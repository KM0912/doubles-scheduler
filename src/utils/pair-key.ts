import type { PlayerId, Team } from "../types.js";
import { comparePlayerIds } from "./compare-players.js";

export function pairKey(a: PlayerId, b: PlayerId): string {
  return [String(a), String(b)].sort(comparePlayerIds).join(":");
}

export function teamKey<ID extends PlayerId>(team: Team<ID>): string {
  return pairKey(team[0], team[1]);
}

export function matchKey<ID extends PlayerId>(teamA: Team<ID>, teamB: Team<ID>): string {
  return [teamKey(teamA), teamKey(teamB)].sort().join("|");
}

export function normalizePair<ID extends PlayerId>(pair: Team<ID>): Team<ID> {
  return [...pair].sort(comparePlayerIds) as Team<ID>;
}

export function pairsEqual<ID extends PlayerId>(a: Team<ID>, b: Team<ID>): boolean {
  return pairKey(a[0], a[1]) === pairKey(b[0], b[1]);
}
