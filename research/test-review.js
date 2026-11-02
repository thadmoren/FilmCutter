// The watch-and-judge mode: does it actually play, loop inside the clip, judge, advance,
// and leave the play list right? Driven on the synthetic film so it needs no real game.
//   node review.js
const fs = require("fs"), path = require("path");
const {chromium} = require("playwright-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FILM = path.join(__dirname, "..", "synth8", "game.webm");

(async () => {
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, "s8.json"), "utf8"));
  const sKey = `filmCutter:${path.basename(FILM)}:${fs.statSync(FILM).size}`;
  const browser = await chromium.launch({executablePath: CHROME, headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"]});
  const page = await browser.newPage({viewport: {width: 1280, height: 1000}});
  const errs = []; page.on("pageerror", e => errs.push(e.message));

  await page.goto("http://localhost:5004/");
  await page.evaluate(([k, d]) => localStorage.setItem(k, JSON.stringify(d)), [sKey,
    {motion: G.motion, red: G.red, lum: G.lum, men: G.men, sens: "0.5", plays: [], edited: false, detVer: 5}]);
  await page.reload();
  await page.setInputFiles("#fFile", FILM);
  await page.waitForFunction(() => typeof plays !== "undefined" && plays.length > 0, null, {timeout: 60000});

  // give Claude an opinion on every clip: half of them shaky rejects
  await page.evaluate(() => {
    plays.forEach((p, i) => aiSaid.set(snapAt(p),
      i % 2 === 0 ? {play: false, confidence: 0.70} : {play: true, confidence: 0.95}));
    for (const p of plays) { const a = aiSaid.get(snapAt(p)); if (a && !a.play) p.off = true; }
    edited = true; save(); renderPlays(); renderPick(); countPick();
  });

  const before = await page.evaluate(() => ({
    clips: plays.length, dropped: plays.filter(p => p.off).length,
    ringed: document.querySelectorAll("#fPick figure.doubt").length,
    btn: fRevStart.textContent, btnDisabled: fRevStart.disabled,
  }));
  console.log("before:", before);

  await page.click("#fDoubtOnly");
  console.log("filter on, button says:", await page.evaluate(() => fRevStart.textContent));

  await page.click("#fRevStart");
  await page.waitForTimeout(1200);
  const playing = await page.evaluate(() => ({
    open: !fRev.hidden, num: fRevNum.textContent, why: fRevWhy.textContent,
    paused: fRevVid.paused, t: +fRevVid.currentTime.toFixed(1),
    clipStart: plays[revList[revAt]].s, clipEnd: plays[revList[revAt]].e,
  }));
  console.log("playing:", playing);
  console.log("  inside its own clip:", playing.t >= playing.clipStart - 0.5 && playing.t <= playing.clipEnd);

  // keep this one (it was dropped) — should un-drop it and move on
  const firstIdx = await page.evaluate(() => revList[revAt]);
  await page.click("#fRevKeep");
  await page.waitForTimeout(400);
  const afterKeep = await page.evaluate(i => ({
    thatOneKept: !plays[i].off, num: fRevNum.textContent,
    dropped: plays.filter(p => p.off).length, counter: fPickCount.textContent,
  }), firstIdx);
  console.log("after K:", afterKeep);

  // drop the next one with the keyboard
  const secondIdx = await page.evaluate(() => revList[revAt]);
  await page.keyboard.press("d");
  await page.waitForTimeout(400);
  const afterDrop = await page.evaluate(i => ({
    thatOneDropped: !!plays[i].off, num: fRevNum.textContent,
  }), secondIdx);
  console.log("after D:", afterDrop);

  // the loop: park near the end of the clip and check it jumps back
  await page.evaluate(() => { fRevVid.currentTime = plays[revList[revAt]].e - 0.3; });
  await page.waitForTimeout(1500);
  const looped = await page.evaluate(() => ({
    t: +fRevVid.currentTime.toFixed(1), start: plays[revList[revAt]].s, end: plays[revList[revAt]].e,
  }));
  console.log("loop:", looped, "->", looped.t < looped.end ? "jumped back" : "RAN PAST THE END");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() => ({
    closed: fRev.hidden, paused: fRevVid.paused,
    gridRinged: document.querySelectorAll("#fPick figure.doubt").length,
    counter: fPickCount.textContent,
  }));
  console.log("after Esc:", closed);
  console.log("page errors:", errs.length ? errs.join(" | ") : "none");
  await page.locator("#fPickWrap").screenshot({path: path.join(__dirname, "review.png")}).catch(() => {});
  await browser.close();
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
