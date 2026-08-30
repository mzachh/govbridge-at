# OEGK Adapter

## Purpose

Define the isolated boundary that recognizes the confirmed Meine SV OEGK claim
pages, extracts visible claim data, and converts it into canonical `Claim`
records. This revision incorporates a read-only authenticated-page observation
performed on 2026-08-30; it distinguishes that confirmed sample from remaining
unknowns and from implementation assumptions.

## Scope

The adapter implements this contract:

```ts
type ExtractionState = "complete" | "empty" | "loading" | "unsupported" | "error";

interface ClaimExtractionResult {
  state: ExtractionState;
  pageKind: "type-range" | "results" | "open-rejected-detail" | "reimbursed-detail";
  claims: Claim[];
  observedRange?: { from: string; to: string };
  diagnostics: { candidateCount: number; skippedCount: number };
}

interface ClaimAdapter {
  canHandlePage(): boolean;
  extractClaims(): Promise<ClaimExtractionResult>;
}

class OegkAdapter implements ClaimAdapter {}
```

Implementation starts against anonymized fixtures that reproduce the confirmed
structure below. Live activation may follow only after those fixtures and
acceptance tests pass. All OEGK-specific selectors, label maps, and extraction
rules belong inside the adapter module.

## Non-goals

- Treating one observed account/sample as proof that all OEGK accounts expose
  every optional field or every possible state.
- Guessing selectors from unrelated public OEGK pages.
- Navigating the site or authentication flow.
- Clicking controls, opening documents, submitting forms, or mutating the DOM.
- Extracting credentials, cookies, tokens, hidden authentication state, or raw
  page snapshots.
- Parsing PDF responses.

## Known-state register

### CONFIRMED

- The authenticated service origin is `https://www.meinesv.at`.
- The outer entry URL observed was
  `/vsInfo/views/KE/?LO=1&contentid=10007.815943&portal=meinesvoegkwportal`.
  After loading, the content document uses top-level same-origin pages under
  `/vsInfo/views/KE/`; no iframe or shadow root was present in the observed
  content document.
- The service is server-rendered Jakarta Faces/JSF using Mojarra form posts and
  AJAX. Dynamic component IDs begin with values such as `j_idt1` and are not a
  stable contract.
- The type/range page is `/vsInfo/views/KE/einreichungTyp.xhtml`, page title
  `Rechnung abfragen`, H1 `Einreichungen abfragen`.
- The result page is `/vsInfo/views/KE/einreichungListe.xhtml`, H1
  `Liste der Einreichungen`.
- Open/rejected detail pages use `/vsInfo/views/KE/einreichungDetailOA.xhtml`;
  reimbursed details use `/vsInfo/views/KE/einreichungDetail.xhtml`.
- The desired claim type is selected through an anchor with `role="tab"` and
  visible name `Wahlarzt / Wahltherapeut`. Other invoice types are separate
  tabs and were not analyzed.
- The query requires `Von-Datum` and `Bis-Datum` values in `DD.MM.YYYY` format.
  The server rejects ranges longer than five years.
- The result list groups cards under the exact headings `offene Einreichungen`,
  `abgelehnte Einreichungen`, and `erstattete Einreichungen`.
- Details and PDF controls are JSF POST links (`href="#"`), not stable resource
  URLs. PDF actions post with target `_blank`.
- The complete confirmed DOM/field contract is specified under
  `OEGK-ADAPTER-009` through `OEGK-ADAPTER-013`.

### ASSUMED — implementation hypotheses

- Semantic heading text, role attributes, field labels, stable business-oriented
  classes, and route paths are safer selector anchors than generated JSF IDs.
- A list that contains all expected status-section landmarks and no loading or
  error alert can be treated as a complete snapshot for the user-selected range.
- `Antragsnummer:` may be a stable identity candidate, but this is not confirmed
  across status transitions.
