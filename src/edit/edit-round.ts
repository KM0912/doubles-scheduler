import type { PlayerId, Round, Team } from "../types.js";

export type PlayerSlot = {
  matchIndex: number;
  team: "teamA" | "teamB";
  slot: 0 | 1;
};

export type MovePlayerTarget = {
  matchId: string;
  team: "teamA" | "teamB";
  slot: 0 | 1;
};

function cloneRound<ID extends PlayerId>(round: Round<ID>): Round<ID> {
  return {
    ...round,
    matches: round.matches.map((match) => ({
      ...match,
      teamA: [match.teamA[0], match.teamA[1]] as Team<ID>,
      teamB: [match.teamB[0], match.teamB[1]] as Team<ID>,
    })),
    restingPlayers: [...round.restingPlayers],
    sittingOutPlayers: [...round.sittingOutPlayers],
  };
}

function findPlayerSlot<ID extends PlayerId>(
  round: Round<ID>,
  playerId: ID,
): PlayerSlot | undefined {
  for (let matchIndex = 0; matchIndex < round.matches.length; matchIndex++) {
    const match = round.matches[matchIndex]!;

    for (const team of ["teamA", "teamB"] as const) {
      const slot = match[team].indexOf(playerId);
      if (slot !== -1) {
        return {
          matchIndex,
          team,
          slot: slot as 0 | 1,
        };
      }
    }
  }

  return undefined;
}

function setPlayerAtSlot<ID extends PlayerId>(
  round: Round<ID>,
  location: PlayerSlot,
  playerId: ID,
): void {
  const match = round.matches[location.matchIndex]!;
  match[location.team][location.slot] = playerId;
}

export function swapPlayers<ID extends PlayerId>(
  round: Round<ID>,
  playerA: ID,
  playerB: ID,
): Round<ID> {
  const nextRound = cloneRound(round);
  const slotA = findPlayerSlot(nextRound, playerA);
  const slotB = findPlayerSlot(nextRound, playerB);

  if (!slotA || !slotB) {
    return round;
  }

  setPlayerAtSlot(nextRound, slotA, playerB);
  setPlayerAtSlot(nextRound, slotB, playerA);
  return nextRound;
}

export function movePlayer<ID extends PlayerId>(
  round: Round<ID>,
  playerId: ID,
  target: MovePlayerTarget,
): Round<ID> {
  const nextRound = cloneRound(round);
  const sourceSlot = findPlayerSlot(nextRound, playerId);
  const targetMatchIndex = nextRound.matches.findIndex((match) => match.id === target.matchId);

  if (targetMatchIndex === -1) {
    return round;
  }

  const targetMatch = nextRound.matches[targetMatchIndex]!;
  const displacedPlayerId = targetMatch[target.team][target.slot];

  if (sourceSlot) {
    setPlayerAtSlot(nextRound, sourceSlot, displacedPlayerId);
    targetMatch[target.team][target.slot] = playerId;
    return nextRound;
  }

  const sittingOutIndex = nextRound.sittingOutPlayers.indexOf(playerId);
  if (sittingOutIndex === -1) {
    return round;
  }

  targetMatch[target.team][target.slot] = playerId;
  nextRound.sittingOutPlayers[sittingOutIndex] = displacedPlayerId;
  return nextRound;
}
