# GovBridge AT Privacy Notice

The extension reads only supported claim information already visible in the Meine SV pages opened by the user. It stores normalized claim records, minimal status history, and count-free snapshot metadata locally in `chrome.storage.local`. This data is not encrypted by the extension; a person with access to the unlocked Chrome profile may be able to inspect it.

The extension does not upload claim data to the developer, a backend, analytics, or telemetry. It does not read credentials or cookies, or download and parse documents. It does not store raw HTML, screenshots, insured-person names, bank accounts, rejection reasons, itemized billing positions, or raw application numbers. OEGK is the first supported service.

The explicitly invoked `search_claims` action fills the two date fields and clicks `Weiter` only on the recognized, selected Wahlarzt / Wahltherapeut search form. The website submits its own search request, which can navigate the tab. This does not create or submit a reimbursement claim. ID Austria login remains user-operated. The action returns a structural acknowledgement, not claims or proof of successful search.

On the four supported OEGK pages, the extension registers four read-only WebMCP proxy tools in the page's MAIN JavaScript world. The type/range page also registers the search action with `readOnlyHint: false`. A browser agent may receive normalized claim data after invoking a query tool. The GovBridge AT Codex skill obtains consent before sensitive retrieval and explains that stored observations may include claims outside the search range. Native WebMCP is preferred; a pinned, locally bundled compatibility runtime is used when the native API is unavailable. No data is sent to the compatibility-runtime developer or loaded from a CDN.

This PoC bridge is deliberately not an authenticated or isolated channel. Scripts running on the matched OEGK page can observe or race its request and response messages and invoke the bounded search action. Skill-level consent is not an extension-enforced access gate. Only normalized query inputs/results or search dates/acknowledgements cross the bridge. The complete storage snapshot, status events, metadata, raw HTML, PDF content or links, cookies, tokens, credentials, and ID Austria data do not cross it. The storage-backed handlers remain inside the extension.

For local diagnosis, the extension writes two structural readiness labels to attributes on the supported page's root element. These labels contain only bridge state such as ready, unsupported, or failed; they contain no claim values or identifiers.

After successful WebMCP registration, the extension also adds a visually hidden semantic note containing the tool names available on that route and generic invocation instructions. It contains no claim inputs, outputs, values, identifiers, or credentials. It does not alter the visible layout, although assistive-technology browse modes may encounter the note.

Claims accumulate locally across searches. An empty search does not clear earlier records. `lastSeen` records observation time, not current-query membership or freshness of every retained field. The branding change retains the legacy storage key and existing history.

Removing the extension removes its local extension storage according to Chrome's normal extension-removal behavior. Chrome's extension/site-data controls may also remove the local data.

This is a prototype. Automated tests use synthetic fixtures only. Production extraction is enabled solely for the documented Meine SV claim routes and fails closed when their structure is not recognized; real-account layout variants remain a live compatibility boundary.
