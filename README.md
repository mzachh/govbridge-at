# GovBridge AT

A local Chrome extension that connects Austrian government services to WebMCP
agents. OEGK is the first supported service: search Wahlarzt / Wahltherapeut
claims in Meine SV, normalize observed claim data, track status changes, and
query stored claims through read-only tools. Internal package name: `govbridge-at`.

The user completes ID Austria login. The `search_claims` action fills and
submits only the recognized Wahlarzt date-range search form; it does not submit
a reimbursement application. Claim extraction remains passive. The extension
does not open PDFs, collect credentials, or upload claim data to a backend.
See [PRIVACY.md](PRIVACY.md) and the specifications in [`specs/`](specs/).

## Development

```sh
npm install
npm run verify
```

The unpacked extension is produced in `dist/`. Load that directory from
`chrome://extensions` only after the verification command succeeds.

On each supported OEGK page, a MAIN-world WebMcpBridge registers four read-only
tools through native `document.modelContext`. If native WebMCP is unavailable,
the locally bundled, pinned `@mcp-b/webmcp-polyfill` 4.0.0 provides the same API.
The dashboard documents the architecture and contracts; it does not need to
remain open. The normal claim tracker does not depend on WebMCP availability.

On the MeineSV entry URL `https://www.meinesv.at/vsInfo/views/KE/?contentid=10007.815943`,
its redirected type/range page, and the results page
`/vsInfo/views/KE/einreichungListe.xhtml`, a fifth tool, `search_claims({from, to})`, accepts ISO
dates (for example `2025-01-01` and `2025-12-31`) and activates the selected
Wahlarzt form's `Weiter` control when that form is present. Its `readOnlyHint` is `false`; the other four
tools remain read-only. Ranges must be ordered and at most five calendar years.
A `submission_requested` result only acknowledges dispatch. Navigation can
instead end the call or return `null`; inspect the resulting page before retrying.

## Codex skill

The reusable skill is versioned in [`skills/govbridge-at/`](skills/govbridge-at/).
Install that folder in your personal Codex skills directory, then use
`$govbridge-at` and specify a date range. The skill opens external Chrome,
helps select Wahlarzt / Wahltherapeut after your login, and uses `search_claims`
for the form interaction. It obtains consent before sensitive retrieval.

`list_claims` returns accumulated local observations, not a current-search
snapshot. `lastSeen` does not prove query membership or per-field freshness.
An empty search does not delete stored claims. Yearly reimbursement summaries
use invoice dates, which are not established as the site's search-date basis.

### Upgrade compatibility

Reload the existing unpacked extension from the same `dist/` directory.
The legacy storage key `oegkClaimTracker.state.v1`, bridge identifier
`oegk-claim-tracker.webmcp`, and `data-oegk-*` diagnostics are intentionally
preserved. OEGK remains the service identifier; existing claims need no migration.

### Browser-agent and CDP requirement

CDP is **not** a runtime requirement of the extension. The extension registers
its tools in the page through `document.modelContext`, and any browser agent
with native WebMCP access can discover and call them without CDP. The visible
DOM hints are only discovery and demo metadata; they are not an execution
channel.

The current Codex external-Chrome connector exposes CDP but does not expose a
dedicated `webmcp` capability. Consequently, Codex browser tests use the tab's
CDP capability to inspect `document.modelContext` and invoke the registered
tools. This requirement belongs to that connector/test path, not to GovBridge AT
or to a future WebMCP-native agent. If the connector gains native
WebMCP support, CDP can be removed from the test flow.

This is a PoC boundary, not an authenticated channel. Scripts running on the
matched OEGK page can observe or race MAIN-world bridge messages and invoke the
bounded search action. Only normalized tool data crosses per invocation;
storage internals, raw HTML,
PDFs, cookies, tokens, credentials, and ID Austria data do not cross.

The skill's consent step governs disclosure to the agent, not access by scripts
on the host page. This prototype does not authenticate callers of the bridge.
