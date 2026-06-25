import { describe, expect, it } from "vitest";
import {
  applyRound,
  computePairStats,
  computePlayerStats,
  createSchedulerState,
  generateNextRound,
  GenerateNextRoundError,
  removePlayer,
  setCourtCount,
  validateRound,
} from "../src/index";
import type { Round } from "../src/index";

function createNumberedPlayers(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: index + 1 }));
}

function getPlayingPlayerIds(round: Round<number>) {
  return round.matches.flatMap((match) => [...match.teamA, ...match.teamB]);
}

function sortedNumbers(ids: number[]) {
  return [...ids].sort((a, b) => a - b);
}

function playingSetKey(round: Round<number>) {
  return sortedNumbers(getPlayingPlayerIds(round)).join(",");
}

const fourPlayerMatchups = ["1-2|3-4", "1-3|2-4", "1-4|2-3"];

function matchupKey(round: Round<number>) {
  const match = round.matches[0]!;
  const teamA = sortedNumbers(match.teamA).join("-");
  const teamB = sortedNumbers(match.teamB).join("-");
  return [teamA, teamB].sort().join("|");
}

function expectCompleteFourPlayerRotation(matchupKeys: string[]) {
  for (let index = 0; index < matchupKeys.length; index += 3) {
    expect([...matchupKeys.slice(index, index + 3)].sort()).toEqual(
      fourPlayerMatchups,
    );
  }
}

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

  it("starts from player order when no history or strength data changes the score", () => {
    const state = createSchedulerState({
      players: createNumberedPlayers(6),
      courtCount: 1,
    });

    const round = generateNextRound(state, {
      strategy: "balanced",
      seed: 1,
    }).round;

    expect(round.matches).toEqual([
      {
        id: "match-1-1",
        court: 1,
        teamA: [1, 2],
        teamB: [3, 4],
      },
    ]);
    expect(round.sittingOutPlayers).toEqual([5, 6]);
  });

  it("continues player-order intake across early rounds", () => {
    let state = createSchedulerState({
      players: createNumberedPlayers(9),
      courtCount: 1,
    });

    const firstRound = generateNextRound(state, {
      strategy: "balanced",
      seed: 1,
    }).round;
    state = applyRound(state, firstRound);
    const secondRound = generateNextRound(state, {
      strategy: "balanced",
      seed: 2,
    }).round;

    expect(firstRound.matches[0]).toMatchObject({
      teamA: [1, 2],
      teamB: [3, 4],
    });
    expect(secondRound.matches[0]).toMatchObject({
      teamA: [5, 6],
      teamB: [7, 8],
    });
  });

  it("sits out higher player ids first while fairness is otherwise tied", () => {
    let state = createSchedulerState({
      players: createNumberedPlayers(9),
      courtCount: 2,
    });

    const sittingOutByRound: number[][] = [];
    for (let roundIndex = 0; roundIndex < 3; roundIndex++) {
      const round = generateNextRound(state, {
        strategy: "balanced",
        seed: roundIndex,
      }).round;
      sittingOutByRound.push(round.sittingOutPlayers);
      state = applyRound(state, round);
    }

    expect(sittingOutByRound).toEqual([[9], [8], [7]]);
  });

  it("avoids consecutive sitting out when enough alternatives exist", () => {
    let state = createSchedulerState({
      players: createNumberedPlayers(10),
      courtCount: 2,
    });
    let previousSittingOut = new Set<number>();

    for (let roundIndex = 0; roundIndex < 6; roundIndex++) {
      const round = generateNextRound(state, {
        strategy: "balanced",
        seed: `no-consecutive-${roundIndex}`,
      }).round;

      expect(
        round.sittingOutPlayers.filter((id) => previousSittingOut.has(id)),
      ).toEqual([]);

      previousSittingOut = new Set(round.sittingOutPlayers);
      state = applyRound(state, round);
    }
  });

  it("does not fall back into a repeated 4-player lineup loop", () => {
    let state = createSchedulerState({
      players: createNumberedPlayers(6),
      courtCount: 1,
    });
    const previousPlayingSets = new Set<string>();

    for (let roundIndex = 0; roundIndex < 4; roundIndex++) {
      const round = generateNextRound(state, {
        strategy: "balanced",
        seed: `loop-${roundIndex}`,
        candidateCount: 64,
      }).round;
      const key = playingSetKey(round);

      if (roundIndex < 3) {
        previousPlayingSets.add(key);
      } else {
        expect(previousPlayingSets.has(key)).toBe(false);
      }

      state = applyRound(state, round);
    }
  });

  it("cycles through all three four-player pairings", () => {
    let state = createSchedulerState({
      players: createNumberedPlayers(4),
      courtCount: 1,
    });
    const matchupKeys: string[] = [];

    for (let roundIndex = 0; roundIndex < 12; roundIndex++) {
      const round = generateNextRound(state, {
        strategy: "balanced",
        seed: `four-player-cycle-${roundIndex}`,
        candidateCount: 64,
      }).round;

      matchupKeys.push(matchupKey(round));
      state = applyRound(state, round);
    }

    expectCompleteFourPlayerRotation(matchupKeys);
  });

  it("keeps the four-player pairing rotation after players leave", () => {
    let state = createSchedulerState({
      players: createNumberedPlayers(8),
      courtCount: 2,
    });

    for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
      const round = generateNextRound(state, {
        strategy: "balanced",
        seed: `before-leave-${roundIndex}`,
        candidateCount: 64,
      }).round;
      state = applyRound(state, round);
    }

    for (const playerId of [5, 6, 7, 8]) {
      state = removePlayer(state, playerId);
    }
    state = setCourtCount(state, 1);

    const matchupKeys: string[] = [];
    const postLeaveRounds: Round<number>[] = [];

    for (let roundIndex = 0; roundIndex < 12; roundIndex++) {
      const round = generateNextRound(state, {
        strategy: "balanced",
        seed: `after-leave-${roundIndex}`,
        candidateCount: 64,
      }).round;

      matchupKeys.push(matchupKey(round));
      postLeaveRounds.push(round);
      state = applyRound(state, round);
    }

    const postLeaveGames = [1, 2, 3, 4].map(
      (playerId) =>
        postLeaveRounds.filter((round) =>
          getPlayingPlayerIds(round).includes(playerId),
        ).length,
    );

    expectCompleteFourPlayerRotation(matchupKeys);
    expect(new Set(postLeaveGames)).toEqual(new Set([12]));
  });

  it.each(
    createNumberedPlayers(13).flatMap((_, playerIndex) =>
      [1, 2, 3].map((courtCount) => ({
        playerCount: playerIndex + 4,
        courtCount,
      })),
    ),
  )(
    "generates valid rounds for $playerCount players and $courtCount courts",
    ({ playerCount, courtCount }) => {
      const state = createSchedulerState({
        players: createNumberedPlayers(playerCount),
        courtCount,
      });

      const round = generateNextRound(state, {
        strategy: "balanced",
        seed: `${playerCount}-${courtCount}`,
        candidateCount: 32,
      }).round;
      const expectedMatchCount = Math.min(
        courtCount,
        Math.floor(playerCount / 4),
      );
      const accountedPlayers = [
        ...getPlayingPlayerIds(round),
        ...round.sittingOutPlayers,
        ...round.restingPlayers,
      ];

      expect(round.matches).toHaveLength(expectedMatchCount);
      expect(new Set(accountedPlayers).size).toBe(playerCount);
      expect(validateRound(state, round).valid).toBe(true);
    },
  );

  it("keeps game and sitting-out counts balanced over a full rotation window", () => {
    let state = createSchedulerState({
      players: createNumberedPlayers(9),
      courtCount: 2,
    });

    for (let roundIndex = 0; roundIndex < 9; roundIndex++) {
      const round = generateNextRound(state, {
        strategy: "balanced",
        seed: `rotation-${roundIndex}`,
        candidateCount: 64,
      }).round;
      state = applyRound(state, round);
    }

    const stats = computePlayerStats(state);
    const games = stats.map((stat) => stat.games);
    const sitOuts = stats.map((stat) => stat.sitOuts);

    expect(Math.max(...games) - Math.min(...games)).toBeLessThanOrEqual(1);
    expect(Math.max(...sitOuts) - Math.min(...sitOuts)).toBeLessThanOrEqual(1);
  });

  it("prioritizes new partners when repeated pairs can be avoided", () => {
    let state = createSchedulerState({
      players: createNumberedPlayers(8),
      courtCount: 2,
    });

    for (let roundIndex = 0; roundIndex < 2; roundIndex++) {
      const round = generateNextRound(state, {
        strategy: "balanced",
        seed: `pair-diversity-${roundIndex}`,
        candidateCount: 128,
      }).round;
      state = applyRound(state, round);
    }

    expect(
      computePairStats(state).every((stat) => stat.gamesTogether === 1),
    ).toBe(true);
  });

  it("uses balanced as the default strategy", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4, 5, 6].map((id) => ({ id })),
      courtCount: 1,
    });

    const explicit = generateNextRound(state, {
      strategy: "balanced",
      seed: 7,
    });
    const implicit = generateNextRound(state, { seed: 7 });

    expect(implicit.round).toEqual(explicit.round);
    expect(implicit.score).toBe(explicit.score);
  });

  it("rejects previously exposed strategy names", () => {
    const state = createSchedulerState({
      players: [1, 2, 3, 4].map((id) => ({ id })),
      courtCount: 1,
    });

    expect(() =>
      generateNextRound(state, { strategy: "avoidRepeatedPair" as never }),
    ).toThrow(GenerateNextRoundError);
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
      match.teamA.map(
        (id) => state.players.find((player) => player.id === id)?.rating ?? 0,
      ),
      match.teamB.map(
        (id) => state.players.find((player) => player.id === id)?.rating ?? 0,
      ),
    ];
    const teamAStrength = teamRatings[0]!.reduce(
      (sum, rating) => sum + rating,
      0,
    );
    const teamBStrength = teamRatings[1]!.reduce(
      (sum, rating) => sum + rating,
      0,
    );

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

    state = applyRound(state, {
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
    });

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
        const wins =
          (player?.stats?.wins ?? 0) + (id === 3 || id === 4 ? 1 : 0);
        const losses =
          (player?.stats?.losses ?? 0) + (id === 1 || id === 2 ? 1 : 0);
        const games = wins + losses;
        return sum + (games > 0 ? wins / games : 0);
      }, 0);

    expect(
      Math.abs(teamStrength(match.teamA) - teamStrength(match.teamB)),
    ).toBeLessThan(0.01);
  });
});
