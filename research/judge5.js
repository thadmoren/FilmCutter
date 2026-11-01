// Five frames spread across the WHOLE clip, against the same 222 labels as judge.js.
//
// Why: the shipped pass sees snap+2/+6/+10 and nothing later, however long the clip is.
// Measured on this game, 43% of junk clips have more than 10 s that is never looked at,
// against 16% of real snaps — so the model is shown systematically less of the junk. The
// owner's own verdict on what survived a full run ("all the clips that were bad were
// walking off penalties and timeouts") is the same fact from the other end: both of those
// look busiest in the first ten seconds and only give themselves away later, when the ref
// is still pacing off yards or the huddle is STILL there.
//
// So: keep the two early frames (that is where a snap shows) and spread three more across
// whatever is left. Short clips dedupe down to fewer frames and cost less.
//
//   node judge5.js --frames     cut every frame, send nothing, spend nothing
//   node judge5.js --dry        what it would cost
//   node judge5.js              the real run
//
// Answers cache into the same answers.json under a different tag, so the 3-frame baseline
// stays intact and both can be printed side by side.
const fs = require("fs"), path = require("path"), {execFileSync} = require("child_process");
const {z} = require("zod");
const Anthropic = require("@anthropic-ai/sdk").default;
const {zodOutputFormat} = require("@anthropic-ai/sdk/helpers/zod");

const FILM = "/Users/thadmoren/Desktop/Bellevue vs Mount Si/Mount Si vs Bellevue.mp4";
const REPO = "/Users/thadmoren/Documents/FilmCutter";
// the browser scan dump (motion/red/lum/men + the 236 clips); it is too big for the repo,
// so it lives wherever the last scan put it — see CLAUDE.md, "Testing"
const SCAN = [path.join(__dirname, "game-men.json"),
              path.join(__dirname, "..", "pw", "game-men.json"),
              path.join(__dirname, "..", "..", "pw", "game-men.json")].find(fs.existsSync);
const FRAMES = path.join(__dirname, "frames5");
const CACHE = path.join(__dirname, "judge-answers.json");

const MODEL = "claude-opus-5-5";
const IN_PER_MTOK = 4.00, OUT_PER_MTOK = 20.00;
const PRE = 4, W = 640, CONC = 6;
const BUDGET = 3.00;                       // hard stop; the owner approved about this much
const TAG = "spread5";

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const DRY = has("--dry"), LIMIT = Number(val("--limit", 0));

/* ---------- where the frames go --------------------------------------------------- */
// Two anchors where a snap is visible, then three spread over the rest of the clip.
// Deduped and clamped, so a 12 s clip asks about 3 distinct seconds and a 60 s clip
// reaches the end of it.
function secondsFor(p) {
  const snap = Math.round(p.s + PRE), end = Math.max(snap, Math.round(p.e));
  const tail = snap + 10;
  const want = [snap + 2, snap + 6];
  for (let j = 0; j < 3; j++) want.push(Math.round(tail + (end - tail) * (j / 2)));
  return [...new Set(want.map(t => Math.min(Math.max(t, snap), end)))].sort((a, b) => a - b);
}

/* ---------- what we ask it -------------------------------------------------------- */
// Same spine as judge.js's picture prompt — no scoreboard, judge the players — plus the
// two shapes the owner saw survive, and the converse, which matters more than it looks:
// a flag is thrown ON a play often enough that "a penalty is not a play" alone would
// start costing real snaps.
const SYSTEM = `You are watching American high-school football film shot from a single
fixed camera on the sideline. It is wide: players are small in frame.

You will see several frames from one candidate clip, in time order, spread across the whole
clip. Decide whether a PLAY FROM SCRIMMAGE happens during them — a snap, including kickoffs,
punts and field goals.

A play looks like this: the two teams are arranged in lines facing each other, then over the
following frames that arrangement breaks up — players move downfield, a ball carrier is run
down, bodies end up on the ground or in a pile.

These are NOT plays, and they are what you are mainly being asked to catch:
- a huddle: players gathered in a ring or a loose knot, still gathered in the later frames
- the teams walking up to the line, or standing about, with nothing breaking open
- the camera on the sideline, the bench, the crowd, or a band
- warm-ups, pre-game, halftime, the end of the game
- a replay, a sponsor card, or a black frame

Two of these look busy and are the ones most often got wrong:
- a PENALTY being marked off: an official walks the ball up or back along the field while
  players drift after him and regroup. Men are moving all over the frame, but nobody is
  tackled, nothing piles up, and by the later frames the teams are simply standing or
  huddling again.
- a TIMEOUT: the teams drift towards their own sidelines and coaches, or stand about loosely
  in the middle of the field, and in the LATER frames they are still doing it. A huddle
  before a snap breaks up; a timeout huddle does not.

Being busy is not enough. The test is that the players line up facing each other and then
that arrangement breaks.

But if a snap DOES happen in any of these frames, it is a play — even if a flag is thrown,
or a timeout is called, or everyone mills about for the rest of the clip afterwards. The
frames span the whole clip, so dead time at the end is normal and does not make it junk.

Judge from what the PLAYERS are doing between the frames. There may be a scoreboard overlay
in this film, but it is sometimes frozen and on other films it is absent altogether, so you
must not depend on it.

Answer only with the structured fields.`;

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

function framesFor(k) {
  fs.mkdirSync(FRAMES, {recursive: true});
  return secondsFor(plays[k - 1]).map(t => {
    const f = path.join(FRAMES, `${String(k).padStart(3, "0")}-t${t}.jpg`);
    if (!fs.existsSync(f))
      execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-ss", String(t), "-i", FILM,
        "-frames:v", "1", "-vf", `scale=${W}:-2`, "-q:v", "4", "-y", f], {stdio: "pipe"});
    return f;
  });
}

