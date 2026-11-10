import { computePlayerStats } from "../stats/compute-stats.js";
import type {
  ComputedPlayerStats,
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
import {
  courtGroupUnits,
  createHistoryIndex,
  type HistoryIndex,
} from "../utils/history-index.js";
import { pairKey } from "../utils/pair-key.js";
import { createRandom, type RandomFn } from "../utils/random.js";
import {
  DEFAULT_CANDIDATE_COUNT,
  mergeStrategyWeights,
  opponentRepeatUnits,
  scoreMatches,
  scoreRound,
} from "../utils/scoring.js";
import {
  getAvailablePlayerIds,
  getEffectiveFixedPairs,
  getEffectiveRestingPlayerIds,
  isFixedPairAvailable,
} from "../state/helpers.js";
import { selectSittingOut } from "./select-sitting-out.js";
import { improveMatches } from "./improve-matches.js";
import { searchBestMatches } from "./search-matches.js";
import { collectGenerationWarnings } from "../validation/validate-round.js";
import { resolveStrategy } from "../strategies/index.js";
import {
  groupTeamsByCost,
  groupTeamsIntoMatches,
  groupTeamsIntoMatchesInOrder,
  pairSolosByCost,
  pairSolosInOrder,
  pairSolosRandomly,
} from "../strategies/pairing.js";
import { sortPlayerIds } from "../utils/compare-players.js";

type CandidateMode = "ordered" | "greedy" | "random";

type BuildContext<ID extends PlayerId> = {
  state: SchedulerState<ID>;
  playingPlayerIds: ID[];
  sittingOutPlayerIds: ID[];
  restingPlayerIds: ID[];
  fixedPairs: Team<ID>[];
  roundNumber: number;
  maxMatches: number;
  history: HistoryIndex;
  playerStats: ComputedPlayerStats<ID>[];
  weights: Required<StrategyWeights>;
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

function candidateMode(index: number, candidateCount: number): CandidateMode {
  if (index === 0) {
    return "ordered";
  }
  if (index === 1 && candidateCount > 1) {
    return "greedy";
  }
  return "random";
}

function pairCost<ID extends PlayerId>(
  history: HistoryIndex,
  left: ID,
  right: ID,
): number {
  return history.pairCounts.get(pairKey(left, right)) ?? 0;
}

function matchCost<ID extends PlayerId>(
  history: HistoryIndex,
  weights: Required<StrategyWeights>,
  left: Team<ID>,
  right: Team<ID>,
): number {
  let cost = 0;

  if (weights.avoidRepeatedOpponent > 0) {
    for (const playerA of left) {
      for (const playerB of right) {
        cost +=
          weights.avoidRepeatedOpponent *
          opponentRepeatUnits(
            history.opponentCounts.get(pairKey(playerA, playerB)) ?? 0,
          );
      }
    }
  }

  if (weights.avoidRepeatedCourtGroup > 0) {
    cost +=
      weights.avoidRepeatedCourtGroup * courtGroupUnits(left, right, history);
  }

  return cost;
}

function buildTeams<ID extends PlayerId>(
  solos: ID[],
  random: RandomFn,
  mode: CandidateMode,
  history: HistoryIndex,
): Team<ID>[] {
  if (mode === "ordered") {
    return pairSolosInOrder(solos);
  }

  if (mode === "greedy") {
    return pairSolosByCost(
      solos,
      (left, right) => pairCost(history, left, right),
      random,
    );
  }

  return pairSolosRandomly(solos, random);
}

function groupTeams<ID extends PlayerId>(
  teams: Team<ID>[],
  random: RandomFn,
  mode: CandidateMode,
  history: HistoryIndex,
  weights: Required<StrategyWeights>,
): Team<ID>[][] {
  if (mode === "ordered") {
    return groupTeamsIntoMatchesInOrder(teams);
  }

  if (mode === "greedy") {
    return groupTeamsByCost(
      teams,
      (left, right) => matchCost(history, weights, left, right),
      random,
    );
  }

  return groupTeamsIntoMatches(teams, random);
}

function assembleRound<ID extends PlayerId>(
  context: BuildContext<ID>,
  matchTeams: Team<ID>[][],
): Round<ID> {
  const {
    state,
    playingPlayerIds,
    sittingOutPlayerIds,
    restingPlayerIds,
    roundNumber,
  } = context;

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

function buildRoundCandidate<ID extends PlayerId>(
  context: BuildContext<ID>,
  random: RandomFn,
  mode: CandidateMode,
): Round<ID> {
  const { playingPlayerIds, fixedPairs, maxMatches, history, weights } =
    context;
  const { fixedTeams, solos } = buildFixedTeams(playingPlayerIds, fixedPairs);
  const soloTeams = buildTeams(solos, random, mode, history);
  const allTeams = [...fixedTeams, ...soloTeams];
  const matchTeams = groupTeams(allTeams, random, mode, history, weights).slice(
    0,
    maxMatches,
  );
  const lockedPlayerIds = new Set<ID>(fixedTeams.flat());
  const scoreCandidate = (candidate: Team<ID>[][]) =>
    scoreMatches(
      candidate,
      context.state,
      context.playerStats,
      history,
      weights,
    );
  const improved =
    scoreCandidate(matchTeams) === 0
      ? matchTeams
      : improveMatches(matchTeams, lockedPlayerIds, scoreCandidate);

  return assembleRound(context, improved);
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

function zeroRandom(): number {
  return 0;
}

function fixedPartnerMap<ID extends PlayerId>(
  playingPlayerIds: ID[],
  fixedPairs: Team<ID>[],
): Map<ID, ID> {
  const playing = new Set(playingPlayerIds);
  const partnerOf = new Map<ID, ID>();

  for (const pair of fixedPairs) {
    if (!playing.has(pair[0]) || !playing.has(pair[1])) {
      continue;
    }
    partnerOf.set(pair[0], pair[1]);
    partnerOf.set(pair[1], pair[0]);
  }

  return partnerOf;
}

function selectBestCandidate<ID extends PlayerId>(
  context: BuildContext<ID>,
  candidateCount: number,
  seed: string | number | undefined,
): { round: Round<ID>; score: number } {
  let bestRound: Round<ID> | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  const consider = (round: Round<ID>, random: RandomFn) => {
    const score = scoreRound(
      round,
      context.state,
      context.playerStats,
      context.history,
      context.weights,
      random,
    );
    if (score < bestScore) {
      bestScore = score;
      bestRound = round;
    }
  };

  consider(
    buildRoundCandidate(context, createCandidateRandom(seed, 0), "ordered"),
    zeroRandom,
  );

  const exactMatches = searchBestMatches(
    context.playingPlayerIds,
    context.maxMatches,
    fixedPartnerMap(context.playingPlayerIds, context.fixedPairs),
    (teams) =>
      scoreMatches(
        [teams],
        context.state,
        context.playerStats,
        context.history,
        context.weights,
      ),
  );
  if (exactMatches) {
    consider(assembleRound(context, exactMatches), zeroRandom);
  }

  const exhaustive =
    exactMatches !== undefined &&
    exactMatches.length * 4 === context.playingPlayerIds.length;

  if (!exhaustive) {
    for (let index = 1; index < candidateCount; index += 1) {
      const candidateRandom = createCandidateRandom(seed, index);
      consider(
        buildRoundCandidate(
          context,
          candidateRandom,
          candidateMode(index, candidateCount),
        ),
        candidateRandom,
      );
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

  const candidateCount = options?.candidateCount ?? DEFAULT_CANDIDATE_COUNT;
  const weights = mergeStrategyWeights(options?.weights);
  const buildContext: BuildContext<ID> = {
    state,
    playingPlayerIds,
    sittingOutPlayerIds,
    restingPlayerIds,
    fixedPairs,
    roundNumber,
    maxMatches,
    history: createHistoryIndex(state),
    playerStats: computePlayerStats(state),
    weights,
  };
  const { round, score } = selectBestCandidate(
    buildContext,
    candidateCount,
    options?.seed,
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
