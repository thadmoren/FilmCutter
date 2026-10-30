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
   as its own video file. Finding the plays takes a few minutes per hour of film; **Stop**
   keeps what's done and the next **Cut into clips** picks up there, even after closing
   the tab.

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
and all of those are over in three or four seconds. A play isn't: the snap, the tackle
and everyone getting up takes eight to fourteen, kickoffs included. That is how it picks
the snap out.

Each clip starts **five seconds before the snap**, so you see the teams set and the ball
go, and ends five seconds after the whistle. Expect roughly one clip per 20–30 seconds
of live football. Dead time the camera sweeps across — a long stoppage, the walk down
the field after a score — can still look like a play, so a few clips will be ones you
delete; **Sensitivity** trades those against missed plays.

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
