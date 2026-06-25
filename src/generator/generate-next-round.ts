import {
  computeOpponentStats,
  computePairStats,
  computePlayerStats,
} from "../stats/compute-stats.js";
import type {
  GenerationWarning,
  GenerateOptions,
  Match,
  PlayerId,
  Round,
  RoundProposal,
  SchedulerState,
  StrategyWeights,
  Team,
} from "../types.js";
import { createRandom, type RandomFn } from "../utils/random.js";
import {
  DEFAULT_CANDIDATE_COUNT,
  mergeStrategyWeights,
  scoreRound,
} from "../utils/scoring.js";
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
  pairSolosRandomly,
} from "../strategies/pairing.js";
import { sortPlayerIds } from "../utils/compare-players.js";

type BuildContext<ID extends PlayerId> = {
  state: SchedulerState<ID>;
  playingPlayerIds: ID[];
  sittingOutPlayerIds: ID[];
  restingPlayerIds: ID[];
  fixedPairs: Team<ID>[];
  roundNumber: number;
  maxMatches: number;
};

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
  random: RandomFn,
): Team<ID>[] {
  return pairSolosRandomly(solos, random);
}

function groupTeams<ID extends PlayerId>(
  teams: Team<ID>[],
  random: RandomFn,
): Team<ID>[][] {
  return groupTeamsIntoMatches(teams, random);
}

function buildRoundCandidate<ID extends PlayerId>(
  context: BuildContext<ID>,
  random: RandomFn,
): Round<ID> {
  const {
    state,
    playingPlayerIds,
    sittingOutPlayerIds,
    restingPlayerIds,
    fixedPairs,
    roundNumber,
    maxMatches,
  } = context;

  const { fixedTeams, solos } = buildFixedTeams(playingPlayerIds, fixedPairs);
  const soloTeams = buildTeams(solos, random);
  const allTeams = [...fixedTeams, ...soloTeams];
  const matchTeams = groupTeams(allTeams, random).slice(0, maxMatches);

  const matches: Match<ID>[] = matchTeams.map(([teamA, teamB], index) => ({
    id: `match-${roundNumber}-${index + 1}`,
    court: index + 1,
    teamA,
    teamB,
  }));

  const matchedPlayerIds = new Set<ID>(
    matches.flatMap((match) => [...match.teamA, ...match.teamB]),
  );
  const unmatchedPlayingIds = playingPlayerIds.filter(
    (playerId) => !matchedPlayerIds.has(playerId),
  );
  const allSittingOutPlayerIds = sortPlayerIds([
    ...sittingOutPlayerIds,
    ...unmatchedPlayingIds,
  ]);

  return {
    id: `round-${roundNumber}`,
    matches,
    restingPlayers: sortPlayerIds(
      restingPlayerIds.filter((id) =>
        state.players.some((player) => player.id === id),
      ),
    ),
    sittingOutPlayers: allSittingOutPlayerIds,
  };
}

function createCandidateRandom(
  seed: string | number | undefined,
  index: number,
): RandomFn {
  if (seed === undefined) {
    return createRandom();
  }
  return createRandom(`${seed}:${index}`);
}

function selectBestCandidate<ID extends PlayerId>(
  context: BuildContext<ID>,
  candidateCount: number,
  seed: string | number | undefined,
  weights: Required<StrategyWeights>,
): { round: Round<ID>; score: number } {
  const playerStats = computePlayerStats(context.state);
  const pairStats = computePairStats(context.state);
  const opponentStats = computeOpponentStats(context.state);

  let bestRound: Round<ID> | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index < candidateCount; index++) {
    const candidateRandom = createCandidateRandom(seed, index);
    const round = buildRoundCandidate(context, candidateRandom);
    const score = scoreRound(
      round,
      context.state,
      playerStats,
      pairStats,
      opponentStats,
      weights,
      candidateRandom,
    );

    if (score < bestScore) {
      bestScore = score;
      bestRound = round;
    }
  }

  return {
    round: bestRound!,
    score: bestScore,
  };
}

export function generateNextRound<ID extends PlayerId>(
  state: SchedulerState<ID>,
  options?: GenerateOptions<ID>,
): RoundProposal<ID> {
  const warnings: GenerationWarning<ID>[] = [];
  resolveStrategy(options?.strategy);

  const restingPlayerIds = getEffectiveRestingPlayerIds(
    state,
    options?.restingPlayerIds,
  );
  const fixedPairs = getEffectiveFixedPairs(state, options?.fixedPairs);
  const restingSet = new Set(restingPlayerIds);
  const unavailableDueToFixedPair = new Set<ID>();

  for (const pair of fixedPairs) {
    if (restingSet.has(pair[0]) || restingSet.has(pair[1])) {
      unavailableDueToFixedPair.add(pair[0]);
      unavailableDueToFixedPair.add(pair[1]);
    }
  }

  const availablePlayerIds = getAvailablePlayerIds(
    state,
    restingPlayerIds,
  ).filter((playerId) => !unavailableDueToFixedPair.has(playerId));
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

    const availableSet = new Set(
      getAvailablePlayerIds(state, restingPlayerIds),
    );
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
      id: `round-${roundNumber}`,
      matches: [],
      restingPlayers: sortPlayerIds(
        restingPlayerIds.filter((id) =>
          state.players.some((player) => player.id === id),
        ),
      ),
      sittingOutPlayers: [],
    };

    return {
      round,
      warnings: [
        ...warnings,
        ...collectGenerationWarnings(
          round,
          state.courtCount,
          availablePlayerIds.length,
        ),
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

  const buildContext: BuildContext<ID> = {
    state,
    playingPlayerIds,
    sittingOutPlayerIds,
    restingPlayerIds,
    fixedPairs,
    roundNumber,
    maxMatches,
  };

  const candidateCount = options?.candidateCount ?? DEFAULT_CANDIDATE_COUNT;
  const weights = mergeStrategyWeights(options?.weights);
  const { round, score } = selectBestCandidate(
    buildContext,
    candidateCount,
    options?.seed,
    weights,
  );

  return {
    round,
    score,
    warnings: [
      ...warnings,
      ...collectGenerationWarnings(
        round,
        state.courtCount,
        availablePlayerIds.length,
      ),
    ],
  };
}
