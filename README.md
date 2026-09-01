# OEGK Claim Tracker

A minimal, local-only Chrome extension that observes supported Wahlarzt /
Wahltherapeut claim pages the user opens in Meine SV, normalizes the visible
claim data, tracks status changes, and exposes read-only local views.

The extension never logs in, submits forms, clicks links, opens PDFs, navigates
the site, or sends claim data over the network. See [PRIVACY.md](PRIVACY.md) and
the specifications in [`specs/`](specs/).

## Development

```sh
npm install
npm run verify
```

The unpacked extension is produced in `dist/`. Load that directory from
`chrome://extensions` only after the verification command succeeds.

On each supported OEGK page, a MAIN-world WebMcpBridge registers four read-only
tools through native `document.modelContext`. If native WebMCP is unavailable,
the locally bundled, pinned `@mcp-b/webmcp-polyfill` 4.0.0 provides the same API.
The dashboard documents the architecture and contracts; it does not need to
remain open. The normal claim tracker does not depend on WebMCP availability.

### Browser-agent and CDP requirement

CDP is **not** a runtime requirement of the extension. The extension registers
its tools in the page through `document.modelContext`, and any browser agent
with native WebMCP access can discover and call them without CDP. The visible
DOM hints are only discovery and demo metadata; they are not an execution
channel.

The current Codex external-Chrome connector exposes CDP but does not expose a
dedicated `webmcp` capability. Consequently, Codex browser tests use the tab's
CDP capability to inspect `document.modelContext` and invoke the registered
tools. This requirement belongs to that connector/test path, not to OEGK Claim
Tracker or to a future WebMCP-native agent. If the connector gains native
WebMCP support, CDP can be removed from the test flow.

This is a PoC boundary, not an authenticated channel. Scripts running on the
matched OEGK page can observe or race MAIN-world bridge messages. Only one
normalized tool result crosses per invocation; storage internals, raw HTML,
PDFs, cookies, tokens, credentials, and ID Austria data do not cross.

The user performs the complete Meine SV / ID Austria login and claim query.
After login, manually open one of the documented claim pages; the extension
does not click, type, submit, navigate, or open documents on the user's behalf.
