import type { PlayerId, SchedulerState, Team } from "../types.js";
import { sortPlayerIds } from "./compare-players.js";
import { pairKey } from "./pair-key.js";

export type HistoryIndex = {
  pairCounts: Map<string, number>;
  opponentCounts: Map<string, number>;
  foursomeCounts: Map<string, number>;
  tripleCounts: Map<string, number>;
};

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function createHistoryIndex<ID extends PlayerId>(
  state: SchedulerState<ID>,
): HistoryIndex {
  const pairCounts = new Map<string, number>();
  const opponentCounts = new Map<string, number>();
  const foursomeCounts = new Map<string, number>();
  const tripleCounts = new Map<string, number>();

  for (const round of state.rounds) {
    for (const match of round.matches) {
      for (const team of [match.teamA, match.teamB]) {
        bump(pairCounts, pairKey(team[0], team[1]));
      }

      for (const playerA of match.teamA) {
        for (const playerB of match.teamB) {
          bump(opponentCounts, pairKey(playerA, playerB));
        }
      }

      const ordered = orderedIds([
        match.teamA[0],
        match.teamA[1],
        match.teamB[0],
        match.teamB[1],
      ]);
      bump(foursomeCounts, ordered.join(":"));
      for (let skip = 0; skip < ordered.length; skip += 1) {
        bump(
          tripleCounts,
          ordered.filter((_, index) => index !== skip).join(":"),
        );
      }
    }
  }

  return {
    pairCounts,
    opponentCounts,
    foursomeCounts,
    tripleCounts,
  };
}

function orderedIds<ID extends PlayerId>(ids: ID[]): ID[] {
  if (
    typeof ids[0] === "number" &&
    typeof ids[1] === "number" &&
    typeof ids[2] === "number" &&
    typeof ids[3] === "number"
  ) {
    return [...(ids as number[])].sort((left, right) => left - right) as ID[];
  }

  return sortPlayerIds(ids);
}

export function courtGroupUnits<ID extends PlayerId>(
  teamA: Team<ID>,
  teamB: Team<ID>,
  history: HistoryIndex,
): number {
  const ordered = orderedIds([teamA[0], teamA[1], teamB[0], teamB[1]]);
  let units = 4 * (history.foursomeCounts.get(ordered.join(":")) ?? 0);

  for (let skip = 0; skip < ordered.length; skip += 1) {
    units +=
      history.tripleCounts.get(
        ordered.filter((_, index) => index !== skip).join(":"),
      ) ?? 0;
  }

  return units;
}
