# Read-only WebMCP Tools

## Purpose

Define an optional WebMCP surface that lets a browser agent query locally
normalized OEGK claim data without scraping the OEGK DOM or changing any claim.

## Scope

Milestone one specifies four read-only tools over canonical claims:

- `list_claims`
- `get_open_claims`
- `get_claim`
- `get_reimbursement_summary`

The current WebMCP draft uses the experimental imperative API at
`document.modelContext.registerTool(...)`. Integration remains capability-gated
because browser availability and the draft API may change. The normative draft
is tracked at <https://github.com/webmachinelearning/webmcp>.

## Non-goals

- Scraping or querying the OEGK DOM from a tool handler.
- Submitting, editing, deleting, downloading, opening, or navigating claims.
- Exposing raw HTML, PDF bytes, credentials, cookies, tokens, debug output, or
  internal storage records.
- Sending tool results to a backend or third-party origin.
- Polyfilling WebMCP with a remote dependency.

## Functional requirements

### OEGK-WEBMCP-001 — Capability-gated registration

On the four supported OEGK pages, a MAIN-world bridge registers the four
specified tools through a callable native `document.modelContext`. When the
native API is absent, the extension initializes the locally bundled, pinned
`@mcp-b/webmcp-polyfill` and registers the same definitions. The polyfill does
not replace native support and its testing shim is disabled in production.

When the API is absent, disabled, or registration rejects, the extension shall
continue local extraction, tracking, storage, and popup behavior normally.
Failure shall not be retried in an unbounded loop.

Each definition uses `annotations: { readOnlyHint: true }`. Tool execution
returns the JSON envelope directly; milestone one does not declare an output
schema because the current draft API has no output-schema member. The handler
honors the execution cancellation signal where applicable.

### OEGK-WEBMCP-002 — Normalized-data boundary

Every background tool handler shall obtain validated canonical claims through a
read-only claim repository/service. MAIN-world definitions are metadata-only
proxies. Tool modules shall contain no DOM selectors and shall not call
`OegkAdapter`, `document.querySelector`, OEGK page functions, or network APIs.
The bridge contract and accepted PoC boundary are normative in
`009-webmcp-bridge.md`.

### OEGK-WEBMCP-003 — Read-only guarantee

Tool execution shall not mutate claims, events, storage, the host page, browser
navigation, documents, or OEGK state. Tool names, descriptions, and schemas
shall use query language only. No tool may cause authentication or a legally
relevant action.

### OEGK-WEBMCP-004 — Common output envelope

Successful tools return JSON-compatible values in this envelope:

```json
{
  "ok": true,
  "data": {}
}
```

Expected query failures return:

```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Claim not found."
  }
}
```

Allowed error codes are `INVALID_INPUT`, `NOT_FOUND`, `STORAGE_UNAVAILABLE`, and
`INTERNAL_ERROR`. Messages shall not include claim values, stack traces, storage
contents, or page data.

### OEGK-WEBMCP-005 — `list_claims`

Description: `List all locally observed OEGK claims in deterministic order.`

Input schema:

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Success data schema:

```json
{
  "type": "object",
  "required": ["claims", "count"],
  "properties": {
    "claims": { "type": "array", "items": { "$ref": "#/$defs/claim" } },
    "count": { "type": "integer", "minimum": 0 }
  },
  "additionalProperties": false
}
```

It returns all validated canonical claims using storage ordering. It performs no
implicit refresh or page extraction.

### OEGK-WEBMCP-006 — `get_open_claims`

Description: `List locally observed OEGK claims whose status is submitted or processing.`

Input schema is the same empty object schema as `list_claims`.

Success data has the same `{ claims, count }` schema, restricted to status
`submitted` or `processing`. `unknown` is excluded.

### OEGK-WEBMCP-007 — `get_claim`

Description: `Get one locally observed OEGK claim by its canonical claim ID.`

Input schema:

```json
{
  "type": "object",
  "required": ["claimId"],
  "properties": {
    "claimId": { "type": "string", "minLength": 1, "maxLength": 256 }
  },
  "additionalProperties": false
}
```

Success data schema:

```json
{
  "type": "object",
  "required": ["claim"],
  "properties": { "claim": { "$ref": "#/$defs/claim" } },
  "additionalProperties": false
}
```

An empty/malformed ID returns `INVALID_INPUT`; a valid but unknown ID returns
`NOT_FOUND`.

### OEGK-WEBMCP-008 — `get_reimbursement_summary`

Description: `Summarize known invoice and reimbursement amounts for OEGK claims with an invoice date in one year.`

Input schema:

```json
{
  "type": "object",
  "required": ["year"],
  "properties": {
    "year": { "type": "integer", "minimum": 2000, "maximum": 2100 }
  },
  "additionalProperties": false
}
```

Success data schema:

```json
{
  "type": "object",
  "required": [
    "year",
    "claimCount",
    "invoiceAmountKnownCount",
    "reimbursementAmountKnownCount",
    "invoiceTotal",
    "reimbursedTotal",
    "yearBasis",
    "currency"
  ],
  "properties": {
    "year": { "type": "integer" },
    "claimCount": { "type": "integer", "minimum": 0 },
    "invoiceAmountKnownCount": { "type": "integer", "minimum": 0 },
    "reimbursementAmountKnownCount": { "type": "integer", "minimum": 0 },
    "invoiceTotal": { "type": "number", "minimum": 0 },
    "reimbursedTotal": { "type": "number", "minimum": 0 },
    "yearBasis": { "const": "invoiceDate" },
    "currency": { "const": "EUR" }
  },
  "additionalProperties": false
}
```

