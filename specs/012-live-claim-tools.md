# 012 — Live claim tools (normative)

This specification supersedes storage, reconciliation, history, automatic
observation, background claim execution and stored-data UI/skill requirements in
specs 000–011. Existing bounded search actions and native/polyfill registration
remain supported, including the retained results-range form.

## Execution and privacy

WebMCP agent → MAIN registration → closed request/response bridge → ISOLATED live
query executor → OegkAdapter → normalized snapshot. MAIN never parses claim DOM.
Every query calls `extractClaims()` anew; no refresh, implicit search, cache,
cross-page merge, pagination traversal, or claim persistence is permitted.
Only canonical Claim fields may cross the bridge. Exclude transient source IDs,
HTML, DOM objects, document links/PDFs, authentication data and unrelated personal
fields. Retain existing bridge identifiers for compatibility, not as a security
secret. All five invocations are bounded local operations and do not transmit
data to a third party; the four query responses can still contain sensitive
claim fields and require consent before disclosure. Same-origin page code can
invoke/observe the bridge; consent is an agent workflow boundary, not a claim
of in-page access control.

## Contracts

Keep tool names, inputs, `{ok,data}`/`{ok:false,error}` envelopes and existing
result fields. `list_claims({})` returns `{claims,count,page}`;
`get_open_claims({})` filters submitted/processing from a new read;
`get_claim({claimId})` returns `{claim,page}` only from that new read, without
navigation; `get_reimbursement_summary({year})` adds `page` to the existing
invoice-year summary, preserving known-amount counts. Unknown amounts are not
inferred as zero; totals sum known values only. All four remain read-only.
`search_claims({from,to})` retains its validated one-click action contract and
`readOnlyHint:false`; an acknowledgement or lost navigation response is not proof
of a successful search. Never retry uncertain submissions automatically.
During a same-document search, retain only weak identities of existing outcome
nodes. A replacement result/alert node permits a new read, still subject to adapter
loading/error precedence. An in-place text-only update with no reliable completion
signal remains uncertain (`PAGE_NOT_READY`); the user must navigate/reload to
establish a new document. The single-dispatch lock remains set either way.

Successful query `page` metadata:

```ts
{
  scope: "current-page";
  pageKind: "type-range" | "results" | "open-rejected-detail" | "reimbursed-detail";
  readAt: string; // ISO UTC, invocation time
  completeness: "complete" | "partial";
  skippedCount: number;
  visibleRange?: { from: string; to: string }; // displayed controls only
}
```

Complete means the rendered rows were parsed, not account-wide coverage or that
all fields/amounts are known. Pagination remains current-page only. Live means
read at invocation time, not newly refreshed server data. Displayed dates do not
prove server-query boundaries, nor equal the invoice-year aggregation basis.

## Page state precedence

Unsupported origin/route → `UNSUPPORTED_PAGE`. On supported routes, loading,
including unsettled dispatched searches, takes precedence over retained rows →
`PAGE_NOT_READY`. Recognized validation errors/extraction failure →
`EXTRACTION_FAILED`. Explicit empty alerts on result or type/range pages → empty
success. A plain search mask → `PAGE_NOT_READY`. Results return rendered rows;
details return only the displayed singleton. Skipped malformed rows produce
partial results; a recognized but missing/broken result structure is an error,
not a claim that no claims exist. No diagnostic contains raw page content.
Recognized grids with no rendered candidate rows and no explicit empty alert
are not ready, including temporary hidden-row transitions without a busy marker.

## Identity

One random nonce per document lifetime, a SHA-256 digest of canonical ordered
allowlisted observations (excluding timestamps), and row index form each
`live-v1-*` ID. Duplicate rows remain distinct. Unchanged content in the same
document retains IDs; changed normalized snapshot content or navigation expires
them. Only a nonce and structural search state may persist in memory, never claim
records. `get_claim` returns `NOT_FOUND` for absent/expired IDs; callers list again.
`lastSeen` remains for compatibility and equals this invocation's `readAt`.
Legacy `local-v1-*` IDs are not resolved.

## Runtime and UI removal

Remove storage APIs/permission, stored-state types, reconciliation/status history,
automatic extraction/observer/rearm entrypoints, runtime claim messages and the
service worker. Popup opens its dashboard directly; neither UI reads claim data.
Show packaged tool capabilities, architecture, consent, prerequisites and
troubleshooting, never infer page connection/registration from dashboard opening.
Build removes obsolete `background.js` and `content.js` before packaging. Legacy
stored bytes are unused and untouched; removal of this feature does not erase
data previously written by older versions.

## Skill and verification

Preserve external Chrome, user-operated ID Austria, scoped sensitive-data consent,
native capability preference and supported CDP fallback. Hints alone are not
callability. After search, inspect its outcome/rediscover tools and read only with
consent. Remove stored-data and observation-commit workflows. Explain temporary
IDs, partial/current-page results, invoice-year limits and removal of history.

Automated verification covers dynamic DOM changes/removal without observation,
document isolation, stable/expired/duplicate IDs, all state branches, allowlists,
known totals, bridge validation, native/polyfill and search regression, no storage
or obsolete artifacts, and technical UI with no automatic sensitive reads.
Run `npm run verify`. Live Chrome verification requires reloaded build, user login,
and consent: one search/read plus a subsequent real page change/read proving no
carry-forward. Keep only structural evidence in repository artifacts.
