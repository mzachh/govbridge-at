# OEGK Claim Tracker Privacy Notice

The extension reads only supported claim information already visible in the Meine SV pages opened by the user. It stores normalized claim records, minimal status history, and count-free snapshot metadata locally in `chrome.storage.local`. This data is not encrypted by the extension; a person with access to the unlocked Chrome profile may be able to inspect it.

No claim data is sent to the developer, a backend, analytics, telemetry, or any external service. The extension does not read credentials or cookies, automate forms or navigation, or download and parse documents. It does not store raw HTML, screenshots, insured-person names, bank accounts, rejection reasons, itemized billing positions, or raw application numbers.

On the four supported OEGK pages, the extension registers four read-only WebMCP proxy tools in the page's MAIN JavaScript world. A browser agent may receive normalized claim data after invoking one of them. Native WebMCP is preferred; a pinned, locally bundled compatibility runtime is used when the native API is unavailable. No data is sent to the compatibility-runtime developer or loaded from a CDN.

This PoC bridge is deliberately not an authenticated or isolated channel. Scripts running on the matched OEGK page can observe or race its request and response messages. Only the normalized result of the invoked tool crosses the bridge. The complete storage snapshot, status events, metadata, raw HTML, PDF content or links, cookies, tokens, credentials, and ID Austria data do not cross it. The storage-backed handlers remain inside the extension.

For local diagnosis, the extension writes two structural readiness labels to attributes on the supported page's root element. These labels contain only bridge state such as ready, unsupported, or failed; they contain no claim values or identifiers.

After successful WebMCP registration, the extension also adds a visually hidden semantic note containing the four static tool names and generic invocation instructions. It contains no claim inputs, outputs, values, identifiers, or credentials. It does not alter the visible layout, although assistive-technology browse modes may encounter the note.

Removing the extension removes its local extension storage according to Chrome's normal extension-removal behavior. Chrome's extension/site-data controls may also remove the local data.

This is a prototype. Automated tests use synthetic fixtures only. Production extraction is enabled solely for the documented Meine SV claim routes and fails closed when their structure is not recognized; real-account layout variants remain a live compatibility boundary.
