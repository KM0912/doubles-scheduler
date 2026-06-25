import { describe, expect, it } from "vitest";
import {
  computeOpponentStats,
  createSchedulerState,
  movePlayer,
  swapPlayers,
  validateRound,
} from "../src/index";

describe("computeOpponentStats", () => {
  it("counts cross-team opponent meetings from history", () => {
    const state = createSchedulerState({
      players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      courtCount: 1,
      rounds: [
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
          sittingOutPlayers: [],
        },
      ],
    });

    expect(computeOpponentStats(state)).toEqual(
      expect.arrayContaining([
        { players: [1, 3], gamesAgainst: 1 },
        { players: [1, 4], gamesAgainst: 1 },
        { players: [2, 3], gamesAgainst: 1 },
        { players: [2, 4], gamesAgainst: 1 },
      ]),
    );
  });
});

describe("swapPlayers", () => {
  it("swaps two players within match teams", () => {
    const round = {
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
      sittingOutPlayers: [],
    };

    const edited = swapPlayers(round, 1, 4);

    expect(edited.matches[0]).toMatchObject({
      teamA: [4, 2],
      teamB: [3, 1],
    });
  });
});

describe("movePlayer", () => {
  it("moves a player from one match slot to another", () => {
    const round = {
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
    };

    const edited = movePlayer(round, 1, { matchId: "match-2", team: "teamB", slot: 0 });

    expect(edited.matches[0]?.teamA).toEqual([7, 2]);
    expect(edited.matches[1]?.teamB).toEqual([1, 8]);
  });

  it("moves a sitting-out player into a match slot", () => {
    const round = {
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
      sittingOutPlayers: [5],
    };

    const edited = movePlayer(round, 5, { matchId: "match-1", team: "teamA", slot: 0 });

    expect(edited.matches[0]?.teamA).toEqual([5, 2]);
    expect(edited.sittingOutPlayers).toEqual([1]);
  });

  it("keeps edited rounds valid when checked", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })),
      courtCount: 2,
    });

    const round = {
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
    };

    const edited = swapPlayers(round, 1, 8);
    expect(validateRound(state, edited).valid).toBe(true);
  });
});
