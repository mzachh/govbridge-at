# GovBridge AT and guided OEGK search

> **Status: historical / not current.** This specification predates the live
> current-page contract and remains as design history. [Spec 012 — Live claim
> tools](012-live-claim-tools.md) is normative where requirements differ.

## Product and compatibility

The product is GovBridge AT; the package and Codex skill are `govbridge-at`.
OEGK is the first supported service. Preserve the existing installation path,
claim model, four query-tool contracts, storage key `oegkClaimTracker.state.v1`,
protocol `oegk-claim-tracker.webmcp`, and `data-oegk-*` diagnostics as legacy
compatibility identifiers. Do not migrate or clear history for this rename.

## Search action

Register `search_claims({from, to})` in MAIN on the exact HTTPS MeineSV entry
URL `/vsInfo/views/KE/?contentid=10007.815943`, its redirected
`/vsInfo/views/KE/einreichungTyp.xhtml` route, and
`/vsInfo/views/KE/einreichungListe.xhtml`. Its closed schema requires ISO
calendar dates, ascending inclusive bounds, and at most five calendar years
(fifth anniversary with leap-day clamping). Same-day queries are valid. Server
validation remains authoritative. Use `readOnlyHint: false`; the four existing
query tools retain `readOnlyHint: true` on all supported pages.

The MAIN bridge delegates this action to a dedicated ISOLATED-world executor;
the tool is discoverable on the results route for agent continuity. The
executor mutates only a validated selected search form (`vonDatWAH`/
`bisDatWAH` with `Weiter`) or the retained results-range form (`vonDat`/
`bisDat` with `OK`), and returns `FORM_UNAVAILABLE` when the relevant form is
absent or ambiguous;
the service worker continues to execute only the four storage queries. The
executor validates origin, route, heading, the active Wahlarzt / Wahltherapeut
form, unique visible/enabled date inputs and Weiter submitter, POST method,
same-origin expected action, and current-tab target including submitter
overrides before mutation. Ambiguous or unavailable forms fail closed.

Set only vonDatWAH and bisDatWAH to DD.MM.YYYY using native value setters,
dispatch bubbling input/change events, verify values and form again, then click
Weiter once. Preserve the site's JSF handlers; do not construct requests, read
hidden authentication/ViewState fields, invoke site functions, or use raw
form.submit(). Reject duplicate dispatch in the same document. Cancellation
cannot undo a dispatched click.

Return `{ok:true,data:{status:"submission_requested"}}` if the original
document survives. This is not confirmation of successful search or fresh
storage. Navigation may return null or destroy the tool's execution context.
Use redacted INVALID_INPUT, UNSUPPORTED_PAGE, FORM_UNAVAILABLE,
SEARCH_IN_PROGRESS, or INTERNAL_ERROR failures. Never retry an uncertain
submission automatically. The action returns no claims.

## Codex skill

Version the skill in skills/govbridge-at and install the same files in the
user's personal Codex skill directory. Instructions are English; responses
follow the user's language. Use the available Chrome skill/runtime docs, not
fixed plugin versions or remembered tab IDs. Resolve the requested date range;
ask about missing/ambiguous dates or a range longer than five years.

Use external Chrome, navigate MeineSV, leave ID Austria authentication entirely
to the user, and select Wahlarzt / Wahltherapeut. Inspect current tool metadata
and call search_claims for date entry/submission; do not implement this action
through the skill's own clicks. Prefer native WebMCP capability, otherwise
supported CDP with document.modelContext. Hints alone are not callability.

After invocation, inspect navigation and structural result/error/empty/login
state and rediscover tools. Explain uncertain outcomes before any retry. Obtain
consent before sensitive tool results or claim-bearing DOM/screenshots;
disclose that list_claims returns all stored observations, including outside
the requested range. Reuse consent for its agreed scope.

Separate the confirmed website search outcome from stored-claim summaries.
lastSeen is observation time and does not establish query membership or
per-field freshness. Missing amounts are unknown. Invoice-year summaries do
not establish the website query period's date semantics. Empty results do not
erase accumulated claims. If observation completion is uncertain, allow one
bounded recheck and report remaining uncertainty.

## Updated boundary

This spec supersedes blanket prohibitions in earlier specs on extension form
submission solely for this bounded search action. The extractor remains
passive; claim creation/editing/submission, login, and PDF actions remain out
of scope. Page scripts may observe/race the existing bridge and invoke this
bounded action: skill consent is not an extension-enforced authorization gate.
No new manifest permissions or external exposure are required.

## Live route clarification

The search action was verified against the selected live form after user login:
the Wahlarzt tab exposes aria-selected=true; the form uses the documented POST
destination and Weiter submitter. An empty result can navigate back to the
type/range route, retaining the requested dates and displaying the recognized
empty-result alert. Do not require a results-list URL to recognize this outcome.
The existing adapter does not commit that type-page alert as an empty store
snapshot; the skill reports website emptiness separately from stored history.

## Verification

Cover invalid/impossible/reversed/overlong dates and leap-year boundaries;
wrong/inactive/ambiguous forms, controls and destinations; no mutation on
preflight rejection; value events/readback; exactly one dispatch; five versus
four registrations; native/fallback/unavailable runtime; unchanged query
contracts and storage; and navigation/uncertain-response handling.

Validate skill structure and review consent refusal, unavailable browser/tools,
empty searches with stored history, and freshness scenarios independently.
Run existing package verification. Live-test active-tab and JSF behavior
after user login. If navigation is same-document AJAX, rearm existing
observation for this action; do not move extraction into MAIN or the action.
Never store personal live-test values in repository artifacts.
