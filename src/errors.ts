import type { ValidationError, PlayerId } from "./types.js";

export class ApplyRoundError<ID extends PlayerId = PlayerId> extends Error {
  readonly errors: ValidationError<ID>[];

  constructor(errors: ValidationError<ID>[]) {
    super("Cannot apply invalid round");
    this.name = "ApplyRoundError";
    this.errors = errors;
  }
}

export class GenerateNextRoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerateNextRoundError";
  }
}
