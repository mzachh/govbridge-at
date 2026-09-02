# GovBridge AT Privacy Notice

GovBridge AT reads only supported claim information already visible in the
Meine SV page currently open in the user's tab, and only when a read-only
WebMCP query is invoked. The isolated live reader extracts a new, normalized
snapshot for every call. It does not refresh the page, traverse pagination,
merge other pages, or persist claim records, events, snapshots, or history.

The extension does not upload claim data to the developer, a backend,
analytics, or telemetry. It does not read credentials or cookies, download or
parse documents, or expose raw HTML, screenshots, insured-person names, bank
accounts, rejection reasons, itemized billing positions, source IDs, or PDF
links/content. OEGK is the first supported service.

Every successful read includes structural page metadata: current-page scope,
page kind, invocation time, completeness, skipped-row count, and any displayed
date range. Partial results identify malformed rows without exposing page
diagnostics. A plain search mask, loading page, or unsettled search fails
closed with `PAGE_NOT_READY`; unsupported routes and extraction failures are
reported without raw page content.

The explicitly invoked `search_claims` action fills the two date fields and
clicks `Weiter` on the recognized, selected Wahlarzt / Wahltherapeut type/range
form, or the retained results-form `OK` control on the results page. The
website submits its own search request, which can navigate the tab. This does
not create or submit a reimbursement claim. ID Austria login remains
user-operated. The action returns a structural acknowledgement, not claims or
proof of successful search; uncertain submissions are never retried
automatically.

On supported OEGK pages, the extension registers four read-only WebMCP proxy
tools in the page's MAIN JavaScript world. The type/range and retained-results
routes also register the search action with `readOnlyHint: false`. A browser
agent may receive canonical claim data after invoking a query tool. Native
WebMCP is preferred; a pinned, locally bundled compatibility runtime is used
when the native API is unavailable. No data is sent to the compatibility-runtime
developer or loaded from a CDN.

The bridge returns only canonical Claim fields and the structural page
metadata above. Each `live-v1-*` ID combines a random document nonce, a
canonical snapshot digest, and row position. IDs are temporary: unchanged
content in one document can retain them, while changed content or navigation
expires them. `get_claim` does not navigate and returns `NOT_FOUND` for an
absent or expired ID; callers must list the current page again. Legacy
`local-v1-*` IDs are never resolved.

This PoC bridge is deliberately not an authenticated or isolated channel.
Scripts running on the matched OEGK page can observe or race request and
response messages and invoke the bounded search action. Skill-level consent is
not an extension-enforced access gate. It is the agent workflow boundary for
returning sensitive current-page fields, not protection from same-origin page
scripts.

The popup is technical guidance only and opens the dashboard directly. The
popup and dashboard do not read active-tab claim data, storage, or runtime
claim messages. The dashboard describes packaged capabilities, current-page
scope, temporary IDs, partial results, invoice-year limits, consent, and
troubleshooting; opening it does not prove a page connection or registration.

Older versions may have written bytes under the legacy key
`oegkClaimTracker.state.v1`. The live implementation does not read, migrate,
delete, or display those bytes. They remain untouched and inaccessible to this
runtime. Removing the storage feature does not erase those legacy bytes.

For local diagnosis, the extension writes only structural readiness labels to
attributes on the supported page's root element. These labels contain bridge
state such as ready, unsupported, or failed; they contain no claim values or
identifiers. A visually hidden semantic note may contain static tool names and
generic invocation instructions, never claim inputs, outputs, values,
identifiers, or credentials.

This is a prototype. Automated tests use synthetic fixtures only. Production
extraction is enabled solely for the documented Meine SV claim routes and
fails closed when their structure is not recognized; real-account layout
variants remain a live compatibility boundary.
