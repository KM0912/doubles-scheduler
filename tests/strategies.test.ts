import { describe, expect, it } from "vitest";
import {
  applyRound,
  createSchedulerState,
  generateNextRound,
  pairKey,
} from "../src/index";

describe("leastPlayed strategy", () => {
  it("prioritizes players with fewer games when selecting participants", () => {
    let state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => ({ id })),
      courtCount: 2,
    });

    state = applyRound(
      state,
      {
        id: "round-1",
        matches: [
          {
            id: "match-1",
            court: 1,
            teamA: [1, 2],
            teamB: [3, 4],
          },
        ],
        restingPlayers: [],
        sittingOutPlayers: [5, 6, 7, 8, 9],
      },
    );

    const round = generateNextRound(state, { strategy: "leastPlayed", seed: 1 }).round;
    const playing = new Set(round.matches.flatMap((match) => [...match.teamA, ...match.teamB]));

    expect(playing.size).toBe(8);
    expect([5, 6, 7, 8, 9].every((id) => playing.has(id))).toBe(true);
    expect([1, 2, 3, 4].filter((id) => playing.has(id))).toHaveLength(3);
    expect(round.sittingOutPlayers).toHaveLength(1);
  });
});

describe("avoidRepeatedPair strategy", () => {
  it("prefers pairs that have not played together before", () => {
    let state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })),
      courtCount: 2,
    });

    state = applyRound(
      state,
      {
        id: "round-1",
        matches: [
          {
            id: "match-1",
            court: 1,
            teamA: [1, 2],
            teamB: [3, 4],
          },
          {
            id: "match-2",
            court: 2,
            teamA: [5, 6],
            teamB: [7, 8],
          },
        ],
        restingPlayers: [],
        sittingOutPlayers: [],
      },
    );

    const round = generateNextRound(state, { strategy: "avoidRepeatedPair", seed: 5 }).round;
    const teams = round.matches.flatMap((match) => [match.teamA, match.teamB]);

    expect(teams.some((team) => pairKey(team[0], team[1]) === pairKey(1, 2))).toBe(false);
    expect(teams.some((team) => pairKey(team[0], team[1]) === pairKey(5, 6))).toBe(false);
  });
});

describe("random strategy", () => {
  it("is deterministic with the same seed", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6].map((id) => ({ id })),
      courtCount: 1,
    });

    const first = generateNextRound(state, { strategy: "random", seed: 99 }).round;
    const second = generateNextRound(state, { strategy: "random", seed: 99 }).round;

    expect(first).toEqual(second);
  });
});
