import type { PlayerId } from "../types.js";

export function comparePlayerIds(a: PlayerId, b: PlayerId): number {
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function sortPlayerIds<ID extends PlayerId>(ids: ID[]): ID[] {
  return [...ids].sort(comparePlayerIds);
}
