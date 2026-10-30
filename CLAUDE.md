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
test does the work three earlier attempts could not. A kickoff is no different, by the
way — it is 10–14 s like any other play; what is long is the replay that follows it.

Its span is measured down to `lo`, the local lull, **not** to the higher of its own two
shoulders. A play that runs straight into something else — a kickoff with the replay cut
in on top of it — never gets back down on that side, so its shoulder sits high and
measuring to it made a real play look seconds long and lost it.

**A replay or black second reads as the lull**, both when picking out high points (`mv`)
and when walking out to the shoulders. Without that, the director cutting a replay on
top of a play — which is to say on top of the best plays in the game — leaves it with no
quiet on that side at all: it scores no prominence, and the peak often lands on the
cut itself so it is not even seen as a high point. That alone was losing the play at
18:35 on the NFHS half, a long run with the replay cut straight in after it.

The clip then backs up to the **foot** of the bump — where the motion first rose `FOOT`
(0.12) of the way to the peak, at most `FOOT_MAX` 8 s — before `PRE` is applied. A play
that builds to a big peak is well under way by the time it reaches the level its length
was measured at, and PRE from there started the clip after the ball had gone.

A "has it settled first?" test was tried here — the teams huddle before a play and a
camera sweeping an empty field does not — and **removed**: it threw out a real snap
(13:57 on the NFHS half, where the teams were still walking up 8 s before) to save about
nine points of dead-time coverage. Not worth a play.

Earlier versions used one motion threshold for the whole film, or asked a play to hold a
plateau. On NFHS film those found 21 plays in a half when there were nearer 45: a camera
pan in dead time reaches the same height as a play, so a threshold set high enough to
reject the pans rejected every quiet play too — and quiet is what a snap looks like with
the camera parked and the players small in frame. Judge by the clock: the clips should
land about one per 20–30 s of live football, and a short list means plays are being
missed, not that the list is tidy.

