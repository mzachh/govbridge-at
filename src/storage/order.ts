import { sortClaims as sortCanonicalClaims, type Claim } from "../domain/claim.js";

export function sortClaims(claims: readonly Claim[]): Claim[] {
  return sortCanonicalClaims(claims);
}
