# GovBridge AT Demo

Contract-compatible, independently authored MeineSV simulator. No production data, government identity service, database, claim persistence, or separate WebMCP implementation.

The demo defaults to English for judges. The header's English / Deutsch switch
uses `lang=en|de` and retains search, page and claim context across navigation.
It adds no language cookie or storage. Form values remain DD.MM.YYYY and EUR;
the extension accepts translated labels only on approved synthetic origins.
The header reads `GovBridge AT: OEGK (meinesv.at) demo server` in both languages.

## Local workflow

Use Node >=22.13, then `npm ci` and `npm run dev`. Open `http://localhost:4173/login` and use the public username `peter`, password `ThisIsJustADemo$`. Never enter real credentials. The fixed sample period is 2021-09-03–2026-09-02; default results contain 20 records (5 processing, 11 completed, 4 rejected).

The compact overview mirrors MeineSV: date column, provider/invoice date, applicable reimbursement badge and separate detail/document actions. Overview tools return only provider, invoice date, status and displayed reimbursement amount; richer invoice amounts, treatment periods and reimbursement dates remain on detail pages. Missing values stay unknown; no detail fetching or hidden enrichment occurs. The fictional overview date is invoice date plus two days, not a verified canonical event date. The former reimbursement-summary tool has been removed; `search_claims` remains the separate action. Claim values use invented natural-looking names; the fictional-data banner and explicit environment provenance remain. Person, bank account, social security number and claim reference are display-only and excluded from tool responses.

In the parent extension project run `npm run build && npm run audit`. Reload the existing `dist/` unpacked extension in external Chrome. This single PoC extension supports MeineSV and the exact local demo origins; there is no separate development installation. The website works manually without the extension, but only the installed extension supplies its three query tools and page-scoped search action. Agent callability requires native WebMCP or a supported CDP connection.

Run `npm run verify` for server tests/typecheck/build. With the local server running, `npm run test:http` checks real HTTP login, both native form POSTs, search redirects, escaping and logout. Parent `npm run demo:verify` also covers actual adapter/reader/search contracts and extension package audits. Tests never contact production.

`/demo/scenarios` exposes deterministic test states, including pagination, empty results, validation, malformed/hidden/loading rows and same-document AJAX. Fault controls do not modify shared fixture data. AJAX text-only intentionally remains not ready; do not automatically retry a search. Reset navigates to a fresh document.

## Implementation boundaries

Vinext's generated Worker entry delegates catch-all route requests to `server/handler.ts`; native HTML compatibility pages are not hydrated React forms. The React/shadcn launcher is separate. Exact `.xhtml` paths, labels and form inputs preserve existing extension guards. Successful native searches use POST/303/GET. Invalid submissions return HTTP 422 on the original route, preserving escaped input and recognized validation markers.

Server-side HMAC cookies last one hour, use HttpOnly/SameSite=Lax, and Secure on HTTPS. A documented fallback signing key exists only on exact loopback port 4173. Hosting requires a unique `DEMO_SESSION_SECRET` runtime secret (32+ characters); configure it in Sites, never in source or hosting metadata. This public-credential simulation is not suitable for real records. Static assets contain no claim dataset; rendered pages use no-store, and history restoration revalidates the session.

No official logos/assets are copied. Local CSS recreates measured visual properties using system-font alternatives. `fixtures/PROVENANCE.md` records independent authorship. Fixture CC0 licensing and publication are not yet approved.

## Hosting gate

The existing `.openai/hosting.json` project identity must be reused; do not create another Site. No deployment currently exists. Complete local Chrome/WebMCP verification, obtain renewed publication/license approval, configure the runtime secret, then use Sites hosting to obtain the exact assigned origin. Set that origin in the parent `config/extension-targets.json`, build/audit the release extension, add its ZIP/checksum, and publish the final version. Do not infer a hostname, grant wildcard permissions, publish the parent workspace, or claim a public URL before its access is verified.
