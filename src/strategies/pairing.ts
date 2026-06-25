import type { ComputedOpponentStats, ComputedPairStats, PlayerId, Team } from "../types.js";
import type { RandomFn } from "../utils/random.js";
import { shuffleInPlace } from "../utils/random.js";
import { comparePlayerIds } from "../utils/compare-players.js";
import { getPairGamesTogether } from "../stats/compute-stats.js";
import type { ComputedPlayerStats } from "../types.js";
import { getOpponentGamesAgainst } from "../utils/scoring.js";

export function pairSolosRandomly<ID extends PlayerId>(
  solos: ID[],
  random: RandomFn,
): Team<ID>[] {
  const shuffled = shuffleInPlace([...solos], random);
  const teams: Team<ID>[] = [];

  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    teams.push([shuffled[i]!, shuffled[i + 1]!]);
  }

  return teams;
}

export function pairSolosByLeastPlayed<ID extends PlayerId>(
  solos: ID[],
  playerStats: ComputedPlayerStats<ID>[],
): Team<ID>[] {
  const sorted = [...solos].sort((a, b) => {
    const statsA = playerStats.find((stat) => stat.playerId === a);
    const statsB = playerStats.find((stat) => stat.playerId === b);
    const gamesDiff = (statsA?.games ?? 0) - (statsB?.games ?? 0);
    if (gamesDiff !== 0) {
      return gamesDiff;
    }
    return comparePlayerIds(a, b);
  });

  const teams: Team<ID>[] = [];
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    teams.push([sorted[i]!, sorted[i + 1]!]);
  }

  return teams;
}

export function pairSolosAvoidRepeatedPair<ID extends PlayerId>(
  solos: ID[],
  pairStats: ComputedPairStats<ID>[],
  random: RandomFn,
): Team<ID>[] {
  const remaining = [...solos];
  const teams: Team<ID>[] = [];

  while (remaining.length >= 2) {
    const first = remaining.shift()!;
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const score = getPairGamesTogether(pairStats, [first, candidate]);
      if (
        score < bestScore ||
        (score === bestScore && comparePlayerIds(candidate, remaining[bestIndex]!) < 0)
      ) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const partner = remaining.splice(bestIndex, 1)[0]!;
    teams.push([first, partner]);
  }

  shuffleInPlace(teams, random);
  return teams;
}

export function groupTeamsIntoMatches<ID extends PlayerId>(
  teams: Team<ID>[],
  random: RandomFn,
): Team<ID>[][] {
  const shuffled = shuffleInPlace([...teams], random);
  const matches: Team<ID>[][] = [];

  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    matches.push([shuffled[i]!, shuffled[i + 1]!]);
  }

  return matches;
}

function opponentMatchPenalty<ID extends PlayerId>(
  teamA: Team<ID>,
  teamB: Team<ID>,
  opponentStats: ComputedOpponentStats<ID>[],
): number {
  let penalty = 0;
  for (const playerA of teamA) {
    for (const playerB of teamB) {
      penalty += getOpponentGamesAgainst(opponentStats, [playerA, playerB]);
    }
  }
  return penalty;
}

export function groupTeamsAvoidRepeatedOpponent<ID extends PlayerId>(
  teams: Team<ID>[],
  opponentStats: ComputedOpponentStats<ID>[],
  random: RandomFn,
): Team<ID>[][] {
  const remaining = shuffleInPlace([...teams], random);
  const matches: Team<ID>[][] = [];

  while (remaining.length >= 2) {
    const teamA = remaining.shift()!;
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i++) {
      const teamB = remaining[i]!;
      const score = opponentMatchPenalty(teamA, teamB, opponentStats);
      if (
        score < bestScore ||
        (score === bestScore && comparePlayerIds(teamB[0], remaining[bestIndex]![0]) < 0)
      ) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const teamB = remaining.splice(bestIndex, 1)[0]!;
    matches.push([teamA, teamB]);
  }

  return matches;
}
