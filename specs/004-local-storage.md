# Local Claim Storage

> **Status: historical / not current.** This specification predates the live
> current-page contract and remains as design history. [Spec 012 — Live claim
> tools](012-live-claim-tools.md) is normative where requirements differ.

## Purpose

Define a versioned, local-only persistence boundary for canonical claims and
status-change events.

## Scope

Milestone one persists normalized claims, status-change events, and minimal
schema metadata in extension-owned browser storage. The storage implementation
is abstracted behind `ClaimStorage` so the backing mechanism can change without
affecting the adapter, tracker, UI, or WebMCP tools.

## Non-goals

- Cloud sync or cross-browser synchronization.
- Storing raw HTML, PDFs, screenshots, cookies, credentials, or authentication
  tokens.
- Using OEGK-owned local/session storage.
- Long-term regulated medical-record archival.
- Automatic export or backup.

## Functional requirements

### OEGK-STORAGE-001 — Storage interface

The storage boundary shall conceptually support:

```ts
interface ClaimStorage {
  loadSnapshot(): Promise<StoredClaimState>;
  replaceSnapshot(state: StoredClaimState): Promise<void>;
}
```

Additional methods may provide read-only queries, but consumers must not depend
on Chrome storage primitives directly.

### OEGK-STORAGE-002 — Backing store

Milestone one shall use extension-local `chrome.storage.local` unless measured
data volume or atomicity requirements demonstrate that IndexedDB is necessary.
`chrome.storage.sync` is prohibited. Changing to IndexedDB requires an explicit
spec update and migration plan.

### OEGK-STORAGE-003 — Versioned state

Stored state shall use:

```ts
interface StoredClaimState {
  schemaVersion: 1;
  claims: Claim[];
  events: ClaimStatusChangedEvent[];
  updatedAt: string;
  metadata?: {
    lastSnapshotAt: string;
    lastExtractionState: "complete" | "empty";
    lastObservedRange?: { from: string; to: string };
  };
}
```

The storage key remains `oegkClaimTracker.state.v1` as a legacy compatibility
identifier after the GovBridge AT rename. No storage migration or clearing is
required. OEGK remains the service identifier, never the umlaut spelling.

### OEGK-STORAGE-004 — Atomic snapshot replacement

Claims and events shall be written as one logical state value so readers never
observe new claims with missing corresponding events or vice versa. The new
value must be fully validated before replacing the previous value.

### OEGK-STORAGE-005 — Deterministic reads

Loaded claims shall be returned in a deterministic order defined for consumers:
open statuses before unknown before closed; within a status group, most recent
`invoiceDate` first, then `lastSeen` descending, then `id` ascending. Claims
without `invoiceDate` sort after dated claims in their status group. Neither the
unlabeled source date nor another canonical date substitutes for `invoiceDate`.
Storage may persist any order, but query output must follow this rule.

### OEGK-STORAGE-006 — Corruption and migration

Missing storage initializes an empty version-1 state. Unknown schema versions or
invalid stored records shall not be silently coerced. The implementation shall
preserve the unread value, expose a generic local error, and avoid overwriting
it until a documented migration or explicit user reset exists.

### OEGK-STORAGE-007 — Data minimization

Only canonical claims, minimal status-change events, schema timestamps, and the
closed count-free snapshot metadata above may be persisted. Diagnostics and raw
extraction material remain ephemeral.

### OEGK-STORAGE-008 — Retention boundary

Milestone one retains valid discovered claims and status-change events locally
until the extension is removed, browser data is cleared, or a later specified
user-controlled clear function is implemented. No background expiration is
performed in milestone one.

## Data contracts

`StoredClaimState` is the only milestone-one persisted application object. All
dates follow `001-claim-model.md`; all events follow
`003-claim-tracking.md`. Optional fields are omitted rather than stored as
`null`.

## Error handling

- A read failure returns a storage-unavailable error, not an empty state.
- A quota or write failure leaves the prior state usable and is surfaced to the
  popup without sensitive data.
- Invalid application input is rejected before calling the browser storage API.
- Concurrent writers must be serialized by the coordinating extension context;
  later implementation shall document the chosen lock/queue mechanism.

## Security/privacy considerations

Storage stays inside the local Chrome profile and is not encrypted by the
extension; anyone with access to the unlocked browser profile may be able to
inspect it. The UI and `PRIVACY.md` must state this accurately. Sync storage,
network replication, and content-page-readable storage are forbidden.

## Acceptance criteria

- **AC-OEGK-STORAGE-001** (`OEGK-STORAGE-001`, `OEGK-STORAGE-002`): Consumers
  interact through `ClaimStorage`, and milestone one uses only local, non-sync
  extension storage.
- **AC-OEGK-STORAGE-002** (`OEGK-STORAGE-003`, `OEGK-STORAGE-004`): A state
  round-trip preserves valid claims/events and exposes only a complete versioned
  snapshot.
- **AC-OEGK-STORAGE-003** (`OEGK-STORAGE-005`): Mixed dated and undated claims
  load in the specified deterministic order.
- **AC-OEGK-STORAGE-004** (`OEGK-STORAGE-006`): Missing state initializes empty;
  corrupt or future-version state produces an error and is not overwritten.
- **AC-OEGK-STORAGE-005** (`OEGK-STORAGE-007`): Persisted test data contains no
  raw HTML, document bytes, debug payloads, credentials, cookies, or tokens.
- **AC-OEGK-STORAGE-006** (`OEGK-STORAGE-008`): Reopening the extension preserves
  the last valid local state without automatic expiry.

## Open questions

- Will realistic claim counts and event history fit comfortably within
  `chrome.storage.local` quotas?
- Which extension context will serialize writes under Manifest V3 suspension?
- When should a user-facing clear/export feature be specified?
- Is browser-profile-at-rest protection sufficient for the prototype audience,
  and how should this limitation be worded in `PRIVACY.md`?
