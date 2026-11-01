// A wrong key used to fail all 236 clips in silence and then cut everything, which looks
// exactly like "Claude found nothing". Prove it now stops at once and says why.
//   node badkey.js
const fs = require("fs"), path = require("path");
const {chromium} = require("playwright-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FILM = "/Users/thadmoren/Desktop/Bellevue vs Mount Si/Mount Si vs Bellevue.mp4";

(async () => {
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, "game-men.json"), "utf8"));
  const key = `filmCutter:${path.basename(FILM)}:${fs.statSync(FILM).size}`;
  const browser = await chromium.launch({executablePath: CHROME, headless: true});
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  page.on("pageerror", e => console.log("PAGE ERROR:", e.message));
  page.on("dialog", async d => { console.log("UNEXPECTED DIALOG:", d.message().split("\n")[0]); await d.accept(); });
  await page.goto("http://localhost:5004/");
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => ({ name: "sink", getFileHandle: async () => ({
      createWritable: async () => ({ async write() {}, async close() {} }) }) });
  });
  await page.evaluate(([k, d]) => {
    localStorage.setItem(k, JSON.stringify(d));
    localStorage.setItem("filmCutter:aiKey", "sk-ant-api03-THIS-KEY-IS-NOT-REAL-AT-ALL");
  }, [key, {motion: G.motion, red: G.red, lum: G.lum, men: G.men, plays: [], edited: false, sens: "0.5"}]);
  await page.reload();
  await page.setInputFiles("#fFile", FILM);
  await page.waitForFunction(() => typeof plays !== "undefined" && plays.length > 0, null, {timeout: 120000});
  await page.evaluate(() => { plays = plays.slice(0, 20); renderPick(); countPick(); });

  const t0 = Date.now();
  await page.click("#fExp");
  // it should give up during the AI pass and move on to cutting, not grind through 20 clips
  await page.waitForFunction(() => /couldn't be reached/.test(document.getElementById("fMsg").textContent)
    || /Done:/.test(document.getElementById("fMsg").textContent), null, {timeout: 120000});
  const msg = await page.evaluate(() => document.getElementById("fMsg").textContent);
  const asked = await page.evaluate(() => aiSaid.size);
  console.log(`after ${((Date.now()-t0)/1000).toFixed(0)}s`);
  console.log(`message: ${msg}`);
  console.log(`clips judged (should be 0): ${asked}`);
  console.log(`clips still kept (should be 20): ${await page.evaluate(() => kept().length)}`);
  await browser.close();
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
