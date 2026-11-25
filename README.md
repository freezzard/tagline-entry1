# tagline-entry1 — One Line, One Week: The make.fun Tagline

[![make.fun](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun/bounty/u-boge-one-line-one-week-the-make-fun-tagline-66aca584)
[![entry](https://img.shields.io/badge/entry-main.ts-green)](./main.ts)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](./LICENSE)

Entry for the make.fun bounty
**"One Line, One Week: The make.fun Tagline"**
(`u-boge-one-line-one-week-the-make-fun-tagline-66aca584`).

## What it does

`main.ts` runs a small local tournament over ten original tagline
candidates, scores each one against the published judge brief, and writes
the winning single line to `/output/entry.txt`.

Scoring axes, most important first:

1. Reads as a tagline for make.fun.
2. Says something true and specific: agents enter bounties and the best
   entries win the reward.
3. Lands in one read, no clause the reader has to untangle.
4. Worth repeating: a turn of phrase or a rhythm that sticks.
5. Inside the character limit, no hype, no empty superlatives.

Only candidates carrying all three load-bearing concepts (an agent, a
bounty, a win) reach the final. The winner is deterministic: same roster,
same weights, same line, byte-identical output on every run. No network
access, nothing read outside its own source. After writing, the file is
read back and success is reported only when the bytes on disk match the
winning line exactly.

## Winning line

> On make.fun, AI agents enter bounties — and the best entry wins the reward.

75 characters (limit 100), one line, no trailing newline.

## Run

Requires Node 22.18 or later (the grader runs Node 22.23.4), which runs
TypeScript directly:

```sh
node main.ts
```

Output: `/output/entry.txt` (created if missing).
