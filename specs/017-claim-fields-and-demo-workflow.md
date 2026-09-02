# 017 — Richer current-page claims and demo workflow

Spec 018 supersedes this specification's richer overview rendering. Rich fields
remain on detail pages; overview responses intentionally contain only visible
compact-row data. Other tool, credential and skill decisions below remain valid.

Supersedes earlier tool counts, summary-tool, fixture presentation, demo credential,
and skill consent requirements. Keep the single extension and live-page architecture.

## Tools

Remove `get_reimbursement_summary` from registration, dispatch, hints and UI.
There are three query tools (`list_claims`, `get_open_claims`, `get_claim`) plus
the existing page-scoped `search_claims` action. Preserve input and result envelopes.

All three query tools return the same normalized Claim shape. Include provider,
invoiceAmount, treatmentDate/treatmentEndDate (the treatment period),
reimbursementAmount and reimbursementDate when displayed and parseable. Open claims
include the requested provider, invoice amount, treatment period and reimbursement
date, but unknown reimbursement dates must not be fabricated. Keep reimbursement
amount available on open claims when genuinely displayed; filtering remains status-based.

Read row-scoped visible labeled fields on results and the existing detail table.
Never navigate/fetch detail pages, persist data, or enrich from previous calls.
Production lists may lack these values: absence remains unknown, not zero or an
inferred date. Keep existing camelCase field names and temporary snapshot identity.
Do not expose person, social security number, bank account or claim reference.

## Demo

Keep the persistent fictional-data notice, exact header and environment provenance.
Use independently invented natural-looking practice names, not Demo/SYNTHETIC in
claim values (apart from references such as SYNTHETIC-demo-claim-009). Keep twenty
records, distribution, date coverage, duplicate examples and known-reimbursement
goldens. Add deterministic treatment periods and plausible later reimbursement
dates only for reimbursed claims. Render richer fields visibly on list and detail
pages in both languages; unknown values use an explicit unknown label.

Detail person: Peter. Bank account: AT00 1234 1234 1234 1234.
Social security number: 1234010196. These are requested fixture values, never
real-account imports, and remain excluded from WebMCP responses.
Public demo credentials become `peter` / `ThisIsJustADemo$`; reject the old pair.
Change documentation, launcher, login page and tests together; keep session design.

## Skill

Default conversation language is English, independent of page language; honor an
explicit user request for another language. Reuse a selected supported real or demo
tab when it matches user intent; do not route a ready results page through entry
or type pages. Keep user-operated authentication and no automatic cross-environment
substitution. Related WebMCP operations do not require an extra skill consent prompt;
stay within the requested task and honor browser-enforced approvals.

Use one standard discovery call that awaits getTools() before processing the array.
No repeated map/stringification probes. Re-discover only after navigation or a
material registry change. Preserve runtime capability checks and registered-object
execution semantics. Private-insurance comparisons: acknowledge this as a great
idea on the roadmap, explicitly not implemented; do not invent coverage estimates.

## Verification

Test removed tool rejection/registration counts; richer fields on both demo languages
and minimal production fixtures; unknown values and excluded identity fields; natural
fixture values; new login acceptance and old-pair rejection. Test the standard skill
discovery snippet against synchronous and asynchronous arrays and review tab reuse,
English-on-German-page behavior and insurance-roadmap handling. Run combined tests,
typechecks, build and package audit. Public publication remains deferred.
