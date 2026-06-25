import { computePlayerStats } from "../stats/compute-stats.js";
import type { ComputedPlayerStats, PlayerId, SchedulerState, Team } from "../types.js";
import { comparePlayerIds, sortPlayerIds } from "../utils/compare-players.js";
import { findFixedPairForPlayer } from "../state/helpers.js";

type SelectionUnit<ID extends PlayerId> = {
  playerIds: ID[];
  games: number;
  rests: number;
  tiebreakId: ID;
};

function buildSelectionUnits<ID extends PlayerId>(
  availablePlayerIds: ID[],
  fixedPairs: Team<ID>[],
  statsById: Map<ID, ComputedPlayerStats<ID>>,
): SelectionUnit<ID>[] {
  const availableSet = new Set(availablePlayerIds);
  const assigned = new Set<ID>();
  const units: SelectionUnit<ID>[] = [];

  for (const pair of fixedPairs) {
    if (!availableSet.has(pair[0]) || !availableSet.has(pair[1])) {
      continue;
    }

    assigned.add(pair[0]);
    assigned.add(pair[1]);

    const firstStats = statsById.get(pair[0]);
    const secondStats = statsById.get(pair[1]);
    const games = Math.max(firstStats?.games ?? 0, secondStats?.games ?? 0);
    const rests = Math.max(firstStats?.rests ?? 0, secondStats?.rests ?? 0);
    const tiebreakId = sortPlayerIds([pair[0], pair[1]])[0]!;

    units.push({
      playerIds: [pair[0], pair[1]],
      games,
      rests,
      tiebreakId,
    });
  }

  for (const playerId of availablePlayerIds) {
    if (assigned.has(playerId)) {
      continue;
    }

    const stats = statsById.get(playerId);
    units.push({
      playerIds: [playerId],
      games: stats?.games ?? 0,
      rests: stats?.rests ?? 0,
      tiebreakId: playerId,
    });
  }

  return units;
}

function compareUnits<ID extends PlayerId>(
  a: SelectionUnit<ID>,
  b: SelectionUnit<ID>,
): number {
  if (a.games !== b.games) {
    return a.games - b.games;
  }
  if (a.rests !== b.rests) {
    return b.rests - a.rests;
  }
  return comparePlayerIds(a.tiebreakId, b.tiebreakId);
}

export function selectSittingOut<ID extends PlayerId>(
  state: SchedulerState<ID>,
  availablePlayerIds: ID[],
  fixedPairs: Team<ID>[],
  courtCount: number,
): { playingPlayerIds: ID[]; sittingOutPlayerIds: ID[] } {
  const capacity = Math.min(availablePlayerIds.length, courtCount * 4);

  if (availablePlayerIds.length <= capacity) {
    return {
      playingPlayerIds: [...availablePlayerIds],
      sittingOutPlayerIds: [],
    };
  }

  const playerStats = computePlayerStats(state);
  const statsById = new Map(playerStats.map((stat) => [stat.playerId, stat]));
  const units = buildSelectionUnits(availablePlayerIds, fixedPairs, statsById).sort(compareUnits);

  const playingSet = new Set<ID>();
  let usedCapacity = 0;

  for (const unit of units) {
    if (usedCapacity + unit.playerIds.length > capacity) {
      continue;
    }

    for (const playerId of unit.playerIds) {
      playingSet.add(playerId);
    }
    usedCapacity += unit.playerIds.length;
  }

  const playingPlayerIds = availablePlayerIds.filter((id) => playingSet.has(id));
  const sittingOutPlayerIds = availablePlayerIds.filter((id) => !playingSet.has(id));

  return {
    playingPlayerIds,
    sittingOutPlayerIds,
  };
}

export function getFixedPairPartner<ID extends PlayerId>(
  playerId: ID,
  fixedPairs: Team<ID>[],
): ID | undefined {
  const pair = findFixedPairForPlayer(playerId, fixedPairs);
  if (!pair) {
    return undefined;
  }
  return pair[0] === playerId ? pair[1] : pair[0];
}
