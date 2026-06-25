import { describe, expect, it } from "vitest";
import {
  PACKAGE_NAME,
  createSchedulerState,
  generateNextRound,
  validateRound,
} from "../src/index";

describe("smoke", () => {
  it("exports package name", () => {
    expect(PACKAGE_NAME).toBe("doubles-scheduler");
  });

  it("exports MVP public API", () => {
    const state = createSchedulerState({
      players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      courtCount: 1,
    });
    const proposal = generateNextRound(state, { seed: 1 });
    expect(validateRound(state, proposal.round).valid).toBe(true);
  });
});
