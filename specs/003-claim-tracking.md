# Claim Tracking and Change Detection

> **Status: historical / not current.** This specification predates the live
> current-page contract and remains as design history. [Spec 012 — Live claim
> tools](012-live-claim-tools.md) is normative where requirements differ.

## Purpose

Define how current OEGK claim observations are matched with local history,
merged, classified, and converted into status-change events.

## Scope

This specification covers identity precedence, fallback matching, duplicate
handling, snapshot reconciliation, field merging, timestamps, and status-change
events. It operates only on canonical claims and extraction metadata, never on
the OEGK DOM.

## Non-goals

- Guessing that similar-looking claims are identical when evidence is
  ambiguous.
- Treating absence from a partial page as deletion or completion.
- Sending notifications outside the extension in milestone one.
- Maintaining a complete medical audit log indefinitely.
- Altering a claim on Meine OEGK.

## Functional requirements

### OEGK-TRACK-001 — Reconciliation sequence

For each complete results-page snapshot, the tracker shall:

1. validate and normalize current observations;
2. load the previously stored state;
3. match observations to stored claims using the rules below;
4. detect supported changes;
5. merge current and retained information;
6. atomically store the resulting snapshot and new events; and
7. return the snapshot and events to local consumers.

Unsupported, loading, or failed extraction shall stop before reconciliation and
shall not change stored claims or events.

A documented `empty` result is authoritative only for its observed query range
and still does not delete historical claims under `OEGK-TRACK-009`. Type/range
and detail pages are never full snapshots. Detail observations follow
`OEGK-TRACK-011` and cannot infer absence.

### OEGK-TRACK-002 — Identity precedence

Identity resolution follows this order:

1. **Confirmed source identifier:** if the supported page exposes a stable OEGK
   claim ID whose stability is documented, derive `id` deterministically from
   `source + sourceId` using a versioned local encoding or hash.
2. **Previously matched fingerprint:** if no confirmed source ID exists, build a
   versioned fingerprint only from stable, present fields: provider,
   `invoiceDate`, treatment start/end dates, and invoice amount.
   `submittedDate` may participate only when explicitly labeled by a future
   source. Reimbursement date/amount, status, response availability, the
   unlabeled list date, JSF component IDs, DOM position, and `lastSeen` are
   excluded because they may change or lack stable semantics.
3. **New local identity:** if the stable-field fingerprint is incomplete or
   ambiguous, assign a cryptographically random local ID and do not claim a
   match.

Raw source identifiers need not be exposed outside the adapter/tracker identity
function. ID generation must be deterministic for the same confirmed source ID
or unambiguous fingerprint.

Live detail observation found an `Antragsnummer:` only on the open/rejected
detail route, not on the observed reimbursed detail route. Until repeat
observations prove that value stable across a status transition, it is a
candidate identifier rather than a confirmed universal source ID. Dynamic
Mojarra IDs such as `j_idt1:vsinfoForm:j_idt73:0:j_idt83` encode component and
row positions and must never be used as claim identity.

### OEGK-TRACK-003 — Fallback matching threshold

A fallback fingerprint is eligible only when at least two stable identity
components are present and the resulting fingerprint uniquely matches exactly
one current observation and exactly one stored claim. At least one component
must be a date or invoice amount; provider alone is never sufficient.

This threshold is provisional until real-page identifiers are understood. Any
change to it requires a spec and fixture update.

### OEGK-TRACK-004 — Duplicate handling

If two current observations or two stored claims share the same fallback
fingerprint and no confirmed source ID disambiguates them:

- they shall remain separate records;
- no automatic cross-snapshot match shall be asserted for the ambiguous group;
- existing unambiguous records shall not be overwritten;
- current records receive distinct local IDs; and
- a non-sensitive local diagnostic records the ambiguity count.

Order in the DOM shall not be used as identity evidence.

### OEGK-TRACK-005 — Status transitions

All canonical status pairs are recordable because the source may correct or
reopen a claim. A `CLAIM_STATUS_CHANGED` event is emitted only when an
unambiguous matched claim has different previous and current canonical statuses.
Transitions involving `unknown` are recorded as observed changes but are not
interpreted as progress or regression.

The tracker must not synthesize a transition for a newly discovered claim or an
ambiguous match.

### OEGK-TRACK-006 — Event contract

Status-change events shall conform to:

```ts
interface ClaimStatusChangedEvent {
  type: "CLAIM_STATUS_CHANGED";
  claimId: string;
  previousStatus: Claim["status"];
  newStatus: Claim["status"];
  observedAt: string;
}
```

`observedAt` is the same tracker-clock instant used as the current claim's
`lastSeen`. Events contain no provider, amount, document, or raw-page data.

### OEGK-TRACK-007 — Timestamp behavior

The tracker captures one UTC clock instant per reconciliation. Every valid
currently observed claim receives that instant as `lastSeen`, whether or not it
changed. A retained claim not present in a complete snapshot keeps its prior
`lastSeen`. Clock injection shall be supported for deterministic tests.

