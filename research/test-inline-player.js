// Clicking a tile's play button must open the player BESIDE the grid, mark that tile, and
// not scroll the page away from where he was. "It scrolls down and then I can't remember
// what clip I clicked."
//   node inline.js
const fs = require("fs"), path = require("path");
const {chromium} = require("playwright-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FILM = path.join(__dirname, "..", "synth8", "game.webm");

(async () => {
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, "s8.json"), "utf8"));
  const sKey = `filmCutter:${path.basename(FILM)}:${fs.statSync(FILM).size}`;
  const browser = await chromium.launch({executablePath: CHROME, headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"]});
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errs = []; page.on("pageerror", e => errs.push(e.message));

  await page.goto("http://localhost:5004/");
  await page.evaluate(([k, d]) => localStorage.setItem(k, JSON.stringify(d)), [sKey,
    {motion: G.motion, red: G.red, lum: G.lum, men: G.men, sens: "0.5", plays: [], edited: false, detVer: 6}]);
  await page.reload();
  await page.setInputFiles("#fFile", FILM);
  await page.waitForFunction(() => typeof plays !== "undefined" && plays.length > 0, null, {timeout: 60000});
  await page.waitForTimeout(3000);               // let some thumbnails land

  const scrollBefore = await page.evaluate(() => window.scrollY);
  // click the play button on the 6th tile
  await page.click('#fPick figure[data-i="5"] button.go');
  await page.waitForTimeout(1200);

  const after = await page.evaluate(() => ({
    playerOpen: !fRev.hidden,
    paused: fRevVid.paused,
    t: +fRevVid.currentTime.toFixed(1),
    clipStart: plays[revList[revAt]].s,
    clipEnd: plays[revList[revAt]].e,
    whichClip: revList[revAt],
    caption: fRevNum.textContent,
    markedTiles: [...document.querySelectorAll("#fPick figure.playing")].map(f => f.dataset.i),
    pageScroll: window.scrollY,
    sideBySide: (() => {
      const r = fRev.getBoundingClientRect(), g = fPick.getBoundingClientRect();
      return {playerRight: Math.round(r.right), gridLeft: Math.round(g.left),
              beside: r.right <= g.left + 5, sameRow: Math.abs(r.top - g.top) < 40};
    })(),
  }));
  console.log("after clicking tile 6's play button:");
  console.log("  player open:", after.playerOpen, "| playing:", !after.paused,
              "| at", after.t, "inside", after.clipStart + "-" + after.clipEnd);
  console.log("  clip:", after.whichClip, "| caption:", after.caption);
  console.log("  tile marked:", after.markedTiles, "(want ['5'])");
  console.log("  page scrolled:", scrollBefore, "->", after.pageScroll,
              after.pageScroll === scrollBefore ? "(stayed put)" : "(MOVED)");
  console.log("  layout:", after.sideBySide);

  // arrows should walk to the neighbour
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  const moved = await page.evaluate(() => ({
    clip: revList[revAt], marked: [...document.querySelectorAll("#fPick figure.playing")].map(f => f.dataset.i),
  }));
  console.log("  after →:", moved, "(want clip 6, tile '6')");

  await page.locator("#fPickWrap").screenshot({path: path.join(__dirname, "inline.png")}).catch(() => {});
  console.log("page errors:", errs.length ? errs.join(" | ") : "none");
  await browser.close();
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
