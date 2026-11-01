# Can a vision model tell football from the camera wandering?

Eleven hand-made measurements have been tried against `play-labels.json` and only one — the
head count — works, and only on halftime and the end of the game. This tests the one idea
with evidence rather than hope behind it: **the labels themselves were made by a person
looking at three frames of each clip and deciding**, so the task is known to be solvable
from this input. The question is whether the model does it too, and at what cost in plays.

## Running it

You need an API key from console.anthropic.com. Then:

```bash
cd <this folder> && ANTHROPIC_API_KEY=sk-ant-... node judge.js
```

- `--dry` — show the cost, the frames and the prompt; **sends nothing, spends nothing**
- `--limit 40` — a cheap first look (about 30 cents) before committing to the full run
- `--clock` — let it read the scoreboard as well as the picture (see below)

All 222 judged clips on Claude Opus 5.5 is **about $1.60** and takes a few minutes.
Frames and answers are both cached on disk, so a second run costs nothing, a stopped run
picks up where it left off, and the two prompts are cached separately.

## The two prompts, and why it matters which one wins

The default prompt tells the model to judge from **what the players are doing** and warns it
that the overlay is sometimes frozen and on other films absent altogether. That is the rule
in CLAUDE.md: the detector may never depend on the scorebug, because the owner's films won't
always carry a live one. Clip #1 of this very game is the proof — a banner shot with the
scoreboard reading "1st & 10, 1st, 02:01".

`--clock` lifts that restriction. **The gap between the two scores is how much of the signal
is the scoreboard rather than the game**, and that single number decides whether this travels
to the next film or only works here. Run both.

## What it prints

Not accuracy — accuracy is not the question. It prints the trade this project has always
been judged on:

- how many of the 125 real snaps the model kept, and **how many it lost**
- how many of the 97 junk clips it caught
- junk caught per snap lost, at each confidence bar, since the safe way to use this is to
  drop only the clips the model is sure about
- the real snaps it called junk, with its own reason for each — the ones that matter

For reference, the bar to beat: every rejected idea sat near **3 junk per snap lost or
worse**. The shipped head count removes 27 clips and loses nothing.

## What a good result would and would not prove

It would not settle whether this works on a film with no scorebug, no NFHS overlay, a
different camera or daylight. There is only one game on the machine — the old regression
film has been deleted — so a good score here is a reason to try a second film, not a reason
to ship.
