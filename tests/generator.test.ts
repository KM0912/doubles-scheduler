import { describe, expect, it } from "vitest";
import {
  createSchedulerState,
  generateNextRound,
  setFixedPairs,
  setPlayerResting,
  validateRound,
} from "../src/index";

function roundSnapshot(state: ReturnType<typeof createSchedulerState>, seed: number) {
  return generateNextRound(state, { seed }).round;
}

describe("generateNextRound", () => {
  it("creates one match for 4 players and 1 court", () => {
    const state = createSchedulerState({
      players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      courtCount: 1,
    });

    const proposal = generateNextRound(state, { seed: 1 });

    expect(proposal.round.matches).toHaveLength(1);
    expect(proposal.round.matches[0]?.court).toBe(1);
    expect(validateRound(state, proposal.round).valid).toBe(true);
  });

  it("creates two matches for 8 players and 2 courts", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })),
      courtCount: 2,
    });

    const proposal = generateNextRound(state, { seed: 2 });

    expect(proposal.round.matches).toHaveLength(2);
    expect(proposal.round.sittingOutPlayers).toEqual([]);
  });

  it("creates one match and two sittingOut players for 6 players and 2 courts", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6].map((id) => ({ id })),
      courtCount: 2,
    });

    const proposal = generateNextRound(state, { seed: 3 });

    expect(proposal.round.matches).toHaveLength(1);
    expect(proposal.round.sittingOutPlayers).toHaveLength(2);
    expect(proposal.warnings.some((warning) => warning.type === "unusedCourts")).toBe(true);
  });

  it("returns notEnoughPlayers warning below 4 available players", () => {
    const state = createSchedulerState({
      players: [{ id: 1 }, { id: 2 }, { id: 3 }],
      courtCount: 1,
    });

    const proposal = generateNextRound(state, { seed: 4 });

    expect(proposal.round.matches).toEqual([]);
    expect(proposal.warnings.some((warning) => warning.type === "notEnoughPlayers")).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6].map((id) => ({ id })),
      courtCount: 1,
    });

    const first = generateNextRound(state, { seed: "abc" }).round;
    const second = generateNextRound(state, { seed: "abc" }).round;

    expect(first).toEqual(second);
  });
});

describe("fixed pairs", () => {
  it("keeps fixed pairs on the same team", () => {
    let state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })),
      courtCount: 2,
    });
    state = setFixedPairs(state, [[1, 2]]);

    const round = generateNextRound(state, { seed: 10 }).round;
    const teams = round.matches.flatMap((match) => [match.teamA, match.teamB]);

    expect(teams.some((team) => team.includes(1) && team.includes(2))).toBe(true);
    expect(validateRound(state, round).valid).toBe(true);
  });

  it("does not split a fixed pair when one player is resting", () => {
    let state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6].map((id) => ({ id })),
      courtCount: 1,
    });
    state = setFixedPairs(state, [[1, 2]]);
    state = setPlayerResting(state, 2, true);

    const proposal = generateNextRound(state, { seed: 11 });
    const allPlayers = proposal.round.matches.flatMap((match) => [
      ...match.teamA,
      ...match.teamB,
      ...proposal.round.sittingOutPlayers,
    ]);

    expect(allPlayers).not.toContain(1);
    expect(proposal.warnings.some((warning) => warning.type === "fixedPairUnavailable")).toBe(
      true,
    );
  });
});

describe("seed stability", () => {
  it("produces identical rounds for identical inputs", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => ({ id })),
      courtCount: 2,
    });

    expect(roundSnapshot(state, 123)).toEqual(roundSnapshot(state, 123));
    expect(roundSnapshot(state, 123)).not.toEqual(roundSnapshot(state, 124));
  });
});