- The observed result groups likely cover the common open, rejected, and
  reimbursed outcomes, but additional groups may exist for other accounts or
  future OEGK versions.

### UNKNOWN

- Whether generated IDs, class names, or exact German labels vary by OEGK
  region, account, release, viewport, or accessibility mode.
- Whether result sections are omitted when empty, whether pagination or
  virtualization appears for larger datasets, and whether more than five years
  can be retrieved only through multiple manual queries.
- The semantics of the unlabeled `.cb_date` cell in each status group.
- Whether `Antragsnummer:` remains stable and accessible after reimbursement.
- All source states beyond the three observed section headings.
- Whether any displayed PDF is a decision/response rather than a submitted
  claim copy or confirmation.
- The PDF response MIME type and content. In the in-app browser observation,
  both `_blank` JSF PDF actions produced a blank tab, so PDF delivery was not
  verified.
- Whether comma-decimal/thousands-separated EUR values appear; the observed
  reimbursement list used dot decimals.
- Loading, timeout, session-expiry, pagination, and malformed-row variants in
  real production data.

## Functional requirements

### OEGK-ADAPTER-001 — Strict page recognition

`canHandlePage()` shall return `true` only for the confirmed origin plus one of
the complete page signatures in `OEGK-ADAPTER-009`. Fixture mode may substitute
an explicitly injected origin/root. Any live signature drift returns `false`
and preserves stored data.

### OEGK-ADAPTER-002 — Isolation

The content script may coordinate execution but shall not contain OEGK DOM
selectors or field parsing. Generic tracker, storage, UI, and WebMCP modules
shall never query the OEGK DOM.

### OEGK-ADAPTER-003 — Visible-data extraction

The adapter shall extract only fields actually represented in the current
supported claim container. Missing optional fields remain absent. It shall not
derive values from unrelated page text.

### OEGK-ADAPTER-004 — Explicit status mapping

Source headings/labels shall be mapped through a centralized, documented map.
Only the three status-section mappings confirmed in `OEGK-ADAPTER-011` are live
baseline mappings. Unmapped or absent labels produce `unknown` and a count-only
diagnostic; they never inherit status from CSS color or card position.

### OEGK-ADAPTER-005 — Complete-snapshot signal

Extraction shall return metadata distinguishing:

- a complete supported-page snapshot;
- a supported page that is still loading or partially rendered;
- an unsupported page; and
- an extraction failure.

Only a complete snapshot may be used to infer that a previously stored claim is
absent from the current page. A plain empty array is insufficient to make that
inference.

The required `ClaimExtractionResult` contract carries this state explicitly. A
type/range page with no query result is not an empty claim snapshot. Only the
documented empty-result alert returns `empty`; validation alerts return `error`.

### OEGK-ADAPTER-006 — Duplicate preservation

The adapter shall return all distinct repeated claim containers. It shall not
deduplicate records merely because provider, date, or amount values match.
Tracker identity rules decide whether observations refer to the same claim.

### OEGK-ADAPTER-007 — Local debug mode

An explicit, default-off debug mode may report:

- which supported-page signatures matched;
- counts of candidate claim containers and recognized fields;
- unknown status labels in redacted or developer-approved form; and
- reasons a candidate was skipped.

Debug mode shall not transmit, persist, or automatically copy raw page data. It
shall avoid printing provider names, amounts, dates, IDs, document contents, raw
HTML, cookies, tokens, or authentication data. Candidate highlighting, if later
specified, must be temporary, visually obvious, and must not alter application
state.

### OEGK-ADAPTER-008 — Partially malformed containers

A container with enough evidence to represent a claim but missing optional
fields produces a partial canonical claim. A container that cannot produce the
required model safely is skipped and locally diagnosed. One malformed container
shall not prevent extraction of valid siblings.

### OEGK-ADAPTER-009 — Supported-page signatures

The adapter shall recognize a page only when all applicable signature parts
match:

