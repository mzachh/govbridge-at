# 018 — Compact MeineSV-compatible overview

Supersedes spec 017's rich overview fields. The user chose strict page mirroring:
query responses reflect only the currently rendered overview or detail page.

## Rendering

Default overview, search results and paginated/scenario results share compact rows:
left overview date, provider and invoice date, reimbursement badge where applicable,
separate detail arrow and document-action space. Remove the overview's claim-fields
definition list entirely, not merely visually. Keep richer fields and identity
display fixtures on detail pages, with no automatic navigation or hidden enrichment.

The observed official left date is unlabelled. Use a dedicated fictional
`overviewDate` equal to invoiceDate plus two calendar days; do not map it to a
canonical submission/treatment/reimbursement date. Downloads remain visibly disabled
placeholders on reimbursed rows; no PDF backend is introduced.

Retain existing header, fictional-data banner, English/German support, credentials,
twenty records, status distribution and natural-looking fixture values. Use the
observed compact row geometry, with readable mobile wrapping. Remove unused rich
overview CSS and redundant developer-control writes to removed fields.

Reimbursement badges use the compact language-neutral `↪ 42.00 €` notation,
with two dot-separated decimals and a single non-wrapping green pill. Keep the
localized reimbursement explanation in a tooltip, not a visible long label.
Developer amount mutations use the same notation. The adapter accepts both this
arrow-only notation and the existing localized labelled badges.

## Tool behavior

The existing three query tools and search action remain unchanged. Overview reads
include provider, invoice date, status and displayed reimbursement amounts only,
plus normal IDs/source/read metadata. Optional detail fields stay absent. Detail
reads retain their richer fields; identity fields remain excluded. `get_claim`
never opens a detail page. No fetching, storage, fixture API or hidden records.

## Verification

Cover English/German compact HTML with no rich or hidden fields, sparse overview
responses versus rich detail responses, ignored overview date, known-amount badges,
mutation, duplicates, pagination, empty states and normal search behavior. Compare
desktop real/demo geometry without retaining private values, and inspect demo
mobile wrapping. Run combined typechecks/tests/builds/audit and local HTTP smoke.
Keep publication and installed-extension live verification separately reported.
