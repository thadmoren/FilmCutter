// Can a vision model do what eleven hand-made measurements could not: look at a clip and
// say whether it is football?
//
// This is the one idea with evidence behind it rather than hope. play-labels.json was made
// by a person looking at exactly these three frames and deciding, so the task is known to
// be solvable from this input. The question here is only whether the model does it too,
// and at what cost in plays lost.
//
// Scored the way everything in this project is scored: junk removed against snaps lost,
// never accuracy on its own.
//
//   node judge.js --dry              what it would cost and send, spends nothing
//   node judge.js                    the real run, on all 222 judged clips
//   node judge.js --limit 40         a cheap first look
//   node judge.js --clock            let it read the scoreboard too (see below)
//
// Frames and answers are both cached on disk, so a second run costs nothing and a stopped
// run picks up where it left off.
const fs = require("fs"), path = require("path"), {execFileSync} = require("child_process");
const {z} = require("zod");
const Anthropic = require("@anthropic-ai/sdk").default;
const {zodOutputFormat} = require("@anthropic-ai/sdk/helpers/zod");

const FILM = "/Users/thadmoren/Desktop/Bellevue vs Mount Si/Mount Si vs Bellevue.mp4";
const REPO = "/Users/thadmoren/Documents/FilmCutter";
const SCAN = path.join(__dirname, "..", "pw", "game-men.json");
const FRAMES = path.join(__dirname, "frames");
const CACHE = path.join(__dirname, "judge-answers.json");

const MODEL = "claude-opus-5-5";
const IN_PER_MTOK = 4.00, OUT_PER_MTOK = 20.00;      // Opus 5.5, Anthropic first-party
const PRE = 4, SHOTS = [2, 6, 10];                   // the page's own three frames
const W = 640, CONC = 6;

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const DRY = has("--dry"), CLOCK = has("--clock");
const LIMIT = Number(val("--limit", 0));

/* ---------- what we ask it ------------------------------------------------------- */
// Two prompts, because the answer to "does this travel?" depends on which one works.
// The owner's films will not always carry a live scorebug (CLAUDE.md says the detector may
// never depend on one), so the DEFAULT prompt tells the model to judge from the players and
// warns it the overlay may be absent or frozen. --clock lifts that restriction, and the gap
// between the two scores is how much of the signal is the scoreboard rather than the game.
const SYSTEM_PICTURE = `You are watching American high-school football film shot from a
single fixed camera on the sideline. It is wide: players are small in frame.

You will see three frames from one candidate clip, taken 4 seconds apart. Decide whether a
PLAY FROM SCRIMMAGE happens during them — a snap, including kickoffs, punts and field goals.

A play looks like this: the two teams are arranged in lines facing each other, then over the
following frames that arrangement breaks up — players move downfield, a ball carrier is run
down, bodies end up on the ground or in a pile.

These are NOT plays, and they are what you are mainly being asked to catch:
- a huddle: players gathered in a ring or a loose knot, still gathered in the later frames
- the teams walking up to the line, or standing about, with nothing breaking open
- the camera on the sideline, the bench, the crowd, or a band
- warm-ups, pre-game, halftime, the end of the game
- a replay, a sponsor card, or a black frame

Judge from what the PLAYERS are doing between the frames. There may be a scoreboard overlay
in this film, but it is sometimes frozen and on other films it is absent altogether, so you
must not depend on it. The test is whether the arrangement of players changes the way it does
when a ball is snapped.

Answer only with the structured fields.`;

const SYSTEM_CLOCK = SYSTEM_PICTURE.replace(
  /There may be a scoreboard overlay[\s\S]*?when a ball is snapped\./,
  `You may also read the scoreboard overlay if one is visible: a game clock that ADVANCES
across the three frames means the ball was live, and a frozen clock means it was not.`);

const Answer = z.object({
  play: z.boolean().describe("true if a play from scrimmage happens in these frames"),
  confidence: z.number().describe("0.0 to 1.0, how sure you are"),
  why: z.string().describe("one short sentence, what you actually saw"),
});

/* ---------- the clips ------------------------------------------------------------- */
const G = JSON.parse(fs.readFileSync(SCAN, "utf8"));
const plays = G.plays.map(q => Array.isArray(q) ? {s: q[0], e: q[1]} : q);
const L = JSON.parse(fs.readFileSync(path.join(REPO, "play-labels.json"), "utf8"));
const lab = new Array(plays.length + 1).fill("?");
for (const k of L.P) lab[k] = "P";
for (const k of L.J) lab[k] = "J";
let judged = plays.map((_, i) => i + 1).filter(k => lab[k] !== "?");
if (LIMIT) judged = judged.slice(0, LIMIT);

const shotAt = (p, k) => Math.min(Math.round(p.s + PRE) + SHOTS[k],
                                  Math.max(Math.round(p.s + PRE), Math.round(p.e)));

function framesFor(k) {                       // cut once, keep on disk
  const p = plays[k - 1], out = [];
  fs.mkdirSync(FRAMES, {recursive: true});
  SHOTS.forEach((_, j) => {
    const f = path.join(FRAMES, `${String(k).padStart(3, "0")}-${j}.jpg`);
    if (!fs.existsSync(f))
      execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-ss", String(shotAt(p, j)), "-i", FILM,
        "-frames:v", "1", "-vf", `scale=${W}:-2`, "-q:v", "4", "-y", f], {stdio: "pipe"});
    out.push(f);
  });
  return out;
}

