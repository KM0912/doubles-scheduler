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

export { ApplyRoundError } from "./errors.js";

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

export { computePairStats, computePlayerStats } from "./stats/compute-stats.js";

export { pairKey, teamKey, matchKey } from "./utils/pair-key.js";

export { PACKAGE_NAME } from "./constants.js";
