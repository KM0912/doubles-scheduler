import { computePairStats, computePlayerStats } from "../stats/compute-stats.js";
import type {
  BuiltInStrategy,
  GenerationWarning,
  Match,
  PlayerId,
  Round,
  SchedulerState,
  Team,
} from "../types.js";
import { createRandom } from "../utils/random.js";
import {
  getAvailablePlayerIds,
  getEffectiveFixedPairs,
  getEffectiveRestingPlayerIds,
  isFixedPairAvailable,
} from "../state/helpers.js";
import { selectSittingOut } from "./select-sitting-out.js";
import { collectGenerationWarnings } from "../validation/validate-round.js";
import { resolveStrategy } from "../strategies/index.js";
import {
  groupTeamsIntoMatches,
  pairSolosAvoidRepeatedPair,
  pairSolosByLeastPlayed,
  pairSolosRandomly,
} from "../strategies/pairing.js";
import { sortPlayerIds } from "../utils/compare-players.js";

function buildFixedTeams<ID extends PlayerId>(
  playingPlayerIds: ID[],
  fixedPairs: Team<ID>[],
): { fixedTeams: Team<ID>[]; solos: ID[] } {
  const playingSet = new Set(playingPlayerIds);
  const fixedTeams: Team<ID>[] = [];
  const assigned = new Set<ID>();

  for (const pair of fixedPairs) {
    if (!playingSet.has(pair[0]) || !playingSet.has(pair[1])) {
      continue;
    }

    fixedTeams.push([pair[0], pair[1]]);
    assigned.add(pair[0]);
    assigned.add(pair[1]);
  }

  const solos = playingPlayerIds.filter((id) => !assigned.has(id));
  return { fixedTeams, solos };
}

function buildTeams<ID extends PlayerId>(
  solos: ID[],
  strategy: BuiltInStrategy,
  state: SchedulerState<ID>,
  random: ReturnType<typeof createRandom>,
): Team<ID>[] {
  const playerStats = computePlayerStats(state);
  const pairStats = computePairStats(state);

  switch (strategy) {
    case "leastPlayed":
      return pairSolosByLeastPlayed(solos, playerStats);
    case "avoidRepeatedPair":
      return pairSolosAvoidRepeatedPair(solos, pairStats, random);
    case "random":
    default:
      return pairSolosRandomly(solos, random);
  }
}

function createRoundId(roundNumber: number): string {
  return `round-${roundNumber}`;
}

function createMatchId(roundNumber: number, court: number): string {
  return `match-${roundNumber}-${court}`;
}

export function generateNextRound<ID extends PlayerId>(
  state: SchedulerState<ID>,
  options?: import("../types.js").GenerateOptions<ID>,
): import("../types.js").RoundProposal<ID> {
  const warnings: GenerationWarning<ID>[] = [];
  const strategy = resolveStrategy(options?.strategy);
  const random = createRandom(options?.seed);
  const restingPlayerIds = getEffectiveRestingPlayerIds(state, options?.restingPlayerIds);
  const fixedPairs = getEffectiveFixedPairs(state, options?.fixedPairs);
  const restingSet = new Set(restingPlayerIds);
  const unavailableDueToFixedPair = new Set<ID>();

  for (const pair of fixedPairs) {
    if (restingSet.has(pair[0]) || restingSet.has(pair[1])) {
      unavailableDueToFixedPair.add(pair[0]);
      unavailableDueToFixedPair.add(pair[1]);
    }
  }

  const availablePlayerIds = getAvailablePlayerIds(state, restingPlayerIds).filter(
    (playerId) => !unavailableDueToFixedPair.has(playerId),
  );
  const roundNumber = state.rounds.length + 1;

  for (const pair of fixedPairs) {
    if (restingSet.has(pair[0]) || restingSet.has(pair[1])) {
      warnings.push({
        type: "fixedPairUnavailable",
        pair,
        reason: "One player is resting or unavailable",
      });
      continue;
    }

    const availableSet = new Set(getAvailablePlayerIds(state, restingPlayerIds));
    if (!isFixedPairAvailable(pair, availableSet)) {
      warnings.push({
        type: "fixedPairUnavailable",
        pair,
        reason: "Both players are unavailable",
      });
    }
  }

  if (availablePlayerIds.length < 4) {
    const round: Round<ID> = {
      id: createRoundId(roundNumber),
      matches: [],
      restingPlayers: sortPlayerIds(
        restingPlayerIds.filter((id) => state.players.some((player) => player.id === id)),
      ),
      sittingOutPlayers: [],
    };

    return {
      round,
      warnings: [
        ...warnings,
        ...collectGenerationWarnings(round, state.courtCount, availablePlayerIds.length),
      ],
    };
  }

  const { playingPlayerIds, sittingOutPlayerIds } = selectSittingOut(
    state,
    availablePlayerIds,
    fixedPairs,
    state.courtCount,
  );

  const maxMatches = Math.min(
    Math.floor(playingPlayerIds.length / 4),
    state.courtCount,
  );

  const { fixedTeams, solos } = buildFixedTeams(playingPlayerIds, fixedPairs);
  const soloTeams = buildTeams(solos, strategy, state, random);
  const allTeams = [...fixedTeams, ...soloTeams];
  const matchTeams = groupTeamsIntoMatches(allTeams, random).slice(0, maxMatches);

  const matches: Match<ID>[] = matchTeams.map(([teamA, teamB], index) => ({
    id: createMatchId(roundNumber, index + 1),
    court: index + 1,
    teamA,
    teamB,
  }));

  const matchedPlayerIds = new Set<ID>(
    matches.flatMap((match) => [...match.teamA, ...match.teamB]),
  );
  const unmatchedPlayingIds = playingPlayerIds.filter((playerId) => !matchedPlayerIds.has(playerId));
  const allSittingOutPlayerIds = sortPlayerIds([
    ...sittingOutPlayerIds,
    ...unmatchedPlayingIds,
  ]);

  const round: Round<ID> = {
    id: createRoundId(roundNumber),
    matches,
    restingPlayers: sortPlayerIds(
      restingPlayerIds.filter((id) => state.players.some((player) => player.id === id)),
    ),
    sittingOutPlayers: allSittingOutPlayerIds,
  };

  return {
    round,
    warnings: [
      ...warnings,
      ...collectGenerationWarnings(round, state.courtCount, availablePlayerIds.length),
    ],
  };
}
