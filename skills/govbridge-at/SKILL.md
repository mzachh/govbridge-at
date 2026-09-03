---
name: govbridge-at
description: Guide MeineSV OEGK Wahlarzt / Wahltherapeut reimbursement searches, or an explicitly requested synthetic GovBridge AT demo, in external Chrome with the extension, then summarize requested current-page results. Not for claim filing, editing, ID Austria authentication, private-insurance estimates, or PDF retrieval.
---

# GovBridge AT

Help the user run an OEGK search and interpret the currently rendered page. Use
English for the conversation by default, regardless of the page language; honor
an explicit request for another language. OEGK is the first supported service;
do not imply support for other authorities.

Choose the workflow from the user's intent. Run Guided search only for a
requested website search. For a current-page summary or a single known claim ID,
discover the tools on the supported page and summarize only the requested
current-page fields; do not require dates or initiate a new search.
Historical stored-data access has been removed: explain this for past-store
requests, and do not silently substitute a new search. A live read does not
refresh the website. A comparison with private insurance is a great idea and is
on the roadmap, but is not implemented; do not invent coverage estimates.

## Boundaries and approvals

- Use external Chrome with GovBridge AT. Read the available Chrome skill and its
  current runtime documentation before browser actions; discover the installed
  runtime instead of hardcoding plugin versions, paths, browser IDs, or
  remembered tab IDs. Do not substitute the in-app browser. If the user
  explicitly requests a different browser, explain this workflow's Chrome
  requirement and ask before switching.
- Leave ID Austria login, credentials, MFA, and consent screens entirely to the
  user. Ask them to sign in in Chrome and tell you when ready; do not inspect
  authentication fields, cookies, tokens, hidden JSF state, or browser/extension
  storage.
- The three query tools and the `search_claims` action are bounded local
  operations; they do not upload data or transmit it to a third party. A
  requested related WebMCP operation does not need an extra skill-level consent
  prompt: the user's request authorizes reading and summarizing the requested
  current-page fields. Honor any browser/platform approval that is actually
  required, and do not broaden the response beyond the requested task.
- Read only browser-provided tab URL/capability metadata, WebMCP schemas, and
  normalized WebMCP responses. Never inspect page content: no DOM queries or
  markers, page titles, form values, accessibility/DOM snapshots, screenshots,
  raw HTML, network response bodies or PDFs. Do not read first and redact later.
  This applies to both real and fictional pages and to all browser mechanisms.
  If tool metadata cannot resolve the state, ask the user for a non-sensitive
  confirmation rather than asking them to paste page contents.
- CDP is only a fallback transport for WebMCP registry discovery and invocation
  through `document.modelContext`; it is not a page-inspection or navigation
  channel. Do not use CDP DOM, Network, Storage, Input or screenshot commands, or
  arbitrary JavaScript. Use ordinary browser URL metadata/navigation for tab
  selection. If that safe navigation capability is missing, ask the user to
  open the verified URL themselves.
- Do not file, edit, delete, or submit a reimbursement claim, open a claim detail
  page automatically, or invoke/download PDFs. The only supported submission is
  the bounded **search form** action below. Do not export or persist personal
  results unless separately requested.

## Supported-tab and synthetic-demo rules

Reuse a selected supported real or demo tab when it matches the user's intent.
Do not route a ready results page through the entry or type pages. Do not
automatically substitute a production tab for a demo tab (or the reverse), and
do not switch environments without the user's agreement. Keep authentication
user-operated.

Use the synthetic branch only when the user requests the demo. Before navigating,
verify the exact approved origin in the project's `config/extension-targets.json`
and the corresponding installed build. Do not infer a hostname from page banners
or trust an arbitrary localhost port. A null `demoOrigin` means no hosted demo is
configured; local development uses the configured loopback origin on port 4173.
The same `dist/` extension supports production and configured demo origins:
reload the existing unpacked extension, never request a separate development
copy or second installation. If this configuration cannot be verified, ask for a
verified demo target rather than inventing one. A hosted extension download
remains deferred; the approved demo origin is in that configuration.

The demo uses the exact header `GovBridge AT: OEGK (meinesv.at) demo server`, an
always-visible fictional-data notice, and environment provenance. It contains
20 independently invented records with natural-looking practice names; claim
values must not say `Demo` or `SYNTHETIC` except for references such as
`SYNTHETIC-demo-claim-009`. The fixed full-fixture range is
`2021-09-03`–`2026-09-02`, with 5 processing, 11 completed, and 4 rejected
records, duplicate examples, date coverage, and 11 known reimbursements
totaling EUR 543.40. These are fixture expectations, not a substitute for live
WebMCP results. Reimbursed claims have deterministic treatment periods and
plausible later reimbursement dates; open claims do not receive fabricated
reimbursement dates. Rich fields render on detail pages in both languages;
overview rows remain compact. The explicit missing-fields scenario retains
unknown amounts.

