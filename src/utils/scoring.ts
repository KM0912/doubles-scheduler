import type {
  ComputedOpponentStats,
  ComputedPairStats,
  ComputedPlayerStats,
  Player,
  PlayerId,
  Round,
  SchedulerState,
  StrategyWeights,
  Team,
} from "../types.js";
import { getPairGamesTogether, getPlayerStat } from "../stats/compute-stats.js";
import { pairKey } from "./pair-key.js";
import type { RandomFn } from "./random.js";

export const DEFAULT_STRATEGY_WEIGHTS: Required<StrategyWeights> = {
  balanceGames: 8,
  avoidRepeatedPair: 10,
  avoidRepeatedOpponent: 4,
  avoidConsecutiveRest: 6,
  avoidConsecutivePlay: 2,
  balanceRating: 5,
  randomness: 1,
};

export const DEFAULT_CANDIDATE_COUNT = 8;

export function mergeStrategyWeights(weights?: StrategyWeights): Required<StrategyWeights> {
  return {
    ...DEFAULT_STRATEGY_WEIGHTS,
    ...weights,
  };
}

export function getOpponentGamesAgainst<ID extends PlayerId>(
  opponentStats: ComputedOpponentStats<ID>[],
  players: Team<ID>,
): number {
  const key = pairKey(players[0], players[1]);
  return (
    opponentStats.find((stat) => pairKey(stat.players[0], stat.players[1]) === key)
      ?.gamesAgainst ?? 0
  );
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

  const ratings = members.map((player) => player.rating).filter((rating) => rating !== undefined);

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

export function scoreRound<ID extends PlayerId>(
  round: Round<ID>,
  state: SchedulerState<ID>,
  playerStats: ComputedPlayerStats<ID>[],
  pairStats: ComputedPairStats<ID>[],
  opponentStats: ComputedOpponentStats<ID>[],
  weights: Required<StrategyWeights>,
  random: RandomFn,
): number {
  const playingIds = getPlayingPlayerIds(round);
  let score = 0;

  if (playingIds.length > 0 && weights.balanceGames > 0) {
    const games = playingIds.map((id) => getPlayerStat(playerStats, id).games);
    score += weights.balanceGames * (Math.max(...games) - Math.min(...games));
  }

  if (weights.avoidRepeatedPair > 0) {
    let pairPenalty = 0;
    for (const match of round.matches) {
      for (const team of [match.teamA, match.teamB]) {
        pairPenalty += getPairGamesTogether(pairStats, team);
      }
    }
    score += weights.avoidRepeatedPair * pairPenalty;
  }

  if (weights.avoidRepeatedOpponent > 0) {
    let opponentPenalty = 0;
    for (const match of round.matches) {
      for (const playerA of match.teamA) {
        for (const playerB of match.teamB) {
          opponentPenalty += getOpponentGamesAgainst(opponentStats, [playerA, playerB]);
        }
      }
    }
    score += weights.avoidRepeatedOpponent * opponentPenalty;
  }

  const lastRoundId = state.rounds.at(-1)?.id;

  if (lastRoundId && weights.avoidConsecutiveRest > 0) {
    let consecutiveRestPenalty = 0;
    for (const playerId of [...round.restingPlayers, ...round.sittingOutPlayers]) {
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

  if (weights.balanceRating > 0) {
    let ratingPenalty = 0;
    for (const match of round.matches) {
      const teamAStrength = getTeamStrength(match.teamA, state.players, playerStats);
      const teamBStrength = getTeamStrength(match.teamB, state.players, playerStats);
      if (teamAStrength !== undefined && teamBStrength !== undefined) {
        ratingPenalty += Math.abs(teamAStrength - teamBStrength);
      }
    }
    score += weights.balanceRating * ratingPenalty;
  }

  if (weights.randomness > 0) {
    score += weights.randomness * random();
  }

  return score;
}
