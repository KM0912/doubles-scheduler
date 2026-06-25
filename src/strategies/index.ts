import { GenerateNextRoundError } from "../errors.js";
import type { BuiltInStrategy } from "../types.js";

export type { BuiltInStrategy };

export function resolveStrategy(strategy?: string): BuiltInStrategy {
  if (strategy === undefined || strategy === "balanced") {
    return "balanced";
  }

  throw new GenerateNextRoundError(
    `Unsupported built-in strategy: ${strategy}`,
  );
}
