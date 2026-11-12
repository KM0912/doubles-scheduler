import {
  applyRound,
  createSchedulerState,
  generateNextRound,
} from "../src/index.js";
import type { Round, StrategyWeights } from "../src/types.js";

function repeatRate(
  players: number,
  courts: number,
  rounds: number,
  seed: string,
  candidateCount: number,
  weights?: StrategyWeights,
): { pair: number; opp: number; oppMax: number; pairMax: number } {
  let state = createSchedulerState({
    players: Array.from({ length: players }, (_, index) => ({ id: index + 1 })),
    courtCount: courts,
  });
  const played: Round<number>[] = [];
  for (let index = 0; index < rounds; index += 1) {
    const round = generateNextRound(state, {
      strategy: "balanced",
      seed: `${seed}:${index}`,
      candidateCount,
      weights,
    }).round;
    played.push(round);
    state = applyRound(state, round);
  }
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  let partnerSlots = 0;
  let opponentSlots = 0;
  let partnerRepeats = 0;
  let opponentRepeats = 0;
  for (const round of played) {
    for (const match of round.matches) {
      for (const team of [match.teamA, match.teamB]) {
        partnerSlots += 1;
        const next = (partners.get(key(team[0], team[1])) ?? 0) + 1;
        partners.set(key(team[0], team[1]), next);
        if (next > 1) partnerRepeats += 1;
      }
      for (const a of match.teamA) {
        for (const b of match.teamB) {
          opponentSlots += 1;
          const next = (opponents.get(key(a, b)) ?? 0) + 1;
          opponents.set(key(a, b), next);
          if (next > 1) opponentRepeats += 1;
        }
      }
    }
  }
  return {
    pair: partnerRepeats / partnerSlots,
    opp: opponentRepeats / opponentSlots,
    oppMax: Math.max(...opponents.values()),
    pairMax: Math.max(...partners.values()),
  };
}

const scenarios = [
  { label: "default-c8", candidateCount: 8 },
  { label: "search-c48", candidateCount: 48 },
  {
    label: "opp-w12-c8",
    candidateCount: 8,
    weights: { avoidRepeatedOpponent: 12 },
  },
  {
    label: "opp-w12-c48",
    candidateCount: 48,
    weights: { avoidRepeatedOpponent: 12 },
  },
];

for (const rounds of [6, 11]) {
  for (const scenario of scenarios) {
    const rows = [];
    for (let seed = 0; seed < 8; seed += 1) {
      rows.push(
        repeatRate(
          13,
          3,
          rounds,
          `early-${rounds}-${seed}`,
          scenario.candidateCount,
          scenario.weights,
        ),
      );
    }
    const avg = (pick: keyof (typeof rows)[number]) =>
      rows.reduce((sum, row) => sum + row[pick], 0) / rows.length;
    console.log(
      `13p/3c r=${rounds} ${scenario.label} pairRep ${(100 * avg("pair")).toFixed(1)}% pairMax ${avg("pairMax").toFixed(2)} oppRep ${(100 * avg("opp")).toFixed(1)}% oppMax ${avg("oppMax").toFixed(2)}`,
    );
  }
}