| Page | Path | Required landmarks |
| --- | --- | --- |
| Type/range | `/vsInfo/views/KE/einreichungTyp.xhtml` | H1 `Einreichungen abfragen`, tab `Wahlarzt / Wahltherapeut`, form method `post` |
| Results | `/vsInfo/views/KE/einreichungListe.xhtml` | H1 `Liste der Einreichungen`, result form, at least one recognized status-section heading or the documented empty-state alert |
| Open/rejected detail | `/vsInfo/views/KE/einreichungDetailOA.xhtml` | H1 `Einreichung Detail`, recognized detail table labels |
| Reimbursed detail | `/vsInfo/views/KE/einreichungDetail.xhtml` | H1 `Einreichung Detail`, reimbursement detail labels |

Origin, path, and semantic landmarks are combined. A path match alone is not
sufficient. The outer query URL is an entry point, not an extraction page until
the content document reaches one of these signatures.

### OEGK-ADAPTER-010 — Type/range and result-state contract

The observed type/range form has `id="j_idt1:vsinfoForm"`, method `post`, and
action `/vsInfo/views/KE/einreichungTyp.xhtml`. Because the `j_idt1` prefix is
generated, implementation shall anchor to the unique POST form containing:

- tab `Wahlarzt / Wahltherapeut` (observed suffix `:wah_tab`);
- `input#vonDatWAH[name="vonDatWAH"]`;
- `input#bisDatWAH[name="bisDatWAH"]`;
- placeholder `TT.MM.JJJJ`; and
- submit control value `Weiter` (observed generated ID suffix `:search`).

The extension shall never click the tab, fill dates, submit `Weiter`, submit
`OK`, or clear the form. The user performs the query; the extension only reads
the resulting DOM.

Confirmed non-list outcomes are:

- empty result: `#infolist.infobox.yellow[role="alert"]` containing
  `In diesem Abfragezeitraum wurde keine Kostenerstattung bzw. kein Onlineantrag gefunden.`;
- invalid range: an alert headed `ACHTUNG: Fehlerhafte Eingaben im Formular`
  containing `Der Abfragezeitraum darf höchstens 5 Jahre betragen.`.

An invalid-range alert is an error and never an empty snapshot. The observed
result form posts to `/vsInfo/views/KE/einreichungListe.xhtml`, has date inputs
`#vonDat` and `#bisDat`, and an `OK` submit control; the extension does not use
those controls.

### OEGK-ADAPTER-011 — Result-list extraction contract

Each status section is a `.card_container` containing a `.card_title h2` and a
`[role="grid"].card_content`. Rows use `[role="row"]`; their field cells use
the following stable-looking classes:

| Element | Observed meaning | Canonical mapping |
| --- | --- | --- |
| `.cb_date` | Unlabeled group-dependent date | None until semantics are confirmed |
| `.cb_title > h4` | Provider, sometimes empty | `provider` when non-empty |
| `.cb_title` text matching `Rechnung vom DD.MM.YYYY` | Invoice date | `invoiceDate` |
| `.cb_status .badge.error` under rejected heading | `abgelehnt` | `rejected` |
| `.cb_status .badge` under reimbursed heading | `Rückerstattung: <amount> €` | `completed`, `reimbursementAmount` |
| `.cb_details a` | User-operated JSF detail navigation | No field; never click automatically |
| `.cb_download a` | User-operated `_blank` JSF PDF action | Does not prove `responseAvailable` |

Status is derived primarily from the exact enclosing section heading, not CSS
alone: both open and rejected containers used `.cb_list_open`; reimbursed used
`.cb_list_done`. An open observed row had no `.cb_status` cell, a rejected row
had `.badge.error`, and a reimbursed row had `.badge` plus a PDF link.

The adapter shall scope rows through their enclosing heading/card relationship,
not global grid order. It shall not read accessible placeholder text such as
`Arztname Arztnachname Datum` as actual claim data.

