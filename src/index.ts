export type {
  BuiltInStrategy,
  ComputedOpponentStats,
  ComputedPairStats,
  ComputedPlayerStats,
  CreateSchedulerStateInput,
  GenerateOptions,
  GenerationWarning,
  Match,
  MatchResult,
  Player,
  PlayerId,
  PlayerSeedStats,
  Round,
  RoundProposal,
  RoundScorer,
  SchedulerState,
  ScoringContext,
  StrategyWeights,
  Team,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from "./types.js";

export { ApplyRoundError, GenerateNextRoundError } from "./errors.js";

export { createSchedulerState } from "./state/create-state.js";
export {
  addPlayer,
  applyRound,
  removePlayer,
  setCourtCount,
  setFixedPairs,
  setPlayerResting,
} from "./state/update-state.js";

export { generateNextRound } from "./generator/generate-next-round.js";
export { validateRound } from "./validation/validate-round.js";

export {
  computeOpponentStats,
  computePairStats,
  computePlayerStats,
} from "./stats/compute-stats.js";

export { swapPlayers, movePlayer } from "./edit/edit-round.js";
export type { MovePlayerTarget, PlayerSlot } from "./edit/edit-round.js";

export { createScheduler, Scheduler } from "./wrapper/scheduler.js";

export { pairKey, teamKey, matchKey } from "./utils/pair-key.js";
export {
  DEFAULT_CANDIDATE_COUNT,
  DEFAULT_STRATEGY_WEIGHTS,
} from "./utils/scoring.js";

export { PACKAGE_NAME } from "./constants.js";
