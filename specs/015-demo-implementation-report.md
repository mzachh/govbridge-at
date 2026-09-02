# GovBridge AT Demo — local implementation evidence

Date: 2026-09-02. Status: local implementation; final installed-extension gate pending.

## Implemented

- Spec 018 restores the compact official-style overview for default and searched
  results. No rich or hidden detail block remains in list rows. Detail pages retain
  richer fields; query responses reflect only their current page. A fictional
  overview date is displayed without mapping it to a canonical event date.

- Separate Sites/Vinext project in `demo-site/`; canonical entry, type, results and both detail `.xhtml` routes use real HTTP handlers and native forms.
- Public `peter` / `ThisIsJustADemo$` simulation login (spec 017), signed one-hour cookie, same-origin POST checks, bounded body/query input, safe return destinations, no-store pages, logout/expiry and history-revalidation script. The former credentials are rejected.
- Twenty independently authored synthetic claims, fixed 2021-09-03–2026-09-02 range, 5 processing / 11 completed / 4 rejected. Ten known reimbursements total EUR 492.10; one completed record intentionally has unknown reimbursement. Duplicate-looking rows have distinct fixture keys.
- Required scenario catalog, developer-only in-document mutations, and bounded AJAX handlers. Unrecognized/failed/text-only AJAX outcomes remain visibly busy rather than exposing retained rows as a confirmed result.
- Same extension adapter, live reader, search executor and bridge; no website implementation of the three query tools and search action. Explicit origin/provenance checks preserve production isolation and no claim persistence. Spec 017 removes the reimbursement-summary tool; spec 018 keeps richer fields on detail pages rather than compact overview rows.
- Measured official visual language, independently authored CSS, system-font alternatives, no official artwork, and conspicuous synthetic branding. Social preview image contains no private data.
- Repository and installed skill updated for an explicitly requested synthetic workflow. Spec 017 uses English independently of page language, reuses a selected supported tab, awaits async discovery, and removes additional prompts for related requested WebMCP reads/summaries. Private-insurance comparisons are a roadmap item, not implemented.
- English-first demo presentation (spec 016), with an English / Deutsch switch retaining route and search/claim context across navigation. Header reads `GovBridge AT: OEGK (meinesv.at) demo server`. Dates, amounts, selectors and form field names retain their existing formats. Extension label matching supports both demo languages without changing production labels.

## Verified locally

- Follow-up badge correction: overview badges now show `↪ 42.00 €` as one
  non-wrapping pill in both languages; the explanation remains in a localized
  tooltip. Developer mutations use the same format. Adapter tests preserve legacy
  labelled badges and add arrow-only amounts. Combined verification passed 151
  extension tests plus 32 server tests (183 total), both typechecks/builds, package
  audit and whitespace checks. This follow-up did not add browser verification.
- Root extension/parser/UI suite: 146 tests passed after the compact-overview revision, including generated English/German server compatibility, production-language isolation, search/pending detection, sparse overview versus rich detail responses, display-only date identity stability and AJAX/UI behavior. Together with 32 server tests, 178 automated tests pass. The final combined verification also passed both typechecks, both builds, package audit and whitespace checks.
- Server suite: 32 tests passed, covering fixture counts/totals, calendar boundaries, login, tampering/expiry, cookie flags, origin rejection, body bounds, safe returns, POST/redirect searches, empty states, page bounds, detail routes, English defaults, German switching, context propagation, language validation, natural claim presentation, richer fields, unknown values and rejection of retired credentials.
- Actual HTTP smoke against localhost passed: protected redirect, login, 20 rendered rows, both native search POSTs and redirects, escaped invalid input, logout. Session cookie values were not printed or persisted.
- Compact overview revision: local HTTP smoke and 32 server tests passed. Desktop
  and mobile overview/badge layouts were checked in Chrome; no horizontal overflow
  at 390 px. Official-page inspection retained only structure and geometry (spec
  014), not claim values. No new installed-extension tool run is claimed.
- Spec 017 HTTP smoke repeated successfully with the new `peter` login. Its original overview presentation is superseded by the visually checked compact revision above; no installed-WebMCP verification is inferred from screenshots or automated tests.
- Skill discovery snippet executed against synchronous and async-array registries, including malformed-registry and missing-tool failures. Repository and installed skill/metadata copies match. Manual scenario review covered retained results searches, detail summaries, English conversation on German pages, requested reads without extra consent, and the private-insurance roadmap response.
- Chrome demo login succeeded and rendered 20 records. Native submitter `.click()` through the supported developer capability navigated from type to results with 20 records. This is a form integration check, **not** a successful WebMCP invocation.
- Chrome expired-session route and subsequent protected deep link both returned the login page with zero claim rows. Browser Back after expiry also showed login; a specific BFCache restoration is not established by that observation.
- Visual review: desktop login, search, results, reimbursed detail, explicit empty and validation layouts; mobile search at 390×844. No production screenshots or claim contents were saved. Mobile detail requires a final screenshot recheck after overflow wrapping changes. The simulator is not asserted pixel-identical to production.
- Bilingual revision: English results and the exact new header checked in Chrome at desktop and 390×844 mobile widths. English → German → English switching retained the current date-range/scenario query. Temporary viewport emulation was restored. This verifies presentation/navigation, not an installed-extension WebMCP call.
- Site typecheck and Worker build passed. Generated `dist/server/index.js` has a default object exposing `fetch`; route table includes the catch-all API handler.
- Dependency review: patched the starter's React/Vinext/Vite and Cloudflare tooling together with required peers. `npm audit` reported zero vulnerabilities after updates. Removed unused generated UI components and dependencies; this discarded only scaffold files, reproducible from the pinned initializer.
- Fixed a Chrome native-login failure caused by `Referrer-Policy: no-referrer` producing a null Origin. `same-origin` now preserves same-origin POST validation without accepting null or foreign origins.

## Current gates and deliberate deferrals

1. User requested **one extension only**: implemented and audited. Normal `dist/` includes production and exact local demo origins; do not require another development installation. Old `build:dev`/`audit:dev` commands are aliases for the same package. Stale generated `dist-dev/` was removed; it contained no source or user data and can be recreated from source if ever needed. Reload the existing unpacked extension before the installed-tool check.
2. Last live discovery on localhost found `document.modelContext` but no registered tools. Actual calls to the current four tools, mutation-driven reread, tool-based search navigation and same-document AJAX remain pending the rebuilt extension reload. No injected bridge or fixture API was used to fake this gate.
3. The user declined public publication/fixture licensing for now and requested local verification first. No Site version has been saved, no source has been pushed to Sites, and no deployment or public access change was made. The reserved project identity is persisted for reuse. Hosted origin, release ZIP/checksum, absolute hosted social metadata and anonymous judge-access verification remain deferred.
4. CC0-1.0 is only proposed for the newly invented fixture data; it has not been granted. No public repository was created.
5. Formal personal-skill validation was unavailable because PyYAML is missing. Frontmatter, paths, workflow separation and matching installed copy were checked manually.

## Reproduce

From the root: `npm run demo:verify`. Start local preview with `npm run demo:dev`.
With the preview running: `npm --prefix demo-site run test:http`.
Use only `http://localhost:4173` or `http://127.0.0.1:4173` for local extension tests.
No command in automated verification contacts MeineSV or deploys the site.