### OEGK-ADAPTER-012 — Detail-page enrichment contract

Detail pages enrich only the claim page that the user opened manually. The
extension shall not navigate to details, replay JSF parameters, or use a row
index as an identifier.

`einreichungDetailOA.xhtml` uses a four-row semantic `th`/`td` table for an
observed open claim:

- `Antragsnummer:` — transient identity candidate;
- `Behandlung für:` — excluded from persistence;
- `Behandlung ab:` — `treatmentDate`; and
- `Rechnungsbetrag:` — `invoiceAmount`.

An observed rejected detail added:

- `Behandler:` — `provider`; and
- `Ablehnungsgrund:` — excluded from milestone-one persistence.

`einreichungDetail.xhtml` for an observed reimbursed claim exposed:

- `Behandlung für:` — excluded;
- `Behandlungszeitraum:` — parse into treatment start/end only when the format
  is unambiguous;
- `Rechnungsbetrag:` — `invoiceAmount`;
- `Behandler:` — `provider`;
- `Höhe der Kostenerstattung:` — `reimbursementAmount`;
- `Datum der Erstattung:` — `reimbursementDate`; and
- `Erstattung auf das Konto:` — excluded and never logged.

It also contained itemization headers `Anzahl`, `Pos. Nr.`,
`Positionsbezeichnung`, and `Kostenerstattung`, plus totals/adjustments
`Zwischensumme`, `zuzüglich Mwst.`, `abzüglich Rezeptgebühr(en)`,
`abzüglich Einbehalt(e)`, and `Anweisungsbetrag`. These are explicitly outside
the milestone-one claim model.

Because detail pages do not expose a confirmed universal link back to a stored
claim ID, enrichment may merge only when the tracker establishes a unique match
from candidate application number or canonical fingerprint. Otherwise it is
shown as current-page detail without mutating a stored record.

### OEGK-ADAPTER-013 — JSF navigation and PDF boundary

Details and PDF anchors have `href="#"` and call `mojarra.cljs(...)` against the
JSF form. Their generated component IDs include section and row indices and are
volatile. Detail paths depend on server-side view state; normal browser Back or
direct navigation may produce a cache miss or invalid view. The adapter must
never depend on replaying these controls.

The observed reimbursed-detail link `PDF-Bestätigung` had title
`PDF Bestätigung der Einreichung`; the reimbursed-list download had title
`PDF Download der Einreichung Arztname Arztnachname Datum`. Both posted to
target `_blank`, had no stable PDF URL, and opened a blank tab in the in-app
browser test. Milestone one shall neither invoke nor intercept these controls.
PDF parsing remains a future, user-initiated, separately specified extension.

## Data contracts

Input is a read-only `Document`/root abstraction supplied to the adapter. Output
is the authoritative `ClaimExtractionResult` declared in Scope. The explicit
state is required because the live page has distinct empty, validation-error,
list, and detail states. Diagnostics contain counts only. Fixture markup shall
use synthetic values while matching confirmed landmarks.

Identity construction and timestamp injection are coordinated with
`003-claim-tracking.md`: a source ID is preferred; otherwise the adapter exposes
normalized identity components without treating a mutable DOM index as stable.

## Error handling

- Unsupported pages produce an explicit unsupported result and no storage
  mutation.
- Loading/partial pages may be retried locally after a bounded observation
  interval; retries must not create duplicate stored events.
- A changed DOM that no longer matches confirmed signatures fails closed and
  preserves the last valid snapshot.
- Per-field parse errors omit that optional field; per-container structural
  errors skip that container; catastrophic extraction errors fail the snapshot.
- Production logging is silent except for a generic extension error state.

## Security/privacy considerations

The adapter performs read-only DOM reads on the narrowest confirmed page. It
must not access ID Austria routes, forms, inputs, cookies, local/session storage
owned by OEGK, network APIs, response bodies, or page-internal authentication
state. Debug data remains ephemeral and local.

