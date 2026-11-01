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

## What is left over, labelled properly

Everything above was measured against clips labelled from **one** frame each. That is
not enough to judge by, and the owner said so before the evidence did: shown the
picker, he answered "I'm not sure I could tell from thumbnails". He is right. Labelling
needs **three frames across the clip** (snap+2, +6, +10 — `scratchpad/ingame.js` builds
the sheets); at one frame a huddle and a snap look the same. Clip #129 of the game was
labelled a play from one frame and is, in three, players walking about with the clock
frozen. Treat any single-frame label here as a coin toss, this file's own included.

Labelled that way, **36 consecutive clips from the middle of the second half (#123–#158,
1h32m–2h00m) came out 17 snaps, 13 not football, and 6 that three frames still could not
settle.** The 13 are halftime warm-up lines that run on past the head-count block,
huddles, the camera on the near bench, players milling with the clock stopped, and one
replay tail. That ratio — a bit under half the clips in live football are not snaps —
is the leftover the head count cannot reach, and this is the first set of labels good
enough to measure against.

**Three more ideas died against it.**

*The rhythm of the game.* The intuition is strong: football comes round every 25–40 s,
so a clip arriving too soon after a play is suspect, and the whole film should be fitted
as a sequence rather than 236 separate guesses. **There is no rhythm to fit.** Between
labelled snaps the real interval runs **17 s to 298 s** (median 58) — hurry-up at one end,
timeout plus change of possession at the other. Gap back to the previous clip: snaps
17–64 s, junk 13–105 s, and the junk's median is the *higher* of the two, because huddles
and sideline shots happen in the long dead stretches. Suppressing a clip that arrives
within T of the last kept one buys 4 junk for 1 snap at T=25 and 5 for 1 at T=30 — the
same bad trade the <8 s gap rule was rejected for.

*How far the head count dips inside the clip.* Real promise here, and it is the one to
pick up again if anything is: a snap ends in a pile, the lumps merge, and the count
falls to **zero in 12 of the 17 snaps but only 1 of the 13 junk clips** — and that one is
the replay tail of a real play. But the converse is not safe. Dropping clips whose count
never reaches zero costs 5 of 17 snaps to catch 12 of 13 junk; at any threshold the
trade sits near **3 junk for every snap lost**, worse than rules already rejected.
Combining it with peak motion does not improve it: the two interleave completely.

*How hard the picture moves at the peak of the clip.* On the game it looks like the
answer — snaps peak at 303–952 (median 854), junk at 35–912 (median 405) — and a cut at
0.7 of the film's median peak loses none of the 17 snaps while dropping 49 of 236 clips.
**It fails the old film outright**: the same relative cut loses **3 of the 12 findable
hand-timed snaps**, 4 at 0.8. The reason is written higher up this file — a snap in front
of a parked camera barely moves the picture. On the old film real snaps sit at 0.61–2.64
of the median peak, so half of them are *below* it. Any absolute height test, however it
is normalised, kills the quiet plays. Do not try this again.

**Where that leaves it.** Eleven hand-made measurements have now been tried and measured
against labels, and the only one that works is the head count, which reaches halftime and
the end of the game and nothing inside it. The pattern is the finding: "is this
football?" does not fit in a few numbers chosen by hand.

## All 236 clips, labelled — and the model that was fitted to them

`play-labels.json` in this folder is **every clip of the 3 h 19 m game judged three
frames at a time**: 125 snaps, 97 not football, 14 that three frames could not settle.
It is the most expensive thing in this project — an hour of reading contact sheets — and
it cannot be regenerated without the film (`~/Desktop/Bellevue vs Mount Si/`), so do not
delete it. Clip numbers index the 236-clip list at Sensitivity 0.5. `scratchpad/sheets.js`
rebuilds the sheets; the per-batch files record *why* each call was made.

