# GovBridge AT

GovBridge AT is a local Chrome extension that connects Austrian government
services to WebMCP agents. OEGK is the first supported service: its tools read
claim information on demand from the currently rendered Meine SV page.

The live implementation is page-scoped. Each query invokes the isolated OEGK
adapter for the current document and returns normalized fields plus page
metadata. It does not refresh the page, traverse pagination, merge other pages,
or persist claim records. Results may be partial when malformed rows are
skipped. “Live” means read at invocation time; it does not guarantee newly
fetched server data.

On production, the user completes ID Austria login. The `search_claims` action
fills and submits only the recognized Wahlarzt / Wahltherapeut date-range form;
it does not submit a reimbursement application. Its
`submission_requested` response acknowledges dispatch only. Navigation can
interrupt the call, so inspect the resulting page and rediscover tools before
reading. The extension does not open PDFs, collect credentials, or upload claim
data to a backend.

See [PRIVACY.md](PRIVACY.md), [spec 018](specs/018-compact-demo-overview.md),
and [spec 017](specs/017-claim-fields-and-demo-workflow.md),
and the earlier specifications in [`specs/`](specs/) (which are marked
historical where superseded).

## Development

```sh
npm install
npm run verify
```

The unpacked extension is produced in `dist/`. Load that directory from
`chrome://extensions` only after verification succeeds. Keep one unpacked
`dist/` installation for both production and the configured local demo.

## Synthetic local demo

`demo-site/` implements a separate synthetic MeineSV simulator using the same
extension registration and rendered-DOM extraction, not a second tool backend.
It contains exactly 20 independently invented claims with the fixed
demonstration range `2021-09-03`–`2026-09-02` (reference date `2026-09-02`),
with 5 processing, 11 completed, and 4 rejected records, duplicate examples,
date coverage, and 11 known reimbursements totaling EUR 543.40. Claim values
use natural-looking practice names;
they do not contain `Demo` or `SYNTHETIC` except for references such as
`SYNTHETIC-demo-claim-009`.

The header is exactly `GovBridge AT: OEGK (meinesv.at) demo server` and the
fictional-data notice remains visible in both languages. The demo login uses
the public username `peter` and password `ThisIsJustADemo$`; the old
`username` / `password` pair is rejected. Never enter a real password. The
synthetic detail fixture may display Peter, `AT00 1234 1234 1234 1234`, and
`1234010196` for visual testing, but these person, bank-account, and social
security values are excluded from WebMCP responses.

The demo does not use ID Austria and is not an official service. Its English
presentation is the default, with an always-visible `English` / `Deutsch`
switch. Compact overview rows show only the fictional overview date, provider,
invoice date, and displayed reimbursement badges; richer provider, invoice,
treatment-period, and reimbursement fields are visible on detail pages in both
languages. The overview date is display-only and is not mapped to a canonical
claim date. Missing detail values use an explicit unknown label. Reimbursed
claims have deterministic treatment periods and plausible later reimbursement
dates; open claims do not receive fabricated reimbursement dates. Verify
`page.environment` is `development` or `demo` and label results synthetic.
`source: "oegk"` identifies the adapter only.

```sh
npm --prefix demo-site install
npm run build
npm run audit
npm run demo:dev
```

Reload the existing unpacked extension from `dist/` in external Chrome; do not
install a second copy. Open `http://localhost:4173` while the local server is
running. The server uses strict port 4173; runtime origin checks allow only the
exact loopback origins in `config/extension-targets.json`. Loopback development
uses a local-only session key; hosted operation requires a separate
`DEMO_SESSION_SECRET` and must never reuse that development key. Run
`npm run demo:verify` for combined automated verification. Starting a server or
building a package alone does not establish browser tool callability.

