# GovBridge AT

GovBridge AT is a local Chrome extension that connects Austrian government
services to WebMCP agents. OEGK is the first supported service: its tools read
claim information on demand from the currently rendered Meine SV page.

The live implementation is page-scoped. Each query invokes the isolated OEGK
adapter for the current document and returns normalized fields plus page
metadata. It does not refresh the page, traverse pagination, merge other pages,
or persist claim records. "Live" means read at invocation time. It does not
guarantee newly fetched server data.

The extension does not open PDFs, collect credentials, or upload claim data to
a backend.

Want to test it? [Getting started](#getting-started) takes about five minutes
and runs against a hosted demo with fictional data, so no Austrian account is
needed.

See [PRIVACY.md](PRIVACY.md) and the [spec index](specs/README.md) for the
current specifications.

## Getting started

### What you need

- Node.js 22.13 or newer only if building from source or running the local
  demo server (the prebuilt extension and hosted demo need no Node)
- Google Chrome
- An agent that can reach a Chrome tab. We tested with the ChatGPT desktop app
  connected to Chrome through its browser extension.

### 1. Download or build the extension

Download [GovBridge AT 0.1.0](https://github.com/mzachh/govbridge-at/raw/refs/heads/main/downloads/govbridge-at-0.1.0.zip)
and unzip it. No build is needed.

Or build from source:

```sh
npm install
npm run build
```

This produces the unpacked extension in `dist/`. To also run the full checks
(typecheck, 152 tests, build, package audit), use `npm run verify`.

### 2. Install it in Chrome

1. Open `chrome://extensions`
2. Enable Developer mode (top right)
3. Click "Load unpacked" and select the extracted folder containing
   `manifest.json` (or `dist/` if you built from source)

One build supports production (`www.meinesv.at`), the hosted demo, and the
local demo origin.

### 3. Open the demo

The fastest path uses the hosted synthetic demo, no local server needed:

1. Open the [GovBridge AT demo](https://govbridge-at-demo.manuel857067.chatgpt.site)
2. Log in with the public demo credentials `peter` / `ThisIsJustADemo$`
   (fictional data only, never enter a real password)
3. You land on the claims query page. GovBridge AT registers its WebMCP tools
   automatically on supported pages

To run the demo locally instead:

```sh
npm --prefix demo-site install
npm run demo:dev
```

Then open `http://localhost:4173` with the same demo credentials. Runtime
origin checks accept exactly the loopback origins in
`config/extension-targets.json`.

### 4. Connect the agent

With the ChatGPT desktop app:

1. Install the ChatGPT desktop app and its Chrome browser extension. The
   connector links the app to external Chrome over CDP. The in-app browser is
   not supported.
2. In the app, connect to external Chrome (the same Chrome profile where you
   loaded `dist/`).
3. Copy [`skills/govbridge-at/`](skills/govbridge-at/) into your personal Codex
   skills directory (typically `~/.codex/skills/`) so the agent knows the
   workflow, then reference `$govbridge-at` in the conversation.

Any other WebMCP-capable agent works too: it can discover the tools directly
through `document.modelContext` on a supported tab.

### 5. Try it

With the demo open on the claims query page, ask the agent:

> Use $govbridge-at to search my claims from the last 3 years, then
> tell me which ones are still open.

Expected: the agent calls `search_claims` (the site's own date-range form fills
and submits), then reads the results page with `get_open_claims` and reports
the open claims.

A good follow-up question:

> How much was reimbursed in total?

### Verify without an agent

Open the demo results page, then run this in the Chrome DevTools console:

```js
const tools = await document.modelContext.getTools();
// list_claims, get_open_claims, get_claim, plus search_claims on query and
// results routes
const open = tools.find(t => t.name === "get_open_claims");
JSON.parse(await document.modelContext.executeTool(open, "{}"));
```

To search manually instead of through an agent: on the claims query page enter
`03.09.2021` and `02.09.2026` as the range (the full demo range) and click
Weiter.

### Troubleshooting

- `getTools()` is empty or missing: confirm you are on a supported page
  (claims query, results, or detail route under `/vsInfo/views/KE/`), reload
  the extension, then reload the page. The bridge status
  `document.documentElement.getAttribute("data-oegk-webmcp-bridge")` should
  read `ready:native` or `ready:polyfill`.
- `UNSUPPORTED_PAGE`: wrong origin or route. Use the hosted demo URL or the
  exact production entry URL, with the `dist/` build from this repo.
  Unconfigured origins fail closed.
- `PAGE_NOT_READY`: the query page shows a search mask with no rendered
  results yet. Run a search first (manually or via `search_claims`), then ask
  again.
- Demo login rejected: only `peter` / `ThisIsJustADemo$` is accepted.
- The agent controls the wrong browser: the workflow requires external Chrome
  with the extension installed, not the ChatGPT in-app browser.

## WebMCP tools

On supported OEGK pages, a MAIN-world WebMCP bridge registers three read-only
query tools through native `document.modelContext`, plus the page-scoped
`search_claims` action. If native WebMCP is unavailable, the locally bundled,
pinned `@mcp-b/webmcp-polyfill` compatibility runtime provides the same API.
The dashboard documents packaged capabilities and workflow guidance. It does
not read claim data or infer that a page is connected or registered.

The query tools are:

- `list_claims({})`
- `get_open_claims({})`
- `get_claim({ claimId })`

Every query is read-only and current-page only. All three return the same
normalized Claim shape for fields displayed and parseable on the current page.
Compact overview rows provide `provider`, `invoiceDate`, `status`, and a
displayed `reimbursementAmount`. Detail pages may additionally provide
`invoiceAmount`, `treatmentDate`, `treatmentEndDate`, and `reimbursementDate`.
Open-claim filtering is status-based (`submitted` or `processing`) and keeps a
displayed reimbursement amount when present. An unknown reimbursement date
remains unknown. Missing production fields are not converted to zero or
inferred dates, and the overview date is never inferred as a claim field.

Person, social security number, bank account, and claim reference fields never
cross the WebMCP bridge. `page.scope` is `"current-page"`. `page.completeness`
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
when present. Its `readOnlyHint` is `false`. The three query tools remain
read-only. Ranges must be ordered and at most five calendar years. A plain
search mask or unsettled search returns `PAGE_NOT_READY`. An acknowledgement
does not confirm fresh results.

## Demo details

`demo-site/` implements a separate synthetic MeineSV simulator using the same
extension registration and rendered-DOM extraction, not a second tool backend.
It contains exactly 20 independently invented claims with the fixed
demonstration range `2021-09-03` to `2026-09-02` (reference date `2026-09-02`),
with 5 processing, 11 completed, and 4 rejected records, duplicate examples,
date coverage, and 11 known reimbursements totaling EUR 543.40. Claim values
use natural-looking practice names. They do not contain `Demo` or `SYNTHETIC`
except for references such as `SYNTHETIC-demo-claim-009`.

The header is exactly `GovBridge AT: OEGK (meinesv.at) demo server` and the
fictional-data notice remains visible in both languages. The demo does not use
ID Austria and is not an official service. Its English presentation is the
default, with an always-visible `English` / `Deutsch` switch. Compact overview
rows show only the fictional overview date, provider, invoice date, and
displayed reimbursement badges. Richer provider, invoice, treatment-period,
and reimbursement fields are visible on detail pages in both languages. The
overview date is display-only and is not mapped to a canonical claim date.
Missing detail values use an explicit unknown label. The synthetic detail
fixture may display Peter, `AT00 1234 1234 1234 1234`, and `1234010196` for
visual testing, but these person, bank-account, and social security values are
excluded from WebMCP responses.

The local server uses strict port 4173. Loopback development uses a local-only
session key. Hosted operation requires a separate `DEMO_SESSION_SECRET` and
must never reuse that development key. Run `npm run demo:verify` for combined
automated verification of extension and demo server.

## Production use

On production, the user completes ID Austria login. The extension never
touches authentication. The `search_claims` action fills and submits only the
recognized Wahlarzt / Wahltherapeut date-range form. It does not submit a
reimbursement application. Its `submission_requested` response acknowledges
dispatch only. Navigation can interrupt the call, so the agent inspects the
resulting page and rediscovers tools before reading. Production support is a
prototype validated against the observed page structure. The adapter fails
closed when origin, route, or landmarks drift.

## Agent setup details

The reusable skill is versioned in [`skills/govbridge-at/`](skills/govbridge-at/).
Install that folder in your personal Codex skills directory, then use
`$govbridge-at` and specify a date range. The skill opens external Chrome,
reuses a selected matching supported real or demo tab, helps select Wahlarzt /
Wahltherapeut after user-operated login, and uses native WebMCP capability
discovery with the documented CDP fallback. Related requested WebMCP operations
are read and summarized within the user's requested scope without an extra
skill consent prompt. Browser/platform approvals remain authoritative.

The skill's standard discovery call awaits `document.modelContext.getTools()`
before processing its array, uses the registered tool object with
`executeTool(tool, JSON.stringify(input))`, and runs no repeated probe loops.
It explains that reads are current-page only, may be partial, and do not create
history. It also explains temporary IDs, unknown fields, supported-tab reuse,
English conversation by default, and the private-insurance roadmap boundary.

Any browser agent with native WebMCP support can discover and call the tools.
The ChatGPT app's Chrome extension does not yet expose WebMCP tools directly,
so our integration currently requires CDP to discover and call them. This
dependency is outside our control. We expect direct WebMCP access to become
available in the future, which would remove the need for CDP in this workflow.
The skill never uses CDP for page inspection. DOM hints are discovery metadata
only, not an execution channel.

## Privacy boundary

The popup contains an introduction and opens the technical dashboard directly
with `chrome.tabs.create`. Neither extension page reads claim data from the
active tab. The bridge exposes only canonical claim fields and structural page
metadata. It does not expose raw HTML, DOM objects, source IDs, links/PDFs,
authentication data, or the excluded identity fields.

This is a PoC boundary, not an authenticated channel. Scripts running on the
matched OEGK page can observe or race MAIN-world bridge messages and invoke the
bounded search action. The skill's task scope is not an in-page access-control
mechanism.

## License

GovBridge AT's original extension, demo server, skill, documentation, and
fictional fixtures are licensed under the [MIT License](LICENSE).
Third-party components retain their own licenses and notices.
