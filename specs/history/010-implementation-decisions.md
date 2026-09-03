# Milestone-one Implementation Decisions

> **Status: historical / not current.** This specification predates the live
> current-page contract and remains as design history. [Spec 012 — Live claim
> tools](../012-live-claim-tools.md) is normative where requirements differ.

## Purpose

Close the implementation gaps discovered during the pre-build specification
review. These decisions are normative for milestone one.

## Adapter boundary

The adapter returns observations, not persisted claims:

```ts
interface ClaimObservation {
  provider?: string;
  treatmentDate?: string;
  treatmentEndDate?: string;
  invoiceDate?: string;
  submittedDate?: string;
  reimbursementDate?: string;
  invoiceAmount?: number;
  reimbursementAmount?: number;
  status: ClaimStatus;
  responseAvailable?: boolean;
  source: "oegk";
  transientSourceId?: string;
}

interface ClaimExtractionResult {
  state: "complete" | "empty" | "loading" | "unsupported" | "error";
  pageKind?: "type-range" | "results" | "open-rejected-detail" | "reimbursed-detail";
  snapshotComplete: boolean;
  observations: ClaimObservation[];
  observedRange?: { from: string; to: string };
  diagnostics: { candidateCount: number; skippedCount: number };
}
```

`transientSourceId` exists only between adapter and tracker. It is never stored,
rendered, logged, or returned through WebMCP. The tracker alone assigns `id` and
`lastSeen`.

`snapshotComplete` is true only for a successfully parsed results page,
including a documented empty result. It is false for type/range, loading,
unsupported, error, and detail pages. `state: "empty"` is therefore authoritative
only when `snapshotComplete` is true.

## Persistence metadata

The single versioned storage value may contain operational metadata alongside
canonical claims and events:

```ts
interface ObservationMetadata {
  lastSnapshotAt: string;
  lastExtractionState: "complete" | "empty";
  lastObservedRange?: { from: string; to: string };
}
```

This metadata contains no page content or identifiers. `provenance` is always
`"live-local"` in production; fixture/demo data is permitted only in tests and
must never be packaged as production state.

## Extension messages

Only these closed requests are accepted by the service worker:

- `{ type: "claims.observe", result: ClaimExtractionResult }` from the exact
  Meine SV origin and supported path;
- `{ type: "claims.read" }` from extension-owned pages;
- `{ type: "dashboard.open" }` from the popup; and
- `{ type: "webmcp.execute", tool, input }` from the extension's isolated
  top-frame relay on an exact supported Meine SV page, with an allowlisted tool
  name and tool-specific closed input.

Responses are `{ ok: true, data }` or a redacted `{ ok: false, error }`.
Unknown types, extra top-level properties, invalid payloads, and invalid senders
are rejected. The service worker serializes observation writes through one
in-memory promise chain; storage replacement of the single state value is the
atomic commit boundary.

## Detail enrichment

A detail observation may enrich a stored claim only when it has exactly one
match using transient source identity within the current run or the documented
fallback fingerprint. Otherwise it is ignored. Detail observations never
create claims and never form an authoritative snapshot.

The currently confirmed list and detail layouts do not expose two overlapping
identity components, and the application number is not present on list cards.
Consequently, live detail enrichment is expected to remain fail-closed for
those shapes until a stable cross-page identity is confirmed. This limitation
is preferable to attaching medical/financial detail to the wrong claim.

## Amount grammar

Milestone one accepts explicit EUR text in these unambiguous forms:

- `1234.56` or `1234,56`;
- `1.234,56` (dot thousands, comma decimal); and
- `1 234,56` including a non-breaking space.

An optional `EUR` or `€` marker may surround the number. Mixed US-style
`1,234.56`, more than two fractional digits, negatives, other currencies, and
ambiguous separator groupings are rejected. Only dot-decimal has been confirmed
on the live results page; the others are fixture-backed compatibility formats.

## WebMCP lifecycle

The four tool handlers remain complete and context-independent in the service
worker. Static proxy definitions register in the MAIN world of supported OEGK
pages through native `document.modelContext` or the pinned local compatibility
runtime. Registration uses `annotations.readOnlyHint: true`, direct JSON
envelopes, cancellation, and a document-lifetime `AbortController`. The
isolated relay and background service use the closed protocol in
`009-webmcp-bridge.md`; there is no `exposedTo` option or generic window API.

The dashboard documents this architecture but no longer registers tools. Exact
agent discovery in the target browser remains a manual compatibility check.

## Live activation

Production extraction is fail-closed but enabled for the four exact supported
paths after automated fixture, security, and package verification succeeds.
Unconfirmed selectors or layouts yield `unsupported` or `error` and do not
remove stored claims. Remaining real-account variants stay documented as live
validation items; they do not justify broad selectors or automation.
