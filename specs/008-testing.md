# Testing and Verification

## Purpose

Define how automated and manual evidence will prove that implementation matches
the authoritative specs without implying unverified live OEGK compatibility.

## Scope

Testing covers claim validation/normalization, fixture extraction, tracker
matching and events, local persistence, UI rendering/summary logic, optional
WebMCP tools, manifest/security checks, and spec-to-test traceability.

## Non-goals

- Automated login to Meine OEGK or ID Austria.
- Using real personal, medical, invoice, or response-document data in tests.
- Claiming end-to-end live OEGK support from fixture tests.
- OCR or PDF parser testing in milestone one.
- Network-based analytics or test reporting from the installed extension.

## Functional requirements

### OEGK-TEST-001 — Requirement traceability

Every test shall include at least one requirement ID in its suite/test title or
metadata. Each acceptance criterion shall map to one or more automated tests or
an explicitly named manual verification. A generated or maintained traceability
table shall report requirement ID, acceptance criterion, test evidence, and
result.

### OEGK-TEST-002 — Anonymized fixture set

Fixtures shall be synthetic, local, deterministic, and clearly marked as not
captured from a real user. The minimum fixture cases are:

1. one processing claim;
2. one completed claim;
3. multiple claims;
4. missing optional fields;
5. the same stable claim changing status;
6. duplicate-looking claims;
7. an unknown status label; and
8. a malformed or partially rendered claim alongside a valid sibling.

Additional fixtures shall cover a valid empty page, unsupported page, and
loading/partial page so snapshot safety is testable. Confirmed-structure
fixtures shall additionally cover:

- type/range form and the five-year validation alert;
- result-list open, rejected, and reimbursed card containers;
- open and rejected `einreichungDetailOA.xhtml` layouts;
- reimbursed `einreichungDetail.xhtml` summary, itemization, and deduction
  tables; and
- JSF `_blank` PDF controls without embedding actual documents or IDs.

### OEGK-TEST-003 — Claim-model tests

Unit tests shall cover required fields, every status, open/closed/unknown
classification, ISO date/timestamp handling, locale money parsing, whitespace
normalization, optional omission, response availability, and rejection/omission
of malformed values.

Date tests shall prove that invoice, treatment, submission, and reimbursement
dates are not interchangeable and that the unlabeled list-card date is ignored.
Data-minimization tests shall reject the excluded live-detail fields.

### OEGK-TEST-004 — Adapter tests

DOM-fixture tests shall cover page recognition, extraction, normalization,
missing fields, unknown labels, duplicate preservation, malformed sibling
isolation, loading vs complete outcomes, and debug redaction/network silence.
They shall verify semantic heading/card scoping, ignore generated Mojarra IDs,
ignore accessible placeholder text, avoid JSF form/PDF actions, parse the
confirmed labels, and exclude sensitive detail-only fields. Fixtures may state
that their structure is based on the confirmed 2026-08-30 observation but shall
never be described as real-user captures or evidence that selectors cannot
drift.

### OEGK-TEST-005 — Tracker tests

Unit tests with an injected clock and in-memory storage shall cover:

- source-ID matching;
- eligible unique fallback matching;
- insufficient and ambiguous fallback evidence;
- duplicate-looking claims;
- every meaningful status-change direction, including `unknown`;
- no event for a new claim;
- idempotent repeated snapshots;
- conservative missing-field merge;
- unique and ambiguous detail-page enrichment;
- retained claims absent from a snapshot;
- no mutation on partial/failed extraction; and
- atomic failure behavior.

### OEGK-TEST-006 — Storage tests

Contract tests shall cover empty initialization, valid round-trip, deterministic
ordering, atomic replacement, quota/write failure, corrupt data, unknown schema
version, and data minimization. Browser API calls shall be represented by a
controlled fake in unit tests; a packaged-extension smoke test shall verify the
real `chrome.storage.local` boundary.

### OEGK-TEST-007 — UI tests

DOM tests shall cover status labels/grouping, total/open/unknown counts, optional
fields, locale formatting, yearly totals and known counts, fixture labeling,
loading/empty/stale/error states, adversarial text rendering, keyboard semantics,
and absence of write-capable controls. A manual popup check shall confirm sizing,
focus visibility, contrast, and no horizontal scroll.

### OEGK-TEST-008 — WebMCP tool tests

Unit tests shall invoke every tool with valid, empty, boundary, invalid, and
not-found inputs; validate outputs against the specified JSON Schemas; verify
open filtering and yearly summaries; simulate absent/rejecting WebMCP APIs; and
prove handlers perform no DOM, network, storage-write, or navigation operation.
Bridge tests shall cover native-first registration, local fallback,
unavailability, closed request/response validation, correlation, concurrency,
timeouts, cancellation, duplicate IDs, wrong origins, and redacted failures.

