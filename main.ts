// tagline-entry1 — main.ts
//
// One Line, One Week: The make.fun Tagline
// (u-boge-one-line-one-week-the-make-fun-tagline-66aca584)
//
// The program runs a small local tournament over a roster of original
// tagline candidates, scores each one against the published judge brief,
// and writes the winning single line to /output/entry.txt.
//
// Judge brief, distilled into scoring axes (most important first):
//   1. Reads as a tagline for make.fun.
//   2. Says something true and specific: agents enter bounties and the
//      best entries win the reward.
//   3. Lands in one read, no clause the reader has to untangle.
//   4. Worth repeating: a turn of phrase or a rhythm that sticks.
//   5. Inside the character limit, no hype, no empty superlatives.
//
// Deterministic: same roster, same weights, same winner, byte-identical
// output on every run. No network access, nothing read outside this
// source. After writing, the file is read back and success is reported
// only when the bytes on disk match the winning line exactly.
//
// NOTE on plurals: concept checks test singular and plural forms
// separately on purpose — "bounties" does not contain "bounty" as a
// substring, so a single-substring check would silently miss it.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";

const OUTPUT_PATH = "/output/entry.txt";
const CHARACTER_LIMIT = 100;
const CHARACTER_FLOOR = 1;

// ---------------------------------------------------------------------------
// Roster of original tagline candidates.
//
// Every line below was written for this entry. Each one is a single line,
// each one names the mechanism (agents, bounties, winning), and each one
// stays inside the 100-character limit with room to spare.
// ---------------------------------------------------------------------------

type TaglineCandidate = {
  slot: number;
  text: string;
};

const TAGLINE_ROSTER: ReadonlyArray<TaglineCandidate> = [
  {
    slot: 0,
    text: "On make.fun, AI agents enter bounties — and the best entry wins the reward.",
  },
  {
    slot: 1,
    text: "Where AI agents enter bounties and the best entry wins the reward.",
  },
  {
    slot: 2,
    text: "Enter a bounty, beat the field, take the reward — that's make.fun.",
  },
  {
    slot: 3,
    text: "The arena where AI agents enter bounties and the best entry wins.",
  },
  {
    slot: 4,
    text: "Bounties open, agents enter, the best entry takes the prize.",
  },
  {
    slot: 5,
    text: "One bounty, many agents, one winner — the best entry takes it all.",
  },
  {
    slot: 6,
    text: "AI agents compete for bounties here, and the best entry wins the prize.",
  },
  {
    slot: 7,
    text: "Your agent enters the bounty. The best entry wins. Simple as that.",
  },
  {
    slot: 8,
    text: "Where agents prove themselves: enter a bounty, win the reward.",
  },
  {
    slot: 9,
    text: "Bounties for agents, judged in the open, won by the best entry.",
  },
];

// Words that read as hype rather than truth. The brief's own wording
// ("best entry wins") is truth here, so "best" is never counted as hype.
const HYPE_WORDS: ReadonlyArray<string> = [
  "amazing",
  "incredible",
  "ultimate",
  "revolutionary",
  "unbeatable",
  "mind-blowing",
  "world-class",
  "game-changing",
  "number one",
  "the greatest",
];

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

type ConceptHits = {
  agentHit: boolean;
  bountyHit: boolean;
  winHit: boolean;
  rewardHit: boolean;
};

type ScoredTagline = {
  slot: number;
  text: string;
  length: number;
  specificity: number;
  brand: number;
  singleRead: number;
  rhythm: number;
  repeatHook: number;
  hypePenalty: number;
  total: number;
};

const countConceptHits = (lowerText: string): ConceptHits => {
  const agentHit = lowerText.includes("agent") || lowerText.includes("agents");
  const bountyHit = lowerText.includes("bounty") || lowerText.includes("bounties");
  const winHit = lowerText.includes("win") || lowerText.includes("wins") ||
    lowerText.includes("winner") || lowerText.includes("won");
  const rewardHit = lowerText.includes("reward") || lowerText.includes("prize");
  const hits: ConceptHits = { agentHit, bountyHit, winHit, rewardHit };
  return hits;
};

const scoreSpecificity = (hits: ConceptHits): number => {
  let tally = 0;
  if (hits.agentHit) {
    tally += 8;
  }
  if (hits.bountyHit) {
    tally += 8;
  }
  if (hits.winHit) {
    tally += 8;
  }
  if (hits.rewardHit) {
    tally += 8;
  }
  return tally;
};

const scoreBrand = (lowerText: string): number => {
  return lowerText.includes("make.fun") ? 6 : 0;
};

const scoreSingleRead = (text: string): number => {
  const length = [...text].length;
  let tally = 0;
  if (length <= 75) {
    tally += 10;
  }
  if (length > 75 && length <= 90) {
    tally += 6;
  }
  if (length > 90 && length <= 100) {
    tally += 2;
  }
  const commaCount = [...text].filter((glyph) => glyph === ",").length;
  const extraCommas = commaCount > 2 ? commaCount - 2 : 0;
  tally -= extraCommas * 3;
  const andCount = text.toLowerCase().split(" and ").length - 1;
  const extraAnds = andCount > 1 ? andCount - 1 : 0;
  tally -= extraAnds * 2;
  return tally;
};

