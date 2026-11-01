// Prove the ffmpeg restart works: cut enough clips to cross the FF_RECYCLE boundary and
// check every one lands. The old code died at ~120 clips with "memory access out of
// bounds"; a run that crosses 40 exercises the same path cheaply.
//   node cut.js [clips]
const fs = require("fs"), path = require("path");
const {chromium} = require("playwright-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FILM = "/Users/thadmoren/Desktop/Bellevue vs Mount Si/Mount Si vs Bellevue.mp4";
const N = Number(process.argv[2] || 45);

(async () => {
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, "game-men.json"), "utf8"));
  const key = `filmCutter:${path.basename(FILM)}:${fs.statSync(FILM).size}`;
  const browser = await chromium.launch({executablePath: CHROME, headless: true});
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  page.on("pageerror", e => console.log("PAGE ERROR:", e.message));
  page.on("dialog", async d => { console.log(`dialog: ${d.message().split("\n")[0]}`); await d.accept(); });

  await page.goto("http://localhost:5004/");
  // A real folder needs a user gesture, and the origin private file system runs out of
  // quota around 500 MB — which is the TEST's limit, not the app's. What is under test is
  // whether ffmpeg survives a whole game, so hand the page a folder that records each
  // clip's name and size and throws the bytes away.
  await page.addInitScript(() => {
    window.__written = [];
    window.showDirectoryPicker = async () => ({
      name: "sink",
      getFileHandle: async (n) => ({
        createWritable: async () => ({
          async write(d) { window.__written.push({n, size: d.length || d.byteLength || 0}); },
          async close() {},
        }),
      }),
    });
  });
  await page.evaluate(([k, d]) => localStorage.setItem(k, JSON.stringify(d)),
    [key, {motion: G.motion, red: G.red, lum: G.lum, men: G.men, plays: [], edited: false, sens: "0.5"}]);
  await page.reload();
  await page.setInputFiles("#fFile", FILM);
  await page.waitForFunction(() => typeof plays !== "undefined" && plays.length > 0, null, {timeout: 120000});
  await page.evaluate(n => { plays = plays.slice(0, n); renderPick(); countPick(); }, N);
  console.log(`cutting ${await page.evaluate(() => kept().length)} clips (FF_RECYCLE boundary at 40)`);

  const t0 = Date.now();
  const restarts = [];
  page.on("console", m => { const t = m.text(); if (t.includes("Restarting")) restarts.push(t); });
  await page.evaluate(() => { window.__msgs = []; const s = window.say;
    window.say = m => { window.__msgs.push(m); return s(m); }; });
  await page.click("#fExp");
  await page.waitForFunction(() => {
    const m = document.getElementById("fMsg").textContent;
    return m.startsWith("Done:") || m.includes("failed") || m.startsWith("Stopped");
  }, null, {timeout: 900000});

  const msg = await page.evaluate(() => document.getElementById("fMsg").textContent);
  const msgs = await page.evaluate(() => window.__msgs);
  console.log(`\n${msg}`);
  console.log(`took ${((Date.now()-t0)/1000).toFixed(0)}s`);
  const restartMsgs = msgs.filter(m => m.includes("Restarting"));
  console.log(`emergency restarts (should be 0): ${restartMsgs.length}` +
    (restartMsgs.length ? "\n  " + restartMsgs.join("\n  ") : ""));

  const files = await page.evaluate(() => window.__written);
  console.log(`\nfiles written: ${files.length} of ${N}`);
  console.log(`empty or tiny (<100 KB): ${files.filter(f => f.size < 100000).map(f => f.n).join(", ") || "none"}`);
  console.log(`total ${(files.reduce((a, f) => a + f.size, 0) / 1e6).toFixed(0)} MB`);
  console.log(`first: ${files[0] && files[0].n} ${(files[0] && files[0].size/1e6).toFixed(1)} MB`);
  console.log(`last : ${files.at(-1) && files.at(-1).n} ${(files.at(-1) && files.at(-1).size/1e6).toFixed(1)} MB`);
  await browser.close();
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
