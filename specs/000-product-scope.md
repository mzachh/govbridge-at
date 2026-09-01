# GovBridge AT: Product Scope

## Purpose

Define the first milestone for **GovBridge AT**, a local
Chrome extension prototype that helps a user understand which submitted medical
invoice claims are still being processed in Meine OEGK.

OEGK is the first supported service. The package and skill use `govbridge-at`.
Spec `011-govbridge-at-skill.md` adds the bounded `search_claims` form action
and guided Codex workflow; claim queries and extraction remain read-only.

## Scope

The first milestone covers:

- a Manifest V3 Chrome extension;
- extraction of claim information already visible on a supported Meine OEGK
  claims page;
- normalization into the canonical `Claim` model;
- local persistence and comparison with earlier observations;
- a minimal popup/dashboard for claim status and yearly totals;
- four read-only WebMCP queries and one query/results-page search action; and
- fixture-based development from the authenticated DOM baseline documented on
  2026-08-30 in `002-oegk-adapter.md`.

The primary question the product answers is:

> Which medical invoices are still being processed by OEGK?

## Non-goals

- Submitting, editing, withdrawing, or otherwise changing claims.
- Navigating or automating ID Austria authentication.
- Automating any legally relevant action.
- Scraping pages outside the narrowly supported claims view.
- Parsing claim-response PDFs in milestone one.
- OCR, document upload, a backend, cloud synchronization, telemetry, analytics,
  or external AI services.
- Providing medical, legal, or tax advice.
- Automatically navigating to details or opening PDFs. The Codex skill may
  select the claim type, then invoke the extension's bounded search action.
- Claiming universal production support from one confirmed account/session
  observation.

## Functional requirements

### OEGK-SCOPE-001 — Read-only claim overview

The extension shall present locally observed submitted claims and distinguish
open claims from completed claims. For milestone one, `submitted` and
`processing` are open; `completed` and `rejected` are closed; `unknown` is
neither and must be shown separately or clearly identified.

### OEGK-SCOPE-002 — Local-only operation

All extraction, normalization, comparison, storage, and presentation shall run
inside the user's browser without sending claim or page data to an external
service.

### OEGK-SCOPE-003 — Graceful partial data

The extension shall remain useful when optional provider, date, amount, or
response fields are absent. It shall not invent missing values.

### OEGK-SCOPE-004 — Fixture-gated OEGK integration

Implementation shall first target anonymized fixtures reproducing the confirmed
Meine SV DOM contract in `002-oegk-adapter.md`. Live activation is permitted
only after fixture acceptance tests pass and must fail closed when origin, path,
semantic landmarks, or snapshot completeness do not match. The implementation
shall describe support as a prototype validated against the 2026-08-30
observation, not universal compatibility.

### OEGK-SCOPE-005 — Spec-driven delivery

Behavior shall be implemented only after its corresponding requirement and
acceptance criteria exist in `specs/`. Tests shall reference the requirement IDs
they prove.

## Data contracts

The authoritative normalized data contract is the `Claim` model in
`001-claim-model.md`. OEGK-specific page details must terminate at the adapter
boundary; storage, tracking, UI, and WebMCP consume only canonical claims and
tracker events.

The intended data flow is:

```text
Meine OEGK claims page
        |
        v
Content script
        |
        v
OegkAdapter
        |
        v
ClaimExtractionResult
   |        |         |
   v        v         v
Storage     UI      WebMCP
```

## Error handling

- Unsupported or partially rendered pages shall produce a non-destructive,
  diagnosable result rather than an empty snapshot that could erase stored data.
- Extraction errors shall not modify Meine OEGK or discard the last valid local
  snapshot.
- Storage or WebMCP failures shall not interfere with the host page.
- User-facing errors shall avoid exposing sensitive claim details in logs.

## Security/privacy considerations

The complete constraints are in `007-security-privacy.md`. The extension is
read-only for claim data, permits only the documented search form action,
has no backend, uses no remote code, does not collect credentials or
authentication artifacts, and requests only the minimum OEGK host access needed
for the confirmed claims page.

## Acceptance criteria

- **AC-OEGK-SCOPE-001** (`OEGK-SCOPE-001`): Given normalized fixture claims in
  each canonical status, the product classification identifies open, closed,
  and unknown claims as specified.
- **AC-OEGK-SCOPE-002** (`OEGK-SCOPE-002`): Static inspection and automated
  tests find no network transmission path for claim data.
- **AC-OEGK-SCOPE-003** (`OEGK-SCOPE-003`): A claim containing only required
  fields can be normalized, stored, listed, and rendered without fabricated
  optional values.
- **AC-OEGK-SCOPE-004** (`OEGK-SCOPE-004`): The adapter suite uses anonymized
  fixtures matching the confirmed routes/landmarks, and live extraction remains
  disabled or fails closed when the page signature drifts.
- **AC-OEGK-SCOPE-005** (`OEGK-SCOPE-005`): Every automated test name or
  description cites at least one requirement ID from `specs/`.

## Open questions

- Does the observed candidate `Antragsnummer:` remain stable across status
  transitions, and how can reimbursed records expose the same identity?
- Are there status sections beyond the confirmed open, rejected, and reimbursed
  groups?
- What does the unlabeled list-card date mean in each status group?
- Is the minimal usable UI a toolbar popup only, or is a larger extension page
  needed after usability testing?
- Which Chrome/WebMCP client versions will the hackathon judges use?