/* ---------- ask ------------------------------------------------------------------- */
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
const client = DRY ? null : new Anthropic();
let inTok = 0, outTok = 0, calls = 0, stopped = false;
const cost = () => inTok / 1e6 * IN_PER_MTOK + outTok / 1e6 * OUT_PER_MTOK;

async function ask(k) {
  const key = `${TAG}:${k}`;
  if (cache[key]) return cache[key];
  if (stopped) return null;
  const files = framesFor(k);
  const imgs = files.map(f => ({
    type: "image",
    source: {type: "base64", media_type: "image/jpeg", data: fs.readFileSync(f).toString("base64")},
  }));
  const r = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    output_config: {format: zodOutputFormat(Answer), effort: "low"},
    messages: [{role: "user", content: [...imgs,
      {type: "text", text: `${files.length} frames in time order, spread across the whole clip. Is this a play?`}]}],
  });
  inTok += r.usage.input_tokens; outTok += r.usage.output_tokens; calls++;
  if (r.stop_reason === "refusal") throw new Error(`clip ${k}: declined`);
  const a = r.parsed_output;
  if (!a) throw new Error(`clip ${k}: answer did not parse`);
  cache[key] = a;
  if (calls % 10 === 0) {
    fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
    process.stderr.write(`  ${calls} asked, $${cost().toFixed(2)} so far\n`);
  }
  if (cost() > BUDGET) { stopped = true; process.stderr.write(`\n!! budget $${BUDGET} reached, stopping\n`); }
  return a;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({length: n}, async () => {
    while (i < items.length) { const j = i++; out[j] = await fn(items[j]); }
  }));
  return out;
}

/* ---------- score ----------------------------------------------------------------- */
function grade(said, label) {
  const P = judged.filter(k => lab[k] === "P" && said.get(k));
  const J = judged.filter(k => lab[k] === "J" && said.get(k));
  console.log(`\n=== ${label} — ${P.length} snaps, ${J.length} junk ===`);
  console.log("  min conf   junk caught   SNAPS LOST   junk per snap lost");
  for (const c of [0, 0.7, 0.8, 0.9, 0.95]) {
    const drop = k => !said.get(k).play && said.get(k).confidence >= c;
    const gotJ = J.filter(drop).length, lostP = P.filter(drop).length;
    console.log(`  ${c.toFixed(2)}   ${String(gotJ).padStart(11)}   ${String(lostP).padStart(10)}   ` +
      `${(lostP ? (gotJ / lostP).toFixed(1) : "— lossless").padStart(10)}`);
  }
  return {P, J};
}

(async () => {
  if (has("--frames")) {
    let n = 0;
    judged.forEach((k, i) => {
      n += framesFor(k).length;
      if (i % 25 === 0) process.stderr.write(`  ${i + 1} of ${judged.length} clips, ${n} frames\n`);
    });
    console.log(`${n} frames ready in ${FRAMES}`);
    return;
  }
  const counts = judged.map(k => secondsFor(plays[k - 1]).length);
  const totalImgs = counts.reduce((a, b) => a + b, 0);
  const fresh = judged.filter(k => !cache[`${TAG}:${k}`]);
  console.log(`${judged.length} judged clips, ${totalImgs} frames ` +
    `(${(totalImgs / judged.length).toFixed(1)} per clip, vs 3 before)`);
  console.log(`${fresh.length} to ask, ${judged.length - fresh.length} cached`);
  const est = fresh.length ? (totalImgs / judged.length * fresh.length * 310 + fresh.length * 420) / 1e6 * IN_PER_MTOK
    + fresh.length * 130 / 1e6 * OUT_PER_MTOK : 0;
  console.log(`rough cost: $${est.toFixed(2)}  (hard stop at $${BUDGET})\n`);
  if (DRY) {
    [judged[0], judged[40], judged[100]].forEach(k => {
      console.log(`clip #${k} (${lab[k]}), ${(plays[k-1].e - plays[k-1].s).toFixed(0)}s long -> seconds ${secondsFor(plays[k-1]).join(", ")}`);
    });
    return;
  }
  const answers = await pool(judged, CONC, async k => {
    try { return await ask(k); } catch (e) { console.error(`  ${e.message}`); return null; }
  });
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));

  const now = new Map(judged.map((k, i) => [k, answers[i]]));
  const before = new Map(judged.map(k => [k, cache[`picture:${k}`]]).filter(([, a]) => a));
  grade(before, "3 frames, old prompt (the baseline, from cache)");
  const {P} = grade(now, "5 frames spread, new prompt");

  const lost = P.filter(k => !now.get(k).play && now.get(k).confidence >= 0.90);
  if (lost.length) {
    console.log("\nreal snaps it would now drop at 0.90 — these are what matter:");
    for (const k of lost) console.log(`  #${k}  conf ${now.get(k).confidence}  ${now.get(k).why}`);
  }
  const newJunk = judged.filter(k => lab[k] === "J" && now.get(k) && before.get(k) &&
    !now.get(k).play && now.get(k).confidence >= 0.90 &&
    !(!before.get(k).play && before.get(k).confidence >= 0.90));
  console.log(`\njunk the 5-frame version catches that the 3-frame one did not: ${newJunk.length}`);
  for (const k of newJunk.slice(0, 15)) console.log(`  #${k}  ${now.get(k).why}`);
  console.log(`\nspent $${cost().toFixed(2)} on ${calls} calls (${inTok} in, ${outTok} out)`);
})();
