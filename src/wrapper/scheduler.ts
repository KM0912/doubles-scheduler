import { createSchedulerState } from "../state/create-state.js";
import {
  addPlayer,
  applyRound,
  removePlayer,
  setCourtCount,
  setFixedPairs,
  setPlayerResting,
} from "../state/update-state.js";
import { generateNextRound } from "../generator/generate-next-round.js";
import { validateRound } from "../validation/validate-round.js";
import type {
  CreateSchedulerStateInput,
  GenerateOptions,
  Player,
  PlayerId,
  Round,
  RoundProposal,
  SchedulerState,
  Team,
  ValidationResult,
} from "../types.js";

function isSchedulerState<ID extends PlayerId>(
  input: CreateSchedulerStateInput<ID> | SchedulerState<ID>,
): input is SchedulerState<ID> {
  const candidate = input as SchedulerState<ID>;
  return (
    Array.isArray(candidate.restingPlayerIds) &&
    Array.isArray(candidate.fixedPairs) &&
    Array.isArray(candidate.rounds)
  );
}

export class Scheduler<ID extends PlayerId = PlayerId> {
  private state: SchedulerState<ID>;

  constructor(input: CreateSchedulerStateInput<ID> | SchedulerState<ID>) {
    this.state = isSchedulerState(input) ? input : createSchedulerState(input);
  }

  generateNextRound(options?: GenerateOptions<ID>): RoundProposal<ID> {
    return generateNextRound(this.state, options);
  }

  validateRound(round: Round<ID>): ValidationResult<ID> {
    return validateRound(this.state, round);
  }

  applyRound(round: Round<ID>): SchedulerState<ID> {
    this.state = applyRound(this.state, round);
    return this.state;
  }

  addPlayer(player: Player<ID>): SchedulerState<ID> {
    this.state = addPlayer(this.state, player);
    return this.state;
  }

  removePlayer(playerId: ID): SchedulerState<ID> {
    this.state = removePlayer(this.state, playerId);
    return this.state;
  }

  setCourtCount(courtCount: number): SchedulerState<ID> {
    this.state = setCourtCount(this.state, courtCount);
    return this.state;
  }

  setPlayerResting(playerId: ID, resting: boolean): SchedulerState<ID> {
    this.state = setPlayerResting(this.state, playerId, resting);
    return this.state;
  }

  setFixedPairs(fixedPairs: Team<ID>[]): SchedulerState<ID> {
    this.state = setFixedPairs(this.state, fixedPairs);
    return this.state;
  }

  getState(): SchedulerState<ID> {
    return this.state;
  }
}

export function createScheduler<ID extends PlayerId>(
  input: CreateSchedulerStateInput<ID> | SchedulerState<ID>,
): Scheduler<ID> {
  return new Scheduler(input);
}
