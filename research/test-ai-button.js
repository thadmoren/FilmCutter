// Drive the real page's "Sharpen with AI" button on the real film, in the user's own
// Chrome. The saved scan is pushed into localStorage so it restores 236 plays without a
// rescan, the key is pre-seeded so no prompt appears, and the play list is cut to a dozen
// so the test costs about 20 cents. Everything after that is the page's own code.
//   node ai.js [howManyClips]
const fs = require("fs"), path = require("path");
const {chromium} = require("playwright-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FILM = "/Users/thadmoren/Desktop/Bellevue vs Mount Si/Mount Si vs Bellevue.mp4";
const N = Number(process.argv[2] || 12);
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("no key in env"); process.exit(1); }

(async () => {
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, "game-men.json"), "utf8"));
  const key = `filmCutter:${path.basename(FILM)}:${fs.statSync(FILM).size}`;
  const browser = await chromium.launch({executablePath: CHROME, headless: false});
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  page.on("pageerror", e => console.log("PAGE ERROR:", e.message));
  page.on("console", m => { if (m.type() === "error" && !m.text().includes("404")) console.log("console:", m.text()); });
  // the page asks before spending money; say yes, and never let a prompt() block
  page.on("dialog", async d => { console.log(`dialog [${d.type()}]: ${d.message().split("\n")[0]}`); await d.accept(); });

  await page.goto("http://localhost:5004/");
  await page.evaluate(([k, d, ak]) => {
    localStorage.setItem(k, JSON.stringify(d));
    localStorage.setItem("filmCutter:aiKey", ak);
  }, [key, {motion: G.motion, red: G.red, lum: G.lum, men: G.men, plays: [], edited: false, sens: "0.5"}, KEY]);
  await page.reload();
  await page.setInputFiles("#fFile", FILM);
  await page.waitForFunction(() => typeof plays !== "undefined" && plays.length > 0, null, {timeout: 120000});
  console.log(`restored ${await page.evaluate(() => plays.length)} plays`);

  await page.evaluate(n => { plays = plays.slice(0, n); renderPick(); }, N);
  const before = await page.evaluate(() => kept().length);
  console.log(`cut to ${N} clips, ${before} kept before the AI pass`);

  await page.click("#fAI");
  await page.waitForFunction(() => typeof aiRun !== "undefined" && aiRun === 0 &&
    document.getElementById("fAI").textContent === "Sharpen with AI", null, {timeout: 300000});
  await page.waitForTimeout(1500);

  const out = await page.evaluate(() => ({
    said: [...aiSaid.entries()].map(([t, a]) => ({t, play: a.play, conf: a.confidence})),
    kept: kept().length,
    off: plays.filter(p => p.off).length,
    msg: document.getElementById("fMsg").textContent,
    btn: document.getElementById("fAI").textContent,
    dimmed: document.querySelectorAll("#fPick figure.off").length,
  }));
  console.log(`\nanswers: ${out.said.length}`);
  out.said.forEach(s => console.log(`  t=${s.t}s  ${s.play ? "PLAY" : "junk"}  conf ${s.conf}`));
  console.log(`\nkept ${out.kept} of ${N}, set aside ${out.off}, tiles dimmed ${out.dimmed}`);
  console.log(`button back to: "${out.btn}"`);
  console.log(`message: ${out.msg}`);

  // "Keep all" must bring everything back
  await page.click("#fPickAll");
  console.log(`after Keep all: ${await page.evaluate(() => kept().length)} kept`);
  await page.locator("#fPick").screenshot({path: path.join(__dirname, "ai-pick.png")});
  await browser.close();
  console.log("done");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