Demo login uses only the public username `peter` and password
`ThisIsJustADemo$`; the former `username` / `password` pair must be rejected.
Never enter real credentials. The fixture detail page may show the requested
synthetic identity and bank fields, but the agent must not inspect them. These
fields are never returned by WebMCP and must not be disclosed. Verify
`page.environment` in the tool response is
`development` or `demo` and label results synthetic. `source: "oegk"` is only
the adapter identifier. Do not switch origins without the user's request or
present one environment's records as another's.

The demo defaults to English and offers `English` / `Deutsch` while preserving
search context. Switching language navigates to a new document, so rediscover
tools and obtain new temporary IDs. Leave page-language changes to the user;
do not inspect or manipulate language controls. The extension handles supported
page labels. Tool inputs remain ISO dates in either language.

## Guided search

1. Resolve the user's inclusive `from` and `to` calendar dates as `YYYY-MM-DD`.
   Treat the maximum accepted query span as **five calendar years minus one
   day**. For a relative request such as “last 5 years,” use the user's timezone
   and compute `to = today` and `from = addCalendarYears(to, -5) + 1 calendar
   day`; when the anniversary falls on February 29, clamp it to February 28
   before adding the day. Show the exact computed dates to the user before
   searching. For explicit user-provided dates, do not silently alter, clamp,
   narrow, or split them; pass them through and let server validation decide,
   then report any rejection. Ask about missing or ambiguous bounds. Same-day
   queries are valid.
2. Reuse a selected matching supported tab. If there is no matching tab,
   navigate to the MeineSV OEGK entry page
   `https://www.meinesv.at/vsInfo/views/KE/?contentid=10007.815943` (or the
   verified requested demo origin with the same supported routes). This is the
   search-mask entry point; MeineSV may redirect it to
   `/vsInfo/views/KE/einreichungTyp.xhtml`. Leave ID Austria authentication
   entirely to the user.
3. Use the tab's supported URL and browser capabilities as the only preflight.
   Do not inspect page headings, selected tabs, form fields or result markers.
   The extension validates those locally. If category selection is needed, ask
   the user to select “Wahlarzt / Wahltherapeut” (Private doctor / therapist)
   and confirm readiness. Do not use locators or CDP to select it yourself.
4. Prefer the browser's native WebMCP tool surface; use only the restricted CDP
   fallback below when unavailable. Inspect callable tools and their live schemas; hints,
   diagnostics, and static metadata do not prove callability. Make one standard
   discovery call per document, await `getTools()` before processing its array,
   and rediscover only after navigation or a material registry change:

   ```js
   const registeredTools = await document.modelContext.getTools();
   if (!Array.isArray(registeredTools)) throw new Error("Invalid tool registry");
   const tool = registeredTools.find(({ name }) => name === requestedToolName);
   if (!tool) throw new Error(`Missing registered tool: ${requestedToolName}`);
   const result = await document.modelContext.executeTool(tool, JSON.stringify(input));
   ```

   Use the registered tool object, not a tool name. Do not run repeated
   `map()`/stringification probe loops. The type/range page must expose
   `search_claims` with exactly required `from` and `to` ISO-date fields before
   proceeding.
5. Use CDP only when native WebMCP access is unavailable and the browser
   advertises supported CDP. Limit evaluation to the `document.modelContext`
   discovery/invocation above, awaiting and returning the registry or tool
   response. Do not append page reads, including `location`, titles or DOM
   checks, to the expression. If neither tool access path is available, report
   the blocker without scraping, fetching URLs, or accessing extension storage.
6. Once `search_claims({from, to})` is exposed with the expected schema, invoke
   it directly once through that tool surface; the explicit website-search
   request authorizes the bounded action. The extension sets the actual website
   dates and submits `Weiter` or the retained results-form `OK`; do not fill
   dates or click either submitter yourself, call site functions, replay JSF
   requests, or construct form submissions. This action returns no claims. If
   it is unavailable, stop the automated search and offer user-operated search
   guidance; do not substitute scraping or raw storage access.
7. Treat `{ok:true,data:{status:"submission_requested"}}` as **dispatch
   requested**, not successful results or refreshed server data. Navigation can
   legitimately return `null` or destroy the execution context. Verify the
   resulting state through tab URL metadata and rediscovered WebMCP query
   responses only; a changed URL alone is not search success. Do not resubmit after
   `null`, a timeout, lost context, or `SEARCH_IN_PROGRESS`. Explain uncertainty
   and obtain the user's direction before retrying. Cancellation cannot undo a
   dispatched click.
8. Interpret only WebMCP envelopes and `data.page` metadata. A successful
   current-page query supplies the readable results and their completeness;
   tool errors describe unsupported, loading or extraction states. Do not
   inspect the page to supplement an error. Missing tools on a login route mean
   the user may need to sign in; do not inspect the login page.
9. The extension recognizes explicit empty-result alerts, including on the
   type/range route, and returns an empty success. Rely on that response, not
   on reading alerts or inferring emptiness from the URL. No earlier records
   are retained or merged.
