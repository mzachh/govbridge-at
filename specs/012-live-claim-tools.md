# 012 — Live claim tools (normative)

Spec 017 supersedes the reimbursement-summary tool and older tool counts here;
three query tools remain, with richer visible fields and no skill-level consent
prompt for related requested tool operations. Current-page-only scope is unchanged.

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
  environment: "production" | "demo" | "development";
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

## Approved environments and synthetic server

Resolve environments from checked extension build configuration, never page
flags, URL parameters, or globals. Production remains exactly
`https://www.meinesv.at`. An explicitly configured demo HTTPS origin and fixed
development loopback origins may use the same supported paths and extraction
implementation. MAIN registration, ISOLATED readers, adapter construction, and
manifest generation must share that policy. Search destinations must match the
invoking approved origin and expected route, not merely another approved origin.

Successful query `page.environment` provides origin-derived provenance;
`source: "oegk"` names the adapter, not official provenance. Synthetic tool
descriptions and UI guidance must identify the demo. The server must not
register competing claim tools or provide fixtures directly to tool handlers.
Current-page scope, temporary IDs, loading precedence and one-dispatch locks
remain unchanged in every environment.

The separate local simulator defaults to 20 independently invented records,
reference date `2026-09-02`, range `2021-09-03`–`2026-09-02`, with public demo
credentials `username` / `password` and no ID Austria. Its documented search
basis is inclusive invoice date; this does not establish production semantics.
Demo login is not a confidentiality boundary. The extension does not manage
its website cookie. No consent transfers between origins or environments.

`config/extension-targets.json` currently leaves `demoOrigin` null. One `dist/`
package supports production, exact `http://localhost:4173` and
`http://127.0.0.1:4173` origins, and a future explicitly configured hosted demo.
Reload the existing unpacked extension; do not require a separate development
build or second installation. Runtime checks retain exact origin and port
validation, and unconfigured hosted origins fail closed. No hosted URL is available. Public
publication and proposed CC0 fixture licensing are deferred until local
verification completes and must not be inferred from source preparation.

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
`lastSeen` equals this invocation's `readAt`.

## Runtime and UI

The extension has no storage APIs, no service worker, and no claim persistence.
Popup opens its dashboard directly; neither UI reads claim data. Show packaged
tool capabilities, architecture, consent, prerequisites and troubleshooting,
never infer page connection/registration from dashboard opening.

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
