# GovBridge AT

GovBridge AT is a local Chrome extension that connects Austrian government
services to WebMCP agents. OEGK is the first supported service: its tools read
claim information on demand from the currently rendered Meine SV page.

The current implementation is live and page-scoped. Each query invokes the
isolated OEGK adapter for the current document and returns normalized fields
plus page metadata. It does not refresh the page, traverse pagination, merge
other pages, or persist claim records. Results may be partial when malformed
rows are skipped. “Live” means read at invocation time; it does not guarantee
newly fetched server data.

The user completes ID Austria login. The `search_claims` action fills and
submits only the recognized Wahlarzt / Wahltherapeut date-range form; it does
not submit a reimbursement application. Its `submission_requested` response
acknowledges dispatch only. Navigation can interrupt the call, so inspect the
resulting page and rediscover tools before reading. The extension does not open
PDFs, collect credentials, or upload claim data to a backend.

See [PRIVACY.md](PRIVACY.md), [spec 012](specs/012-live-claim-tools.md), and
the earlier specifications in [`specs/`](specs/) (which are marked historical).

## Development

```sh
npm install
npm run verify
```

The unpacked extension is produced in `dist/`. Load that directory from
`chrome://extensions` only after verification succeeds.

On supported OEGK pages, a MAIN-world WebMcpBridge registers four read-only
tools through native `document.modelContext`. If native WebMCP is unavailable,
the locally bundled, pinned `@mcp-b/webmcp-polyfill` 4.0.0 provides the same
API. The dashboard documents packaged capabilities and workflow guidance; it
does not read claim data or infer that a page is connected or registered.

The four query tools are:

- `list_claims({})`
- `get_open_claims({})`
- `get_claim({ claimId })`
- `get_reimbursement_summary({ year })`

Every query is read-only and current-page only. `page.scope` is
`"current-page"`; `page.completeness` and `page.skippedCount` describe the
rendered snapshot. IDs have the form `live-v1-*` and are temporary: list again
after a page change or when `get_claim` returns `NOT_FOUND`. Legacy
`local-v1-*` IDs are not resolved. Reimbursement totals sum known values only;
unknown amounts are not treated as zero, and invoice-year summaries are not an
account-wide result.

On the MeineSV entry URL
`https://www.meinesv.at/vsInfo/views/KE/?contentid=10007.815943`, its redirected
type/range page, and the results page
`/vsInfo/views/KE/einreichungListe.xhtml`, the fifth tool,
`search_claims({from, to})`, accepts ISO dates and activates the selected
Wahlarzt form's `Weiter` control on the type/range page or the retained
results-form `OK` control on the results page when present. Its
`readOnlyHint` is `false`; the other four tools remain read-only. Ranges must
be ordered and at most five calendar years. A plain search mask or unsettled search returns
`PAGE_NOT_READY`; an acknowledgement does not confirm fresh results.

## Codex skill

The reusable skill is versioned in [`skills/govbridge-at/`](skills/govbridge-at/).
Install that folder in your personal Codex skills directory, then use
`$govbridge-at` and specify a date range. The skill opens external Chrome,
helps select Wahlarzt / Wahltherapeut after your login, uses native/CDP
capability discovery, and obtains consent before exposing or summarizing
claim-bearing fields. Tool invocation itself is a bounded local operation and
does not require a separate sensitivity approval.

The skill explains that reads are current-page only, may be partial, and do not
create history. It also explains that temporary IDs expire, invoice-year
summaries are limited to the rendered page, and displayed ranges do not prove
server-query boundaries.

## Compatibility and privacy boundary

Reload the existing unpacked extension from the same `dist/` directory. The
legacy storage key `oegkClaimTracker.state.v1`, bridge identifier
`oegk-claim-tracker.webmcp`, and `data-oegk-*` diagnostic markers are retained
only as compatibility identifiers where needed. This version does not read,
migrate, delete, or display bytes previously written under the legacy storage
key; those bytes remain untouched and inaccessible to the live reader.

The popup contains an introduction and opens the technical dashboard directly
with `chrome.tabs.create`. Neither extension page reads active-tab claim data,
storage, or runtime claim messages. The bridge exposes only canonical claim
fields and structural page metadata; it does not expose raw HTML, DOM objects,
source IDs, links/PDFs, authentication data, or unrelated personal fields.

This is a PoC boundary, not an authenticated channel. Scripts running on the
matched OEGK page can observe or race MAIN-world bridge messages and invoke the
bounded search action. Skill-level consent governs disclosure to the agent; it
is not an in-page access-control mechanism.

## Browser-agent and CDP requirement

CDP is not a runtime requirement of the extension. The extension registers its
tools in the page through `document.modelContext`, and any browser agent with
native WebMCP access can discover and call them without CDP. Visible DOM hints
are discovery and demo metadata only; they are not an execution channel.

The Codex external-Chrome connector may expose CDP without a dedicated
`webmcp` capability. In that test path, CDP can inspect
`document.modelContext` and invoke registered tools. This connector-specific
fallback does not change the extension's runtime requirements. Capability
metadata should be inspected after reload, navigation, and search because
hints alone do not prove registration.
