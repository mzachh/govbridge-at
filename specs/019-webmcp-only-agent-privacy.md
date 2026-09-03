# 019 — WebMCP-only agent reads and complete default demo reimbursements

Supersedes the skill's structural DOM preflight and page-marker inspection in
specs 011/017. The current-page scope in specs 012/018 remains unchanged.

## Data and tool contract

- Give fictional `demo-claim-017` a reimbursement amount of EUR 51.30. Default
  fixtures now have eleven known reimbursements totaling EUR 543.40; keep twenty
  claims and existing status counts. The explicit `missing-fields` scenario still
  exercises unknown amounts. These numbers are invented, not account-derived.
- `get_claim({claimId})` must include `invoiceAmount` when the currently rendered
  claim exposes a parseable invoice amount, including detail pages. Preserve the
  other allowed fields and exclude person, social security, bank, document and
  authentication data. Do not invent amounts or fetch/navigate to enrich an
  overview read. Explain unavailable fields and let the user open a detail page,
  then obtain a fresh temporary ID through WebMCP.

## Agent privacy boundary

The agent may read browser-provided tab URL/capability metadata, WebMCP tool
schemas, and normalized WebMCP outputs only. It must not read page content,
including narrow DOM markers, titles, form values, accessibility trees, HTML,
screenshots, or network response bodies. Do not scan a page and redact afterward.

Prefer native WebMCP. CDP fallback is allowed only as a transport to
`document.modelContext.getTools()` and `executeTool()` on the supported tab,
including awaiting and returning their results. It is not permission for DOM,
storage, network, credential or form access. Use ordinary browser tab URL metadata
and supported navigation outside CDP; ask the user to select the category or
finish login where needed. If those capabilities are unavailable, stop clearly.

After search, rediscover on the current document and use query envelopes and page
metadata to distinguish results, emptiness, partial data and errors. A URL or
submission acknowledgement is not proof of search success. An uncertain response
never triggers automatic resubmission. One bounded read retry is allowed for
`PAGE_NOT_READY`; otherwise ask for user confirmation without reading the page.

Explain the privacy advantage accurately: the extension parses locally and only
allowlisted fields reach the agent, unlike whole-page inspection. This is a skill
workflow restriction, not a browser/CDP sandbox or isolation from host scripts.

## Verification

Test default fixture 017 and known totals, explicit unknown-data scenarios,
`get_claim` invoice amount on detail pages, and exclusion of identity fields.
Independently review skill scenarios for missing tools, expired IDs, unavailable
amounts, login/category selection and uncertain search without DOM fallback.
