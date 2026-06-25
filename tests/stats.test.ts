import { describe, expect, it } from "vitest";
import {
  applyRound,
  computePairStats,
  computePlayerStats,
  createSchedulerState,
  generateNextRound,
  matchKey,
  pairKey,
  setPlayerResting,
  teamKey,
} from "../src/index";

describe("canonical keys", () => {
  it("normalizes pair key order", () => {
    expect(pairKey("b", "a")).toBe("a:b");
    expect(pairKey(2, 10)).toBe("2:10");
  });

  it("builds team and match keys", () => {
    expect(teamKey(["b", "a"])).toBe("a:b");
    expect(matchKey(["b", "a"], ["d", "c"])).toBe("a:b|c:d");
    expect(matchKey(["d", "c"], ["b", "a"])).toBe("a:b|c:d");
  });
});

describe("computePlayerStats", () => {
  it("derives games, rests, sitOuts, and results from history", () => {
    const state = createSchedulerState({
      players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
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
              result: { winner: "teamA" },
            },
          ],
          restingPlayers: [5],
          sittingOutPlayers: [],
        },
        {
          id: "round-2",
          matches: [],
          restingPlayers: [],
          sittingOutPlayers: [1, 2, 3, 4, 5],
        },
      ],
    });

    const stats = computePlayerStats(state);
    const byId = Object.fromEntries(stats.map((stat) => [stat.playerId, stat]));

    expect(byId[1]).toMatchObject({ games: 1, rests: 0, sitOuts: 1, wins: 1, losses: 0 });
    expect(byId[3]).toMatchObject({ games: 1, wins: 0, losses: 1 });
    expect(byId[5]).toMatchObject({ games: 0, rests: 1, sitOuts: 1 });
  });

  it("starts from seed stats for mid-session joiners", () => {
    const state = createSchedulerState({
      players: [{ id: "new", stats: { games: 2, rests: 1, wins: 1, losses: 1 } }],
      courtCount: 1,
    });

    expect(computePlayerStats(state)[0]).toMatchObject({
      playerId: "new",
      games: 2,
      rests: 1,
      wins: 1,
      losses: 1,
    });
  });

  it("updates after applyRound", () => {
    let state = createSchedulerState({
      players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }],
      courtCount: 1,
    });
    state = applyRound(state, generateNextRound(state, { seed: 42 }).round);

    const stats = computePlayerStats(state);
    const totalGames = stats.reduce((sum, stat) => sum + stat.games, 0);
    expect(totalGames).toBe(4);
  });
});

describe("computePairStats", () => {
  it("counts pair appearances with normalized order", () => {
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
              teamA: [2, 1],
              teamB: [3, 4],
            },
          ],
          restingPlayers: [],
          sittingOutPlayers: [],
        },
      ],
    });

    expect(computePairStats(state)).toEqual([
      {
        pair: [2, 1],
        gamesTogether: 1,
      },
      {
        pair: [3, 4],
        gamesTogether: 1,
      },
    ]);
  });
});

describe("selectSittingOut fairness via generation", () => {
  it("prioritizes lower games, then higher rests, then id", () => {
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

    state = applyRound(
      state,
      {
        id: "round-2",
        matches: [],
        restingPlayers: [],
        sittingOutPlayers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      },
    );

    const proposal = generateNextRound(state, { seed: 1 });
    const playing = new Set(
      proposal.round.matches.flatMap((match) => [...match.teamA, ...match.teamB]),
    );

    expect(playing.size).toBe(8);
    expect([1, 2, 3, 4].filter((id) => playing.has(id))).toHaveLength(3);
    expect([5, 6, 7, 8, 9].every((id) => playing.has(id))).toBe(true);
    expect(proposal.round.sittingOutPlayers).toHaveLength(1);
    expect(proposal.round.sittingOutPlayers[0]).toBeGreaterThanOrEqual(1);
    expect(proposal.round.sittingOutPlayers[0]).toBeLessThanOrEqual(4);
  });
});

describe("resting vs sittingOut", () => {
  it("keeps resting players out of matches and sittingOut", () => {
    let state = createSchedulerState({
      players: [1, 2, 3, 4, 5].map((id) => ({ id })),
      courtCount: 1,
    });
    state = setPlayerResting(state, 5, true);

    const proposal = generateNextRound(state, { seed: 7 });
    const allMatchPlayers = proposal.round.matches.flatMap((match) => [
      ...match.teamA,
      ...match.teamB,
    ]);

    expect(proposal.round.restingPlayers).toEqual([5]);
    expect(proposal.round.sittingOutPlayers).not.toContain(5);
    expect(allMatchPlayers).not.toContain(5);
  });
});
