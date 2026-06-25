import type { BuiltInStrategy } from "../types.js";

export type { BuiltInStrategy };

export function resolveStrategy(strategy?: BuiltInStrategy): BuiltInStrategy {
  return strategy ?? "balanced";
}

export function usesCandidateScoring(strategy: BuiltInStrategy): boolean {
  return strategy === "balanced" || strategy === "custom" || strategy === "avoidRepeatedOpponent";
}

export function weightsForStrategy(
  strategy: BuiltInStrategy,
  overrides?: import("../types.js").StrategyWeights,
): import("../types.js").StrategyWeights | undefined {
  if (strategy === "avoidRepeatedOpponent") {
    return {
      balanceGames: 0,
      avoidRepeatedPair: 0,
      avoidRepeatedOpponent: 1,
      avoidConsecutiveRest: 0,
      avoidConsecutivePlay: 0,
      balanceRating: 0,
      randomness: 0,
      ...overrides,
    };
  }

  return overrides;
}
