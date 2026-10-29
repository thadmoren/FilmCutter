# Film Cutter

Single-file web app (`index.html`): open a game video, find the plays, skip the dead
time, tag plays with formation calls, export a CSV or an ffmpeg clip script. Sister
app to **Formation Drawer** (github.com/thadmoren/FormationDrawer); the owner wants
them to read as one family and may merge them later, so keep the look in step: the
`:root` colour tokens, base styles and header (h1 + `.sub` + `.ver` stamp) are copied
from Formation Drawer's `index.html`. README.md is the human doc; keep it in sync.

## Where it runs

- **Live site**: https://thadmoren.github.io/FilmCutter/ (GitHub Pages off `main`).
  Bump the `.ver` stamp on every push, as in Formation Drawer.
- **Mac**: `serve.command` serves on port 5004 (Formation Drawer uses 5003).

## Formation Drawer link

Diagrams are not re-implemented here. The page loads `../FormationDrawer/` in a
hidden iframe; on the same origin (both on thadmoren.github.io, or both served from
one folder locally) it calls that window's `parseCall()` and `update()` and copies its
`#cv` canvas into `#fDiag`. Off-origin or before it loads, `fd` is null and calls are
plain text with no validation. If Formation Drawer renames `parseCall`, `update`,
`#call` or `#cv`, this breaks quietly; check both when either changes.

## Detection

**Find plays** *seeks* every `STEP` (1 s), grabs a 96×54 grayscale frame, and stores the
per-mille of pixels whose luma moved >18 in `motion[]`, the corner redness in `red[]`
and the frame's mean brightness in `lum[]`. The grab canvas sets
`imageSmoothingQuality = "high"`: shrinking 1920×1440 to 96×54 the cheap way samples a
few source pixels per cell, so a camera that barely moves lands on different grass and
the score doubles — on the real film the default halved the usable signal
(median score 158 against 65 for a proper box filter). `detect()` = median-of-3 (kills camera-cut
spikes) → 3-sample average → a threshold between the median and the 95th percentile **of
the `BASE` 90 s either side**, not of the whole film, set by the Sensitivity slider.
The baseline has to be local: a camera sitting still and a camera panning and zooming to
follow the ball put wildly different amounts of movement on screen, one film has both,
and with a single level the busy stretches set the bar and every play in the quiet ones
is lost. (It is worked out every fifth sample and held in between; it moves slowly.)

A play is then a **plateau, not a spike**: seed where smoothed motion clears the
threshold, grow out while it stays above `HOLD` (0.7) of the way from baseline to
threshold, and keep it only if it holds at half its own peak for `span` seconds
(`7.5 − sens×5`, so 5 at the default). That last test is what tells a play from the
camera re-framing between plays, which reaches the same height and dies inside 3–4 s.
On a real NFHS half (a phone recording of the stream, 1440×1920 with the picture
letterboxed inside it) this took the clips that cover no live ball at all from 12 of 36
down to 5 of 23, and the clips that ran over a replay from 11 to 0. There is no
gap-merging — growing while the motion stays up does that job, and only when the
action genuinely never stopped.

Each play then starts at the break of the huddle: from the snap, skip ≤ 4 s of still
(the set), then walk back through motion above `walk` (a quarter of the way from the
local baseline to the threshold) until 2 s of still (the huddle), bounded by the
previous play's end and `HUDDLE_MAX` 20 s; no walk-up → `PRE` 2 s before the snap.
Ends `POST` 5 s after.

**Replays**: `red[i]` is the per-mille of bright-red pixels in the top-right corner
(right 25 %, top 25 %), for the NFHS "replay" badge. A sample is replay when it is > 10
above the game's median (so always-red seats or scoreboards don't count), median-of-3.
**Black screens**: a sample whose `lum[i]` is under half the film's median brightness
(capped at 40) is black — the sponsor card either side of an NFHS replay, or an ad
break. A fixed level would call a whole night game black, which is why it is relative.
Replay seconds, black seconds and the second after a black one (whose motion is only the
cut back to the picture) are all breaks: never action, no play grows across one, the
huddle walk-back stops at one, and the 5 s tail is cut where one starts.

Plays are `{s, e, call}` in seconds; everything persists in localStorage under
`filmCutter:<name>:<size>`, and a stopped scan resumes from `done()` — the shortest of
`motion`/`red`/`lum`, so a scan saved before brightness was recorded is simply taken
again. **Don't switch the scan to fast-forward playback**: at 8–16× browsers skip and
repeat frames, which jittered edges by seconds and dropped whole plays in testing;
seeking is exact.

The page is two steps (Choose game video, **Cut into clips**) plus a closed
`<details id="fMore">` holding the review tools: Find plays, Sensitivity, the video,
timeline, play list with calls, CSV and Mac script. The owner wants the two-step flow
up front; keep the extras folded away. Under step 2, `#fNum` / `#fStart` choose clip
names (`clipName`): `play-NNN` counting from the start number, or unnumbered
`play-at-0h12m05s`; saved in localStorage under `filmCutter:names`.

**Cut into clips** (`exportClips`) runs ffmpeg.wasm from `vendor/` (see
`vendor/README.md`): the game `File` is mounted with WORKERFS so ffmpeg reads slices on
demand (verified on a 2.8 GB mp4, cutting past the 2 GB mark), and each play is a
stream copy (`-ss` before `-i`, `-c copy`, `-avoid_negative_ts make_zero`), so a clip
starts on the keyframe at or before its start. Clips keep the source container and drop audio (`-an`; the owner doesn't want it). Output
goes to a `showDirectoryPicker` folder where it exists, else one download per clip. On an
unscanned film it asks for the folder first (needs the tap), then awaits `scan()` (which
resolves true when the film is fully scanned), then exports: one tap per game.
It is vendored, not CDN-loaded, because `FFmpeg` starts a module worker from its own
URL and browsers refuse a cross-origin worker. Needs http(s), not `file://`. To test
the folder path headlessly, stub `showDirectoryPicker` with `navigator.storage.getDirectory()`.

"Mac clip script" writes a bash script of ffmpeg cuts (re-encoded so starts are
frame-accurate) plus a concat into one condensed game.

## Testing

Headless Chromium (Playwright, `/opt/pw-browsers/chromium`) has no H.264, so test
with a synthetic WebM: static noisy frames for dead time, `testsrc2` for plays, joined
with ffmpeg's concat demuxer. To test diagrams, serve a folder holding both
`FormationDrawer/` and `FilmCutter/` over http, not `file://`.

To test on **real film** instead, drive the user's own Chrome (it has H.264):
`playwright-core` with `executablePath` set to Google Chrome, `setInputFiles` on
`#fFile` with the .mp4 and `page.evaluate(() => scan())`. A 28-minute film takes a few
minutes, and dumping `motion`/`red`/`lum` out of the page afterwards lets every later
try run in seconds: lift `detect()` straight out of `index.html` with `new Function`
and feed it those arrays, so it is the real code being tested, not a copy.
**Tune on samples the browser took, not on ffmpeg frames.** ffmpeg
(`fps=1,scale=96:54:flags=area`, plus the top-right quarter at 48×27 for redness) is
fine for a first look and is far faster, but its box filter is cleaner than canvas:
thresholds set on it did not hold in the page.
