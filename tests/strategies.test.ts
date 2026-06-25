import { describe, expect, it } from "vitest";
import {
  applyRound,
  computeOpponentStats,
  createSchedulerState,
  generateNextRound,
  GenerateNextRoundError,
  pairKey,
} from "../src/index";

describe("avoidRepeatedOpponent strategy", () => {
  it("prefers matchups with fewer prior opponent meetings", () => {
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

    const round = generateNextRound(state, {
      strategy: "avoidRepeatedOpponent",
      seed: 5,
      candidateCount: 24,
    }).round;
    const opponentStats = computeOpponentStats(state);

    const getOpponentCount = (a: number, b: number) =>
      opponentStats.find((stat) => pairKey(stat.players[0], stat.players[1]) === pairKey(a, b))
        ?.gamesAgainst ?? 0;

    for (const match of round.matches) {
      for (const playerA of match.teamA) {
        for (const playerB of match.teamB) {
          expect(getOpponentCount(playerA, playerB)).toBe(0);
        }
      }
    }
  });
});

describe("balanced strategy", () => {
  it("returns a scored proposal and is deterministic with the same seed", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })),
      courtCount: 2,
    });

    const first = generateNextRound(state, { strategy: "balanced", seed: 42 });
    const second = generateNextRound(state, { strategy: "balanced", seed: 42 });

    expect(first.score).toBeTypeOf("number");
    expect(first.round).toEqual(second.round);
    expect(first.score).toBe(second.score);
  });

  it("uses balanced as the default strategy", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6].map((id) => ({ id })),
      courtCount: 1,
    });

    const explicit = generateNextRound(state, { strategy: "balanced", seed: 7 });
    const implicit = generateNextRound(state, { seed: 7 });

    expect(implicit.round).toEqual(explicit.round);
    expect(implicit.score).toBe(explicit.score);
  });

  it("prefers more balanced rating matchups when ratings are available", () => {
    const state = createSchedulerState({
      players: [
        { id: 1, rating: 1 },
        { id: 2, rating: 1 },
        { id: 3, rating: 5 },
        { id: 4, rating: 5 },
      ],
      courtCount: 1,
    });

    const round = generateNextRound(state, {
      strategy: "balanced",
      seed: 99,
      candidateCount: 24,
      weights: {
        balanceGames: 0,
        avoidRepeatedPair: 0,
        avoidRepeatedOpponent: 0,
        avoidConsecutiveRest: 0,
        avoidConsecutivePlay: 0,
        balanceRating: 100,
        randomness: 0,
      },
    }).round;

    const match = round.matches[0]!;
    const teamRatings = [
      match.teamA.map((id) => state.players.find((player) => player.id === id)?.rating ?? 0),
      match.teamB.map((id) => state.players.find((player) => player.id === id)?.rating ?? 0),
    ];
    const teamAStrength = teamRatings[0]!.reduce((sum, rating) => sum + rating, 0);
    const teamBStrength = teamRatings[1]!.reduce((sum, rating) => sum + rating, 0);

    expect(Math.abs(teamAStrength - teamBStrength)).toBe(0);
  });

  it("prefers balanced win rates when ratings are unavailable", () => {
    let state = createSchedulerState({
      players: [
        { id: 1, stats: { wins: 0, losses: 0 } },
        { id: 2, stats: { wins: 0, losses: 0 } },
        { id: 3, stats: { wins: 6, losses: 0 } },
        { id: 4, stats: { wins: 6, losses: 0 } },
      ],
      courtCount: 1,
    });

    state = applyRound(
      state,
      {
        id: "round-1",
        matches: [
          {
            id: "match-1",
            court: 1,
            teamA: [3, 4],
            teamB: [1, 2],
            result: { winner: "teamA" },
          },
        ],
        restingPlayers: [],
        sittingOutPlayers: [],
      },
    );

    const round = generateNextRound(state, {
      strategy: "balanced",
      seed: 11,
      candidateCount: 24,
      weights: {
        balanceGames: 0,
        avoidRepeatedPair: 0,
        avoidRepeatedOpponent: 0,
        avoidConsecutiveRest: 0,
        avoidConsecutivePlay: 0,
        balanceRating: 100,
        randomness: 0,
      },
    }).round;

    const match = round.matches[0]!;
    const teamStrength = (team: typeof match.teamA) =>
      team.reduce((sum, id) => {
        const player = state.players.find((entry) => entry.id === id);
        const wins = (player?.stats?.wins ?? 0) + (id === 3 || id === 4 ? 1 : 0);
        const losses = (player?.stats?.losses ?? 0) + (id === 1 || id === 2 ? 1 : 0);
        const games = wins + losses;
        return sum + (games > 0 ? wins / games : 0);
      }, 0);

    expect(Math.abs(teamStrength(match.teamA) - teamStrength(match.teamB))).toBeLessThan(0.01);
  });
});

describe("custom strategy", () => {
  it("throws when scorer is missing", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4].map((id) => ({ id })),
      courtCount: 1,
    });

    expect(() => generateNextRound(state, { strategy: "custom" })).toThrow(GenerateNextRoundError);
  });

  it("uses the provided scorer to pick a candidate", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })),
      courtCount: 2,
    });

    const round = generateNextRound(state, {
      strategy: "custom",
      seed: 1,
      candidateCount: 4,
      scorer: (candidate) => candidate.matches.length,
    }).round;

    expect(round.matches).toHaveLength(2);
  });
});

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