The single `dist/` build supports production plus exact
`http://localhost:4173` and `http://127.0.0.1:4173` origins, and will include a
hosted demo at [GovBridge AT Demo](https://govbridge-at-demo.manuel857067.chatgpt.site).
Unconfigured or malformed origins are not accepted. The hosted demo is publicly
reachable and uses `peter` / `ThisIsJustADemo$` for its fictional claim pages;
no Sites or MeineSV account is needed. Reload the existing extension from `dist/`
to enable this exact hosted origin. An extension download and the proposed CC0
fixture license remain deferred. Do not switch a real-account request to the demo
without the user's agreement.

## WebMCP tools

On supported OEGK pages, a MAIN-world WebMCP bridge registers three read-only
query tools through native `document.modelContext`, plus the page-scoped
`search_claims` action. If native WebMCP is unavailable, the locally bundled,
pinned `@mcp-b/webmcp-polyfill` compatibility runtime provides the same API.
The dashboard documents packaged capabilities and workflow guidance; it does
not read claim data or infer that a page is connected or registered.

The query tools are:

- `list_claims({})`
- `get_open_claims({})`
- `get_claim({ claimId })`

Every query is read-only and current-page only. All three return the same
normalized Claim shape for fields displayed and parseable on the current page.
Compact overview rows provide `provider`, `invoiceDate`, `status`, and a
displayed `reimbursementAmount`; detail pages may additionally provide
`invoiceAmount`, `treatmentDate`, `treatmentEndDate`, and `reimbursementDate`.
Open-claim filtering is status-based (`submitted` or `processing`) and keeps a
genuinely displayed reimbursement amount; an unknown reimbursement date
remains unknown. Missing production fields are not converted to zero or
inferred dates, and the overview date is never inferred as a claim field. Read
the rendered overview or detail table only; the extension does this extraction
and the agent consumes only the normalized tool response. Never navigate or
fetch detail pages, persist data, or enrich from previous calls.

Person, social security number, bank account, and claim reference fields never
cross the WebMCP bridge. `page.scope` is `"current-page"`; `page.completeness`
and `page.skippedCount` describe the rendered snapshot. IDs have the form
`live-v1-*` and are temporary: list again after a page change or when
`get_claim` returns `NOT_FOUND`. There is no summary tool and no account-wide
history. Unknown values remain unknown.

`page.environment` identifies `production`, `demo`, or `development` from the
extension's approved origin configuration. Demo/development results are
synthetic. The retained `source: "oegk"` identifies the adapter, not proof of
official provenance. Do not switch origins without the user's request or
present one environment's records as another's.

On the MeineSV entry URL
`https://www.meinesv.at/vsInfo/views/KE/?contentid=10007.815943`, its redirected
type/range page, and the results page
`/vsInfo/views/KE/einreichungListe.xhtml`, `search_claims({from, to})` accepts
ISO dates and activates the selected Wahlarzt form's `Weiter` control on the
type/range page or the retained results-form `OK` control on the results page
when present. Its `readOnlyHint` is `false`; the three query tools remain
read-only. Ranges must be ordered and at most five calendar years. A plain
search mask or unsettled search returns `PAGE_NOT_READY`; an acknowledgement
does not confirm fresh results.

## Codex skill

The reusable skill is versioned in [`skills/govbridge-at/`](skills/govbridge-at/).
Install that folder in your personal Codex skills directory, then use
`$govbridge-at` and specify a date range. The skill opens external Chrome,
reuses a selected matching supported real or demo tab, helps select Wahlarzt /
Wahltherapeut after user-operated login, and uses native WebMCP capability
discovery with the documented CDP fallback. Related requested WebMCP operations
are read and summarized within the user's requested scope without an extra skill
consent prompt; browser/platform approvals remain authoritative.

The skill's standard discovery call awaits `document.modelContext.getTools()`
before processing its array, uses the registered tool object with
`executeTool(tool, JSON.stringify(input))`, and runs no repeated probe loops.
It explains that reads are current-page only, may be partial, and do not create
history. It also explains temporary IDs, unknown fields, supported-tab reuse,
English conversation by default, and the private-insurance roadmap boundary.

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
source IDs, links/PDFs, authentication data, or the excluded identity fields.

This is a PoC boundary, not an authenticated channel. Scripts running on the
matched OEGK page can observe or race MAIN-world bridge messages and invoke the
bounded search action. The skill's task scope is not an in-page access-control
mechanism: scripts running on the matched page can observe or race bridge
messages.

## Browser-agent and CDP requirement

CDP is not a runtime requirement of the extension. The extension registers its
tools in the page through `document.modelContext`, and any browser agent with
native WebMCP access can discover and call them without CDP. Visible DOM hints
are discovery and demo metadata only; they are not an execution channel.

The Codex external-Chrome connector may expose CDP without a dedicated
`webmcp` capability. In that test path, CDP can inspect
`document.modelContext` and invoke registered tools only when native WebMCP is
not advertised. This connector-specific fallback does not change the
extension's runtime requirements. Capability metadata should be inspected
after reload, navigation, and search because hints alone do not prove
registration.
