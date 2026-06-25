import type { PlayerId, SchedulerState, Team } from "../types.js";
import { pairsEqual } from "../utils/pair-key.js";

export function getActivePlayerIds<ID extends PlayerId>(state: SchedulerState<ID>): ID[] {
  return state.players.map((player) => player.id);
}

export function getEffectiveRestingPlayerIds<ID extends PlayerId>(
  state: SchedulerState<ID>,
  optionRestingPlayerIds?: ID[],
): ID[] {
  const ids = new Set<ID>([...state.restingPlayerIds, ...(optionRestingPlayerIds ?? [])]);
  return [...ids];
}

export function getEffectiveFixedPairs<ID extends PlayerId>(
  state: SchedulerState<ID>,
  optionFixedPairs?: Team<ID>[],
): Team<ID>[] {
  return optionFixedPairs ?? state.fixedPairs;
}

export function getAvailablePlayerIds<ID extends PlayerId>(
  state: SchedulerState<ID>,
  restingPlayerIds: ID[],
): ID[] {
  const resting = new Set(restingPlayerIds);
  return state.players.map((player) => player.id).filter((id) => !resting.has(id));
}

export function findFixedPairForPlayer<ID extends PlayerId>(
  playerId: ID,
  fixedPairs: Team<ID>[],
): Team<ID> | undefined {
  return fixedPairs.find((pair) => pair[0] === playerId || pair[1] === playerId);
}

export function validateFixedPairs<ID extends PlayerId>(fixedPairs: Team<ID>[]): Team<ID>[] {
  const seen = new Set<ID>();
  for (const pair of fixedPairs) {
    if (seen.has(pair[0]) || seen.has(pair[1])) {
      throw new Error(`Conflicting fixed pairs for player ${String(pair[0])}/${String(pair[1])}`);
    }
    seen.add(pair[0]);
    seen.add(pair[1]);
  }
  return fixedPairs.map((pair) => [pair[0], pair[1]] as Team<ID>);
}

export function removePlayerFromFixedPairs<ID extends PlayerId>(
  fixedPairs: Team<ID>[],
  playerId: ID,
): Team<ID>[] {
  return fixedPairs.filter((pair) => pair[0] !== playerId && pair[1] !== playerId);
}

export function isFixedPairAvailable<ID extends PlayerId>(
  pair: Team<ID>,
  availablePlayerIds: Set<ID>,
): boolean {
  return availablePlayerIds.has(pair[0]) && availablePlayerIds.has(pair[1]);
}

export function fixedPairsConflict<ID extends PlayerId>(
  fixedPairs: Team<ID>[],
): ID | undefined {
  const seen = new Set<ID>();
  for (const pair of fixedPairs) {
    if (seen.has(pair[0])) {
      return pair[0];
    }
    if (seen.has(pair[1])) {
      return pair[1];
    }
    seen.add(pair[0]);
    seen.add(pair[1]);
  }
  return undefined;
}

export function isSameTeam<ID extends PlayerId>(team: Team<ID>, pair: Team<ID>): boolean {
  return pairsEqual(team, pair);
}
