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
