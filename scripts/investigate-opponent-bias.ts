/**
 * Measure partner overlap, opponent overlap, and repeated court groups
 * across player counts and court counts.
 *
 * Run: npx vite-node scripts/investigate-opponent-bias.ts
 */
import {
  applyRound,
  createSchedulerState,
  generateNextRound,
} from "../src/index.js";
import type {
  Match,
  Round,
  SchedulerState,
  StrategyWeights,
} from "../src/types.js";

type Id = number;

type Scenario = {
  label: string;
  candidateCount: number;
  weights?: StrategyWeights;
};

type SessionSummary = {
  players: number;
  courts: number;
  rounds: number;
  matches: number;
  partnerMax: number;
  partnerRepeatSlots: number;
  partnerSlots: number;
  opponentMax: number;
  opponentRepeatSlots: number;
  opponentSlots: number;
  opponentAtLeast3: number;
  foursomeRepeats: number;
  rePairRepeats: number;
  identicalRematches: number;
  playerOpponentMax: number;
  lbPartnerMax: number;
  lbOpponentMax: number;
};

const TARGET_GAMES = 10;
const SWEEP_SEEDS = 8;
const ABLATION_SEEDS = 6;

function roundsFor(players: number, courts: number): number {
  const playing = Math.min(players, courts * 4);
  const matches = Math.min(courts, Math.floor(playing / 4));
  const slots = matches * 4;
  const rounds = Math.ceil((TARGET_GAMES * players) / slots);
  return Math.min(20, Math.max(8, rounds));
}

function keyOf(a: Id, b: Id): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function bump(map: Map<string, number>, key: string): number {
  const next = (map.get(key) ?? 0) + 1;
  map.set(key, next);
  return next;
}

function summarizeSession(
  players: number,
  courts: number,
  rounds: Round<Id>[],
): SessionSummary {
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  const foursomes = new Map<string, Set<string>>();
  let partnerSlots = 0;
  let opponentSlots = 0;
  let partnerRepeatSlots = 0;
  let opponentRepeatSlots = 0;
  let foursomeRepeats = 0;
  let rePairRepeats = 0;
  let identicalRematches = 0;
  let matches = 0;

  const playerOpponentMax = new Map<Id, number>();

  for (const round of rounds) {
    for (const match of round.matches) {
      matches += 1;
      const ids = [...match.teamA, ...match.teamB].sort((a, b) => a - b);
      const foursome = ids.join(":");
      const partition = [
        keyOf(match.teamA[0], match.teamA[1]),
        keyOf(match.teamB[0], match.teamB[1]),
      ]
        .sort()
        .join("+");
      const seenPartitions = foursomes.get(foursome) ?? new Set<string>();
      if (seenPartitions.size > 0) {
        foursomeRepeats += 1;
        if (seenPartitions.has(partition)) {
          identicalRematches += 1;
        } else {
          rePairRepeats += 1;
        }
      }
      seenPartitions.add(partition);
      foursomes.set(foursome, seenPartitions);

      for (const team of [match.teamA, match.teamB]) {
        partnerSlots += 1;
        const seen = bump(partners, keyOf(team[0], team[1]));
        if (seen > 1) {
          partnerRepeatSlots += 1;
        }
      }

      for (const playerA of match.teamA) {
        for (const playerB of match.teamB) {
          opponentSlots += 1;
          const seen = bump(opponents, keyOf(playerA, playerB));
          if (seen > 1) {
            opponentRepeatSlots += 1;
          }
          playerOpponentMax.set(
            playerA,
            Math.max(playerOpponentMax.get(playerA) ?? 0, seen),
          );
          playerOpponentMax.set(
            playerB,
            Math.max(playerOpponentMax.get(playerB) ?? 0, seen),
          );
        }
      }
    }
  }

  const maxOf = (map: Map<string, number>) =>
    map.size === 0 ? 0 : Math.max(...map.values());
  const possiblePairs = (players * (players - 1)) / 2;

  return {
    players,
    courts,
    rounds: rounds.length,
    matches,
    partnerMax: maxOf(partners),
    partnerRepeatSlots,
    partnerSlots,
    opponentMax: maxOf(opponents),
    opponentRepeatSlots,
    opponentSlots,
    opponentAtLeast3: [...opponents.values()].filter((count) => count >= 3)
      .length,
    foursomeRepeats,
    rePairRepeats,
    identicalRematches,
    playerOpponentMax: playerOpponentMax.size
      ? Math.max(...playerOpponentMax.values())
      : 0,
    lbPartnerMax: Math.ceil(partnerSlots / possiblePairs),
    lbOpponentMax: Math.ceil(opponentSlots / possiblePairs),
  };
}

