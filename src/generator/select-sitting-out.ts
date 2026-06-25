import { computePlayerStats } from "../stats/compute-stats.js";
import type {
  ComputedPlayerStats,
  PlayerId,
  Round,
  SchedulerState,
  Team,
} from "../types.js";
import { comparePlayerIds, sortPlayerIds } from "../utils/compare-players.js";
import { findFixedPairForPlayer } from "../state/helpers.js";

type SelectionUnit<ID extends PlayerId> = {
  playerIds: ID[];
  games: number;
  rests: number;
  sitOuts: number;
  restedOrSatOutLastRound: boolean;
  tiebreakId: ID;
};

type RankedSelectionUnit<ID extends PlayerId> = SelectionUnit<ID> & {
  rank: number;
};

function buildSelectionUnits<ID extends PlayerId>(
  availablePlayerIds: ID[],
  fixedPairs: Team<ID>[],
  statsById: Map<ID, ComputedPlayerStats<ID>>,
  lastUnavailableIds: Set<ID>,
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
    const sitOuts = Math.max(
      firstStats?.sitOuts ?? 0,
      secondStats?.sitOuts ?? 0,
    );
    const tiebreakId = sortPlayerIds([pair[0], pair[1]])[0]!;

    units.push({
      playerIds: [pair[0], pair[1]],
      games,
      rests,
      sitOuts,
      restedOrSatOutLastRound:
        lastUnavailableIds.has(pair[0]) || lastUnavailableIds.has(pair[1]),
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
      sitOuts: stats?.sitOuts ?? 0,
      restedOrSatOutLastRound: lastUnavailableIds.has(playerId),
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
  if (a.restedOrSatOutLastRound !== b.restedOrSatOutLastRound) {
    return a.restedOrSatOutLastRound ? -1 : 1;
  }
  if (a.sitOuts !== b.sitOuts) {
    return b.sitOuts - a.sitOuts;
  }
  if (a.rests !== b.rests) {
    return b.rests - a.rests;
  }
  return comparePlayerIds(a.tiebreakId, b.tiebreakId);
}

function playingSetKey<ID extends PlayerId>(playerIds: ID[]): string {
  return sortPlayerIds(playerIds).map(String).join("\u0001");
}

function getRoundPlayingPlayerIds<ID extends PlayerId>(round: Round<ID>): ID[] {
  return round.matches.flatMap((match) => [...match.teamA, ...match.teamB]);
}

function getPreviousPlayingSetCounts<ID extends PlayerId>(
  state: SchedulerState<ID>,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const round of state.rounds) {
    const key = playingSetKey(getRoundPlayingPlayerIds(round));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function getLastUnavailableIds<ID extends PlayerId>(
  state: SchedulerState<ID>,
): Set<ID> {
  const lastRound = state.rounds.at(-1);
  return new Set<ID>([
    ...(lastRound?.restingPlayers ?? []),
    ...(lastRound?.sittingOutPlayers ?? []),
  ]);
}

function createSelectionResult<ID extends PlayerId>(
  availablePlayerIds: ID[],
  selectedUnits: SelectionUnit<ID>[],
): { playingPlayerIds: ID[]; sittingOutPlayerIds: ID[] } {
  const playingSet = new Set<ID>();

  for (const unit of selectedUnits) {
    for (const playerId of unit.playerIds) {
      playingSet.add(playerId);
    }
  }

  return {
    playingPlayerIds: availablePlayerIds.filter((id) => playingSet.has(id)),
    sittingOutPlayerIds: availablePlayerIds.filter((id) => !playingSet.has(id)),
  };
}

function selectGreedyUnits<ID extends PlayerId>(
  units: SelectionUnit<ID>[],
  capacity: number,
): SelectionUnit<ID>[] {
  const selectedUnits: SelectionUnit<ID>[] = [];
  let usedCapacity = 0;

  for (const unit of units) {
    if (usedCapacity + unit.playerIds.length > capacity) {
      continue;
    }

    selectedUnits.push(unit);
    usedCapacity += unit.playerIds.length;
  }

  return selectedUnits;
}

function fairnessSignature<ID extends PlayerId>(
  units: SelectionUnit<ID>[],
): string {
  return units
    .map((unit) =>
      [
        unit.playerIds.length,
        unit.games,
        unit.restedOrSatOutLastRound ? 1 : 0,
        unit.sitOuts,
        unit.rests,
      ].join(":"),
    )
    .sort()
    .join("|");
}

function enumerateSelections<ID extends PlayerId>(
  units: RankedSelectionUnit<ID>[],
  capacity: number,
  maxSelections = 5000,
): RankedSelectionUnit<ID>[][] {
  const selections: RankedSelectionUnit<ID>[][] = [];
  const remainingCapacityByIndex: number[] = new Array(units.length + 1).fill(
    0,
  );

  for (let index = units.length - 1; index >= 0; index--) {
    remainingCapacityByIndex[index] =
      remainingCapacityByIndex[index + 1]! + units[index]!.playerIds.length;
  }

  function visit(
    index: number,
    selected: RankedSelectionUnit<ID>[],
    usedCapacity: number,
  ): void {
    if (selections.length >= maxSelections) {
      return;
    }

    if (usedCapacity === capacity) {
      selections.push([...selected]);
      return;
    }

    if (
      index >= units.length ||
      usedCapacity > capacity ||
      usedCapacity + remainingCapacityByIndex[index]! < capacity
    ) {
      return;
    }

    const unit = units[index]!;
    if (usedCapacity + unit.playerIds.length <= capacity) {
      selected.push(unit);
      visit(index + 1, selected, usedCapacity + unit.playerIds.length);
      selected.pop();
    }

    visit(index + 1, selected, usedCapacity);
  }

  visit(0, [], 0);
  return selections;
}

function countConsecutiveUnavailable<ID extends PlayerId>(
  sittingOutPlayerIds: ID[],
  lastUnavailableIds: Set<ID>,
): number {
  return sittingOutPlayerIds.filter((id) => lastUnavailableIds.has(id)).length;
}

function selectAlternativeForRepeatedLineup<ID extends PlayerId>(
  state: SchedulerState<ID>,
  availablePlayerIds: ID[],
  sortedUnits: SelectionUnit<ID>[],
  baselineUnits: SelectionUnit<ID>[],
  capacity: number,
  lastUnavailableIds: Set<ID>,
): SelectionUnit<ID>[] {
  const previousPlayingSetCounts = getPreviousPlayingSetCounts(state);
  const baselineResult = createSelectionResult(
    availablePlayerIds,
    baselineUnits,
  );
  const baselineKey = playingSetKey(baselineResult.playingPlayerIds);

  if ((previousPlayingSetCounts.get(baselineKey) ?? 0) === 0) {
    return baselineUnits;
  }

  const baselineFairness = fairnessSignature(baselineUnits);
  const rankedUnits: RankedSelectionUnit<ID>[] = sortedUnits.map(
    (unit, rank) => ({
      ...unit,
      rank,
    }),
  );
  const selections = enumerateSelections(rankedUnits, capacity);
  let bestUnits: RankedSelectionUnit<ID>[] | undefined;
  let bestRepeatedCount = Number.POSITIVE_INFINITY;
  let bestConsecutiveUnavailableCount = Number.POSITIVE_INFINITY;
  let bestRankSum = Number.POSITIVE_INFINITY;

  for (const selection of selections) {
    if (fairnessSignature(selection) !== baselineFairness) {
      continue;
    }

    const result = createSelectionResult(availablePlayerIds, selection);
    const repeatedCount =
      previousPlayingSetCounts.get(playingSetKey(result.playingPlayerIds)) ?? 0;
    const consecutiveUnavailableCount = countConsecutiveUnavailable(
      result.sittingOutPlayerIds,
      lastUnavailableIds,
    );
    const rankSum = selection.reduce((sum, unit) => sum + unit.rank, 0);

    if (
      repeatedCount < bestRepeatedCount ||
      (repeatedCount === bestRepeatedCount &&
        consecutiveUnavailableCount < bestConsecutiveUnavailableCount) ||
      (repeatedCount === bestRepeatedCount &&
        consecutiveUnavailableCount === bestConsecutiveUnavailableCount &&
        rankSum < bestRankSum)
    ) {
      bestUnits = selection;
      bestRepeatedCount = repeatedCount;
      bestConsecutiveUnavailableCount = consecutiveUnavailableCount;
      bestRankSum = rankSum;
    }
  }

  return bestUnits ?? baselineUnits;
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
  const lastUnavailableIds = getLastUnavailableIds(state);
  const units = buildSelectionUnits(
    availablePlayerIds,
    fixedPairs,
    statsById,
    lastUnavailableIds,
  ).sort(compareUnits);
  const baselineUnits = selectGreedyUnits(units, capacity);
  const selectedUnits = selectAlternativeForRepeatedLineup(
    state,
    availablePlayerIds,
    units,
    baselineUnits,
    capacity,
    lastUnavailableIds,
  );

  return createSelectionResult(availablePlayerIds, selectedUnits);
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