Labelling got much firmer once the NFHS overlay was read **by the labeller, never by the
detector**: a clock that advances across the three frames is a snap, a frozen one is not,
and a distance that grows while the clock sits still is a pre-snap penalty (#58, #84,
#168 are all flags, not plays). This also caught the commonest shape of junk — a clip
holding at a frozen clock immediately before the clip that is the actual snap (#85 then
#86, #172 then #173, #189 then #190, #199 then #200).

**A 15-feature logistic regression over those labels does not work, and the way it fails
is worth keeping.** Features were all ratios against the film's own middle (length, peak
and mean motion, rise, fall, where the peak sits, gaps either side, brightness, whether a
replay follows within 15 s, and five head-count numbers). Five-fold cross-validation on
**contiguous blocks** of film, never random folds — neighbouring clips share a camera
position and a drive, so random folds let it see its own answers.

- It **ranks** at 76 % (50 % is chance), better than any single measurement here.
- But with the threshold chosen honestly — on the training folds, never on the fold being
  scored — it removes **7–12 % of the junk while losing 3–4 snaps in 125**. At any cut
  conservative enough to lose no snap it removes **nothing**. The first draft of this
  measurement picked the cut just under the lowest true snap *in the test fold*, which
  flattered it to 33 %; that is choosing the answer after seeing it.
- On the **old film it does not transfer at all**. Real hand-timed snaps there score 0.31
  to 0.86, scattered over the whole range, several in the bottom quarter; a cut at 0.4
  loses 4 of the 12 findable ones. It learned this game, not football.

What the weights do confirm, and both are already known: **the head count falling to zero**
(+1.28 — a snap ends in a pile and the lumps merge) and **a replay following within 15 s**
(+1.09 — NFHS only replays football) are the two strongest signals available. Everything
else is noise by comparison.

So a learned model is not the shortcut it looks like: with ~200 labels it can only weight
features that are already weak. The honest next step is a better *feature*, not a better
fitter — and the one that has never been tried is **two facing lines**. The owner's son
pointed at it sideways ("you can tell a play is coming when the referee spots the ball").
Spotting the referee himself is a dead end — at 900 px wide the officials are plainly
visible, but they are just as visible in the junk run-ups (#45 has three of them standing
about, #51 one alone), and the thing a person actually recognises is the *act* of placing
the ball, which needs full-resolution frames several times a second, roughly 150× the
pixels the scan samples. But what the spot *causes* is visible by 2 s before every snap:
both teams formed into two rows a yard apart. That is not the "how spread out are they"
test that failed twice — it is whether the lumps split into two tight lines with a gap.
It needs about 640×360 to resolve the gap; at 320×180 the two rows merge.

**Tried, and it fails — the measurement runs backwards.** `scratchpad/lines.js` finds the
lumps at 640×360, sorts them dark shirt / light shirt by brightness, and sweeps for the
straight line that best divides one team from the other. Snaps score 0.84–1.00 (median
0.96); junk scores 0.80–1.00 (median 0.94). The same picture, twice over.

The reason is worth keeping, because it is the opposite of the intuition. **Two teams are
easiest to separate when they are furthest apart** — in a huddle, or with the camera on
one bench, a line divides them trivially and the score is a perfect 1.00. At the line of
scrimmage the two teams are *interleaved* a yard apart, which is the hardest case of all.
Separability measures how far apart the teams are, not whether they are facing off. On
top of that the measurement cannot be made at all on **8 of 32 snaps and 9 of 25 junk
clips**, where too few lumps of one colour survive the turf test to judge by.

That closes the last of the geometric ideas. Counting the men is still the only thing in
this file that works.

## The ball itself is visible — the best lead in the project

The owner's son was right and the first write-up above was wrong to settle for "the
referee is a dead end". **At 1920×1080 the spotted ball is plainly there**: roughly
20×18 px, brown leather with the white stripe showing, sitting on the turf waiting for
the teams to line up (`scratchpad/ballzoom.js` cuts an 8× window; clip #42 at +2 s,
full-frame (1010, 515) is a textbook example). The film is 1920×1080 at 25 fps.

**But it cannot be found by any simple rule, and the attempt is worth reading before
anyone tries again.** Two finders were built and both missed the ball on frames where it
is clearly visible to the eye, while returning 3–19 false candidates each.

*The colour is not what it looks like.* A first measurement said "R 147, G 107, B 133 —
red and blue both above green". **That number was an artefact**: it was the median of each
channel taken separately, which describes no actual pixel. Printing the real pixels
(`scratchpad/ballmap.js`) shows the truth, and it is much worse:

- On clip #42 the ball sits on the **pink midfield "WILDCATS" logo**, and the logo paint
  has the *same* hue order (red and blue over green) over a region 33 px wide. The ball
  and the paint are not separable by colour there at all.
- On clip #208, where the ball lies on **clean turf**, it is not brown to the sensor:
  around it the pixels run (146,157,144) and similar — green roughly level with red and
  blue — and its centre reads as a small *bright* blob, much like the white hash marks.

So the ball is desaturated by the floodlights and reads differently depending on what it
is lying on. The "brown ball" a person sees in a zoomed crop is local contrast, not an
absolute colour a threshold can key on.

*And the field is full of look-alikes.* A plain "small thing standing alone on turf" test
finds **105 of them in a single frame** — the hash marks. The painted logos and end zones
add large regions with ball-like hue. The ball also frequently rests **on** a painted
line, so any "everything that is not grass" segmentation fuses the two into one long blob
that fails every size test.

*A third attempt asked the right question and settled it.* Colour is the wrong key,
because the answer changes with what the ball lies on; what the eye actually does is spot
**a small thing that differs from whatever is around it**. So: mean colour of a
ball-sized box minus the mean of the ring around it, over the whole frame, ranked
(`scratchpad/ball3.js`, `ball4.js`). This is background-independent by construction and
is the strongest form of the idea. The ball was **not among the 355 candidates** on clean
turf, nor among 343 on the logo — so the contrast at its exact position was measured
directly, against the rest of the frame:

| | ball's contrast | frame median | where the ball ranks |
|---|---|---|---|
| on clean turf (#208) | 23.8 | 9.4 | **77th percentile** |
| on the pink logo (#42) | 45.2 | 10.5 | **91st percentile** |

**About 400,000 places in the frame stand out more than the ball does.** It is barely
above the median. Players, lines, numbers, helmets, the crowd and the sidelines are all
more locally distinctive than the thing the game is played with.

**Verdict: the ball is one of the LEAST conspicuous objects in the picture, and that is
measured, not guessed.** No bottom-up method — colour, shape, local contrast — can pick
it out without also picking out hundreds of thousands of other places. It looks obvious
to a person only because a person already knows where to look: the eye uses the players
and the formation to narrow attention to a few square yards, and *then* resolves the ball.
That is top-down attention, and it is circular here — knowing where the line of scrimmage
is, is the very thing the detector is trying to work out. Finding the ball is therefore
harder than finding the play, not easier. Do not spend more on it.

**If it is ever revisited**, the rule to aim at is not "is a ball visible" — a huddle has
a spotted ball too — but **a ball spotted on the turf that then vanishes**, which is the
snap. And verify in the browser, never on ffmpeg frames.

**Two things the detector may never rely on**, because the owner's films won't always
have them: the **scorebug** (it may be absent, or present but not live) and the
**audio** (it may be missing). Anything built on either is dead on arrival, whatever it
scores on this one film.

## What the other programs do, and why none of it transfers

Five primary sources were read in full. The short answer is that **nobody solves this
problem from arbitrary film.** Everyone either reads a clock, pays a person, or changes
the camera.

- **Xie, Chang, Divakaran & Sun, ICASSP 2002** (*Structure Analysis of Soccer Video with
  Hidden Markov Models*) is the foundational play/break paper and the closest match to
  this project. Two features: **dominant colour ratio** (what share of the frame is grass)
  and motion intensity. Sampled uniformly on a 3 s window stepping 1 s — explicitly *not*
  at shot boundaries, because "shot detectors tend to give lots of false alarms due to
  unpredictable camera motion". Every feature normalised against the mean and variance of
  the whole clip. Six HMM topologies per state, trained on whole play/break chunks (short
  chunks are 2–3 % worse and over-segment), then dynamic programming over a 2×2 play/break
  transition matrix, λ = 0.25, worth +2.2 %. Result: **83.5 %** accuracy training on one
  clip and testing on three others, 62 % of boundaries within 3 s — and the failure mode is
  ours exactly: "**the algorithm suffers more from false alarms than misses**, as we have
  observed that 91 % of the play-segments are correctly classified".
- **Mahasseni, Chen, Fern & Todorovic, IAAI 2013** (*Detecting the Moment of Snap in
  Real-World Football Videos*, Oregon State, written for a company with "over 13,000 high
  school, college, and professional teams"). Read the input assumption before anything
  else: "**our input for MOS estimation will be a video of a single football play**". The
  clip is already cut; they only locate the snap inside it. They also **tried the
  stillness-then-motion rule and rejected it** — "as our results will demonstrate later,
  such an approach is not effective" — because optical flow, KLT and tangent distance all
  measure pixel displacement, which scales with zoom and viewpoint. That is the same reason
  the old "settled first" rule and the peak-motion rule died here, reached independently.
  Their padding numbers justify `PRE`: cutting at the estimated snap gives **63 % bad cuts**,
  one second earlier 11 %, two seconds earlier 8 %. Accuracy about 84 % within a second of
  the true snap, after a field-boundary stage and an optical-flow "Variable Threshold
  Image".
- **US10237512B1, Assist Film LLC** (filed 2017, granted 2019) is the commercial method:
  sample a frame a second, OCR the **play clock**, and open the window when it stops —
  in football the play clock runs *between* plays. Pad about 3 s either side. This is the
  scorebug, which is forbidden here.
- **Hudl, Veo, Pixellot, Trace** publish no method, and the pattern is the point. Hudl
  Assist is a paid service and Hudl says the basketball breakdown is done by "a team of
  professional analysts". Veo follows the ball; Pixellot runs object detection; Trace does
  not analyse the picture at all — it straps a GPS tracker to the player.
- **SoccerNet** is the modern benchmark (tight average-mAP roughly 60–76 % depending on the
  tolerance, over hundreds of hand-annotated broadcast games), and the CVPR 2024 CVsports
  transfer study *Beyond the Premier* reports that models can usually tell that an event
  happened but **tight localisation collapses on amateur footage**, with training-data
  quality the bottleneck. That is the 15-feature model's "it learned this game, not
  football", at scale.

**The grass fraction was measured here and it fails.** It is the one feature in that
literature the page did not already have, and `onField()` computes it for free — the
corner of `sat[]` divided by `PW*PH`. `scratchpad/grass.js` sampled it a second at a time
across the whole 3 h 19 m film; `grasscore.js` scored it against all 222 judged clips.

| | snaps (125) | junk (97) |
|---|---|---|
| at the snap | 224 / **448** / 716 | 0 / **418** / 717 |
| mean over the clip | 230 / **429** / 622 | 230 / **416** / 659 |
| max over the clip | 260 / **510** / 737 | 271 / **507** / 736 |
| min over the clip | 0 / **291** / 584 | 0 / **316** / 550 |

(min / median / max.) The same picture four times over, and on the min the junk is the
*higher* of the two. At a cut of 0.65× the film's median with a run of 3, the only three
clips it sets aside are three the head count already has. Chosen to be lossless on the
first half of the game it **loses 6 snaps on the second half** — the same way the peak-motion
rule and the fitted model failed.

**Two reasons, and both are permanent.** First, **this film has no production grammar.**
Only **2.9 % of its seconds** fall below half the median grass; the camera is wide and
locked on the field essentially all game. The Columbia feature works because a *television
director* cuts between wide shots, medium shots and cutaways, and a break is shot close.
A parent with a camcorder on a tripod does none of that, so there is no scale of view to
read. Expect that of every film the owner brings. Second, **the measurement inverts on the
thing that matters most**: players are not-grass, so an *empty* field scores the highest
grass in the game. #223 (2h52m), #229 (2h57m) and #102 (1h16m) — post-game and a quarter
break — sit in the top ten grassiest clips, above most real snaps. Grass fraction and the
head count point in opposite directions exactly where the head count is right.

So the whole play/break lineage rests on a feature that fixed-camera film does not carry.
That is worth knowing before reading any more of that literature.

**What the research did confirm.** Re-scored against all 125 labelled snaps rather than the
32 the rule was built on, **the head count still sets aside 27 clips, every one of them
junk, losing nothing** — and it holds from 0.60 to 0.70 on `MEN_FRAC`, so 0.65 sits in the
middle of a plateau rather than on a knife edge. Four times the labels, same answer.

**The one untried idea the literature points at is persistence, not a new feature.** What
the HMM-plus-dynamic-programming machinery buys is not rhythm — intervals between snaps
really do run 17 s to 298 s and there is nothing to fit, as measured above. It buys the
fact that once the film is in a break it tends to *stay* in a break, so a run of weak
seconds is evidence where one weak second is not. `MEN_RUN` 3 is a hand-made version of
exactly that, and it is the only thing in this file that works. The lever to try next is
applying the run idea to the features already recorded, not finding another feature.

**Clips that run into each other are one piece of film.** Real plays sit 25–40 s apart,
so a clip butting up against the one before is a single stretch of action chopped in
half — 123 of the first 340 were. `JOIN` (0 s of slack) glues them back; more slack
chains clips into 160 s monsters, so do not raise it. This took the game from 340 to
236 and the old half from 47 to 36 without losing a single hand-timed snap.

The owner still gets the last word on what is left. After the finder runs, `#fPick` shows **one thumbnail
per play, taken `PRE` seconds in — where the ball goes** — and clicking one drops it.
**One frame is not enough to judge by** — see "What is left over, labelled properly":
the owner can't tell a snap from a huddle in a still, and neither can this file's own
earlier labels. If the picker is ever meant to be used in earnest, the tile has to move
(cycle three or four frames across the clip); the thumbnails are already fetched by
second, so the frames are most of the way there.
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
