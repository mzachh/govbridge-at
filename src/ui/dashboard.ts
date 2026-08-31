import type { Claim } from "../domain/claim.js";

export interface DashboardCounts {
  observed: number;
  open: number;
  closed: number;
  unknown: number;
}

export function summarizeDashboardCounts(claims: readonly Claim[]): DashboardCounts {
  return claims.reduce<DashboardCounts>((counts, claim) => {
    counts.observed += 1;
    if (claim.status === "submitted" || claim.status === "processing") counts.open += 1;
    else if (claim.status === "completed" || claim.status === "rejected") counts.closed += 1;
    else counts.unknown += 1;
    return counts;
  }, { observed: 0, open: 0, closed: 0, unknown: 0 });
}
