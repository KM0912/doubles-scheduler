export type PlayerId = string | number;

export type Player<ID extends PlayerId = PlayerId> = {
  id: ID;
  name?: string;
  rating?: number;
  stats?: PlayerSeedStats;
  metadata?: Record<string, unknown>;
};

export type PlayerSeedStats = {
  games?: number;
  rests?: number;
  wins?: number;
  losses?: number;
};

export type Team<ID extends PlayerId = PlayerId> = [ID, ID];

export type Match<ID extends PlayerId = PlayerId> = {
  id: string;
  court: number;
  teamA: Team<ID>;
  teamB: Team<ID>;
  result?: MatchResult;
};

export type MatchResult = {
  winner?: "teamA" | "teamB";
  score?: {
    teamA: number;
    teamB: number;
  };
};

export type Round<ID extends PlayerId = PlayerId> = {
  id: string;
  matches: Match<ID>[];
  restingPlayers: ID[];
  sittingOutPlayers: ID[];
  createdAt?: string;
};

export type SchedulerState<ID extends PlayerId = PlayerId> = {
  players: Player<ID>[];
  courtCount: number;
  restingPlayerIds: ID[];
  fixedPairs: Team<ID>[];
  rounds: Round<ID>[];
};

export type CreateSchedulerStateInput<ID extends PlayerId> = {
  players: Player<ID>[];
  courtCount: number;
  restingPlayerIds?: ID[];
  fixedPairs?: Team<ID>[];
  rounds?: Round<ID>[];
};

export type RoundProposal<ID extends PlayerId = PlayerId> = {
  round: Round<ID>;
  warnings: GenerationWarning<ID>[];
  score?: number;
};

export type ValidationResult<ID extends PlayerId = PlayerId> = {
  valid: boolean;
  errors: ValidationError<ID>[];
  warnings: ValidationWarning<ID>[];
};

export type ValidationWarning<ID extends PlayerId = PlayerId> =
  | {
      type: "roundRestingPlayersMismatch";
      expectedPlayerIds: ID[];
      actualPlayerIds: ID[];
    }
  | { type: "unusedCourt"; court: number }
  | { type: "softConstraintViolation"; message: string };

export type ValidationError<ID extends PlayerId = PlayerId> =
  | { type: "duplicatePlayer"; playerId: ID }
  | { type: "unknownPlayer"; playerId: ID }
  | { type: "restingPlayerIncluded"; playerId: ID }
  | { type: "restingPlayerInSittingOut"; playerId: ID }
  | { type: "invalidTeamSize"; matchId: string }
  | { type: "invalidMatchSize"; matchId: string }
  | { type: "courtCountExceeded"; court: number }
  | { type: "invalidCourtNumber"; court: number }
  | { type: "fixedPairBroken"; pair: Team<ID> }
  | { type: "conflictingFixedPairs"; playerId: ID }
  | { type: "invalidCourtCount"; courtCount: number };

export type GenerationWarning<ID extends PlayerId = PlayerId> =
  | { type: "notEnoughPlayers"; availablePlayerCount: number }
  | { type: "unusedCourts"; unusedCourtCount: number }
  | { type: "playersSatOut"; playerIds: ID[] }
  | { type: "fixedPairUnavailable"; pair: Team<ID>; reason: string };

export type GenerateOptions<ID extends PlayerId = PlayerId> = {
  strategy?: BuiltInStrategy;
  fixedPairs?: Team<ID>[];
  restingPlayerIds?: ID[];
  seed?: string | number;
  weights?: StrategyWeights;
  candidateCount?: number;
};

export type BuiltInStrategy = "balanced";

export type StrategyWeights = {
  balanceGames?: number;
  avoidRepeatedPair?: number;
  avoidRepeatedOpponent?: number;
  avoidConsecutiveRest?: number;
  avoidConsecutivePlay?: number;
  balanceRating?: number;
  randomness?: number;
};

export type ComputedPlayerStats<ID extends PlayerId = PlayerId> = {
  playerId: ID;
  games: number;
  rests: number;
  sitOuts: number;
  wins: number;
  losses: number;
  lastRoundPlayed?: string;
  lastRoundRested?: string;
};

export type ComputedPairStats<ID extends PlayerId = PlayerId> = {
  pair: Team<ID>;
  gamesTogether: number;
};

export type ComputedOpponentStats<ID extends PlayerId = PlayerId> = {
  players: Team<ID>;
  gamesAgainst: number;
};