A clip is then `PRE` 4 s before the foot of the bump to `POST` 5 s after its end, never
starting before the previous play's clip ended. That lands 6–8 s before the snap on real
film (the owner's words: "snap backwards 5 seconds is great"). Two clips join only on
genuine overlap: one that merely backs up to where the last one ended is the next play,
not more of the last one.

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

## Picking the plays by eye

**On a whole game the finder still hands back more clips than there are plays.** A
3 h 19 m NFHS recording gives 236 (340 before clips that run into each other were
joined — see `JOIN`);
a game has 120–140 plays. Sampling by hand: about half of the original 340 were
football, the rest pre-game, the halftime crowd, sidelines and dead time. After joining,
clip spacing during live play peaks at 40–50 s — about right for football. A count here once claimed, from the scoreboard, that only 20 of the 236 were outside the
game. **That count was wrong, because the NFHS scorebug is not always live**: at 1h21m
it reads "2nd 09:48" over a shot of the team running out through a banner. Judged from
the pictures instead, there is a solid block of halftime (roughly 1h15m–1h32m, banners
and the teams lined up along the touchline) and a post-game block after about 2h51m.
The rest are inside live football: the camera on the crowd or the sideline, huddles,
timeouts and the milling about at the end of a quarter.

Lowering the default does **not** help: the 99 clips the default adds over Sensitivity
0.25 were sampled and are only about 70 % junk, so dropping them would cost real plays.

Five ways to tell a play from the camera wandering were tried and **measured against
plays timed by hand, and every one of them overlaps**: motion left after cancelling the
camera's own movement (best-fit slide, ±4 cells), how widely the change is spread across
the frame, whether the picture settled first, whereabouts in the frame it moved, and
reading the NFHS scoreboard. The scoreboard came closest — during play it shows a down
and distance, at halftime that goes blank and before kickoff the box isn't there — but
NFHS alternates **two different overlay layouts within one game** (a wide bar across the
bottom and a compact box bottom-right), both of which stay on screen showing nothing
during halftime, so "is the overlay there" is useless and reading it means handling both
layouts. Don't repeat these; the evidence is in the session, not in the code.

## Counting the men on the grass

**The one thing that does separate football from the camera wandering.** `men[i]` is how
many man-sized lumps of not-grass are standing *in* grass at `i*STEP`, from a 320×180
colour frame (`onField()`): grass is green beating red and blue, a lump is 5–150 joined
pixels no more than 24 across and not long and thin (which drops the painted yard
lines), and it counts only if `MEN_TURF` 0.55 of a ±14 px box around it is turf. That
last test is what does the work: the crowd in the stands and the team packed along the
near touchline are lumps too, and without it sideline shots sail through — it took the
junk caught from 5 of 14 to 8 of 14 with no play lost.

A clip's count at the snap is compared with the median across the film's own clips —
relative, like everything else here — and **a clip is only set aside as part of a run of
`MEN_RUN` (3) in a row** below `MEN_FRAC` (0.65) of that median. The run is what makes
it safe. Judged one clip at a time, the page picked off real snaps in the middle of live
football (#94, #97, #162 on the game) for a cut that was lossless on ffmpeg frames; a
lone quiet clip is as likely to be a quiet play as anything else, but three in a row is
halftime. It is skipped entirely when the median is under `MEN_MIN` 12, which is a film
that never shows a field full of players: the synthetic test films score zero and keep
all 10 plays, as they must.

On the 3 h 19 m game this sets aside **27 of 236 clips — 236 down to 209 — losing none of
32 plays labelled by eye, at every point on the Sensitivity slider**. What it removes,
checked frame by frame, is the halftime block (#103–#122, 1h17m–1h32m: the banner, the
crowd on the pitch, the teams lined up) and the end of the game (#226–#233, 2h55m–3h02m:
the empty field, then Bellevue running to their fans in a mass with the home crowd
already on the pitch). Clips are set `off`, not deleted, so "Keep all" brings them back.

**Tune this on samples the browser took.** On ffmpeg frames the same idea scored 36
clips with nothing lost; the page, scanning the same film, set aside 30 and took a real
play with them. The relative cut travels better than an absolute one but it does not
travel perfectly. `scratchpad/pw/men.js` dumps a browser scan including `men`, and
`final2.js` replays the page's own `detect()` over it across the slider.

**It needs 320×180 colour, not the 96×54 grey the motion uses.** At 96×54 a player is a
pixel or two and there is nothing to count. This is why adding it forces a rescan:
`done()` includes `men.length`.

**"The offence is set for a second before the snap" does not survive contact with the
picture**, and it is the first thing anyone thinks of, so here is how far it was taken.
At one sample a second, stillness before the stir drops real plays as fast as it drops
junk: of twelve clips judged by eye either side of the cut, seven of the rejects were
live football with the clock running. Sampling the eight seconds before each candidate
at **8 frames a second** doesn't rescue it (stillest second: plays 1–23, junk 1–13), and
nor does **cancelling the camera's movement first** and measuring only the players, at
192×108 with a ±6 px best-fit slide (plays 4–41, junk 5–32). The reason it can't work is
structural, not a matter of resolution or thresholds: a still picture before a snap is
the same still picture as the camera parked between plays, a banner, or an empty field —
the stillest clip in the whole sample is the team running out through a banner — while
plenty of real snaps are filmed by an operator still re-framing, so they never freeze at
all. The best cut found loses about a quarter of the plays to remove about 60 % of the
junk, which is the trade that got the old "settled first" rule deleted.

**The shape of the camera's track** — following a ball carrier should be a steady pan
one way, swinging to the crowd an out-and-back — was measured too, as net displacement
over distance travelled across the ten seconds from the stir, at 8 frames a second.
Plays 0.05–1.00, junk 0.03–1.00. It fails for a reason worth knowing: on this film the
camera is wide and nearly locked, so most tracks are **all zeros** and there is no shape
to read. Expect that of fixed-camera film generally.

**Three more that looked good on the game and were not.** *Dropping clips over 35 s*
is lossless on the game's labelled plays and removes 5 of 14 junk — and loses **2 of
the old film's 13 hand-timed snaps**, because `JOIN` merges a play with whatever ran
into it, so a long clip often has a real play inside. Any safe threshold (>45 s) catches
one junk clip and is not worth having. *Dropping clips that butt up against the one
before* (<8 s gap) costs a play for 5 junk. *How spread out the lumps are* is no signal
at all — the obvious way to tell a huddle from a formation, and it fails twice over:
plays 64–108 against junk 60–116 with every lump counted, and plays 69–101 against
huddles and sideline shots 61–104 counting only the men on turf. There are always other
players, officials and the far touchline scattered about, so nothing is ever tightly
bunched. Always regression-test against the old film's
hand-timed snaps before believing a rule that looks lossless on one game.

**Two things the detector may never rely on**, because the owner's films won't always
have them: the **scorebug** (it may be absent, or present but not live) and the
**audio** (it may be missing). Anything built on either is dead on arrival, whatever it
scores on this one film.

**Clips that run into each other are one piece of film.** Real plays sit 25–40 s apart,
so a clip butting up against the one before is a single stretch of action chopped in
half — 123 of the first 340 were. `JOIN` (0 s of slack) glues them back; more slack
chains clips into 160 s monsters, so do not raise it. This took the game from 340 to
236 and the old half from 47 to 36 without losing a single hand-timed snap.

The owner still gets the last word on what is left. After the finder runs, `#fPick` shows **one thumbnail
per play, taken `PRE` seconds in — where the ball goes** — and clicking one drops it.
Dropped plays keep a `p.off` flag: they stay in the list and in storage (nothing is
lost, "Keep all" puts them back) but `kept()` skips them, so they are left out of the
clips, the CSV, the Mac script and the numbering, and the Cut button counts what is
left. Thumbnails are fetched by seeking, cached by second in `thumbs`, and so a move of
the Sensitivity slider only fetches the plays that are new; 340 of them take about half
a minute. They are **not** persisted — on a reload the grid draws placeholders and
fills them again. `thumbRun` cancels a fill when a scan takes the video over.

The page is two steps (Choose game video, **Cut into clips**) plus the picker, plus a
closed `<details id="fMore">` holding the review tools: Find plays, Sensitivity, the video,
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
