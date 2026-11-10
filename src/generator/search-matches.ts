import type { PlayerId, Team } from "../types.js";

const PAIRING_INDEXES = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
] as const;

function keepsFixedPairs<ID extends PlayerId>(
  teamA: Team<ID>,
  teamB: Team<ID>,
  partnerOf: ReadonlyMap<ID, ID>,
): boolean {
  for (const team of [teamA, teamB]) {
    for (const playerId of team) {
      const partner = partnerOf.get(playerId);
      if (partner !== undefined && partner !== team[0] && partner !== team[1]) {
        return false;
      }
    }
  }
  return true;
}

function splitsFixedPair<ID extends PlayerId>(
  group: ID[],
  partnerOf: ReadonlyMap<ID, ID>,
): boolean {
  for (const playerId of group) {
    const partner = partnerOf.get(playerId);
    if (partner !== undefined && !group.includes(partner)) {
      return true;
    }
  }
  return false;
}

function bestPairing<ID extends PlayerId>(
  group: ID[],
  partnerOf: ReadonlyMap<ID, ID>,
  scoreMatch: (teams: Team<ID>[]) => number,
): { teams: Team<ID>[]; score: number } | undefined {
  let bestTeams: Team<ID>[] | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const indexes of PAIRING_INDEXES) {
    const teams: Team<ID>[] = [
      [group[indexes[0]]!, group[indexes[1]]!],
      [group[indexes[2]]!, group[indexes[3]]!],
    ];
    if (!keepsFixedPairs(teams[0]!, teams[1]!, partnerOf)) {
      continue;
    }
    const score = scoreMatch(teams);
    if (score < bestScore) {
      bestScore = score;
      bestTeams = teams;
    }
  }

  if (!bestTeams) {
    return undefined;
  }

  return { teams: bestTeams, score: bestScore };
}

function chooseThree<ID extends PlayerId>(
  players: ID[],
  visit: (combo: [ID, ID, ID]) => void,
): void {
  for (let first = 0; first < players.length; first += 1) {
    for (let second = first + 1; second < players.length; second += 1) {
      for (let third = second + 1; third < players.length; third += 1) {
        visit([players[first]!, players[second]!, players[third]!]);
      }
    }
  }
}

function chooseFour<ID extends PlayerId>(
  players: ID[],
  visit: (combo: [ID, ID, ID, ID]) => void,
): void {
  for (let first = 0; first < players.length; first += 1) {
    for (let second = first + 1; second < players.length; second += 1) {
      for (let third = second + 1; third < players.length; third += 1) {
        for (let fourth = third + 1; fourth < players.length; fourth += 1) {
          visit([
            players[first]!,
            players[second]!,
            players[third]!,
            players[fourth]!,
          ]);
        }
      }
    }
  }
}

function withoutIds<ID extends PlayerId>(players: ID[], removed: ID[]): ID[] {
  const skip = new Set(removed);
  return players.filter((playerId) => !skip.has(playerId));
}

export function searchBestMatches<ID extends PlayerId>(
  playerIds: ID[],
  maxMatches: number,
  partnerOf: ReadonlyMap<ID, ID>,
  scoreMatch: (teams: Team<ID>[]) => number,
): Team<ID>[][] | undefined {
  const matchCount = Math.min(maxMatches, Math.floor(playerIds.length / 4));
  if (matchCount === 0 || matchCount > 3 || playerIds.length > 12) {
    return undefined;
  }

  let bestScore = Number.POSITIVE_INFINITY;
  let bestMatches: Team<ID>[][] | undefined;

  const evaluate = (groups: ID[][]) => {
    const matches: Team<ID>[][] = [];
    let total = 0;

    for (const group of groups) {
      if (splitsFixedPair(group, partnerOf)) {
        return;
      }
      const pairing = bestPairing(group, partnerOf, scoreMatch);
      if (!pairing) {
        return;
      }
      total += pairing.score;
      matches.push(pairing.teams);
    }

    if (total < bestScore) {
      bestScore = total;
      bestMatches = matches;
    }
  };

  const visit = (remaining: ID[], left: number, groups: ID[][]) => {
    if (left === 0) {
      evaluate(groups);
      return;
    }
    if (remaining.length < left * 4) {
      return;
    }

    if (remaining.length === left * 4) {
      const [first, ...rest] = remaining;
      chooseThree(rest, (combo) => {
        groups.push([first!, ...combo]);
        visit(withoutIds(rest, combo), left - 1, groups);
        groups.pop();
      });
      return;
    }

    chooseFour(remaining, (combo) => {
      groups.push(combo);
      visit(withoutIds(remaining, combo), left - 1, groups);
      groups.pop();
    });
  };

  visit([...playerIds], matchCount, []);
  return bestMatches;
}
