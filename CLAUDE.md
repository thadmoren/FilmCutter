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

**Find plays** *seeks* every `STEP` (1 s), grabs a 96×54 grayscale frame, and stores
the per-mille of pixels whose luma moved >18 in `motion[]`. `detect()` = median-of-3
(kills camera-cut spikes) → 3-sample average → threshold between the median and 97th
percentile set by the Sensitivity slider → merge gaps < 4 s, drop < 3 s, pad
`PRE`/`POST` 2 s. Plays are `{s, e, call}` in seconds; everything persists in
localStorage under `filmCutter:<name>:<size>`, and a stopped scan resumes from
`motion.length`. **Don't switch the scan to fast-forward playback**: at 8–16× browsers
skip and repeat frames, which jittered edges by seconds and dropped whole plays in
testing; seeking is exact.

**Export clips** (`exportClips`) runs ffmpeg.wasm from `vendor/` (see
`vendor/README.md`): the game `File` is mounted with WORKERFS so ffmpeg reads slices on
demand (verified on a 2.8 GB mp4, cutting past the 2 GB mark), and each play is a
stream copy (`-ss` before `-i`, `-c copy`, `-avoid_negative_ts make_zero`), so a clip
starts on the keyframe at or before its start. Clips keep the source container. Output
goes to a `showDirectoryPicker` folder where it exists, else one download per clip.
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
