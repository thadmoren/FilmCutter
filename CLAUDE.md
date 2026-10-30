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
spikes) → 3-sample average → **bumps**.

A play is a bump: the picture stirs and then settles again. What is measured is how far
it rises clear of the lulls either side of it — its prominence — not how high it
reaches. That matters because a snap in front of a parked camera barely moves the
picture while a snap the camera chases moves all of it, and both are plays; by
prominence they score alike. The size worth noticing is local: `lo` (20th percentile)
and `hi` (90th) over `BASE` 30 s either side, with a floor at 12 % of the whole film's
range so ripples on a still film don't qualify. A bump counts when its prominence
clears `need × scale`, `need` running from `PROM_LO` 0.45 down to `PROM_HI` 0.15 across
the Sensitivity slider.

**How long the bump lasts is what tells a play from everything else.** The same stretch
of film throws up a bump every 4–8 s all game — the teams gathering, the huddle
breaking, the walk up to the line, the camera re-framing between plays — and they are
all 3–5 s long. The snap is the long one: the play, the tackle and everybody getting up
runs 8–14 s. Measured on NFHS film, every play checked by eye came out 8–14 s and every
walk-up and camera sweep 3–5 s, with nothing in between. So a bump is a play when it
lasts `minPlay` seconds, `PLAY_LO` 6 down to `PLAY_HI` 4 across the slider. That one
test does the work three earlier attempts could not.

Its span is measured down to `lo`, the local lull, **not** to the higher of its own two
shoulders: a kickoff return keeps the picture moving for half a minute, so its shoulders
sit high and measuring to them made the longest play of the game look like the shortest
and lost it. A play must also have settled within `SETTLE` 8 s before it — below `QUIET`
× the film's 15th percentile — because the teams huddle or at least stand at the line
first, and a camera sweeping an empty field never does.

Earlier versions used one motion threshold for the whole film, or asked a play to hold a
plateau. On NFHS film those found 21 plays in a half when there were nearer 40: a camera
pan in dead time reaches the same height as a play, so a threshold set high enough to
reject the pans rejected every quiet play too — and quiet is what a snap looks like with
the camera parked and the players small in frame. Judge by the clock: the clips should
land about one per 20–30 s of live football, and a short list means plays are being
missed, not that the list is tidy.

A clip is then `PRE` 5 s before the bump (the owner's words: "snap backwards 5 seconds
is great" — the bump starts within a second or two of the snap) to `POST` 5 s after it,
never starting before the previous play's clip ended. Two clips join only on genuine
overlap: one that merely backs up to where the last one ended is the next play, not more
of the last one.

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
