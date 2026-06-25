import type { CreateSchedulerStateInput, PlayerId, SchedulerState } from "../types.js";

export function createSchedulerState<ID extends PlayerId>(
  input: CreateSchedulerStateInput<ID>,
): SchedulerState<ID> {
  return {
    players: input.players.map((player) => ({ ...player })),
    courtCount: input.courtCount,
    restingPlayerIds: [...(input.restingPlayerIds ?? [])],
    fixedPairs: (input.fixedPairs ?? []).map((pair) => [pair[0], pair[1]] as const),
    rounds: [...(input.rounds ?? [])],
  };
}