/* ---------- ask ------------------------------------------------------------------- */
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
const tag = CLOCK ? "clock" : "picture";
const client = DRY ? null : new Anthropic();
let inTok = 0, outTok = 0, calls = 0;

async function ask(k) {
  const key = `${tag}:${k}`;
  if (cache[key]) return cache[key];
  const imgs = framesFor(k).map(f => ({
    type: "image",
    source: {type: "base64", media_type: "image/jpeg", data: fs.readFileSync(f).toString("base64")},
  }));
  const r = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: CLOCK ? SYSTEM_CLOCK : SYSTEM_PICTURE,
    output_config: {format: zodOutputFormat(Answer), effort: "low"},
    messages: [{role: "user", content: [...imgs,
      {type: "text", text: "Three frames, 4 seconds apart. Is this a play?"}]}],
  });
  inTok += r.usage.input_tokens; outTok += r.usage.output_tokens; calls++;
  if (r.stop_reason === "refusal")                    // 200 OK, but no answer in it
    throw new Error(`clip ${k}: declined (${r.stop_details && r.stop_details.category})`);
  const a = r.parsed_output;
  if (!a) throw new Error(`clip ${k}: the model's answer did not parse`);
  cache[key] = a;
  if (calls % 10 === 0) {
    fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
    process.stderr.write(`  ${calls} asked, $${cost().toFixed(2)} so far\n`);
  }
  return a;
}
const cost = () => inTok / 1e6 * IN_PER_MTOK + outTok / 1e6 * OUT_PER_MTOK;

async function pool(items, n, fn) {            // n at a time, in order
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({length: n}, async () => {
    while (i < items.length) { const j = i++; out[j] = await fn(items[j]); }
  }));
  return out;
}

/* ---------- score ----------------------------------------------------------------- */
function report(answers) {
  const P = judged.filter(k => lab[k] === "P"), J = judged.filter(k => lab[k] === "J");
  const said = new Map(judged.map((k, i) => [k, answers[i]]));
  const hitP = P.filter(k => said.get(k).play).length;
  const hitJ = J.filter(k => !said.get(k).play).length;
  console.log(`\n=== ${MODEL}, ${tag} prompt, ${judged.length} clips ===`);
  console.log(`snaps it kept : ${hitP} of ${P.length}   (${(100*hitP/P.length).toFixed(0)}%)`);
  console.log(`junk it caught: ${hitJ} of ${J.length}   (${(100*hitJ/J.length).toFixed(0)}%)`);
  console.log(`SNAPS LOST    : ${P.length - hitP}`);
  console.log(`junk per snap lost: ${P.length - hitP ? (hitJ/(P.length-hitP)).toFixed(1) : "— (lossless)"}`);

  // the trade at each confidence bar: only drop a clip the model is sure about
  console.log("\nonly drop junk the model is sure of:");
  console.log("  min conf   junk caught   SNAPS LOST   junk per snap lost");
  for (const c of [0, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]) {
    const drop = k => !said.get(k).play && said.get(k).confidence >= c;
    const gotJ = J.filter(drop).length, lostP = P.filter(drop).length;
    console.log(`  ${c.toFixed(2)}   ${String(gotJ).padStart(11)}   ${String(lostP).padStart(10)}   ` +
      `${(lostP ? (gotJ/lostP).toFixed(1) : "—").padStart(8)}`);
  }
  const wrong = P.filter(k => !said.get(k).play).slice(0, 12);
  if (wrong.length) {
    console.log("\nreal snaps it called junk (the ones that matter):");
    for (const k of wrong) console.log(`  #${k}  conf ${said.get(k).confidence}  ${said.get(k).why}`);
  }
  console.log(`\nspent $${cost().toFixed(2)} on ${calls} calls ` +
    `(${inTok} in, ${outTok} out); ${judged.length - calls} came from cache`);
}

(async () => {
  console.log(`${judged.length} judged clips (${judged.filter(k=>lab[k]==="P").length} snaps, ` +
    `${judged.filter(k=>lab[k]==="J").length} junk), ${tag} prompt, ${MODEL}`);
  const fresh = judged.filter(k => !cache[`${tag}:${k}`]);
  console.log(`${fresh.length} to ask, ${judged.length - fresh.length} already cached`);
  console.log(`rough cost: about $${(fresh.length * 1250 / 1e6 * IN_PER_MTOK +
    fresh.length * 120 / 1e6 * OUT_PER_MTOK).toFixed(2)} at Opus 5.5 rates\n`);
  if (has("--frames")) {          // cut every frame up front; no key needed, nothing sent
    judged.forEach((k, i) => {
      framesFor(k);
      if (i % 25 === 0) process.stderr.write(`  ${i + 1} of ${judged.length}\n`);
    });
    console.log(`frames ready for all ${judged.length} clips in ${FRAMES}`);
    return;
  }
  if (DRY) {
    const k = judged[0];
    console.log(`dry run — nothing sent. First clip #${k} would get these frames:`);
    framesFor(k).forEach(f => console.log(`  ${f}  ${(fs.statSync(f).size/1024).toFixed(0)} KB`));
    console.log(`\nsystem prompt (${(CLOCK ? SYSTEM_CLOCK : SYSTEM_PICTURE).length} chars):\n`);
    console.log(CLOCK ? SYSTEM_CLOCK : SYSTEM_PICTURE);
    return;
  }
  const answers = await pool(judged, CONC, ask);
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
  report(answers);
})().catch(e => {
  try { fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1)); } catch (_) {}
  console.error("FAILED:", e.message); process.exit(1);
});