## Acceptance criteria

- **AC-OEGK-ADAPTER-001** (`OEGK-ADAPTER-001`): An anonymized fixture claims
  page is handled; an unrelated page and an unconfirmed live-like page are not.
- **AC-OEGK-ADAPTER-002** (`OEGK-ADAPTER-002`): Static inspection finds all
  page selectors and source-label parsing inside the adapter boundary.
- **AC-OEGK-ADAPTER-003** (`OEGK-ADAPTER-003`, `OEGK-ADAPTER-004`): Processing,
  completed, missing-field, and unknown-status fixtures normalize without
  invented values.
- **AC-OEGK-ADAPTER-004** (`OEGK-ADAPTER-005`): Empty complete, loading,
  unsupported, and failed extraction outcomes are distinguishable and only the
  first permits absence inference.
- **AC-OEGK-ADAPTER-005** (`OEGK-ADAPTER-006`): Duplicate-looking fixture
  containers are both returned for tracker resolution.
- **AC-OEGK-ADAPTER-006** (`OEGK-ADAPTER-007`): Debug mode makes no network
  request, persists no page-derived debug payload, and logs no listed sensitive
  fields.
- **AC-OEGK-ADAPTER-007** (`OEGK-ADAPTER-008`): A malformed fixture sibling is
  skipped without losing a valid claim in the same document.
- **AC-OEGK-ADAPTER-008** (`OEGK-ADAPTER-009`): Confirmed origin/path plus
  semantic landmarks recognize all four page kinds; path-only and unrelated
  OEGK pages fail closed.
- **AC-OEGK-ADAPTER-009** (`OEGK-ADAPTER-010`): Fixtures distinguish valid
  empty, five-year validation error, and results states without submitting any
  form from extension code.
- **AC-OEGK-ADAPTER-010** (`OEGK-ADAPTER-011`): Synthetic open, rejected, and
  reimbursed card groups extract the confirmed fields/statuses; `.cb_date`,
  generated IDs, and accessible placeholders are ignored.
- **AC-OEGK-ADAPTER-011** (`OEGK-ADAPTER-012`): Open, rejected, and reimbursed
  detail fixtures enrich only allowed fields and exclude insured-person,
  bank-account, rejection-reason, itemization, and deduction values.
- **AC-OEGK-ADAPTER-012** (`OEGK-ADAPTER-013`): Static inspection proves the
  adapter never clicks/replays JSF detail/PDF controls and contains no automatic
  PDF fetch or parser.

## Open questions

- Which observed DOM anchors remain stable across OEGK releases, regions,
  account types, accessibility mode, and mobile layouts?
- Is the combination of recognized status heading, `.card_content` grid, and a
  parseable `Rechnung vom` date sufficient to accept a list row as a claim?
- What retry/observation timing is appropriate for the live rendering model?
- Can a debug build safely provide user-triggered, pre-redacted selector
  diagnostics for development?
- How can a manually opened detail page be matched safely to its originating
  list row when no confirmed universal ID is present?

## Information required before enabling live adapter persistence

The following must be obtained without sharing personal claim content:

1. Sanitized fixture captures for the confirmed type/range, empty, results,
   open-detail, rejected-detail, and reimbursed-detail layouts.
2. A second observation across reload/relogin proving which semantic anchors
   and the candidate `Antragsnummer:` remain stable.
3. One observed status transition for the same claim, with values compared
   locally and only the stability result recorded.
4. The meaning of `.cb_date` in every status section.
5. Loading, timeout/session-expiry, pagination/large-result, missing-section,
   malformed-row, and mobile/accessibility variants.
6. Confirmation of all possible section/status labels.
7. Browser-level confirmation of PDF MIME type and document purpose without
   committing content or identifiers.
8. Confirmation in the target Chrome build that the exact static
   `content_scripts.matches` path excludes ID Austria and unrelated Meine SV
   pages while no `host_permissions` entry is required.
