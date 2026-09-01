# GovBridge AT — Implementation Report

## GovBridge AT update

- Renamed product and package while retaining OEGK provenance, the legacy
  storage key/protocol/diagnostic markers, and the existing dist installation.
- Added the query/results-route `search_claims` action: validated ISO dates,
  selected-form preflight, native value events, a single Weiter click, and
  redacted dispatch acknowledgement. Four stored-claim queries stay read-only.
- Added bounded observer rearming for possible same-document result updates.
- Updated dashboard, hints, specs, and privacy disclosures for the search action.
- Created and installed the `govbridge-at` skill with external Chrome navigation,
  user-operated login, native/CDP capability discovery, consent and conservative
  stored-data interpretation. Independent scenario review corrected stored-only
  requests so they do not initiate a website search.
- Skill frontmatter and UI metadata passed Ruby YAML validation; installed
  copies match repository sources. The bundled Python validator could not run
  because PyYAML is unavailable in the installed Python runtimes.
- Current automated verification: TypeScript, 136 tests, production build,
  and package audit passed. Independent review found and corrected the
  observation deadline cancelling the final queued extraction; a regression
  test now proves that the pending observation is flushed after the cutoff.
- Live query-form inspection confirmed selected tab `aria-selected="true"`,
  the documented date controls, POST action, and unique Weiter control. No
  claim values were captured.
- After the user reloaded the extension, live external Chrome verified the
  `govbridge-search-v1` marker, five registered tools, and `readOnlyHint: false`
  only for search_claims. A tool call using the plan's example dates returned
  `submission_requested`. A Page.frameNavigated event confirmed full navigation
  back to the type/range page with a recognized empty-result alert, no validation
  error, the expected formatted dates, the selected Wahlarzt tab, and both
  bridges ready. No claim-data tool was invoked in this verification.
- The live-tested search path used full-document navigation. Same-document
  rearming and deadline flushing are covered by synthetic tests, not live
  evidence. Final dist includes the subsequently tested deadline fix.
- A type-page empty alert is a website outcome, not a committed empty store
  snapshot under the existing adapter. The skill documents this distinction.

## Historical milestone evidence

The sections below describe the earlier four-query-tool implementation before
the search action. Counts and capability observations are historical.

## Implemented

- Manifest V3 extension with only the `storage` permission and one exact static
  content-script match for the documented Meine SV claim path.
- Strict isolated DOM adapter for the four documented routes, including list,
  empty, loading/error, and detail shapes.
- Canonical claim validation, normalization, deterministic ordering, summaries,
  conservative reconciliation, status events, and versioned local storage.
- German popup UI using DOM creation and text-only rendering.
- Four closed, read-only WebMCP tools: `list_claims`, `get_open_claims`,
  `get_claim`, and `get_reimbursement_summary`.
- MAIN-world WebMcpBridge on four exact OEGK paths, with an isolated relay and
  storage-backed background execution.
- Native-first WebMCP registration with pinned, locally bundled
  `@mcp-b/webmcp-polyfill` 4.0.0 compatibility fallback.
- Presentation-only technical dashboard documenting contracts and the PoC
  page-world visibility/race boundary.
- Visually hidden semantic agent hint with the four static tool names and
  MAIN-world `getTools()` / `executeTool()` instructions, matching the
  discovery fallback used by Auto WebMCP.
- No backend, network calls, remote code/assets, analytics, telemetry, form
  automation, navigation automation, PDF retrieval, or raw-page persistence.

## Automated evidence

- Strict TypeScript typecheck passes.
- 55 unit/integration/security tests pass, including a direct execution check
  against the packaged compatibility runtime.
- Production package allowlist and static security audit pass.
- npm audit reports zero known vulnerabilities as of 2026-08-30/31.

All automated DOM inputs are synthetic. They contain no copied account data.

## Chrome evidence

Previously verified in Chrome 152.0.7977.65 before the bridge refactor:

- the unpacked extension loads and remains enabled without a manifest error;
- the popup reads an empty local state and shows the no-observation state;
- the previous dedicated-dashboard registration worked through
  `document.modelContext`; and
- the existing extraction, storage, popup, and four handler contracts worked
  against live-local normalized state.

After the user completed login and manually opened the results list, a prior
redacted verification confirmed that extraction and stored status groups
matched the visible containers. That evidence does not verify the newly added
MAIN-world bridge.

## Not yet live-verified

- On 2026-08-31, an authenticated external Chrome tab at the supported results
  path reported `data-oegk-webmcp-bridge="ready:native"` and
  `data-oegk-content-bridge="ready"`. This verifies successful MAIN-world
  native registration and isolated-relay injection without recording claim
  values.
- On 2026-09-01, the same external Chrome flow verified build marker `hint-v1`,
  `data-oegk-webmcp-tools-available="true"`, tool count `4`, and the visually
  hidden semantic note containing exactly the four static OEGK tool names and
  generic MAIN-world invocation instructions. No claim tool was invoked and no
  claim value was recorded during this check.
- The external-Chrome Codex connection exposed only its page-assets capability,
  not a WebMCP caller. Browser-agent discovery and invocation through that
  specific connector therefore remain unverified; registration success must
  not be described as a completed Codex tool call.
- Confirmed list/detail layouts do not expose two safe overlapping identity
  components. Detail enrichment therefore fails closed rather than risking an
  incorrect claim association.
- Additional real-account layouts, pagination, session expiry, and source-label
  variants remain compatibility unknowns and fail closed.
