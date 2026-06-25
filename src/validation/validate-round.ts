import type {
  GenerationWarning,
  Match,
  PlayerId,
  Round,
  SchedulerState,
  Team,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from "../types.js";
import { sortPlayerIds } from "../utils/compare-players.js";
import {
  fixedPairsConflict,
  getEffectiveFixedPairs,
  getEffectiveRestingPlayerIds,
  isSameTeam,
} from "../state/helpers.js";

function collectRoundPlayerIds<ID extends PlayerId>(round: Round<ID>): ID[] {
  const ids: ID[] = [];
  for (const match of round.matches) {
    ids.push(...match.teamA, ...match.teamB);
  }
  ids.push(...round.restingPlayers, ...round.sittingOutPlayers);
  return ids;
}

export function validateRound<ID extends PlayerId>(
  state: SchedulerState<ID>,
  round: Round<ID>,
): ValidationResult<ID> {
  const errors: ValidationError<ID>[] = [];
  const warnings: ValidationWarning<ID>[] = [];

  if (state.courtCount <= 0) {
    errors.push({ type: "invalidCourtCount", courtCount: state.courtCount });
  }

  const activePlayerIds = new Set(state.players.map((player) => player.id));
  const restingPlayerIds = getEffectiveRestingPlayerIds(state);
  const restingSet = new Set(restingPlayerIds);
  const fixedPairs = getEffectiveFixedPairs(state);

  const conflictingPlayerId = fixedPairsConflict(fixedPairs);
  if (conflictingPlayerId !== undefined) {
    errors.push({ type: "conflictingFixedPairs", playerId: conflictingPlayerId });
  }

  const expectedResting = sortPlayerIds(
    restingPlayerIds.filter((id) => activePlayerIds.has(id)),
  );
  const actualResting = sortPlayerIds(
    round.restingPlayers.filter((id) => activePlayerIds.has(id)),
  );

  if (
    expectedResting.length !== actualResting.length ||
    expectedResting.some((id, index) => id !== actualResting[index])
  ) {
    warnings.push({
      type: "roundRestingPlayersMismatch",
      expectedPlayerIds: expectedResting,
      actualPlayerIds: actualResting,
    });
  }

  const seenPlayers = new Map<ID, number>();
  for (const playerId of collectRoundPlayerIds(round)) {
    seenPlayers.set(playerId, (seenPlayers.get(playerId) ?? 0) + 1);
  }

  for (const [playerId, count] of seenPlayers) {
    if (count > 1) {
      errors.push({ type: "duplicatePlayer", playerId });
    }
    if (!activePlayerIds.has(playerId)) {
      errors.push({ type: "unknownPlayer", playerId });
    }
  }

  for (const playerId of round.restingPlayers) {
    if (round.sittingOutPlayers.includes(playerId)) {
      errors.push({ type: "restingPlayerInSittingOut", playerId });
    }
  }

  const courtsUsed = new Set<number>();

  for (const match of round.matches) {
    validateMatch(state, match, activePlayerIds, restingSet, errors);
    courtsUsed.add(match.court);
  }

  if (round.matches.length > state.courtCount) {
    for (const court of courtsUsed) {
      if (court > state.courtCount) {
        errors.push({ type: "courtCountExceeded", court });
      }
    }
  }

  for (let court = 1; court <= state.courtCount; court++) {
    if (!courtsUsed.has(court) && round.matches.length < state.courtCount) {
      warnings.push({ type: "unusedCourt", court });
    }
  }

  validateFixedPairsInRound(round, fixedPairs, activePlayerIds, restingSet, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateMatch<ID extends PlayerId>(
  state: SchedulerState<ID>,
  match: Match<ID>,
  activePlayerIds: Set<ID>,
  restingSet: Set<ID>,
  errors: ValidationError<ID>[],
): void {
  if (match.court < 1 || match.court > state.courtCount) {
    errors.push({ type: "invalidCourtNumber", court: match.court });
  }

  if (match.teamA.length !== 2 || match.teamB.length !== 2) {
    errors.push({ type: "invalidTeamSize", matchId: match.id });
    errors.push({ type: "invalidMatchSize", matchId: match.id });
  }

  const matchPlayers = [...match.teamA, ...match.teamB];
  if (matchPlayers.length !== 4 || new Set(matchPlayers).size !== 4) {
    errors.push({ type: "invalidMatchSize", matchId: match.id });
  }

  for (const playerId of matchPlayers) {
    if (!activePlayerIds.has(playerId)) {
      errors.push({ type: "unknownPlayer", playerId });
    }
    if (restingSet.has(playerId)) {
      errors.push({ type: "restingPlayerIncluded", playerId });
    }
  }
}

function validateFixedPairsInRound<ID extends PlayerId>(
  round: Round<ID>,
  fixedPairs: Team<ID>[],
  activePlayerIds: Set<ID>,
  restingSet: Set<ID>,
  errors: ValidationError<ID>[],
): void {
  const playingIds = new Set<ID>();
  for (const match of round.matches) {
    for (const playerId of [...match.teamA, ...match.teamB]) {
      playingIds.add(playerId);
    }
  }

  const sittingOutSet = new Set(round.sittingOutPlayers);

  for (const pair of fixedPairs) {
    if (!activePlayerIds.has(pair[0]) || !activePlayerIds.has(pair[1])) {
      continue;
    }

    const firstResting = restingSet.has(pair[0]);
    const secondResting = restingSet.has(pair[1]);
    if (firstResting || secondResting) {
      continue;
    }

    const firstPlaying = playingIds.has(pair[0]);
    const secondPlaying = playingIds.has(pair[1]);

    if (firstPlaying !== secondPlaying) {
      errors.push({ type: "fixedPairBroken", pair });
      continue;
    }

    if (!firstPlaying && !secondPlaying) {
      continue;
    }

    let pairFound = false;
    for (const match of round.matches) {
      if (isSameTeam(match.teamA, pair) || isSameTeam(match.teamB, pair)) {
        pairFound = true;
        break;
      }
    }

    if (!pairFound) {
      errors.push({ type: "fixedPairBroken", pair });
    }
  }

  for (const pair of fixedPairs) {
    if (restingSet.has(pair[0]) && sittingOutSet.has(pair[1])) {
      errors.push({ type: "fixedPairBroken", pair });
    }
    if (restingSet.has(pair[1]) && sittingOutSet.has(pair[0])) {
      errors.push({ type: "fixedPairBroken", pair });
    }
  }
}

export function collectGenerationWarnings<ID extends PlayerId>(
  round: Round<ID>,
  courtCount: number,
  availablePlayerCount: number,
): GenerationWarning<ID>[] {
  const warnings: GenerationWarning<ID>[] = [];

  if (availablePlayerCount < 4) {
    warnings.push({ type: "notEnoughPlayers", availablePlayerCount });
  }

  if (round.matches.length < courtCount) {
    warnings.push({
      type: "unusedCourts",
      unusedCourtCount: courtCount - round.matches.length,
    });
  }

  if (round.sittingOutPlayers.length > 0) {
    warnings.push({
      type: "playersSatOut",
      playerIds: [...round.sittingOutPlayers],
    });
  }

  return warnings;
}
