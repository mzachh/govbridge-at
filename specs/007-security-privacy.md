# Security and Privacy

## Purpose

Define mandatory security, privacy, permission, and trust boundaries for OEGK
Claim Tracker. This specification is authoritative for the future
`PRIVACY.md`.

## Scope

These requirements apply to the extension manifest, content script, adapter,
tracking, storage, popup, debug behavior, build artifacts, dependencies, tests,
and WebMCP integration.

## Non-goals

- Providing end-to-end encryption beyond protections offered by the local
  Chrome profile and operating system.
- Protecting data from a person who controls the unlocked browser profile or a
  separately installed malicious extension with sufficient permissions.
- Security assessment of Meine OEGK or ID Austria.
- Collecting security telemetry.

## Functional requirements

### OEGK-SEC-001 — Local-only architecture

The product shall have no backend, analytics, telemetry, crash reporting,
external AI API, cloud sync, webhook, or claim-data network transmission. All
claim processing and persistence occur inside the user's browser.

The observed Meine SV host page contains its own tracking/consent machinery;
that third-party page behavior is outside the extension's control. The extension
shall neither integrate with it nor add claim data to the page's analytics. A
security test must distinguish host-page requests from extension-initiated
requests.

### OEGK-SEC-002 — Read-only behavior

The extension shall only read already-rendered information from a confirmed
claims page. It shall not click, submit, edit, upload, download, acknowledge,
approve, reject, withdraw, navigate, or call OEGK application endpoints.

### OEGK-SEC-003 — Authentication boundary

The extension shall never access or automate ID Austria authentication flows.
It shall not inspect login forms, credential fields, authentication frames,
cookies, authorization headers, tokens, session identifiers, or OEGK-owned web
storage. Authentication artifacts shall never be stored or logged.

### OEGK-SEC-004 — Minimum permissions

The future manifest shall request only permissions proven necessary by the
implemented specs. Anticipated milestone-one permission is `storage`.
`tabs`, `activeTab`, `webRequest`, `cookies`, `identity`, `downloads`, clipboard,
history, and broad `scripting` access are prohibited unless a later spec gives a
specific, reviewed justification.

Milestone one shall declare no `host_permissions`: the extension does not fetch
OEGK resources, inspect tabs, inject programmatically, or use a host-requiring
API. Chrome ignores the path part of `host_permissions`, so declaring
`https://www.meinesv.at/vsInfo/views/KE/*` there would effectively grant the
whole `https://www.meinesv.at` origin and would be broader than required.

The static isolated-world content script shall instead use
`content_scripts.matches: ["https://www.meinesv.at/vsInfo/views/KE/*"]`, where
path matching is applicable, plus the runtime origin/path/landmark gate in
`002-oegk-adapter.md`. `all_frames` and `match_origin_as_fallback` remain false.
Wildcards covering other Meine SV paths, subdomains, all HTTPS sites, or ID
Austria are prohibited. This rule follows Chrome's official match-pattern
contract, which states that paths are required but ignored for host
permissions: <https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns>.

### OEGK-SEC-005 — No remote code or assets

All executable code, styles, fonts, images, and dependencies required at runtime
shall ship in the extension package. No remote scripts, dynamic remote module
imports, `eval`, `new Function`, or remotely hosted assets are allowed. The MV3
content security policy shall remain at least as strict as Chrome's default and
shall not enable unsafe evaluation.

The extension-owned WebMCP dashboard uses `cross_origin_opener_policy:
same-origin` and `cross_origin_embedder_policy: require-corp` so its document is
origin-keyed and cannot use `document.domain`. Because all dashboard resources
are local, this isolation adds no external resource dependency.

### OEGK-SEC-006 — Data minimization

Only the canonical claim fields, minimal change events, and version metadata in
the specs may be persisted. Raw HTML, DOM snapshots, PDFs, screenshots,
documents, response bodies, page text dumps, and debugging payloads shall not be
stored.

The observed fields `Behandlung für`, destination bank account, rejection
reason, itemized billing positions, deductions, and raw application number are
excluded as specified in `001-claim-model.md`.

### OEGK-SEC-007 — Extension storage boundary

Claim data shall use extension-owned local storage and never sync storage or
OEGK-owned storage. Content-page scripts shall not receive the full stored
dataset. Messages between extension contexts shall use closed, validated
payloads and reject unknown message types/properties.

### OEGK-SEC-008 — Safe rendering

All source-derived values shall be rendered as text, not executable HTML. The
UI shall avoid `innerHTML` for claim values and shall not construct script,
style, URL, or event-handler content from page data.

### OEGK-SEC-009 — Logging and debug mode

Production builds shall not log claim data. Default-off local debug mode follows
`002-oegk-adapter.md` and may log only non-sensitive structural counts and
redacted diagnostics. It shall make no network request and persist no page data.

