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

Pick a game file. It stays on your device; nothing is uploaded. **Find plays** steps
through the film once per second, measures how much of the picture changed, and marks
the stretches with movement as plays (2 s kept before the snap and after the whistle).
Expect a few minutes per hour of film. **Stop** keeps what's scanned and **Continue
scan** picks it up later, even after closing the tab.

- **Skip dead time** (on by default): playback jumps from one play to the next.
- **Sensitivity**: higher finds more plays. It re-detects instantly, no rescan.
- Each play row: ▶ play it · ⇤ / ⇥ set its start / end to the video's current time
  (keys `[` `]`) · ✕ delete. `,` and `.` step between plays. **+ Play here** adds one.
  Plays over 30 s are flagged "long — check" (halftime, injuries, band).
- Type a formation call on a play (e.g. `24B I`) and its diagram, drawn by Formation
  Drawer, shows beside the video while that play runs.
- **Export clips**: saves every play as its own video file, named with its number and
  call (e.g. `play-012-24B-I.mp4`), right from the browser. Chrome/Edge ask for a folder
  and write the clips into it; other browsers download them one by one. Clips are cut
  without re-encoding, so it takes seconds and keeps full quality; a clip may start up
  to a second or two early (it begins on the nearest keyframe). The cutter is about
  32 MB and downloads the first time you export. Tested on a 2.8 GB file.
- **Download CSV**: every play's start, end, length and call.
- **Mac clip script**: a Terminal script that re-encodes each play to .mp4 with
  frame-exact starts and also joins them into one condensed game. Needs ffmpeg
  (`brew install ffmpeg`). Run: `bash cut-game.sh /path/to/game.mp4`.

Plays, calls and scan progress are saved in the browser per file (name + size).
Works best on a computer with an .mp4. A fixed sideline/end-zone camera detects best;
broadcast replays and crowd shots show up as extra "plays" to delete.
