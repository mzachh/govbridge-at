# Canonical Claim Model

## Purpose

Define the OEGK-independent canonical representation consumed by claim
tracking, local storage, the extension UI, and WebMCP tools.

## Scope

This specification covers the `Claim` record, its field semantics,
normalization rules, validation, serialization, and derived open/closed
classification.

## Non-goals

- Mirroring every field present in Meine OEGK.
- Storing DOM nodes, raw HTML, cookies, tokens, documents, or screenshots.
- Modeling PDF response contents in milestone one.
- Inventing an amount, date, provider, status, or response flag when the source
  does not supply one.

## Functional requirements

### OEGK-CLAIM-001 — Canonical record

The canonical model shall be structurally equivalent to:

```ts
interface Claim {
  id: string;
  provider?: string;
  treatmentDate?: string;
  treatmentEndDate?: string;
  invoiceDate?: string;
  submittedDate?: string;
  reimbursementDate?: string;
  invoiceAmount?: number;
  reimbursementAmount?: number;
  status: "submitted" | "processing" | "completed" | "rejected" | "unknown";
  responseAvailable?: boolean;
  source: "oegk";
  lastSeen: string;
}
```

### OEGK-CLAIM-002 — Required fields

`id`, `status`, `source`, and `lastSeen` are required. `id` is a locally useful
identity token under the rules in `003-claim-tracking.md`; it does not imply that
OEGK supplied the identifier. `source` is always the literal `"oegk"`.

### OEGK-CLAIM-003 — Dates and timestamps

- `treatmentDate`, `treatmentEndDate`, `invoiceDate`, `submittedDate`, and
  `reimbursementDate`, when a complete calendar date is known, shall be
  `YYYY-MM-DD` strings representing the displayed local calendar date.
- `treatmentDate` is the start of treatment. `treatmentEndDate` is present only
  when the page explicitly displays a treatment range.
- `invoiceDate` comes from the exact `Rechnung vom` label in a list/detail
  heading. It is not silently treated as a treatment or submission date.
- `reimbursementDate` comes only from the exact detail label
  `Datum der Erstattung:`.
- `submittedDate` remains absent unless a source label explicitly establishes
  submission semantics. The observed unlabeled date cell in result cards is
  not sufficient evidence because its meaning may vary by status group.
- A partial or ambiguous date shall be omitted, not guessed.
- `lastSeen` shall be a valid UTC ISO 8601 instant such as
  `2026-08-30T18:42:00.000Z`, supplied by the tracker clock rather than parsed
  from the page.

### OEGK-CLAIM-004 — Monetary values

Amounts shall be finite JavaScript numbers representing euros. Parsing shall
support only explicitly documented locale formats. Live observation confirmed
dot-decimal reimbursement values; fixtures shall use synthetic dot-decimal,
comma-decimal, and thousands-separated values without assuming that every form
occurs live.
Currency symbols and separators are removed during normalization; rounding is
to two fractional digits. Missing, ambiguous, non-EUR, negative, or malformed
amounts are omitted. Zero is valid when explicitly displayed.

### OEGK-CLAIM-005 — Text values

Optional text is trimmed and internal whitespace is collapsed. Empty strings
become absent. Provider text is preserved otherwise; it is not corrected,
translated, or inferred.

### OEGK-CLAIM-006 — Status vocabulary

The adapter maps only documented source structures to canonical statuses:

- `submitted`: received/submitted but processing has not yet been confirmed;
- `processing`: actively open or in processing;
- `completed`: processing finished, irrespective of reimbursement amount;
- `rejected`: explicitly refused or rejected;
- `unknown`: a present status value cannot be mapped safely, or no status is
  available on an otherwise valid claim.

`submitted` and `processing` are open. `completed` and `rejected` are closed.
`unknown` is not counted as open or closed.

Confirmed result-list mappings for the supported Wahlarzt/Wahltherapeut view
are:

- the section headed `offene Einreichungen` maps to `processing` because the
  page supplies no finer submitted-versus-processing distinction;
- `abgelehnte Einreichungen` maps to `rejected`; and
- `erstattete Einreichungen` maps to `completed`.

The `submitted` value remains part of the canonical vocabulary for a future
explicit source state but is not produced from the currently observed list.

### OEGK-CLAIM-007 — Response availability

`responseAvailable` is present only when the page explicitly provides evidence
that a response/decision is available (`true`) or explicitly unavailable
(`false`). Absence means not observed or not safely determinable.