10. Invoke only the requested query tools. Related WebMCP operations do not
    require an additional skill prompt: read and summarize only the normalized
    current-page data needed for the user's request. Each query extracts the
    current page anew but does not refresh server data. Rediscover tools after
    navigation. If `PAGE_NOT_READY` is returned, allow one bounded wait and one
    query-tool retry without inspecting the page; never rerun the search
    automatically. Report an uncertain outcome if it remains unresolved.

## Missing browser capabilities

- If Chrome is unavailable, use the Chrome skill's documented
  connection/startup troubleshooting and report the actual blocker. Do not
  conflate a stopped browser with a missing GovBridge AT extension.
- If native WebMCP is unavailable but CDP is advertised, use the documented CDP
  path only for `document.modelContext`; if that object or the expected tool is
  missing, verify the supported route and installed extension build. Advise
  reloading the existing unpacked extension from `dist/` and the page, then
  rediscover once; do not claim a reload fixed it without checking.
- If neither native WebMCP nor CDP is advertised, explain that this connection
  cannot invoke page tools. `pageAssets`, DOM hints, snapshots, and broad text
  searches are insufficient. Ask the user to connect the supported browser
  integration; do not modify browser security settings silently.
- On wrong-page or unavailable-form errors, ask the user to open the supported
  search page and select the category, or navigate to its verified entry URL
  through ordinary browser navigation. Never inspect controls to diagnose it.
  Explain the tool error and ask for non-sensitive readiness confirmation.

## Query tools and interpretation

Use the live schemas. The current query contract has three read-only tools:

| Tool | Input | Meaning |
| --- | --- | --- |
| `list_claims` | `{}` | Current rendered normalized claims and page metadata; no implicit refresh or pagination. |
| `get_open_claims` | `{}` | Current-page `submitted` or `processing` claims; status filtering excludes `unknown`. |
| `get_claim` | `{claimId}` | One temporary snapshot ID from this document; no detail navigation. On `NOT_FOUND`, list again within the user's requested scope. |

All three query tools return the same normalized Claim shape. The extension's
live reader reads row-scoped visible labeled fields on results and the existing
detail table when present; the agent consumes only the normalized tool response
and never scrapes or navigates to claim details. The reader never fetches a detail page, persists
data, or enriches a current read from a previous call. When displayed and
parseable, preserve `provider`,
`invoiceAmount`, `treatmentDate`, `treatmentEndDate` (the treatment period),
`reimbursementAmount`, and `reimbursementDate`. Open claims may include the
requested provider, invoice amount, treatment period, and reimbursement amount
when genuinely displayed; an unknown reimbursement date remains unknown and is
never fabricated. Production pages may omit any of these fields. Absence is
unknown, not zero or an inferred date. Keep existing camelCase names and
temporary snapshot identity. Never expose person, social security number, bank
account, or claim reference fields.

The demo overview mirrors the compact real overview: provider, invoice date,
status and an applicable reimbursement badge, with no hidden detail fields.
Invoice amount, treatment period and reimbursement date are available only on
an already-open detail page. Do not navigate or fetch details to fill gaps in an
overview response. The demo's unlabelled left-hand overview date is a fictional
display value, not a verified claim event date; it is intentionally not returned
as a canonical date by the tools.

`get_claim` includes `invoiceAmount` when available on the current detail page.
If it is absent on an overview, explain the scope limit and ask the user to open
the desired detail page. Then use `list_claims` to obtain that document's fresh
ID and invoke `get_claim`; never reuse the overview ID or read the detail DOM.

When explaining the privacy advantage, say that local extension parsing exposes
only the allowed normalized fields to the agent, keeping social security and
bank fields out of its input. The skill forbids whole-page reads; it does not
make CDP technically incapable of them or isolate data from host-page scripts.

Successful queries use `{ok:true,data:...}`; failures use
`{ok:false,error:{code,message}}`. Respect `INVALID_INPUT`, `NOT_FOUND`,
`PAGE_NOT_READY`, `EXTRACTION_FAILED`, `UNSUPPORTED_PAGE`, and `INTERNAL_ERROR`
without inventing results or falling back to page scraping. Search additionally
uses `UNSUPPORTED_PAGE`, `FORM_UNAVAILABLE`, and `SEARCH_IN_PROGRESS`; a
preflight rejection is not a completed search.

- Separate **confirmed search outcome** from **current-page summary**. Inspect
  `page.environment`, `page.scope`, `page.pageKind`, `page.completeness`, and
  `page.skippedCount`. Partial extraction or pagination is not an account-wide
  result. A plain search mask returns `PAGE_NOT_READY`, not an empty success. An
  explicit empty alert returns zero claims without retained history. Detail
  pages contain only the current claim displayed there, without list-page
  enrichment.
- Distinguish invoice, treatment, submission, and reimbursement dates. The site's
  query-period date semantics and unlabeled result dates are not established;
  do not guess them. Label any user-requested local date filtering by its exact
  canonical field.
- Optional missing amounts and dates are unknown, not zero. Do not interpret an
  invoice total minus reimbursements as confirmed outstanding debt or entitlement.
- Query invocation is bounded and local. Skill-level authorization is not
  enforced by the extension's page-world bridge, whose messages can be observed
  or raced by page scripts; do not claim isolation from the host page.
