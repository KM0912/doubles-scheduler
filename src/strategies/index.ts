import type { BuiltInStrategy } from "../types.js";

export type { BuiltInStrategy };

export function resolveStrategy(strategy?: BuiltInStrategy): BuiltInStrategy {
  if (strategy === "balanced" || strategy === "avoidRepeatedOpponent" || strategy === "custom") {
    return "random";
  }
  return strategy ?? "random";
}
