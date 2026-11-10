import type {
  ComputedPlayerStats,
  Player,
  PlayerId,
  Round,
  SchedulerState,
  StrategyWeights,
  Team,
} from "../types.js";
import { getPlayerStat } from "../stats/compute-stats.js";
import { courtGroupUnits, type HistoryIndex } from "./history-index.js";
import { pairKey } from "./pair-key.js";
import type { RandomFn } from "./random.js";

export const DEFAULT_STRATEGY_WEIGHTS: Required<StrategyWeights> = {
  balanceGames: 8,
  avoidRepeatedPair: 10,
  avoidRepeatedOpponent: 6,
  avoidRepeatedCourtGroup: 12,
  avoidConsecutiveRest: 6,
  avoidConsecutivePlay: 2,
  balanceRating: 5,
  randomness: 1,
};

export const DEFAULT_CANDIDATE_COUNT = 8;

export function opponentRepeatUnits(gamesAgainst: number): number {
  if (gamesAgainst <= 1) {
    return gamesAgainst;
  }

  return gamesAgainst * 8;
}

export function mergeStrategyWeights(
  weights?: StrategyWeights,
): Required<StrategyWeights> {
  return {
    ...DEFAULT_STRATEGY_WEIGHTS,
    ...weights,
  };
}

function getPlayingPlayerIds<ID extends PlayerId>(round: Round<ID>): ID[] {
  return round.matches.flatMap((match) => [...match.teamA, ...match.teamB]);
}

function getTeamStrength<ID extends PlayerId>(
  team: Team<ID>,
  players: Player<ID>[],
  playerStats: ComputedPlayerStats<ID>[],
): number | undefined {
  const members = team
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is Player<ID> => player !== undefined);

  if (members.length !== team.length) {
    return undefined;
  }

  const ratings = members
    .map((player) => player.rating)
    .filter((rating) => rating !== undefined);

  if (ratings.length === team.length) {
    return ratings.reduce((sum, rating) => sum + rating, 0) / team.length;
  }

  const hasRecord = members.some((player) => {
    const stats = getPlayerStat(playerStats, player.id);
    return stats.wins > 0 || stats.losses > 0;
  });

  if (!hasRecord) {
    return undefined;
  }

  return (
    members.reduce((sum, player) => {
      const stats = getPlayerStat(playerStats, player.id);
      const games = stats.wins + stats.losses;
      return sum + (games > 0 ? stats.wins / games : 0);
    }, 0) / team.length
  );
}

export function scoreMatches<ID extends PlayerId>(
  matches: Team<ID>[][],
  state: SchedulerState<ID>,
  playerStats: ComputedPlayerStats<ID>[],
  history: HistoryIndex,
  weights: Required<StrategyWeights>,
): number {
  let score = 0;

  if (weights.avoidRepeatedPair > 0) {
    let pairPenalty = 0;
    for (const [teamA, teamB] of matches) {
      pairPenalty += history.pairCounts.get(pairKey(teamA[0], teamA[1])) ?? 0;
      pairPenalty += history.pairCounts.get(pairKey(teamB[0], teamB[1])) ?? 0;
    }
    score += weights.avoidRepeatedPair * pairPenalty;
  }

  if (weights.avoidRepeatedOpponent > 0) {
    let opponentPenalty = 0;
    for (const [teamA, teamB] of matches) {
      for (const playerA of teamA) {
        for (const playerB of teamB) {
          opponentPenalty += opponentRepeatUnits(
            history.opponentCounts.get(pairKey(playerA, playerB)) ?? 0,
          );
        }
      }
    }
    score += weights.avoidRepeatedOpponent * opponentPenalty;
  }

  if (weights.avoidRepeatedCourtGroup > 0) {
    let courtGroupPenalty = 0;
    for (const [teamA, teamB] of matches) {
      courtGroupPenalty += courtGroupUnits(teamA, teamB, history);
    }
    score += weights.avoidRepeatedCourtGroup * courtGroupPenalty;
  }

  if (weights.balanceRating > 0) {
    let ratingPenalty = 0;
    for (const [teamA, teamB] of matches) {
      const teamAStrength = getTeamStrength(teamA, state.players, playerStats);
      const teamBStrength = getTeamStrength(teamB, state.players, playerStats);
      if (teamAStrength !== undefined && teamBStrength !== undefined) {
        ratingPenalty += Math.abs(teamAStrength - teamBStrength);
      }
    }
    score += weights.balanceRating * ratingPenalty;
  }

  return score;
}

export function scoreRound<ID extends PlayerId>(
  round: Round<ID>,
  state: SchedulerState<ID>,
  playerStats: ComputedPlayerStats<ID>[],
  history: HistoryIndex,
  weights: Required<StrategyWeights>,
  random: RandomFn,
): number {
  const playingIds = getPlayingPlayerIds(round);
  let score = scoreMatches(
    round.matches.map((match) => [match.teamA, match.teamB]),
    state,
    playerStats,
    history,
    weights,
  );

  if (playingIds.length > 0 && weights.balanceGames > 0) {
    const games = playingIds.map((id) => getPlayerStat(playerStats, id).games);
    score += weights.balanceGames * (Math.max(...games) - Math.min(...games));
  }

  const lastRoundId = state.rounds.at(-1)?.id;

  if (lastRoundId && weights.avoidConsecutiveRest > 0) {
    let consecutiveRestPenalty = 0;
    for (const playerId of [
      ...round.restingPlayers,
      ...round.sittingOutPlayers,
    ]) {
      const stats = getPlayerStat(playerStats, playerId);
      if (stats.lastRoundPlayed !== lastRoundId) {
        consecutiveRestPenalty += 1;
      }
    }
    score += weights.avoidConsecutiveRest * consecutiveRestPenalty;
  }

  if (lastRoundId && weights.avoidConsecutivePlay > 0) {
    let consecutivePlayPenalty = 0;
    for (const playerId of playingIds) {
      const stats = getPlayerStat(playerStats, playerId);
      if (stats.lastRoundPlayed === lastRoundId) {
        consecutivePlayPenalty += 1;
      }
    }
    score += weights.avoidConsecutivePlay * consecutivePlayPenalty;
  }

  if (weights.randomness > 0) {
    score += weights.randomness * random();
  }

  return score;
}