### OEGK-TRACK-008 — Missing-field merge

For an unambiguous match:

- fields explicitly observed now replace earlier values;
- current absence of an optional field does not delete an earlier observed
  value unless the adapter can distinguish explicit removal from non-rendering;
- status always uses the current canonical observation, including `unknown`;
- `responseAvailable` uses the current value when present, otherwise retains
  the earlier value; and
- identity fields do not change the persisted `id`.

This conservative merge prevents partial rendering from erasing known data but
means stale optional values may remain; the UI must not claim they were seen in
the latest page unless field provenance is later modeled.

### OEGK-TRACK-009 — Missing claims

Milestone one does not delete a stored claim merely because it is absent from a
snapshot. The stored claim remains available with its earlier `lastSeen`.
Retention/archival policy is deferred until pagination and historical-page
behavior are confirmed. No status is inferred from absence.

### OEGK-TRACK-010 — Idempotency

Reprocessing the same complete snapshot with no status change shall not emit a
new event or create a duplicate claim. Updating `lastSeen` alone is not a status
change.

### OEGK-TRACK-011 — User-opened detail enrichment

An `open-rejected-detail` or `reimbursed-detail` extraction result represents
one enrichment candidate, not a list snapshot. It may update a stored claim
only when identity resolution yields exactly one match. Candidate
`Antragsnummer:` may be used transiently but shall not become a universal stable
ID until transition stability is confirmed.

If matching is ambiguous or impossible, the detail may be displayed as current
page information but shall not create a second persistent claim or overwrite an
existing one. Detail absence never removes list-derived fields, and excluded
sensitive detail fields never enter the tracker.

## Data contracts

Tracker input comprises a validated current `Claim[]`, a typed extraction state,
page kind and observed query range where available, the stored snapshot, and an
injectable clock. Output comprises the reconciled `Claim[]` and newly produced
`ClaimStatusChangedEvent[]`.

## Error handling

- Invalid current claims are rejected before storage; isolated invalid records
  may be skipped only when extraction is still explicitly complete and the
  adapter provides a diagnostic count.
- Storage-load, match, or atomic-write failure leaves the previous committed
  state intact and returns a generic local error.
- Ambiguity fails open for display as separate claims but fails closed for
  change inference.
- A backward or invalid system clock shall not create an invalid `lastSeen`;
  reconciliation fails without a partial commit.

## Security/privacy considerations

Identity hashes are local matching aids, not anonymization. Input values and IDs
remain sensitive. Events intentionally omit medical and financial details.
Nothing is transmitted externally.

## Acceptance criteria

- **AC-OEGK-TRACK-001** (`OEGK-TRACK-001`): A valid complete snapshot commits
  claims/events together; unsupported, loading, and failed states commit
  nothing.
- **AC-OEGK-TRACK-002** (`OEGK-TRACK-002`, `OEGK-TRACK-003`): Stable source IDs
  match first; the candidate application number is not promoted without
  stability evidence; a unique eligible fingerprint matches without one; and
  insufficient evidence creates a new local identity.
- **AC-OEGK-TRACK-003** (`OEGK-TRACK-004`): Duplicate-looking claims remain
  distinct and produce no inferred cross-snapshot change.
- **AC-OEGK-TRACK-004** (`OEGK-TRACK-005`, `OEGK-TRACK-006`): A processing claim
  observed later as completed emits exactly one correctly timestamped event.
- **AC-OEGK-TRACK-005** (`OEGK-TRACK-005`): A new completed claim emits no
  status-change event because no prior status exists.
- **AC-OEGK-TRACK-006** (`OEGK-TRACK-007`, `OEGK-TRACK-010`): Repeated snapshots
  update `lastSeen` but do not create duplicate claims or events.
- **AC-OEGK-TRACK-007** (`OEGK-TRACK-008`): A matched observation missing an
  optional provider or amount retains the stored value and uses the current
  status.
- **AC-OEGK-TRACK-008** (`OEGK-TRACK-009`): A stored claim absent from a complete
  snapshot is retained without a fabricated status change.
- **AC-OEGK-TRACK-009** (`OEGK-TRACK-011`): A uniquely matched detail enriches
  allowed fields without replacing the full snapshot; an ambiguous detail
  creates no persistent duplicate or mutation; and excluded fields never reach
  storage.

## Open questions

- Does `Antragsnummer:` remain stable and available when an open claim becomes
  rejected or reimbursed, even though it was absent from the observed
  reimbursed detail layout?
- Can the same invoice/provider/date/amount combination legitimately occur more
  than once, requiring an additional stable identity field?
- Should field-level `lastSeen` provenance be added before enabling live
  persistence?
- How long should claims and change events be retained?
- Should users be able to clear or export local history in a later milestone?
- How should a confirmed source-side deletion or withdrawn claim be represented?
