import type { PlayerId, Team } from "../types.js";
import type { RandomFn } from "../utils/random.js";
import { shuffleInPlace } from "../utils/random.js";

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

export function pairSolosInOrder<ID extends PlayerId>(solos: ID[]): Team<ID>[] {
  const teams: Team<ID>[] = [];

  for (let i = 0; i + 1 < solos.length; i += 2) {
    teams.push([solos[i]!, solos[i + 1]!]);
  }

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

export function groupTeamsIntoMatchesInOrder<ID extends PlayerId>(
  teams: Team<ID>[],
): Team<ID>[][] {
  const matches: Team<ID>[][] = [];

  for (let i = 0; i + 1 < teams.length; i += 2) {
    matches.push([teams[i]!, teams[i + 1]!]);
  }

  return matches;
}

export function pairSolosByCost<ID extends PlayerId>(
  solos: ID[],
  cost: (left: ID, right: ID) => number,
  random: RandomFn,
): Team<ID>[] {
  const remaining = shuffleInPlace([...solos], random);
  const teams: Team<ID>[] = [];

  while (remaining.length >= 2) {
    let bestLeft = 0;
    let bestRight = 1;
    let bestCost = Number.POSITIVE_INFINITY;

    for (let left = 0; left < remaining.length; left += 1) {
      for (let right = left + 1; right < remaining.length; right += 1) {
        const pairCost = cost(remaining[left]!, remaining[right]!);
        if (pairCost < bestCost) {
          bestCost = pairCost;
          bestLeft = left;
          bestRight = right;
        }
      }
    }

    const partner = remaining[bestRight]!;
    const anchor = remaining[bestLeft]!;
    remaining.splice(bestRight, 1);
    remaining.splice(bestLeft, 1);
    teams.push([anchor, partner]);
  }

  return teams;
}

export function groupTeamsByCost<ID extends PlayerId>(
  teams: Team<ID>[],
  cost: (left: Team<ID>, right: Team<ID>) => number,
  random: RandomFn,
): Team<ID>[][] {
  const remaining = shuffleInPlace([...teams], random);
  const matches: Team<ID>[][] = [];

  while (remaining.length >= 2) {
    let bestLeft = 0;
    let bestRight = 1;
    let bestCost = Number.POSITIVE_INFINITY;

    for (let left = 0; left < remaining.length; left += 1) {
      for (let right = left + 1; right < remaining.length; right += 1) {
        const matchCost = cost(remaining[left]!, remaining[right]!);
        if (matchCost < bestCost) {
          bestCost = matchCost;
          bestLeft = left;
          bestRight = right;
        }
      }
    }

    const partner = remaining[bestRight]!;
    const anchor = remaining[bestLeft]!;
    remaining.splice(bestRight, 1);
    remaining.splice(bestLeft, 1);
    matches.push([anchor, partner]);
  }

  return matches;
}
