# 013 — GovBridge AT synthetic MeineSV server

This specification implements the approved `plan.md`. Existing production behavior
and spec 012's live, current-page extraction remain unchanged except for additive
environment provenance and exact approved demo/development origins.

Presentation update: spec 016 supersedes the German-only demo labels below with
English by default and a German switch. Production German contracts stay unchanged.

Spec 017 supersedes the original credentials, synthetic claim-value markers and
tool counts: use public `peter` / `ThisIsJustADemo$`, natural fictional values with
visible richer claim fields, and three queries plus the search action. Page-level
fictional-data disclosure, identity-field exclusion and no persistence still apply.

## Required contract

- A Sites-hosted, locally runnable Worker serves the canonical MeineSV entry,
  type/range, results and two detail routes under `/vsInfo/views/KE/`.
- A basic simulation login accepts the publicly advertised `username` / `password`.
  Signed one-hour HTTP-only cookies gate server responses. This is not identity
  verification or confidentiality protection for real records. No real credentials,
  ID Austria, private account material, remote data fetching or user registration.
- Exactly twenty independently invented claims span 2021-09-03 through 2026-09-02:
  five processing, eleven completed and four rejected. Four per rolling-year bucket.
  The default page renders all twenty; only the pagination scenario limits rows.
- Both date forms submit native POSTs to their own route with existing input IDs,
  selected tab and exact Weiter/OK controls; POST/Redirect/GET produces a new
  document. Server dates use invoiceDate inclusively, not purported OEGK semantics.
- Existing card/grid/row structures, German headings, amount badges and detail
  table labels match the extension. Display is modeled on measured official CSS,
  with conspicuous synthetic branding and no copied confidential assets.
- Scenarios exercise empty/type and empty/results, validation, malformed rows,
  unknown status, duplicate rows, missing fields, pagination, loading/hidden rows,
  expired login, broken layout and same-document AJAX outcomes. Developer controls
  mutate only the rendered synthetic document, never shared server state.
- No competing WebMCP implementation: installed extension supplies all five tools
  via its existing MAIN/ISOLATED bridge. Tests must call those real tools.

## Environments and publication

Exact origin configuration drives manifest and runtime checks. Production remains
www.meinesv.at; hosted demo origin is recorded only from Sites; development permits
explicit loopback port 4173. Search destinations must match the invoking origin,
not another approved environment. Query `page.environment` identifies synthetic
data.

User-approved PoC packaging revision: one existing `dist/` extension supports all
explicit approved origins, including loopback port 4173. No second development
extension or install directory is required. Unapproved origins/ports stay rejected.

Public access and fixture redistribution license need explicit approval before
release. Never publish Sites credentials, session secrets, private reference
captures, real claims or unrelated parent source. Keep a verification report of
automated, browser, WebMCP and visual checks; mark unverified behaviors honestly.

## Search recovery clarification (2026-09-03)

Natural empty results must not select the developer-only `empty-type` scenario.
The selected scenario remains unchanged across search submissions. A successful
search with no matching invoice dates may redirect to the type/range page with
`searched=1`; this bounded flag distinguishes a completed search from an untouched
search mask. Render natural emptiness from the current range, not from this flag
alone. Accept only `searched=1` on the type/range route, preserve it across login
and language switching, and omit it from the next form action so each submission
recomputes its outcome. Validation errors take precedence over empty results.

Explicit developer scenarios remain separate: `empty-type` stays empty on the
type/range page and `empty-results` stays empty on the results page. Existing
AJAX scenarios retain their scenario and dispatch behavior. Old URLs explicitly
containing `scenario=empty-type` remain forced scenarios; reopen the normal query
page to leave that scenario.

Regression verification must cover 12 results → no matches → 12 results, starting
from both query and results forms in English and German, plus untouched masks,
forced scenarios, invalid flags, validation precedence and language/login return
context. No extension code or downloadable ZIP changes are required.
