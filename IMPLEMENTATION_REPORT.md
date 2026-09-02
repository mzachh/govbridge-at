# GovBridge AT — Implementation Report

## Current live-data refactor

The implementation now follows [spec 012 — Live claim tools](specs/012-live-claim-tools.md):

- claim queries invoke the isolated OEGK adapter on demand for the current
  rendered page;
- no claim records, observations, history, status events, or snapshots are
  persisted by the live runtime;
- successful reads carry current-page metadata, temporary `live-v1-*` IDs, and
  explicit partial-result information;
- the popup and dashboard are technical guidance only, with no claim-data or
  storage reads; and
- the popup opens the dashboard directly with `chrome.tabs.create`.

The legacy storage key and related compatibility identifiers are retained only
as identifiers. Older bytes are not read, migrated, deleted, or displayed;
they remain untouched and inaccessible to this runtime.

## Verification status

Verified on 2026-09-01:

- `npm run verify`: typecheck, 121 tests across six files, build, and package audit
  passed. `git diff --check` passed.
- Dynamic synthetic tests cover row changes/removal, document isolation, duplicate
  rows, stable/expired IDs, unknown amounts, current-page aggregation, partial and
  explicit empty states, loading/error precedence, allowlisted bridge data, and
  search/native/polyfill regression.
- Both repository and personal skill copies match. Frontmatter and UI YAML passed
  Ruby YAML validation; the supplied Python validator was unavailable because its
  environment lacks PyYAML. An independent Luna xhigh review covered refusal,
  missing capabilities, expired IDs, partial results, removed historical access,
  and uncertain navigation responses.

Live external-Chrome verification used its advertised CDP capability to invoke
the page's native `document.modelContext` tools. No claim values were written to
repository artifacts. The user reloaded the extension, handled authentication,
and authorized the bounded search and sensitive read.

- Verified the new current-page tool descriptions and existing search schema.
- Invoked `search_claims` once for the authorized repeat test, received the
  structural acknowledgement, and waited for full navigation.
- Confirmed the exact empty-result alert on the type/range route. `list_claims`
  returned empty success with `scope: current-page`, `pageKind: type-range`,
  complete extraction, and matching displayed bounds. Earlier results were not
  merged into that response.
- Navigated to a fresh search mask. The next query returned `PAGE_NOT_READY`, not
  prior search data. A settled populated results page had also returned live
  current-page metadata and temporary IDs earlier in this verification.
- A first attempt exposed a transitional zero-row bug: hidden/unrendered rows
  without an explicit empty alert had been reported as empty success. The adapter
  now returns `PAGE_NOT_READY` for that state; a regression test and the corrected
  live search verified the fix. The first attempt is not evidence of a successful
  search outcome.

The tested website submission used full navigation. Same-document structural JSF
replacement and uncertain/lost-response behavior are covered synthetically, not
claimed as live-verified. Text-only AJAX completion without a reliable structural
signal remains fail-closed until the user navigates/reloads.

## Historical pre-refactor evidence

Earlier versions of this repository implemented local claim storage,
reconciliation, automatic observation, and storage-backed UI. That evidence is
retained in repository history but is not evidence for the current runtime and
must not be used to describe current behavior.

The earlier search-action evidence also does not prove current-page claim
reads. Search dispatch remains a bounded, one-click action whose acknowledgement
does not confirm a successful server search; callers must inspect the resulting
page and rediscover tools.
