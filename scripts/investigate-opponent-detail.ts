import {
  applyRound,
  createSchedulerState,
  generateNextRound,
} from "../src/index.js";
import type { Round, SchedulerState } from "../src/types.js";

type Id = number;

function keyOf(a: Id, b: Id): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function play(
  players: number,
  courts: number,
  rounds: number,
  seed: string,
  candidateCount = 8,
): Round<Id>[] {
  let state: SchedulerState<Id> = createSchedulerState({
    players: Array.from({ length: players }, (_, index) => ({ id: index + 1 })),
    courtCount: courts,
  });
  const played: Round<Id>[] = [];
  for (let index = 0; index < rounds; index += 1) {
    const round = generateNextRound(state, {
      strategy: "balanced",
      seed: `${seed}:${index}`,
      candidateCount,
    }).round;
    played.push(round);
    state = applyRound(state, round);
  }
  return played;
}

function analyze(players: number, rounds: Round<Id>[]) {
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  const foursomes: string[] = [];
  let partnerSlots = 0;
  let opponentSlots = 0;
  let partnerRepeatSlots = 0;
  let opponentRepeatSlots = 0;
  let rePair = 0;
  let tripleOverlap = 0;
  const seen = new Map<string, Set<string>>();
  const previousTriples = new Set<string>();

  for (const round of rounds) {
    for (const match of round.matches) {
      const ids = [...match.teamA, ...match.teamB].sort((a, b) => a - b);
      const foursome = ids.join(":");
      const partition = [
        keyOf(match.teamA[0], match.teamA[1]),
        keyOf(match.teamB[0], match.teamB[1]),
      ]
        .sort()
        .join("+");
      const history = seen.get(foursome) ?? new Set<string>();
      if (history.size > 0 && !history.has(partition)) {
        rePair += 1;
      }
      history.add(partition);
      seen.set(foursome, history);

      const triples: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        triples.push(ids.filter((_, index) => index !== i).join(":"));
      }
      if (triples.some((triple) => previousTriples.has(triple))) {
        tripleOverlap += 1;
      }
      for (const triple of triples) {
        previousTriples.add(triple);
      }
      foursomes.push(foursome);

      for (const team of [match.teamA, match.teamB]) {
        partnerSlots += 1;
        const next = (partners.get(keyOf(team[0], team[1])) ?? 0) + 1;
        partners.set(keyOf(team[0], team[1]), next);
        if (next > 1) partnerRepeatSlots += 1;
      }
      for (const a of match.teamA) {
        for (const b of match.teamB) {
          opponentSlots += 1;
          const next = (opponents.get(keyOf(a, b)) ?? 0) + 1;
          opponents.set(keyOf(a, b), next);
          if (next > 1) opponentRepeatSlots += 1;
        }
      }
    }
  }

  const histogram = (map: Map<string, number>, possible: number) => {
    const counts = new Map<number, number>();
    for (const value of map.values()) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    counts.set(0, possible - map.size);
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  };

  const perPlayer = Array.from({ length: players }, (_, index) => {
    const id = index + 1;
    let games = 0;
    let partnerMax = 0;
    let opponentMax = 0;
    const partnerIds = new Set<Id>();
    const opponentIds = new Set<Id>();
    for (const [key, count] of partners) {
      const [a, b] = key.split(":").map(Number);
      if (a === id || b === id) {
        partnerMax = Math.max(partnerMax, count);
        partnerIds.add(a === id ? b! : a!);
      }
    }
    for (const [key, count] of opponents) {
      const [a, b] = key.split(":").map(Number);
      if (a === id || b === id) {
        opponentMax = Math.max(opponentMax, count);
        opponentIds.add(a === id ? b! : a!);
      }
    }
    for (const round of rounds) {
      if (
        round.matches.some((match) =>
          [...match.teamA, ...match.teamB].includes(id),
        )
      ) {
        games += 1;
      }
    }
    return {
      id,
      games,
      partnerMax,
      opponentMax,
      uniquePartners: partnerIds.size,
      uniqueOpponents: opponentIds.size,
    };
  });

  return {
    matches: foursomes.length,
    partnerRepeatSlots,
    partnerSlots,
    opponentRepeatSlots,
    opponentSlots,
    partnerMax: Math.max(0, ...partners.values()),
    opponentMax: Math.max(0, ...opponents.values()),
    rePair,
    tripleOverlap,
    partnerHist: histogram(partners, (players * (players - 1)) / 2),
    opponentHist: histogram(opponents, (players * (players - 1)) / 2),
    perPlayer,
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function runCase(players: number, courts: number, rounds: number, seeds = 8) {
  const rows = [];
  for (let seed = 0; seed < seeds; seed += 1) {
    rows.push(
      analyze(
        players,
        play(players, courts, rounds, `detail-${players}-${courts}-${seed}`),
      ),
    );
  }
  const hist = (pick: "opponentHist" | "partnerHist") => {
    const merged = new Map<number, number>();
    for (const row of rows) {
      for (const [bucket, count] of row[pick]) {
        merged.set(bucket, (merged.get(bucket) ?? 0) + count / rows.length);
      }
    }
    return [...merged.entries()].sort((a, b) => a[0] - b[0]);
  };
  console.log(
    `\n${players}p/${courts}c rounds=${rounds} matches=${rows[0]!.matches} ` +
      `pairMax~${mean(rows.map((row) => row.partnerMax)).toFixed(2)} ` +
      `pairRep ${(100 * mean(rows.map((row) => row.partnerRepeatSlots / row.partnerSlots))).toFixed(1)}% ` +
      `oppMax~${mean(rows.map((row) => row.opponentMax)).toFixed(2)} ` +
      `oppRep ${(100 * mean(rows.map((row) => row.opponentRepeatSlots / row.opponentSlots))).toFixed(1)}% ` +
      `rePair~${mean(rows.map((row) => row.rePair)).toFixed(2)} ` +
      `tripleOverlap~${mean(rows.map((row) => row.tripleOverlap)).toFixed(2)}`,
  );
  console.log(
    "opp hist " +
      hist("opponentHist")
        .map(([bucket, count]) => `${bucket}:${count.toFixed(1)}`)
        .join(" "),
  );
  console.log(
    "player avg games " +
      mean(
        rows.flatMap((row) => row.perPlayer.map((player) => player.games)),
      ).toFixed(2) +
      " uniquePartners " +
      mean(
        rows.flatMap((row) =>
          row.perPlayer.map((player) => player.uniquePartners),
        ),
      ).toFixed(2) +
      " partnerMax " +
      mean(
        rows.flatMap((row) => row.perPlayer.map((player) => player.partnerMax)),
      ).toFixed(2) +
      " uniqueOpponents " +
      mean(
        rows.flatMap((row) =>
          row.perPlayer.map((player) => player.uniqueOpponents),
        ),
      ).toFixed(2) +
      " opponentMax " +
      mean(
        rows.flatMap((row) =>
          row.perPlayer.map((player) => player.opponentMax),
        ),
      ).toFixed(2),
  );
}

for (const rounds of [6, 11, 18]) {
  runCase(13, 3, rounds);
}
runCase(8, 2, 10);
runCase(24, 6, 10);
runCase(12, 3, 10);
runCase(9, 2, 12);
runCase(16, 4, 10);