### OEGK-TEST-009 — Security/package tests

Automated checks shall inspect source and final package for:

- prohibited network APIs/endpoints and remote resources;
- prohibited Chrome permissions and overly broad host patterns;
- unsafe evaluation and HTML injection;
- sync storage, credential/cookie/token access, and OEGK endpoint calls;
- real personal data or secrets in fixtures/artifacts;
- unexpected bundle files; and
- the spelling rule: technical identifiers, filenames, docs, code, and UI use
  `OEGK`, not the umlaut spelling.

The spelling check may permit the exact prohibited spelling only inside the
test/check mechanism needed to detect it; ideally the check constructs the
forbidden token from code points so the repository otherwise contains none.

### OEGK-TEST-010 — Build and install smoke test

The packaged MV3 extension shall build reproducibly, load unpacked without
manifest errors, open its popup, preserve data across popup reopen, remain quiet
on unrelated pages, and function when WebMCP is absent. Automated smoke tests
use only local fixtures. A separate manual, read-only verification may inspect
the confirmed Meine SV routes after the user has authenticated and manually
submitted the query; extension code must not operate the query controls.

### OEGK-TEST-011 — No false live claim

Milestone reporting shall separate:

- implemented and passing behavior;
- mocked/fixture-only behavior;
- unknown real OEGK DOM behavior;
- unresolved questions; and
- exact information still required from Meine OEGK.

No fixture test may be cited as evidence of live authenticated-page success.

## Data contracts

The traceability matrix shall use:

| Field | Meaning |
| --- | --- |
| Requirement | One `OEGK-*` requirement ID |
| Acceptance criterion | One `AC-OEGK-*` ID |
| Evidence | Automated test name or manual check ID |
| Layer | Model, adapter, tracker, storage, UI, WebMCP, security, or package |
| Result | Pass, fail, blocked, or not run |
| Notes | Fixture/live boundary or relevant limitation |

Test fixtures must contain obviously synthetic providers, IDs, dates, and
amounts and no copied authentication/page secrets.

## Error handling

- Tests shall fail on assertion errors, unhandled promise rejections, schema
  violations, unexpected console errors, or coverage/traceability gaps defined
  by the eventual test configuration.
- A test blocked by unknown live DOM details is reported `blocked`, not passed.
- Flaky tests shall not be retried into a green result without preserving the
  initial failure; deterministic clocks and local fixtures are preferred.
- Security scan false positives may be allowlisted only with a requirement-linked
  explanation.

## Security/privacy considerations

Tests must not log or commit real OEGK content. No authenticated browser session
is required for milestone-one automation. If later manual live validation uses a
real account, it must be user-operated, read-only, local, and documented without
capturing personal values. Screenshots and DOM snippets must be anonymized before
entering the repository.

## Acceptance criteria

- **AC-OEGK-TEST-001** (`OEGK-TEST-001`): Every acceptance criterion in all nine
  specs appears in the traceability report with evidence and a result.
- **AC-OEGK-TEST-002** (`OEGK-TEST-002`): The required synthetic fixture set plus
  confirmed page-kind structures, empty/validation/unsupported/loading states,
  and inert JSF/PDF controls exists and contains no real-user data.
- **AC-OEGK-TEST-003** (`OEGK-TEST-003`, `OEGK-TEST-004`, `OEGK-TEST-005`,
  `OEGK-TEST-006`, `OEGK-TEST-007`, `OEGK-TEST-008`): The model, adapter,
  tracker, storage, UI, and WebMCP suites cover every listed behavior and pass.
- **AC-OEGK-TEST-004** (`OEGK-TEST-009`): Source/package security checks and the
  OEGK spelling check pass with reviewed allowlists only.
- **AC-OEGK-TEST-005** (`OEGK-TEST-010`): A clean build loads unpacked, the popup
  works on fixture data, persistence survives reopen, unrelated pages are
  untouched, and WebMCP absence is harmless.
- **AC-OEGK-TEST-006** (`OEGK-TEST-011`): The milestone report distinguishes the
  confirmed 2026-08-30 structural baseline from fixture evidence, unverified
  selector stability, unknown dates/PDF semantics, and the remaining information
  requested in `002-oegk-adapter.md`.

## Open questions

- Which test runner, DOM environment, schema validator, and accessibility checker
  will be selected during implementation?
- What minimum coverage thresholds are appropriate after the module boundaries
  exist?
- Which exact Chrome/WebMCP client versions will hackathon judges use?
- Can hackathon review provide a sanitized claims-page fixture, or must a local
  developer create one manually?
- Which manual checks are required on macOS and other target platforms?
