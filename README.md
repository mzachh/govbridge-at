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

WebMCP support is experimental. In the tested Chrome 152 build, enable
`chrome://flags/#enable-webmcp-testing` and relaunch Chrome. Then use the popup's
`WebMCP-Dashboard öffnen` button and keep that extension tab open while the
tools are needed. The dashboard reports whether all four read-only tools were
registered. The normal claim tracker does not depend on WebMCP availability.

The user performs the complete Meine SV / ID Austria login and claim query.
After login, manually open one of the documented claim pages; the extension
does not click, type, submit, navigate, or open documents on the user's behalf.
