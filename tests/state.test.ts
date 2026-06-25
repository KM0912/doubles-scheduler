import { describe, expect, it } from "vitest";
import {
  addPlayer,
  applyRound,
  ApplyRoundError,
  createSchedulerState,
  generateNextRound,
  removePlayer,
  setCourtCount,
  setFixedPairs,
  setPlayerResting,
} from "../src/index";

describe("createSchedulerState", () => {
  it("returns JSON-friendly state", () => {
    const state = createSchedulerState({
      players: [{ id: "a" }, { id: "b" }],
      courtCount: 1,
      restingPlayerIds: ["a"],
      fixedPairs: [["a", "b"]],
    });

    expect(state).toEqual({
      players: [{ id: "a" }, { id: "b" }],
      courtCount: 1,
      restingPlayerIds: ["a"],
      fixedPairs: [["a", "b"]],
      rounds: [],
    });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe("state update API", () => {
  const base = createSchedulerState({
    players: [{ id: 1 }, { id: 2 }, { id: 3 }],
    courtCount: 1,
    restingPlayerIds: [2],
    fixedPairs: [[1, 2]],
  });

  it("adds a player", () => {
    const next = addPlayer(base, { id: 4, name: "D" });
    expect(next.players.map((player) => player.id)).toEqual([1, 2, 3, 4]);
  });

  it("does not duplicate an existing player", () => {
    const next = addPlayer(base, { id: 1 });
    expect(next.players).toHaveLength(3);
  });

  it("removes a player and clears related constraints", () => {
    const next = removePlayer(base, 2);
    expect(next.players.map((player) => player.id)).toEqual([1, 3]);
    expect(next.restingPlayerIds).toEqual([]);
    expect(next.fixedPairs).toEqual([]);
  });

  it("updates court count", () => {
    expect(setCourtCount(base, 2).courtCount).toBe(2);
  });

  it("toggles resting state", () => {
    expect(setPlayerResting(base, 2, false).restingPlayerIds).toEqual([]);
    expect(setPlayerResting(base, 3, true).restingPlayerIds).toEqual([2, 3]);
  });

  it("replaces fixed pairs", () => {
    expect(setFixedPairs(base, [[2, 3]]).fixedPairs).toEqual([[2, 3]]);
  });
});

describe("applyRound", () => {
  it("appends a valid round", () => {
    const state = createSchedulerState({
      players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      courtCount: 1,
    });
    const proposal = generateNextRound(state);
    const next = applyRound(state, proposal.round);

    expect(next.rounds).toHaveLength(1);
    expect(next.rounds[0]?.id).toBe("round-1");
  });

  it("throws on invalid round", () => {
    const state = createSchedulerState({
      players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      courtCount: 1,
      fixedPairs: [[1, 2]],
    });

    expect(() =>
      applyRound(state, {
        id: "round-x",
        matches: [
          {
            id: "match-x",
            court: 1,
            teamA: [1, 3],
            teamB: [2, 4],
          },
        ],
        restingPlayers: [],
        sittingOutPlayers: [],
      }),
    ).toThrow(ApplyRoundError);
  });
});

describe("removed player history", () => {
  it("keeps past rounds after removePlayer", () => {
    let state = createSchedulerState({
      players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      courtCount: 1,
    });
    state = applyRound(state, generateNextRound(state).round);
    state = removePlayer(state, 4);

    expect(state.players.map((player) => player.id)).toEqual([1, 2, 3]);
    const matchPlayers = state.rounds[0]?.matches[0];
    const allPlayersInMatch = [...(matchPlayers?.teamA ?? []), ...(matchPlayers?.teamB ?? [])];
    expect(allPlayersInMatch).toContain(4);
  });
});
