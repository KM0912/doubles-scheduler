import type {
  ComputedOpponentStats,
  ComputedPairStats,
  ComputedPlayerStats,
  PlayerId,
  SchedulerState,
  Team,
} from "../types.js";
import { pairKey } from "../utils/pair-key.js";

function createEmptyStats<ID extends PlayerId>(playerId: ID): ComputedPlayerStats<ID> {
  return {
    playerId,
    games: 0,
    rests: 0,
    sitOuts: 0,
    wins: 0,
    losses: 0,
  };
}

export function computePlayerStats<ID extends PlayerId>(
  state: SchedulerState<ID>,
): ComputedPlayerStats<ID>[] {
  const statsById = new Map<ID, ComputedPlayerStats<ID>>();

  for (const player of state.players) {
    const stats = createEmptyStats(player.id);
    stats.games = player.stats?.games ?? 0;
    stats.rests = player.stats?.rests ?? 0;
    stats.wins = player.stats?.wins ?? 0;
    stats.losses = player.stats?.losses ?? 0;
    statsById.set(player.id, stats);
  }

  for (const round of state.rounds) {
    const playingIds = new Set<ID>();

    for (const match of round.matches) {
      for (const playerId of [...match.teamA, ...match.teamB]) {
        playingIds.add(playerId);
      }
    }

    for (const playerId of round.restingPlayers) {
      const stats = statsById.get(playerId);
      if (stats) {
        stats.rests += 1;
        stats.lastRoundRested = round.id;
      }
    }

    for (const playerId of round.sittingOutPlayers) {
      const stats = statsById.get(playerId);
      if (stats) {
        stats.sitOuts += 1;
      }
    }

    for (const playerId of playingIds) {
      const stats = statsById.get(playerId);
      if (stats) {
        stats.games += 1;
        stats.lastRoundPlayed = round.id;
      }
    }

    for (const match of round.matches) {
      if (!match.result?.winner) {
        continue;
      }

      const winners = match.result.winner === "teamA" ? match.teamA : match.teamB;
      const losers = match.result.winner === "teamA" ? match.teamB : match.teamA;

      for (const playerId of winners) {
        const stats = statsById.get(playerId);
        if (stats) {
          stats.wins += 1;
        }
      }

      for (const playerId of losers) {
        const stats = statsById.get(playerId);
        if (stats) {
          stats.losses += 1;
        }
      }
    }
  }

  return [...statsById.values()];
}

export function computePairStats<ID extends PlayerId>(
  state: SchedulerState<ID>,
): ComputedPairStats<ID>[] {
  const counts = new Map<string, { pair: Team<ID>; gamesTogether: number }>();

  for (const round of state.rounds) {
    for (const match of round.matches) {
      for (const team of [match.teamA, match.teamB]) {
        const key = pairKey(team[0], team[1]);
        const existing = counts.get(key);
        if (existing) {
          existing.gamesTogether += 1;
        } else {
          counts.set(key, {
            pair: [team[0], team[1]],
            gamesTogether: 1,
          });
        }
      }
    }
  }

  return [...counts.values()];
}

export function getPairGamesTogether<ID extends PlayerId>(
  pairStats: ComputedPairStats<ID>[],
  pair: Team<ID>,
): number {
  const key = pairKey(pair[0], pair[1]);
  return pairStats.find((stat) => pairKey(stat.pair[0], stat.pair[1]) === key)?.gamesTogether ?? 0;
}

export function computeOpponentStats<ID extends PlayerId>(
  state: SchedulerState<ID>,
): ComputedOpponentStats<ID>[] {
  const counts = new Map<string, { players: Team<ID>; gamesAgainst: number }>();

  for (const round of state.rounds) {
    for (const match of round.matches) {
      for (const playerA of match.teamA) {
        for (const playerB of match.teamB) {
          const key = pairKey(playerA, playerB);
          const existing = counts.get(key);
          if (existing) {
            existing.gamesAgainst += 1;
          } else {
            counts.set(key, {
              players: [playerA, playerB],
              gamesAgainst: 1,
            });
          }
        }
      }
    }
  }

  return [...counts.values()];
}

export function getPlayerStat<ID extends PlayerId>(
  playerStats: ComputedPlayerStats<ID>[],
  playerId: ID,
): ComputedPlayerStats<ID> {
  return (
    playerStats.find((stat) => stat.playerId === playerId) ?? {
      ...createEmptyStats(playerId),
    }
  );
}