### OEGK-SEC-010 — WebMCP privacy boundary

WebMCP tools are read-only, operate on normalized storage, and shall not use
third-party `exposedTo` origins. They shall register only in an extension-owned
document. Normalized claims and tool handlers must not be injected into the
Meine SV main world; if the target browser requires such a bridge, integration
is blocked pending a new security specification. Tool errors and descriptions
shall not leak data. WebMCP unavailability must not cause fallback transmission
or DOM scraping.

### OEGK-SEC-011 — Dependency and build hygiene

Runtime dependencies shall be minimized and pinned by a lockfile. Build and test
tools may access development files but must not be included as remotely executed
runtime code. The packaged extension shall be inspectable and contain no secrets,
source maps with fixture secrets, remote endpoints, or undeclared files.

### OEGK-SEC-012 — Privacy notice consistency

`PRIVACY.md`, when created after specification approval, shall be derived from
this document and state in plain language:

- what claim data is read and stored;
- that storage remains in the local Chrome profile and is not extension-level
  encrypted;
- that no data is sent to the developer or external services;
- when a browser agent may receive read-only WebMCP results;
- how data can currently be removed (extension removal or browser-site/extension
  data controls); and
- the prototype's fixture/live-integration status.

It shall not promise protections or behavior absent from this specification.

## Data contracts

Permitted persisted data is exactly `StoredClaimState` from
`004-local-storage.md`. Permitted WebMCP disclosure is exactly the schemas from
`006-webmcp-tools.md`. Extension messages require a separately specified closed
union before implementation; no generic pass-through message is permitted.

## Error handling

- Security-sensitive uncertainty fails closed: no host activation, extraction,
  storage mutation, or tool registration.
- Permission denial leaves the host page untouched and shows a generic local
  status.
- Sensitive values and stack traces are excluded from user-visible and console
  errors.
- A DOM change, invalid message, corrupt storage record, or unsupported WebMCP
  API shall not trigger a broader permission or network fallback.
- Security errors shall preserve the last valid local snapshot when safe.

## Security/privacy considerations

Claim records may reveal identity, treatment relationships, medical activity,
dates, and financial information. Local storage reduces transmission risk but
does not make the data anonymous or encrypted. The narrow host boundary,
read-only adapter, normalized data model, minimal messages, and absence of a
backend are defense-in-depth requirements, not optional implementation details.

## Acceptance criteria

- **AC-OEGK-SEC-001** (`OEGK-SEC-001`): Source, packaged artifacts, and runtime
  tests show no claim-data network path, analytics, telemetry, backend, external
  AI, or sync storage.
- **AC-OEGK-SEC-002** (`OEGK-SEC-002`, `OEGK-SEC-003`): Tests and inspection show
  no OEGK/ID Austria actions, endpoint calls, credential reads, cookie/token
  access, or authentication storage.
- **AC-OEGK-SEC-003** (`OEGK-SEC-004`): Manifest review finds `storage`, no
  `host_permissions`, the exact confirmed `content_scripts.matches` path,
  isolated world, and no prohibited broad/authentication patterns.
- **AC-OEGK-SEC-004** (`OEGK-SEC-005`): The package loads all runtime resources
  locally and contains no unsafe evaluation or remote executable/assets.
- **AC-OEGK-SEC-005** (`OEGK-SEC-006`, `OEGK-SEC-007`): Storage and message tests
  reject raw page material, unknown payload properties, and noncanonical data.
- **AC-OEGK-SEC-006** (`OEGK-SEC-008`): Adversarial provider/status fixture text
  is displayed literally and cannot create markup or execute code.
- **AC-OEGK-SEC-007** (`OEGK-SEC-009`): Production logging contains no claim
  values; debug mode is opt-in, ephemeral, redacted, and network-silent.
- **AC-OEGK-SEC-008** (`OEGK-SEC-010`): WebMCP handlers are read-only, specify no
  third-party exposure, and degrade without fallback scraping/transmission.
- **AC-OEGK-SEC-009** (`OEGK-SEC-011`): A package audit finds a lockfile, no
  embedded secrets, no remote endpoints, and only declared runtime files.
- **AC-OEGK-SEC-010** (`OEGK-SEC-012`): `PRIVACY.md` is reviewed line-by-line
  against this spec and introduces no contradictory or unsupported claim.

## Open questions

- Should site access be optional/user-granted rather than install-time static
  content-script access, and can that be achieved without adding `scripting` or
  `activeTab` permissions that broaden the prototype?
- What consent and disclosure does the target WebMCP implementation provide for
  sensitive read-only results?
- Should a user-controlled clear-data action be promoted into milestone one
  before live use?
- Is a formal threat model or extension-store privacy disclosure required for
  hackathon submission?