Only claims whose `invoiceDate` starts with the requested year are included.
Known amounts are summed; missing amounts are excluded and disclosed through
known counts. Treatment, submission, reimbursement, and unlabeled source dates
do not substitute for invoice date. A year with no claims is a successful
zero-count result.

### OEGK-WEBMCP-009 — Canonical claim output schema

All claim outputs use:

```json
{
  "$defs": {
    "claim": {
      "type": "object",
      "required": ["id", "status", "source", "lastSeen"],
      "properties": {
        "id": { "type": "string" },
        "provider": { "type": "string" },
        "treatmentDate": { "type": "string", "format": "date" },
        "treatmentEndDate": { "type": "string", "format": "date" },
        "invoiceDate": { "type": "string", "format": "date" },
        "submittedDate": { "type": "string", "format": "date" },
        "reimbursementDate": { "type": "string", "format": "date" },
        "invoiceAmount": { "type": "number", "minimum": 0 },
        "reimbursementAmount": { "type": "number", "minimum": 0 },
        "status": {
          "enum": ["submitted", "processing", "completed", "rejected", "unknown"]
        },
        "responseAvailable": { "type": "boolean" },
        "source": { "const": "oegk" },
        "lastSeen": { "type": "string", "format": "date-time" }
      },
      "additionalProperties": false
    }
  }
}
```

Optional properties are omitted when unknown.

### OEGK-WEBMCP-010 — Registration lifecycle and exposure

Registrations shall be bound to the supported OEGK page document lifecycle using
the draft API's abort-signal mechanism where available. The extension shall not
use `exposedTo` to share tools with third-party origins. Duplicate registration
shall be prevented. Tool definitions shall be static for the document lifecycle;
their results read the latest committed local state at execution time.

## Data contracts

Input and output JSON Schemas above are normative. The implementation may
factor shared schema fragments but must expose equivalent closed schemas
(`additionalProperties: false`). JSON serialization must preserve the canonical
claim semantics in `001-claim-model.md`.

## Error handling

- Schema-invalid input returns `INVALID_INPUT` without a storage query.
- Missing state is a successful empty query; unreadable/corrupt storage returns
  `STORAGE_UNAVAILABLE`.
- A handler exception is converted to `INTERNAL_ERROR` with a generic message.
- Registration rejection is locally diagnosable without sensitive content and
  does not affect core extension functionality.
- A tool call never triggers extraction as a fallback.

## Security/privacy considerations

WebMCP results contain sensitive personal, medical, and financial data. Proxy
tools register in the OEGK MAIN world and never an explicit third-party origin.
The PoC does not authenticate the page-world channel: OEGK page scripts can
observe or race messages. The dashboard and privacy notice must explain this
accepted boundary and that a browser agent may read invoked tool results. No
write-capable tool is allowed.

## Acceptance criteria

- **AC-OEGK-WEBMCP-001** (`OEGK-WEBMCP-001`): With a fake registration API, all
  four tools register; without it or on rejection, storage and UI remain usable.
- **AC-OEGK-WEBMCP-002** (`OEGK-WEBMCP-002`, `OEGK-WEBMCP-003`): Static and unit
  tests show handlers query only the normalized repository and perform no DOM,
  network, storage-write, navigation, or OEGK action.
- **AC-OEGK-WEBMCP-003** (`OEGK-WEBMCP-004`, `OEGK-WEBMCP-007`): Invalid and
  missing claim IDs produce the specified safe envelopes.
- **AC-OEGK-WEBMCP-004** (`OEGK-WEBMCP-005`, `OEGK-WEBMCP-006`): Listing returns
  deterministic canonical records and open listing contains only `submitted`
  and `processing`.
- **AC-OEGK-WEBMCP-005** (`OEGK-WEBMCP-008`): Invoice-year filtering, totals,
  known counts, explicit `yearBasis`, and the empty-year result match fixture
  data exactly; other dates cannot alter membership.
- **AC-OEGK-WEBMCP-006** (`OEGK-WEBMCP-009`): Tool outputs validate against the
  closed canonical claim schema and omit unknown optional fields.
- **AC-OEGK-WEBMCP-007** (`OEGK-WEBMCP-001`, `OEGK-WEBMCP-010`): Registration
  occurs only on supported OEGK documents, is native-first, lifecycle-bound and
  non-duplicated, and specifies no third-party `exposedTo` origin.

## Open questions

- Which exact Chrome/WebMCP client versions will be used for milestone and
  hackathon validation?
- Does the target browser agent automatically discover MAIN-world tools, or
  must it call `document.modelContext.getTools()` explicitly?
- What user consent UI does the target browser provide before an agent reads
  sensitive tool results?
- Should tool names gain an `oegk_` prefix to avoid collisions, despite the
  requested names?
- Does the target implementation support output schemas directly, or should
  they remain contract/tests only?
