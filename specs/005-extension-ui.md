# Extension User Interface

## Purpose

Define a minimal popup/dashboard that quickly answers which medical invoice
claims remain open and summarizes known invoice and reimbursement amounts
without mislabeling source dates.

## Scope

Milestone one provides a Chrome toolbar popup backed only by normalized local
claims. It supports summary counts, claim cards/rows, basic status grouping,
yearly totals, empty/loading/error states, and a clear distinction between live
verified data and fixture/demo data.

## Non-goals

- Editing or submitting claims.
- Opening or parsing response PDFs.
- Reproducing the Meine OEGK visual design.
- Notifications, charts, exports, advanced filtering, or a full-page claim-management dashboard.
- Showing raw DOM data or technical debug output to ordinary users.

## Functional requirements

### OEGK-UI-001 — Header summary

The popup shall show the title `OEGK Claim Tracker`, total locally stored claim
count, and open count. Open count includes only `submitted` and `processing`.
When any `unknown` claims exist, their count is shown separately and is not
silently included in open or completed totals.

### OEGK-UI-002 — Claim presentation

Each claim row/card shall show, when present:

- provider;
- invoice amount;
- localized canonical status;
- invoice date;
- treatment date/range, when enriched from a manually opened detail page;
- submitted date only when explicitly known;
- reimbursement date, when known;
- reimbursement amount; and
- response/decision availability.

Absent optional values shall be omitted or displayed as a neutral `Not
available`; the UI shall never render `undefined`, `null`, zero-as-missing, or an
invented placeholder value.

### OEGK-UI-003 — Status language and order

Canonical statuses shall use consistent German labels:

- `submitted` → `EINGEREICHT`
- `processing` → `OFFEN`
- `completed` → `ERSTATTET`
- `rejected` → `ABGELEHNT`
- `unknown` → `STATUS UNBEKANNT`

Claims sort with open first, unknown second, closed third; within each group,
the deterministic storage order applies.

### OEGK-UI-004 — Locale formatting

Known EUR amounts shall use the user's German/Austrian locale formatting and
the euro currency. Complete dates shall be displayed in an unambiguous localized
short form. Formatting shall not alter stored values.

### OEGK-UI-005 — Yearly summary

For each displayed invoice year, the popup shall show:

- `Invoice amount`: sum of known `invoiceAmount` values for claims with a known
  `invoiceDate` in that year; and
- `Reimbursed`: sum of known `reimbursementAmount` values for those claims.

Claims without an invoice year are excluded from yearly totals and may be
listed under `Invoice date unknown`. `treatmentDate`, `submittedDate`,
`reimbursementDate`, and the source's unlabeled list date shall not substitute
for `invoiceDate`. Missing amounts contribute nothing and must not be presented
as known zero amounts. The summary shall disclose the number of claims with
missing amounts when nonzero.

### OEGK-UI-006 — Read-only affordances

The popup shall contain no submit, approve, reject, withdraw, upload, login, or
claim-edit controls. Any future navigation link must be explicitly specified and
must not perform an OEGK action.

### OEGK-UI-007 — Data provenance state

Fixture/demo records shall be visibly labeled `Demo data` and shall never be
mixed indistinguishably with live observations. Live records shall show their
latest observation time and may state `Details not yet observed` when list-only
data lacks provider or invoice amount. The UI must not imply that the extension
opened details automatically.

### OEGK-UI-008 — Loading, empty, stale, and error states

- Loading: show a stable loading message without clearing existing content.
- Empty valid snapshot: state that no submitted claims were found on the
  supported page.
- No observations yet: instruct the user to open the supported Meine OEGK claims
  page once live integration exists.
- Stale local data: show the latest known claims and their latest observation
  time without calling them current.
- Error: show a generic local error and preserve the last valid data view when
  possible.

### OEGK-UI-009 — Accessibility and popup constraints

