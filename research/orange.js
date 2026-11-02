// Can the chain crew's orange down marker be found automatically, and does it move when a
// play happens? The ball was measured to be one of the LEAST conspicuous things in the
// frame (see CLAUDE.md). An orange marker against a dark track should be one of the most.
//
//   node orange.js <startSeconds> <seconds>
const fs = require("fs"), {execFileSync} = require("child_process");
const FILM = "/Users/thadmoren/Desktop/!Outbox/Puyallup vs Bellevue - Boys Varsity Football 09 12 2026 Live On Demand.mp4";
const W = 1280, H = 720;
const start = +process.argv[2] || 6000, span = +process.argv[3] || 60;

// orange: red clearly ahead of green, green clearly ahead of blue, and bright enough.
// The flip-number box is safety orange; grass, crowd and the white overlay all fail this.
const isOrange = (r, g, b) => r > 110 && r - g > 45 && g - b > 10 && r - b > 80;

function blobs(buf) {
  const seen = new Uint8Array(W * H), out = [];
  const ok = i => { const p = i * 3; return isOrange(buf[p], buf[p+1], buf[p+2]); };
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !ok(i)) continue;
    const stack = [i]; seen[i] = 1;
    let n = 0, sx = 0, sy = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
    while (stack.length) {
      const j = stack.pop(), x = j % W, y = (j / W) | 0;
      n++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (!seen[k] && ok(k)) { seen[k] = 1; stack.push(k); }
      }
    }
    if (n >= 12) out.push({n, x: Math.round(sx / n), y: Math.round(sy / n),
                           w: x1 - x0 + 1, h: y1 - y0 + 1});
  }
  return out.sort((a, b) => b.n - a.n);
}

const raw = "/tmp/__orange.raw";
const frames = [];
for (let t = start; t < start + span; t++) {
  execFileSync("ffmpeg", ["-nostdin","-v","error","-ss",String(t),"-i",FILM,
    "-frames:v","1","-pix_fmt","rgb24","-f","rawvideo","-y",raw], {stdio:"pipe"});
  const b = fs.readFileSync(raw);
  const got = blobs(b).filter(q => q.h >= 6 && q.w <= 60 && q.h <= 70);
  frames.push({t, got});
}
fs.rmSync(raw, {force: true});

const hms = t => `${Math.floor(t/60)}m${String(t%60).padStart(2,"0")}s`;
let found = 0;
for (const f of frames) {
  if (f.got.length) found++;
  console.log(`${hms(f.t)}  ${String(f.got.length).padStart(2)} orange  ` +
    f.got.slice(0, 4).map(q => `(x${q.x} y${q.y} ${q.n}px ${q.w}x${q.h})`).join(" "));
}
console.log(`\nframes with at least one orange mark: ${found} of ${frames.length}`);
const biggest = frames.map(f => f.got[0] ? f.got[0].x : null);
console.log("x of the largest mark, second by second:", JSON.stringify(biggest));
