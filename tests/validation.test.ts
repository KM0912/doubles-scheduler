import { describe, expect, it } from "vitest";
import {
  createSchedulerState,
  generateNextRound,
  validateRound,
} from "../src/index";

describe("validateRound", () => {
  const state = createSchedulerState({
    players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
    courtCount: 1,
    restingPlayerIds: [5],
    fixedPairs: [[1, 2]],
  });

  it("accepts a valid generated round", () => {
    const round = generateNextRound(state, { seed: 99 }).round;
    expect(validateRound(state, round).valid).toBe(true);
  });

  it("rejects duplicate players", () => {
    const result = validateRound(state, {
      id: "round-x",
      matches: [
        {
          id: "match-x",
          court: 1,
          teamA: [1, 2],
          teamB: [2, 3],
        },
      ],
      restingPlayers: [5],
      sittingOutPlayers: [4],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.type === "duplicatePlayer")).toBe(true);
  });

  it("rejects unknown players", () => {
    const result = validateRound(state, {
      id: "round-x",
      matches: [
        {
          id: "match-x",
          court: 1,
          teamA: [1, 2],
          teamB: [3, 99],
        },
      ],
      restingPlayers: [5],
      sittingOutPlayers: [4],
    });

    expect(result.errors.some((error) => error.type === "unknownPlayer")).toBe(true);
  });

  it("rejects resting players on court", () => {
    const result = validateRound(state, {
      id: "round-x",
      matches: [
        {
          id: "match-x",
          court: 1,
          teamA: [1, 2],
          teamB: [3, 5],
        },
      ],
      restingPlayers: [5],
      sittingOutPlayers: [4],
    });

    expect(result.errors.some((error) => error.type === "restingPlayerIncluded")).toBe(true);
  });

  it("rejects resting players in sittingOut", () => {
    const result = validateRound(state, {
      id: "round-x",
      matches: [
        {
          id: "match-x",
          court: 1,
          teamA: [1, 2],
          teamB: [3, 4],
        },
      ],
      restingPlayers: [5],
      sittingOutPlayers: [5],
    });

    expect(result.errors.some((error) => error.type === "restingPlayerInSittingOut")).toBe(true);
  });

  it("rejects broken fixed pairs", () => {
    const result = validateRound(state, {
      id: "round-x",
      matches: [
        {
          id: "match-x",
          court: 1,
          teamA: [1, 3],
          teamB: [2, 4],
        },
      ],
      restingPlayers: [5],
      sittingOutPlayers: [],
    });

    expect(result.errors.some((error) => error.type === "fixedPairBroken")).toBe(true);
  });

  it("rejects conflicting fixed pairs in state", () => {
    const conflicting = createSchedulerState({
      players: [{ id: 1 }, { id: 2 }, { id: 3 }],
      courtCount: 1,
      fixedPairs: [
        [1, 2],
        [1, 3],
      ],
    });

    const result = validateRound(conflicting, {
      id: "round-x",
      matches: [],
      restingPlayers: [],
      sittingOutPlayers: [1, 2, 3],
    });

    expect(result.errors.some((error) => error.type === "conflictingFixedPairs")).toBe(true);
  });
});