The observed links titled `PDF Download der Einreichung` and
`PDF Bestätigung der Einreichung` describe a claim PDF and submission
confirmation, respectively; neither is sufficient evidence of a decision
response. Their presence therefore does not set `responseAvailable` in
milestone one. An inline `Ablehnungsgrund:` confirms rejection detail but does
not prove that a separate response document exists.

### OEGK-CLAIM-009 — Deliberately excluded live fields

Live detail pages expose additional sensitive fields. Milestone one shall not
persist the insured person (`Behandlung für:`), destination bank account
(`Erstattung auf das Konto:`), rejection reason, itemized billing positions,
tax/fee deductions, or raw OEGK application number as general claim fields.
The application number may be used transiently as identity evidence under
`003-claim-tracking.md`, but it is not exposed through UI or WebMCP.

### OEGK-CLAIM-008 — Extensible response parsing boundary

Future PDF enrichment may implement:

```ts
interface ClaimResponseParser {
  canParse(document: ArrayBuffer): boolean;
  parse(document: ArrayBuffer): Promise<Partial<Claim>>;
}
```

No response parser, PDF.js integration, document fetching, or OCR is part of
milestone one. A future parser may enrich optional fields but must not overwrite
an established claim identity without tracker validation.

## Data contracts

The JSON representation uses exactly the same property names and values as the
TypeScript shape. Optional properties are omitted rather than serialized as
`null`. Unknown additional properties are not part of milestone-one persistence
or tool outputs.

Example with partial data:

```json
{
  "id": "local-v1-7e3f…",
  "status": "processing",
  "source": "oegk",
  "lastSeen": "2026-08-30T18:42:00.000Z"
}
```

## Error handling

- A record missing any required field is invalid and shall not be persisted or
  exposed as a claim.
- An invalid optional field is omitted if the remaining record identifies a
  plausible claim; the adapter shall emit a local diagnostic in debug mode.
- An unrecognized status becomes `unknown`, not `processing` or `completed`.
- Invalid dates and amounts are never coerced to plausible-looking values.

## Security/privacy considerations

Claims contain personal, medical, and financial data. Consumers shall use the
minimum fields needed, retain them only locally, avoid sensitive logs, and never
embed raw source HTML in the canonical record.

## Acceptance criteria

- **AC-OEGK-CLAIM-001** (`OEGK-CLAIM-001`, `OEGK-CLAIM-002`): Validation
  accepts a record with exactly the four required fields and rejects a record
  missing any one of them.
- **AC-OEGK-CLAIM-002** (`OEGK-CLAIM-003`): Complete dates and `lastSeen`
  normalize to their specified forms; invoice, treatment, submission, and
  reimbursement dates are never substituted for one another, and the unlabeled
  list-card date is omitted.
- **AC-OEGK-CLAIM-003** (`OEGK-CLAIM-004`): Documented Austrian EUR formats
  normalize correctly, while malformed, negative, and non-EUR values are
  omitted.
- **AC-OEGK-CLAIM-004** (`OEGK-CLAIM-005`): Text normalization trims and
  collapses whitespace without otherwise rewriting provider names.
- **AC-OEGK-CLAIM-005** (`OEGK-CLAIM-006`): Every canonical status is
  classified exactly as open, closed, or unknown above.
- **AC-OEGK-CLAIM-006** (`OEGK-CLAIM-007`): Lack of page evidence omits
  `responseAvailable` rather than setting it to `false`.
- **AC-OEGK-CLAIM-007** (`OEGK-CLAIM-008`): Milestone-one production bundles
  contain no PDF parser, OCR, or automatic response-document retrieval.
- **AC-OEGK-CLAIM-008** (`OEGK-CLAIM-009`): Persisted/UI/WebMCP fixtures omit
  insured-person, bank-account, rejection-reason, itemization, deduction, and
  raw application-number values.

## Open questions

- Do comma-decimal or thousands-separated amounts occur in this view in
  addition to the confirmed dot-decimal reimbursement format?
- Can displayed invoice or reimbursement amounts ever use another currency or
  negative adjustments?
- What does the unlabeled `.cb_date` value mean in each of the open, rejected,
  and reimbursed groups?
- Is either observed PDF a decision document, or are both only copies and
  confirmations of the submitted claim?
- Are there additional terminal statuses that need a canonical value rather
  than `unknown`?
