import { ApplyRoundError } from "../errors.js";
import type { Player, PlayerId, Round, SchedulerState, Team } from "../types.js";
import { validateRound } from "../validation/validate-round.js";
import { removePlayerFromFixedPairs } from "./helpers.js";

export function applyRound<ID extends PlayerId>(
  state: SchedulerState<ID>,
  round: Round<ID>,
): SchedulerState<ID> {
  const validation = validateRound(state, round);
  if (!validation.valid) {
    throw new ApplyRoundError(validation.errors);
  }

  return {
    ...state,
    rounds: [...state.rounds, round],
  };
}

export function addPlayer<ID extends PlayerId>(
  state: SchedulerState<ID>,
  player: Player<ID>,
): SchedulerState<ID> {
  if (state.players.some((existing) => existing.id === player.id)) {
    return state;
  }

  return {
    ...state,
    players: [...state.players, { ...player }],
  };
}

export function removePlayer<ID extends PlayerId>(
  state: SchedulerState<ID>,
  playerId: ID,
): SchedulerState<ID> {
  return {
    ...state,
    players: state.players.filter((player) => player.id !== playerId),
    restingPlayerIds: state.restingPlayerIds.filter((id) => id !== playerId),
    fixedPairs: removePlayerFromFixedPairs(state.fixedPairs, playerId),
  };
}

export function setCourtCount<ID extends PlayerId>(
  state: SchedulerState<ID>,
  courtCount: number,
): SchedulerState<ID> {
  return {
    ...state,
    courtCount,
  };
}

export function setPlayerResting<ID extends PlayerId>(
  state: SchedulerState<ID>,
  playerId: ID,
  resting: boolean,
): SchedulerState<ID> {
  const isResting = state.restingPlayerIds.includes(playerId);

  if (resting && !isResting) {
    return {
      ...state,
      restingPlayerIds: [...state.restingPlayerIds, playerId],
    };
  }

  if (!resting && isResting) {
    return {
      ...state,
      restingPlayerIds: state.restingPlayerIds.filter((id) => id !== playerId),
    };
  }

  return state;
}

export function setFixedPairs<ID extends PlayerId>(
  state: SchedulerState<ID>,
  fixedPairs: Team<ID>[],
): SchedulerState<ID> {
  return {
    ...state,
    fixedPairs: fixedPairs.map((pair) => [pair[0], pair[1]] as Team<ID>),
  };
}
