# GovBridge AT Privacy Notice

GovBridge AT reads only supported claim information already visible in the
Meine SV page currently open in the user's tab, and only when a current-page
WebMCP query is invoked. The isolated live reader extracts a new, normalized
snapshot for every call. It does not refresh the page, traverse pagination,
merge other pages, or persist claim records, events, snapshots, or history.

The extension does not upload claim data to the developer, a backend, analytics,
or telemetry. It does not read credentials or cookies, download or parse
documents, or expose raw HTML, screenshots, person names, social security
numbers, bank accounts, claim references, source IDs, or PDF links/content.
OEGK is the first supported service.

Every successful read includes structural page metadata: current-page scope,
page kind, origin-derived environment, invocation time, completeness, skipped-row
count, and any displayed date range. Partial results identify malformed rows
without exposing page diagnostics. A plain search mask, loading page, or unsettled
search fails closed with `PAGE_NOT_READY`; unsupported routes and extraction
failures are reported without raw page content.

The three read-only query tools (`list_claims`, `get_open_claims`, and
`get_claim`) return the same normalized Claim shape from the current rendered
page. Compact overview rows expose only their provider, invoice date, status,
and any displayed reimbursement amount. An existing detail table may visibly
provide invoice amount, treatment start/end dates, reimbursement amount, and
reimbursement date. Open-claim filtering is status-based; a displayed
reimbursement amount remains available even for an open claim, while an unknown
reimbursement date stays unknown. Missing values are not converted to zero or
inferred dates, and an overview date remains display-only rather than a
canonical claim date. A query never navigates to or fetches a detail page,
persists data, or enriches a read from an earlier call. There is no
reimbursement-summary tool and no account-wide result.

The explicitly invoked `search_claims` action fills the two date fields and
clicks `Weiter` on the recognized, selected Wahlarzt / Wahltherapeut type/range
form, or the retained results-form `OK` control on the results page. The website
submits its own search request, which can navigate the tab. This does not create
or submit a reimbursement claim. ID Austria login remains user-operated. The
action returns a structural acknowledgement, not claims or proof of successful
search; uncertain submissions are never retried automatically.

The three query operations and the bounded search action are local operations;
they do not transmit data to third parties. A related requested WebMCP operation
does not require an extra skill-level consent prompt: the user's request
authorizes reading and summarizing the requested current-page fields. The agent
does not broaden that task to unrelated fields or origins. Browser/platform
approvals remain authoritative.

## Synthetic simulator

The GovBridge AT skill does not inspect page content, including structural DOM
markers, screenshots, accessibility trees or form values. It reads only browser
tab URL/capability metadata and WebMCP schemas/results. CDP, when necessary, is
restricted by the skill to WebMCP discovery and invocation. Local extension
parsing returns allowlisted claim fields without social security or bank data.
This minimizes what reaches the agent; it is a workflow rule, not a technical
sandbox that removes CDP's underlying capabilities.

The separate `demo-site/` application uses independently invented fixtures, not
exported, renamed, or anonymized account records. Its default page contains 20
synthetic claims in the fixed range `2021-09-03`–`2026-09-02`, with 5 processing,
11 completed, and 4 rejected records, duplicate examples, date coverage, and 11
known reimbursements totaling EUR 543.40. The demo's header is exactly
`GovBridge AT: OEGK (meinesv.at) demo server`, and its persistent notice states
that the records are fictional and the site is not MeineSV or OEGK. The same
extension parser and tools read its rendered pages.

Fixture claim values use natural-looking practice names and do not say `Demo` or
`SYNTHETIC` except for references such as `SYNTHETIC-demo-claim-009`. Compact
overview rows show the fictional overview date, provider, invoice date, and
known reimbursement badges. Reimbursed claims have deterministic treatment
periods and plausible later reimbursement dates; richer fields are visible on
detail pages in both languages. The overview date is display-only and is not
mapped to a canonical claim date. Open claims never receive a fabricated
reimbursement date. Missing detail values are rendered with an explicit unknown
label. The detail fixture may contain the requested visual-test values
Peter, `AT00 1234 1234 1234 1234`, and `1234010196`, but person, bank-account,
and social-security values remain excluded from every WebMCP response.

The public demo credentials are `peter` / `ThisIsJustADemo$`; the former
`username` / `password` pair is rejected. Never supply real credentials or
health records. The demo has no ID Austria and is not a confidentiality boundary
or suitable authentication for actual health data. Its short-lived signed
session cookie belongs to the website, not the extension; the extension does
not read or set it.

`page.environment` marks approved hosted demo or loopback development origins;
`source: "oegk"` remains an adapter identifier and does not certify official
data. The demo defaults to English and offers a language switch; switching
creates a new document, so temporary IDs must be rediscovered. Production
remains German-only for page markers. The agent does not switch silently between
production and a synthetic origin.

The synthetic demo is publicly reachable at
`https://govbridge-at-demo.manuel857067.chatgpt.site`, as approved by the user.
Its fictional claim pages use the public demo credentials; this is a simulation,
not protection suitable for real medical data. The proposed CC0 fixture license
has not been granted. No real account data was published.

On supported OEGK pages, the extension registers three read-only WebMCP query
tools in the page's MAIN JavaScript world. The type/range and retained-results
routes also register the search action with `readOnlyHint: false`. Native WebMCP
is preferred; a pinned, locally bundled compatibility runtime is used when the
native API is unavailable. No data is sent to the compatibility-runtime
developer or loaded from a CDN.

The bridge returns only canonical allowed Claim fields and structural page
metadata. Each `live-v1-*` ID combines a random document nonce, a canonical
snapshot digest, and row position. IDs are temporary: unchanged content in one
document can retain them, while changed content or navigation expires them.
`get_claim` does not navigate and returns `NOT_FOUND` for an absent or expired
ID; callers must list the current page again.

This PoC bridge is deliberately not an authenticated or isolated channel.
Scripts running on the matched OEGK page can observe or race request and
response messages and invoke the bounded search action. The agent's requested
task scope is not an extension-enforced access gate or protection from
same-origin page scripts.

The popup is technical guidance only and opens the dashboard directly. The
popup and dashboard do not read active-tab claim data, storage, or runtime claim
messages. The dashboard describes packaged capabilities, current-page scope,
temporary IDs, partial results, task scope, and troubleshooting; opening it does
not prove a page connection or registration.

For local diagnosis, the extension writes only structural readiness labels to
attributes on the supported page's root element. These labels contain bridge
state such as ready, unsupported, or failed; they contain no claim values or
identifiers. A visually hidden semantic note may contain static tool names and
generic invocation instructions, never claim inputs, outputs, values,
identifiers, or credentials.

This is a prototype. Automated tests use synthetic fixtures only. Production
extraction is enabled solely for the documented Meine SV claim routes and fails
closed when their structure is not recognized; real-account layout variants
remain a live compatibility boundary.