function playSession(
  players: number,
  courts: number,
  seedPrefix: string,
  scenario: Scenario,
): SessionSummary {
  let state: SchedulerState<Id> = createSchedulerState({
    players: Array.from({ length: players }, (_, index) => ({
      id: index + 1,
    })),
    courtCount: courts,
  });
  const roundCount = roundsFor(players, courts);
  const played: Round<Id>[] = [];

  for (let index = 0; index < roundCount; index += 1) {
    const proposal = generateNextRound(state, {
      strategy: "balanced",
      seed: `${seedPrefix}:${scenario.label}:${index}`,
      candidateCount: scenario.candidateCount,
      weights: scenario.weights,
    });
    played.push(proposal.round);
    state = applyRound(state, proposal.round);
  }

  return summarizeSession(players, courts, played);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function max(values: number[]): number {
  return Math.max(...values);
}

type Aggregate = {
  players: number;
  courts: number;
  rounds: number;
  seeds: number;
  partnerMaxMedian: number;
  partnerMaxWorst: number;
  lbPartnerMax: number;
  partnerRepeatRateMedian: number;
  opponentMaxMedian: number;
  opponentMaxWorst: number;
  lbOpponentMax: number;
  opponentExcessMedian: number;
  opponentRepeatRateMedian: number;
  opponentAtLeast3Median: number;
  foursomeRepeatsMedian: number;
  rePairMedian: number;
  rePairWorst: number;
  identicalMedian: number;
  matches: number;
  forcedFoursomeRepeats: number;
};

function aggregate(rows: SessionSummary[]): Aggregate {
  const first = rows[0]!;
  return {
    players: first.players,
    courts: first.courts,
    rounds: first.rounds,
    seeds: rows.length,
    partnerMaxMedian: median(rows.map((row) => row.partnerMax)),
    partnerMaxWorst: max(rows.map((row) => row.partnerMax)),
    lbPartnerMax: first.lbPartnerMax,
    partnerRepeatRateMedian: median(
      rows.map((row) => row.partnerRepeatSlots / row.partnerSlots),
    ),
    opponentMaxMedian: median(rows.map((row) => row.opponentMax)),
    opponentMaxWorst: max(rows.map((row) => row.opponentMax)),
    lbOpponentMax: first.lbOpponentMax,
    opponentExcessMedian: median(
      rows.map((row) => row.opponentMax - row.lbOpponentMax),
    ),
    opponentRepeatRateMedian: median(
      rows.map((row) => row.opponentRepeatSlots / row.opponentSlots),
    ),
    opponentAtLeast3Median: median(rows.map((row) => row.opponentAtLeast3)),
    foursomeRepeatsMedian: median(rows.map((row) => row.foursomeRepeats)),
    rePairMedian: median(rows.map((row) => row.rePairRepeats)),
    rePairWorst: max(rows.map((row) => row.rePairRepeats)),
    identicalMedian: median(rows.map((row) => row.identicalRematches)),
    matches: first.matches,
    forcedFoursomeRepeats: Math.max(
      0,
      first.matches - possibleFoursomes(first.players),
    ),
  };
}

function possibleFoursomes(players: number): number {
  let value = 1;
  for (let i = 0; i < 4; i += 1) {
    value = (value * (players - i)) / (i + 1);
  }
  return value;
}

function configs(): Array<{ players: number; courts: number }> {
  const playerCounts = [
    4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 24,
  ];
  const result: Array<{ players: number; courts: number }> = [];
  for (const players of playerCounts) {
    const maxCourts = Math.min(6, Math.floor(players / 4));
    for (let courts = 1; courts <= maxCourts; courts += 1) {
      result.push({ players, courts });
    }
  }
  return result;
}

function fmt(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function printAggregateTable(title: string, rows: Aggregate[]): void {
  console.log(`\n## ${title}`);
  console.log(
    [
      "players",
      "courts",
      "rounds",
      "matches",
      "pairMax",
      "pairLb",
      "pairRep%",
      "oppMax",
      "oppWorst",
      "oppLb",
      "oppExcess",
      "oppRep%",
      "opp>=3",
      "foursomeRep",
      "forcedRep",
      "rePair",
      "rePairWorst",
      "sameTeams",
    ].join("\t"),
  );
  for (const row of rows) {
    console.log(
      [
        row.players,
        row.courts,
        row.rounds,
        row.matches,
        fmt(row.partnerMaxMedian, 1),
        row.lbPartnerMax,
        fmt(row.partnerRepeatRateMedian * 100, 1),
        fmt(row.opponentMaxMedian, 1),
        row.opponentMaxWorst,
        row.lbOpponentMax,
        fmt(row.opponentExcessMedian, 1),
        fmt(row.opponentRepeatRateMedian * 100, 1),
        fmt(row.opponentAtLeast3Median, 1),
        fmt(row.foursomeRepeatsMedian, 1),
        row.forcedFoursomeRepeats,
        fmt(row.rePairMedian, 1),
        row.rePairWorst,
        fmt(row.identicalMedian, 1),
      ].join("\t"),
    );
  }
}

function runSweep(scenario: Scenario, seedCount: number): Aggregate[] {
  const rows: Aggregate[] = [];
  for (const config of configs()) {
    const sessions: SessionSummary[] = [];
    for (let seed = 0; seed < seedCount; seed += 1) {
      sessions.push(
        playSession(
          config.players,
          config.courts,
          `sweep-${config.players}-${config.courts}-${seed}`,
          scenario,
        ),
      );
    }
    const row = aggregate(sessions);
    rows.push(row);
    console.log(
      `sweep ${row.players}p/${row.courts}c rounds=${row.rounds} pairMax=${fmt(row.partnerMaxMedian, 1)} oppMax=${fmt(row.opponentMaxMedian, 1)} excess=${fmt(row.opponentExcessMedian, 1)} rePair=${fmt(row.rePairMedian, 1)}/${row.matches}`,
    );
  }
  return rows;
}

function formatMatch(match: Match<Id>): string {
  const team = (ids: [Id, Id]) => `${ids[0]}-${ids[1]}`;
  return `C${match.court} ${team(match.teamA)} vs ${team(match.teamB)}`;
}

function traceSession(
  players: number,
  courts: number,
  seed: string,
  candidateCount = 8,
): void {
  let state: SchedulerState<Id> = createSchedulerState({
    players: Array.from({ length: players }, (_, index) => ({ id: index + 1 })),
    courtCount: courts,
  });
  const seenFoursomes = new Map<string, string[]>();
  const played: Round<Id>[] = [];
  console.log(
    `\n## Trace ${players} players / ${courts} courts / seed ${seed} / candidates ${candidateCount}`,
  );

  for (let index = 0; index < roundsFor(players, courts); index += 1) {
    const proposal = generateNextRound(state, {
      strategy: "balanced",
      seed: `${seed}:${index}`,
      candidateCount,
    });
    played.push(proposal.round);
    const notes: string[] = [];
    for (const match of proposal.round.matches) {
      const ids = [...match.teamA, ...match.teamB].sort((a, b) => a - b);
      const foursome = ids.join(":");
      const partition = [
        keyOf(match.teamA[0], match.teamA[1]),
        keyOf(match.teamB[0], match.teamB[1]),
      ]
        .sort()
        .join("+");
      const history = seenFoursomes.get(foursome) ?? [];
      if (history.length > 0) {
        const kind = history.includes(partition)
          ? "同一チーム再戦"
          : "同じ4人でペアだけ変更";
        notes.push(`${formatMatch(match)} [${kind} ${history.length + 1}回目]`);
      }
      history.push(partition);
      seenFoursomes.set(foursome, history);
    }
    const sitting = proposal.round.sittingOutPlayers.join(",") || "-";
    console.log(
      `R${index + 1} sit=${sitting} ${proposal.round.matches.map(formatMatch).join(" | ")}${
        notes.length ? `  << ${notes.join(" ; ")}` : ""
      }`,
    );
    state = applyRound(state, proposal.round);
  }

  const summary = summarizeSession(players, courts, played);
  console.log(
    `summary pairMax=${summary.partnerMax} pairRepeatSlots=${summary.partnerRepeatSlots}/${summary.partnerSlots} oppMax=${summary.opponentMax} oppRepeatSlots=${summary.opponentRepeatSlots}/${summary.opponentSlots} foursomeRepeats=${summary.foursomeRepeats} rePair=${summary.rePairRepeats} sameTeams=${summary.identicalRematches} lbOpp=${summary.lbOpponentMax}`,
  );
}

const defaultScenario: Scenario = {
  label: "default-c8",
  candidateCount: 8,
};

const ablationConfigs = [
  { players: 6, courts: 1 },
  { players: 8, courts: 2 },
  { players: 9, courts: 2 },
  { players: 12, courts: 2 },
  { players: 12, courts: 3 },
  { players: 13, courts: 3 },
  { players: 16, courts: 3 },
  { players: 16, courts: 4 },
  { players: 17, courts: 4 },
  { players: 20, courts: 4 },
  { players: 20, courts: 5 },
  { players: 21, courts: 5 },
  { players: 24, courts: 6 },
];

const ablationScenarios: Scenario[] = [
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

console.log(
  `targetGames=${TARGET_GAMES} sweepSeeds=${SWEEP_SEEDS} ablationSeeds=${ABLATION_SEEDS}`,
);
console.log(
  "pairMax/oppMax are medians of the session maximum. Excess = oppMax - ceil(total opponent meetings / C(n,2)). rePair = matches whose four players already shared a court, with a different pairing.",
);

const sweep = runSweep(defaultScenario, SWEEP_SEEDS);
printAggregateTable("Default balanced (candidateCount=8)", sweep);

const hot = [...sweep]
  .filter((row) => row.opponentExcessMedian >= 1 || row.rePairMedian >= 1)
  .sort(
    (a, b) =>
      b.opponentExcessMedian - a.opponentExcessMedian ||
      b.rePairMedian - a.rePairMedian,
  );
printAggregateTable("Hotspots (excess>=1 or rePair median>=1)", hot);

console.log("\n## Ablation");
console.log(
  [
    "scenario",
    "players",
    "courts",
    "pairMax",
    "oppMax",
    "oppExcess",
    "oppRep%",
    "rePair",
    "sameTeams",
  ].join("\t"),
);
for (const scenario of ablationScenarios) {
  for (const config of ablationConfigs) {
    const sessions: SessionSummary[] = [];
    for (let seed = 0; seed < ABLATION_SEEDS; seed += 1) {
      sessions.push(
        playSession(
          config.players,
          config.courts,
          `ablate-${config.players}-${config.courts}-${seed}`,
          scenario,
        ),
      );
    }
    const row = aggregate(sessions);
    console.log(
      [
        scenario.label,
        row.players,
        row.courts,
        fmt(row.partnerMaxMedian, 1),
        fmt(row.opponentMaxMedian, 1),
        fmt(row.opponentExcessMedian, 1),
        fmt(row.opponentRepeatRateMedian * 100, 1),
        fmt(row.rePairMedian, 1),
        fmt(row.identicalMedian, 1),
      ].join("\t"),
    );
  }
}

traceSession(13, 3, "yesterday", 8);
traceSession(13, 3, "session-b", 8);
traceSession(13, 3, "yesterday", 48);
