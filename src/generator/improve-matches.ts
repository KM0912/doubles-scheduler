import type { PlayerId, Team } from "../types.js";

const MAX_IMPROVEMENT_PASSES = 8;

type Slot = {
  match: number;
  side: 0 | 1;
  slot: 0 | 1;
};

function cloneMatches<ID extends PlayerId>(
  matches: Team<ID>[][],
): Team<ID>[][] {
  return matches.map((match) => [
    [match[0][0], match[0][1]],
    [match[1][0], match[1][1]],
  ]);
}

function slotsOf(matchCount: number): Slot[] {
  const slots: Slot[] = [];
  for (let match = 0; match < matchCount; match += 1) {
    for (const side of [0, 1] as const) {
      for (const slot of [0, 1] as const) {
        slots.push({ match, side, slot });
      }
    }
  }
  return slots;
}

export function improveMatches<ID extends PlayerId>(
  matches: Team<ID>[][],
  lockedPlayerIds: ReadonlySet<ID>,
  score: (matches: Team<ID>[][]) => number,
): Team<ID>[][] {
  if (matches.length === 0) {
    return matches;
  }

  let current = cloneMatches(matches);
  let currentScore = score(current);

  for (let pass = 0; pass < MAX_IMPROVEMENT_PASSES; pass += 1) {
    const baseline = current;
    let best = current;
    let bestScore = currentScore;
    const positions = slotsOf(baseline.length);

    const consider = (candidate: Team<ID>[][]) => {
      const candidateScore = score(candidate);
      if (candidateScore < bestScore) {
        best = candidate;
        bestScore = candidateScore;
      }
    };

    for (let left = 0; left < positions.length; left += 1) {
      for (let right = left + 1; right < positions.length; right += 1) {
        const a = positions[left]!;
        const b = positions[right]!;
        if (a.match === b.match && a.side === b.side) {
          continue;
        }

        const playerA = baseline[a.match]![a.side][a.slot];
        const playerB = baseline[b.match]![b.side][b.slot];
        if (lockedPlayerIds.has(playerA) || lockedPlayerIds.has(playerB)) {
          continue;
        }

        const next = cloneMatches(baseline);
        next[a.match]![a.side][a.slot] = playerB;
        next[b.match]![b.side][b.slot] = playerA;
        consider(next);
      }
    }

    for (let left = 0; left < baseline.length; left += 1) {
      for (let right = left + 1; right < baseline.length; right += 1) {
        for (const sideLeft of [0, 1] as const) {
          for (const sideRight of [0, 1] as const) {
            const next = cloneMatches(baseline);
            const teamLeft = next[left]![sideLeft];
            next[left]![sideLeft] = next[right]![sideRight];
            next[right]![sideRight] = teamLeft;
            consider(next);
          }
        }
      }
    }

    for (let match = 0; match < baseline.length; match += 1) {
      const [teamA, teamB] = baseline[match]!;
      const players = [teamA[0], teamA[1], teamB[0], teamB[1]];
      if (players.some((playerId) => lockedPlayerIds.has(playerId))) {
        continue;
      }

      const [first, second, third, fourth] = players;
      const repaired = cloneMatches(baseline);
      repaired[match] = [
        [first!, third!],
        [second!, fourth!],
      ];
      consider(repaired);

      const repairedAgain = cloneMatches(baseline);
      repairedAgain[match] = [
        [first!, fourth!],
        [second!, third!],
      ];
      consider(repairedAgain);
    }

    if (bestScore >= currentScore) {
      break;
    }

    current = best;
    currentScore = bestScore;
  }

  return current;
}
