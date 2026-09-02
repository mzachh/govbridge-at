# 016 — English-first bilingual demo

The fake server defaults to English for judges, with an always-visible English / Deutsch switch. The header text is exactly `GovBridge AT: OEGK (meinesv.at) demo server` in both languages. This updates spec 013's German-only presentation requirement; it does not rename the extension or alter production MeineSV.

Language is an explicit, validated `lang=en|de` URL parameter, defaulting to `en`. Preserve it across login/logout, redirects, search POSTs, detail/back/pagination links and scenarios. Switching language navigates to the same route with its validated search/claim context; no cookie or local storage is added. Inputs keep DD.MM.YYYY date values and EUR formatting; English placeholders explain this format.

Localize server-rendered visible text and accessible labels, including synthetic provider specialties, alerts, developer controls and runtime AJAX messages. Do not hide duplicate German claim content or provide a second WebMCP implementation. Stable DOM selectors and route/form contracts remain unchanged. The extension accepts a finite set of English semantic labels only on configured synthetic origins; production remains German-only. Language navigation produces a new document, so temporary claim IDs must be obtained again.

Verify English defaults, German switch state, auth/search/detail/pagination propagation, unknown-language rejection, HTML escaping, and adapter/search behavior in both languages. Keep the existing single dist/ extension. Publication remains deferred by the user.
