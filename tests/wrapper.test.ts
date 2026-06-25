import { describe, expect, it } from "vitest";
import {
  applyRound,
  createScheduler,
  createSchedulerState,
  generateNextRound,
  validateRound,
} from "../src/index";

describe("createScheduler", () => {
  it("creates from input and exposes state mutation methods", () => {
    const scheduler = createScheduler({
      players: [1, 2, 3, 4, 5, 6].map((id) => ({ id })),
      courtCount: 1,
    });

    scheduler.setPlayerResting(6, true);
    const proposal = scheduler.generateNextRound({ strategy: "random", seed: 1 });

    expect(validateRound(scheduler.getState(), proposal.round).valid).toBe(true);
    scheduler.applyRound(proposal.round);

    expect(scheduler.getState().rounds).toHaveLength(1);
    expect(scheduler.getState().restingPlayerIds).toEqual([6]);
  });

  it("restores from an existing state", () => {
    let state = createSchedulerState({
      players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      courtCount: 1,
    });
    state = applyRound(state, generateNextRound(state, { seed: 1 }).round);

    const scheduler = createScheduler(state);
    expect(scheduler.getState()).toEqual(state);
  });

  it("mirrors pure function APIs", () => {
    const input = {
      players: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })),
      courtCount: 2,
    };

    const scheduler = createScheduler(input);
    scheduler.setFixedPairs([[1, 2]]);

    const proposal = scheduler.generateNextRound({ strategy: "avoidRepeatedPair", seed: 3 });
    expect(proposal.round.matches).toHaveLength(2);
  });
});
