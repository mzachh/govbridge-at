# OEGK Claim Tracker — Milestone-one Implementation Report

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
