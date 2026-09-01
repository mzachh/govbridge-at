# WebMCP Bridge

## Purpose

Define the smallest refactor that publishes the existing read-only OEGK claim
tools from supported Meine SV pages through `document.modelContext`, while
preserving the extension's adapter, tracking, storage, popup, dashboard, and
tool contracts.

## Architecture

```text
Supported OEGK page
  MAIN world: WebMcpBridge + native WebMCP or local compatibility fallback
       <-> closed request/response protocol
  ISOLATED world: Content Bridge
       <-> chrome.runtime messaging
  service worker: existing storage + existing read-only tool handlers
```

The MAIN-world component registers proxy definitions only. It shall not parse
the OEGK DOM, access Chrome extension APIs, hold a ClaimStore, or receive the
complete storage snapshot. The existing isolated adapter remains the only DOM
reader. The service worker remains the only owner of storage-backed execution.

## Functional requirements

### OEGK-BRIDGE-001 — Native-first compatibility runtime

The MAIN-world entry shall use a callable native `document.modelContext` when
available. Otherwise it may initialize the locally bundled, exactly pinned
`@mcp-b/webmcp-polyfill` compatibility runtime. The fallback must not replace a
native implementation, load remote code, install its testing shim in
production, or expose an extension API on `window`.

If neither implementation becomes available, registration rejects, or the
fallback fails, WebMCP is disabled for that document. Extraction, tracking,
storage, popup, and dashboard behavior shall continue normally.

### OEGK-BRIDGE-002 — Exact page scope

The MAIN entry and isolated relay shall run only in the top frame on the four
supported HTTPS paths under `https://www.meinesv.at`:

- `/vsInfo/views/KE/einreichungTyp.xhtml`
- `/vsInfo/views/KE/einreichungListe.xhtml`
- `/vsInfo/views/KE/einreichungDetailOA.xhtml`
- `/vsInfo/views/KE/einreichungDetail.xhtml`

Both the content relay and service worker independently validate this scope.
Unsupported, authentication, and unrelated pages expose no OEGK tools.

### OEGK-BRIDGE-003 — Existing tool contracts

The MAIN world shall register exactly `list_claims`, `get_open_claims`,
`get_claim`, and `get_reimbursement_summary` with the names, descriptions,
input schemas, direct JSON envelopes, and `annotations.readOnlyHint: true`
defined in `006-webmcp-tools.md`. Definitions are static. Execution delegates
to the existing background handlers and never parses or refreshes the page.

### OEGK-BRIDGE-004 — Closed page protocol

Communication across JavaScript worlds shall use same-window messages with a
constant protocol identifier and version. A request contains exactly:

```ts
{
  protocol: "oegk-claim-tracker.webmcp";
  version: 1;
  direction: "request";
  requestId: string;
  tool: "list_claims" | "get_open_claims" | "get_claim" |
        "get_reimbursement_summary";
  input: object;
}
```

A response contains the same protocol, version, request ID, direction
`"response"`, and exactly one validated `ToolResult` envelope. Receivers shall
validate the current window, exact origin, supported path, plain-object shape,
exact keys, request-ID bounds, tool allowlist, and tool-specific input before
acting. Duplicate in-flight request IDs are ignored. MAIN requests time out and
are removed on cancellation or document disposal.

The protocol is not a generic message tunnel: it cannot choose a Chrome API,
storage key, URL, method, handler, or arbitrary operation.

For local PoC diagnosis, the MAIN and ISOLATED entries may publish structural
status only in `data-oegk-webmcp-bridge` and `data-oegk-content-bridge` on the
root element. Values are limited to readiness/runtime/error labels and must
never contain claim data, inputs, IDs, URLs, credentials, or error details.
The static `data-oegk-webmcp-build` marker may identify the local PoC build so
live verification can distinguish an outdated unpacked extension.

After successful registration, the MAIN entry shall add one visually hidden
semantic note that lists the four static tool names and explains how a compatible
agent can use `document.modelContext.getTools()` and `executeTool(...)`. The note
must contain no claim data, inputs, outputs, identifiers, runtime errors, or
credentials; it must not change visible layout or accept interaction. It is
removed with the document-lifetime registration.

### OEGK-BRIDGE-005 — Data minimization

Only one invoked tool's normalized result may cross into MAIN. The bridge shall
never carry cookies, tokens, credentials, ID Austria data, raw HTML, DOM nodes,
screenshots, PDF bytes or URLs, raw application numbers, internal events,
storage metadata, stack traces, or arbitrary extension state. Structural
errors use the existing redacted error vocabulary.

### OEGK-BRIDGE-006 — Lifecycle and concurrency

Registration uses one document-lifetime `AbortController`, is idempotent per
document, and performs no retry loop. Requests are correlated by unpredictable
IDs and support concurrent out-of-order responses. A BFCache-preserved page
keeps the bridge alive; final page disposal aborts registrations, removes
listeners, and rejects pending requests without leaking their inputs. Runtime
invocation cancellation is best-effort: native clients may supply a signal, but
polyfill 4.0.0 can cancel the outer invocation without cancelling an already
dispatched, read-only bridge request.

### OEGK-BRIDGE-007 — Threat boundary

MAIN-world code and cross-world messages are visible to scripts executing on
the matched OEGK origin. Request IDs provide correlation, not authentication;
the host page could observe or race bridge traffic. This accepted prototype
boundary is limited by exact origin/path checks, read-only tools, strict
schemas, per-call disclosure, and the absence of privileged operations. It must
be disclosed in `PRIVACY.md` and must not be described as isolation from OEGK.

### OEGK-BRIDGE-008 — Dashboard role

The dashboard remains a presentation and aggregate-status view. It documents
the MAIN -> ISOLATED -> service-worker architecture and exact tool contracts,
but no longer owns or duplicates WebMCP registration.

## Verification

Automated tests shall cover native registration, compatibility fallback,
complete unavailability, partial registration rejection, idempotent disposal,
valid request/response correlation, concurrent out-of-order responses,
cancellation where provided, BFCache/final disposal, timeout, malformed and duplicate frames, unsupported tools,
invalid tool inputs, invalid senders, and the unchanged behavior of all four
existing handlers. Package checks shall prove the fallback is local and pinned,
only expected artifacts ship, and prohibited network or unsafe-evaluation
constructs are absent.

A final manual test shall be performed only after the user logs in and opens a
supported OEGK page. It shall verify tool discovery and read-only execution
without recording personal values in source, logs, screenshots, or reports.

## Minimal file-level change

- Add a shared static tool catalog and closed bridge protocol.
- Add one MAIN-world WebMCP entry and one ISOLATED relay entry.
- Add `webmcp.execute` to the service worker's closed request union.
- Reuse the existing storage-backed tool handlers unchanged in behavior.
- Bundle and pin `@mcp-b/webmcp-polyfill`; ship its license notice.
- Remove extension-dashboard registration after page registration is verified.
- Update manifest, build allowlist, privacy text, dashboard copy, tests, and
  implementation report; do not change the OEGK adapter or tracker.
