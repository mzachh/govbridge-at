# OEGK Claim Tracker Privacy Notice

The extension reads only supported claim information already visible in the Meine SV pages opened by the user. It stores normalized claim records, minimal status history, and count-free snapshot metadata locally in `chrome.storage.local`. This data is not encrypted by the extension; a person with access to the unlocked Chrome profile may be able to inspect it.

No claim data is sent to the developer, a backend, analytics, telemetry, or any external service. The extension does not read credentials or cookies, automate forms or navigation, or download and parse documents. It does not store raw HTML, screenshots, insured-person names, bank accounts, rejection reasons, itemized billing positions, or raw application numbers.

If the user opens the extension's WebMCP dashboard and the browser supports WebMCP there, a browser agent may receive normalized claim data only after invoking one of the four registered read-only tools. The extension never bridges those tools or claim data into the Meine SV page.

Removing the extension removes its local extension storage according to Chrome's normal extension-removal behavior. Chrome's extension/site-data controls may also remove the local data.

This is a prototype. Automated tests use synthetic fixtures only. Production extraction is enabled solely for the documented Meine SV claim routes and fails closed when their structure is not recognized; real-account layout variants remain a live compatibility boundary.
