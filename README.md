# Film Cutter

Open a full game film and get every play, with the dead time cut out. Same family as
[Formation Drawer](https://github.com/thadmoren/FormationDrawer): one self-contained
`index.html`, no build step, no dependencies, same look.

## Run it

- **Live site**: https://thadmoren.github.io/FilmCutter/
- **Mac**: double-click `serve.command` (port 5004), or open `index.html` directly. Opened as
  a local file it still finds plays, but **Export clips** and call diagrams need it
  served (the live site or `serve.command`).

## Using it

Two steps, on a computer in Chrome or Edge:

1. **Choose game video.** It stays on your device; nothing is uploaded.
2. **Cut into clips.** Pick a folder, and it finds every play and saves each one there
   as its own video file. Finding the plays takes five to ten minutes per hour of film, and
   the list of plays grows as it goes, so you can watch it work; **Stop**
   keeps what's done and the next **Cut into clips** picks up there, even after closing
   the tab. On a whole game, look through the pictures it shows you first and drop the
   ones that aren't plays — then Cut into clips saves only the ones you kept.

Under step 2, **Number the clips, starting at** sets the first number (`play-001`,
`play-002`, … or start at 101 to carry on from last week). Untick it and each clip is
named by where it starts in the game instead (`play-at-0h12m05s`). It remembers your choice.

How it finds plays: it steps through the film once per second and measures how much of
the picture changed. A play is a **stir that settles** — the picture comes alive and
then goes quiet again — and what counts is how far it rises above the quiet either side,
not how big it looks. That matters because a snap filmed from a parked camera barely
moves the picture while the same snap with the camera chasing the ball moves all of it,
and both are plays. It judges each moment against the half-minute around it rather than
against the whole game, so a quiet stretch isn't measured by the standard of a busy one.

The stir that counts is **the long one**. Film throws up a stir every few seconds — the
teams gathering, the huddle breaking, the walk to the line, the camera swinging round —
and most of those are over in two or three seconds. A play lasts longer: the snap, the
tackle and everyone getting up. That is how it picks the snap out.

How long a play looks depends on the camera, so this is the number most likely to need
nudging on a film it hasn't seen. **If a game comes back with far fewer clips than it
should** — as a rule there's about one per 25 seconds of football, so an hour of film
with under fifty is suspect — **push Sensitivity to the right.** It re-finds the plays
straight away, with no rescan. (When the play finder itself improves, a game you've
already scanned picks the change up by itself the next time you open it, and says so.)

Each clip reaches back to **the huddle breaking** where there's room for it — so you see the
call, the walk-up and the formation, not just the ball going — and ends five seconds after
the whistle. Where the play before was close, the clip takes whatever room is left rather
than running into it; clips are never glued together to make the lead-in fit. If a replay
has been cut in right before the snap, the lead-in will show a second or two of it rather
than give up and start late.

**One play per clip.** Where two snaps come close together they still get a clip each, as
long as they're at least ten seconds apart. Closer than that is treated as one play the
finder spotted twice. If you ever see a long play arriving cut in half, that's the number
to change — say so and it moves.

It also **counts the players out on the grass**. Football means a dozen or more men
standing on turf; a banner, an empty field, the team lined up along the touchline at
halftime and the crowd on the pitch afterwards do not. Where several clips in a row show
far fewer men than the rest of the film, they're set aside for you — on a whole game
that was halftime and the end, 27 clips of 236, without dropping a single play. (It has
to be several in a row: one quiet clip on its own may just be a quiet play.) They
aren't deleted: they
show as dropped in the pictures below, and **Keep all** brings them back.

You will still get more clips than there were plays. It can't always tell a play from
the camera swinging round to the crowd or down the sideline between plays, or from a
huddle or a timeout — there are players on the grass for those too. Most of what's left
over is during the game itself.

So it also shows you **a small moving picture of each play** — three frames taken across
it, cycling, because a single still can't tell a snap from a huddle: players standing
about look the same either way until you see whether anything happens. You can ignore the
grid and just press Cut into clips — or click any picture that isn't football and it
drops out, and the count on **Cut into clips** follows. Nothing is thrown away: **Keep
all** puts them back, and the ▶ by a picture plays that bit if you're not sure. The
pictures take about a minute to come in for a whole game.

**Or let Claude do it for you.** Put an API key in at step 2 and it happens by itself: when
you press Cut into clips, Claude looks at three frames of every clip and sets aside the ones
it's sure aren't football, before anything gets cut. On a full game that's about half the
junk gone, and in testing it didn't drop a single real play. Nothing is deleted — **Keep
all** brings everything back. No key, no charge, and the app behaves exactly as before.

**It drops everything it thinks isn't football** — penalties being walked off, timeouts,
pregame, halftime, the camera on the crowd. That clears almost all the junk, and the price
is that **about one real play in fourteen goes with it**. That's a deliberate trade and it
can be changed; it's not a bug.

**So check the ones with a ?.** Claude says how sure it is about each call, and any clip it
dropped without being sure gets an amber ring and a **?**. That's where a real play gets
thrown out. Tick **Only Claude's shaky calls** to see just those, and click any that is
actually football to put it back. Nothing is ever deleted — **Keep all** brings back
everything. Its answers are kept between visits, so closing the tab and cutting again costs
nothing the second time.

This one is optional and costs a little money, because it needs your own API key from
[console.anthropic.com](https://console.anthropic.com) — about **$1.50 for a whole game**.
The key is kept in your browser and sent only to Anthropic. Your film is never uploaded:
only three small still pictures per clip. Leave the button alone and the app behaves
exactly as before, with no account and no bill.

**Replays** (the red "replay" badge in the top-right corner, as on NFHS Network film)
and **black screens** (the sponsor card either side of a replay, or an ad break) are
skipped, and a play's clip stops where one begins.

About the clips: picking a folder needs Chrome or Edge on a computer; other browsers
download the clips one by one. Clips are cut without re-encoding, so it takes seconds
and keeps full quality; a clip may start up to a second or two early (it begins on the
nearest keyframe). Clips have no sound. The cutter is about 32 MB and downloads the
first time. Tested on a 2.8 GB file.

**Review plays and add formation calls (optional)** opens below the two steps:

- **Find plays** runs the play finder on its own, to check the plays before cutting.
- **Skip dead time** (on by default): playback jumps from one play to the next.
- **Sensitivity**: higher finds more plays. It re-detects instantly, no rescan.
- Each play row: ▶ play it · ⇤ / ⇥ set its start / end to the video's current time
  (keys `[` `]`) · ✕ delete. `,` and `.` step between plays. **+ Play here** adds one.
  Plays over 45 s are flagged "long — check" (halftime, injuries, band).
- Type a formation call on a play (e.g. `24B I`) and its diagram, drawn by Formation
  Drawer, shows beside the video while that play runs.
- A play's call is added to its clip's name (e.g. `play-012-24B-I.mp4`), so type
  calls before **Cut into clips**.
- **Download CSV**: every play's start, end, length and call.
- **Mac clip script**: a Terminal script that re-encodes each play to .mp4 with
  frame-exact starts and also joins them into one condensed game. Needs ffmpeg
  (`brew install ffmpeg`). Run: `bash cut-game.sh /path/to/game.mp4`.

Plays, calls and scan progress are saved in the browser per file (name + size).
Works best on a computer with an .mp4. A fixed sideline/end-zone camera detects best;
broadcast replays and crowd shots show up as extra "plays" to delete.