The popup shall be keyboard readable, use semantic headings/lists, retain visible
focus, meet WCAG 2.1 AA text contrast, not rely on color alone for status, and
fit a practical Chrome popup width without horizontal scrolling. The root HTML
language is German (`de`).

### OEGK-UI-010 — Hackathon WebMCP dashboard

The extension-owned dashboard shall provide a presentation-ready technical
overview without becoming a second claim-management interface. It shall show:

- whether the WebMCP bridge is packaged, with a textual label, not color alone;
- the exact registered tool names, descriptions, input shapes, and concise
  return shapes;
- the `readOnlyHint: true` annotation shared by all tools;
- aggregate local counts for observed, open, closed, and unknown claims, without
  rendering providers, dates, amounts, claim IDs, or other medical details; and
- the architecture from isolated host-page observation through validated local
  storage and the Content Bridge to MAIN-world WebMCP proxy registration; and
- the accepted PoC visibility/race limitation of the page-world channel.

The dashboard shall use English presentation copy for the international
hackathon audience. Dynamic values shall be inserted as text, and the page shall
load no remote assets.

## Data contracts

The UI receives canonical `Claim[]`, storage/extraction state, and derived
summary values from generic application logic. It does not inspect the OEGK DOM
or parse source labels.

Example content, not a pixel-level design contract:

```text
OEGK Claim Tracker
3 claims · 1 open

Dr. Mueller
€185.00 · OFFEN
Invoice dated 14 Aug 2026

2026
Invoice amount:  €425.00
Reimbursed:  €94.20
```

Final implementation shall use localized German wording; the example preserves
the product prompt only as layout guidance.

## Error handling

Rendering one malformed record shall not break the entire popup; invalid records
should already have been rejected by storage validation. UI exceptions shall
show a generic state without logging claim details. Storage unavailability is
distinguished from a valid empty list.

## Security/privacy considerations

The popup reads extension-owned normalized storage only. It shall not render raw
HTML, use unsafe HTML injection, load remote fonts/scripts/images, include
analytics, or expose data to the host page. Claim values are rendered as text.

## Acceptance criteria

- **AC-OEGK-UI-001** (`OEGK-UI-001`, `OEGK-UI-003`): Mixed statuses produce the
  correct total, open, unknown, and closed grouping/counts.
- **AC-OEGK-UI-002** (`OEGK-UI-002`, `OEGK-UI-004`): Present fields render with
  correct locale formatting and absent fields produce no fabricated value.
- **AC-OEGK-UI-003** (`OEGK-UI-005`): Multiple invoice years and missing amounts
  produce exact yearly sums plus a missing-data disclosure; no other date field
  changes year membership.
- **AC-OEGK-UI-004** (`OEGK-UI-006`): DOM inspection finds no legally relevant
  or claim-mutating action control.
- **AC-OEGK-UI-005** (`OEGK-UI-007`): Fixture data is visibly marked; live data
  shows observation provenance; and list-only records do not imply that detail
  data was collected.
- **AC-OEGK-UI-006** (`OEGK-UI-008`): No-observation, valid-empty, stale, and
  storage-error states are distinct and preserve last valid data where stated.
- **AC-OEGK-UI-007** (`OEGK-UI-009`): Keyboard and automated accessibility checks
  verify semantic labeling, focus visibility, no color-only status, contrast,
  and no horizontal scrolling at the target popup width.
- **AC-OEGK-UI-008** (`OEGK-UI-010`): The technical dashboard exposes all four
  exact tool names and contracts, explains the packaged bridge and PoC boundary,
  and renders only aggregate claim counts.

## Open questions

- What popup width and maximum visible claim count are most usable?
- Should completed claims be collapsed by default after user testing?
- Should the UI use `Arzt/Einrichtung` or a more neutral label for providers?
- Is English localization required for the hackathon, or German only?
- How prominently should local-storage sensitivity and staleness be surfaced?