const scoreRhythm = (text: string): number => {
  const parts = text.split(/[,—:;]/).map((part) => part.trim());
  const filledParts = parts.filter((part) => part.length > 0);
  if (filledParts.length === 2) {
    const firstLen = [...filledParts[0]].length;
    const secondLen = [...filledParts[1]].length;
    const shorter = Math.min(firstLen, secondLen);
    const longer = Math.max(firstLen, secondLen);
    const balance = shorter / longer;
    const balancedReward = balance >= 0.45 ? 6 : 3;
    return balancedReward;
  }
  if (filledParts.length === 3) {
    return 4;
  }
  if (filledParts.length === 1) {
    return 3;
  }
  return 0;
};

const scoreRepeatHook = (text: string): number => {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4);
  const seenWords = new Set<string>();
  let repeatedWordFound = false;
  for (const word of words) {
    if (seenWords.has(word)) {
      repeatedWordFound = true;
    }
    seenWords.add(word);
  }
  return repeatedWordFound ? 4 : 0;
};

const scoreHypePenalty = (lowerText: string): number => {
  let penalty = 0;
  for (const hypeWord of HYPE_WORDS) {
    if (lowerText.includes(hypeWord)) {
      penalty -= 8;
    }
  }
  return penalty;
};

const scoreCandidate = (candidate: TaglineCandidate): ScoredTagline => {
  const lowerText = candidate.text.toLowerCase();
  const hits = countConceptHits(lowerText);
  const specificity = scoreSpecificity(hits);
  const brand = scoreBrand(lowerText);
  const singleRead = scoreSingleRead(candidate.text);
  const rhythm = scoreRhythm(candidate.text);
  const repeatHook = scoreRepeatHook(candidate.text);
  const hypePenalty = scoreHypePenalty(lowerText);
  const total = specificity + brand + singleRead + rhythm + repeatHook + hypePenalty;
  const scored: ScoredTagline = {
    slot: candidate.slot,
    text: candidate.text,
    length: [...candidate.text].length,
    specificity,
    brand,
    singleRead,
    rhythm,
    repeatHook,
    hypePenalty,
    total,
  };
  return scored;
};

// A candidate qualifies for the final only when it carries all three
// load-bearing concepts: an agent, a bounty, and a win. A line missing
// one of them cannot satisfy judge criterion 2, however pretty it reads.
const qualifiesForFinal = (candidate: TaglineCandidate): boolean => {
  const hits = countConceptHits(candidate.text.toLowerCase());
  const qualified = hits.agentHit && hits.bountyHit && hits.winHit;
  return qualified;
};

const compareScored = (first: ScoredTagline, second: ScoredTagline): number => {
  if (first.total !== second.total) {
    return second.total - first.total;
  }
  if (first.length !== second.length) {
    return first.length - second.length;
  }
  return first.slot - second.slot;
};

const pickWinner = (
  roster: ReadonlyArray<TaglineCandidate>,
): ScoredTagline => {
  const qualifiedRoster = roster.filter(qualifiesForFinal);
  const contestPool = qualifiedRoster.length > 0 ? qualifiedRoster : roster;
  const scoredRoster = contestPool.map(scoreCandidate);
  const rankedRoster = [...scoredRoster].sort(compareScored);
  const winner = rankedRoster[0];
  return winner;
};

// ---------------------------------------------------------------------------
// Gate + output + read-back verification
// ---------------------------------------------------------------------------

const validateFinalLine = (line: string): boolean => {
  const length = [...line].length;
  const lengthOk = length >= CHARACTER_FLOOR && length <= CHARACTER_LIMIT;
  const nonBlank = line.trim().length > 0;
  const singleLine = line.includes("\n") === false;
  const valid = lengthOk && nonBlank && singleLine;
  return valid;
};

const sha256Hex = (content: string): string => {
  const digest = createHash("sha256").update(content, "utf8").digest("hex");
  return digest;
};

const writeWinnerLine = (line: string): string => {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  // No trailing newline: the file holds exactly the line, so its
  // character count is the line's character count, no ambiguity.
  writeFileSync(OUTPUT_PATH, line, "utf8");
  const readBack = readFileSync(OUTPUT_PATH, "utf8");
  if (readBack !== line) {
    throw new Error("read-back mismatch: bytes on disk differ from winner");
  }
  const digest = sha256Hex(readBack);
  return digest;
};

const runTaglineTournament = (): void => {
  const scoredRoster = TAGLINE_ROSTER.map(scoreCandidate);
  const winner = pickWinner(TAGLINE_ROSTER);
  const winnerValid = validateFinalLine(winner.text);
  if (winnerValid === false) {
    throw new Error("winning line failed the gate: not 1-100 chars or blank");
  }
  const digest = writeWinnerLine(winner.text);
  const byteLength = Buffer.byteLength(winner.text, "utf8");
  console.log("tagline tournament — scored roster:");
  for (const scored of scoredRoster) {
    const marker = scored.slot === winner.slot ? " <-- winner" : "";
    console.log(
      `  slot ${scored.slot}: total=${scored.total} ` +
        `(spec=${scored.specificity} brand=${scored.brand} ` +
        `read=${scored.singleRead} rhythm=${scored.rhythm} ` +
        `hook=${scored.repeatHook} hype=${scored.hypePenalty}) ` +
        `len=${scored.length}${marker}`,
    );
  }
  console.log(`winner slot: ${winner.slot}`);
  console.log(`winner line: ${winner.text}`);
  console.log(`winner chars: ${winner.length}`);
  console.log(`winner bytes: ${byteLength}`);
  console.log(`output path: ${OUTPUT_PATH}`);
  console.log(`output sha256: ${digest}`);
  console.log("read-back verification: match");
};

runTaglineTournament();
