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
- Dedicated origin-isolated WebMCP dashboard using local COOP/COEP policies.
- No backend, network calls, remote code/assets, analytics, telemetry, form
  automation, navigation automation, PDF retrieval, or raw-page persistence.

## Automated evidence

- Strict TypeScript typecheck passes.
- 38 unit/integration/security tests pass.
- Production package allowlist and static security audit pass.
- npm audit reports zero known vulnerabilities as of 2026-08-30/31.

All automated DOM inputs are synthetic. They contain no copied account data.

## Chrome evidence

Verified in Chrome 152.0.7977.65 with `WebMCP for testing` enabled:

- the unpacked extension loads and remains enabled without a manifest error;
- the popup reads an empty local state and shows the no-observation state;
- the dedicated dashboard registers all four tools;
- `document.modelContext.getTools()` returns exactly the four expected names;
- same-document `list_claims` execution returns a successful empty result with
  zero claims; and
- extension-page registration required the documented origin-keyed COOP/COEP
  settings; without them Chrome rejected registration because
  `document.domain` was enabled.

After the user completed login and manually opened the results list, a redacted
live verification confirmed that the number and status groups of stored claims
matched the visible claim containers. All four WebMCP tools executed
successfully against the live-local state. Provider and invoice-date coverage
matched every recognized card, and reimbursement coverage matched every
reimbursed card after adding a regression-tested optional-arrow badge grammar.
The popup rendered the live-local state and was corrected to show `Nicht
verfügbar` rather than a misleading known zero when every invoice amount in a
year is absent.

## Not yet live-verified

- Browser-agent discovery of the extension-origin dashboard tools is separate
  from same-document WebMCP registration and remains to be verified.
- Confirmed list/detail layouts do not expose two safe overlapping identity
  components. Detail enrichment therefore fails closed rather than risking an
  incorrect claim association.
- Additional real-account layouts, pagination, session expiry, and source-label
  variants remain compatibility unknowns and fail closed.
