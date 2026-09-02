import { isSearchPageUrl, isSearchResultsUrl, isSearchToolUrl, isValidSearchInput, SEARCH_PAGE_PATH, SEARCH_RESULTS_PATH } from "../webmcp/catalog.js";
import type { ToolErrorCode, ToolResult } from "../webmcp/types.js";
import { resolveSiteContext } from "../environment/site-context.js";
import { GERMAN_LABELS, labelsForOrigin, type OegkLabels } from "../environment/demo-labels.js";

type SearchResult = ToolResult<{ status: "submission_requested" }>;
const busyDocuments = new WeakSet<Document>();
const dispatchedDocuments = new WeakSet<Document>();
// Weak structural identities only: do not retain detached claim DOM or claim values.
const pendingDocuments = new WeakMap<Document, WeakSet<Element>>();
function labelsForPage(page: Document): OegkLabels {
  try {
    const context = resolveSiteContext(page.URL);
    return context ? labelsForOrigin(context.origin, context.origin, page.documentElement?.lang) : GERMAN_LABELS;
  } catch {
    return GERMAN_LABELS;
  }
}

function outcomeNodes(page: Document): Element[] {
  const labels = labelsForPage(page);
  const results = Array.from(page.querySelectorAll('.card_container [role="grid"], .card_container [role="row"]'));
  const alerts = Array.from(page.querySelectorAll('[role="alert"]')).filter((alert) =>
    [labels.empty, labels.invalidEntries, labels.rangeError]
      .some((message) => text(alert).includes(message)));
  return [...results, ...alerts];
}
export function isSearchPending(page: Document): boolean {
  if (busyDocuments.has(page)) return true;
  const previous = pendingDocuments.get(page);
  if (!previous) return false;
  const current = outcomeNodes(page);
  // A JSF replacement can settle a same-document search. Mere date edits cannot.
  if (current.some((node) => !previous.has(node))) {
    pendingDocuments.delete(page);
    return false;
  }
  return true;
}

function failure(code: ToolErrorCode): SearchResult {
  const messages: Partial<Record<ToolErrorCode, string>> = {
    INVALID_INPUT: "Invalid search dates.",
    UNSUPPORTED_PAGE: "Search is unavailable on this page.",
    FORM_UNAVAILABLE: "The active search form is unavailable or ambiguous.",
    SEARCH_IN_PROGRESS: "A search has already been requested in this document. Do not retry automatically.",
    INTERNAL_ERROR: "Search execution failed. Submission may be uncertain; do not retry automatically.",
  };
  return { ok: false, error: { code, message: messages[code] ?? "Search execution failed." } };
}

function text(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function visible(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view || !element.isConnected || element.getClientRects().length === 0) return false;
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.hidden || ancestor.hasAttribute("inert") || ancestor.getAttribute("aria-hidden") === "true") return false;
    const style = view.getComputedStyle(ancestor);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
  }
  return true;
}

function enabled(element: HTMLElement): boolean {
  return !element.matches(":disabled") && !element.closest('[aria-disabled="true"]');
}

function activeTab(tab: HTMLElement): boolean {
  return visible(tab) && enabled(tab) && tab.getAttribute("aria-selected") === "true";
}

interface SearchForm {
  form: HTMLFormElement;
  from: HTMLInputElement;
  to: HTMLInputElement;
  submitter: HTMLInputElement | HTMLButtonElement;
}

function safeDestination(form: HTMLFormElement, submitter: HTMLElement, pageUrl: string, expectedPath: string, expectedOrigin: string): boolean {
  const method = submitter.getAttribute("formmethod") ?? form.getAttribute("method") ?? "get";
  if (method.trim().toLowerCase() !== "post") return false;
  // Validate both the form and effective submitter destination. Do not read any hidden inputs.
  const actions = [form.getAttribute("action"), submitter.getAttribute("formaction")];
  try {
    for (const action of actions) {
      if (action === null) continue;
      const url = new URL(action || pageUrl, form.ownerDocument.baseURI);
      if (url.origin !== expectedOrigin || url.pathname !== expectedPath ||
          url.username || url.password || url.hash) return false;
    }
    if (form.getAttribute("method")?.trim().toLowerCase() !== "post") return false;
    const baseTarget = form.ownerDocument.querySelector("base[target]")?.getAttribute("target") ?? "";
    const formTarget = form.getAttribute("target") || baseTarget;
    const effectiveTarget = submitter.getAttribute("formtarget") ?? formTarget;
    return [formTarget, effectiveTarget].every((target) => target === "" || target.toLowerCase() === "_self");
  } catch {
    return false;
  }
}

function inspectForm(pageDocument: Document): SearchForm | undefined {
  const context = resolveSiteContext(pageDocument.URL);
  if (!context) return undefined;
  const labels = labelsForOrigin(context.origin, context.origin, pageDocument.documentElement?.lang);
  const typeRoute = isSearchPageUrl(pageDocument.URL) && new URL(pageDocument.URL).pathname === SEARCH_PAGE_PATH;
  const resultsRoute = isSearchResultsUrl(pageDocument.URL);
  if (!typeRoute && !resultsRoute) return undefined;
  const expectedHeading = typeRoute ? labels.typeHeading : labels.resultsHeading;
  const headings = Array.from(pageDocument.querySelectorAll<HTMLElement>("h1"))
    .filter((heading) => visible(heading) && text(heading) === expectedHeading);
  if (headings.length !== 1) return undefined;

  // IDs must be unique document-wide: duplicate or detached alternatives are ambiguous.
  const fromName = typeRoute ? "vonDatWAH" : "vonDat";
  const toName = typeRoute ? "bisDatWAH" : "bisDat";
  const fromInputs = pageDocument.querySelectorAll<HTMLInputElement>(`[id="${fromName}"], input[name="${fromName}"]`);
  const toInputs = pageDocument.querySelectorAll<HTMLInputElement>(`[id="${toName}"], input[name="${toName}"]`);
  if (fromInputs.length !== 1 || toInputs.length !== 1) return undefined;
  const from = fromInputs[0]!;
  const to = toInputs[0]!;
  if (![from, to].every((input) => input instanceof HTMLInputElement && input.type === "text" &&
      input.id === input.name && !input.readOnly && visible(input) && enabled(input))) return undefined;
  const form = from.form;
  if (!form || to.form !== form || !visible(form)) return undefined;
  if (typeRoute) {
    const tabs = Array.from(form.querySelectorAll<HTMLElement>('[role="tab"]'))
      .filter((tab) => text(tab) === labels.doctorTab);
    if (tabs.length !== 1 || !activeTab(tabs[0]!)) return undefined;
    // A second selected tab is an inconsistent/transitioning form, not a safe active form.
    if (Array.from(form.querySelectorAll<HTMLElement>('[role="tab"]'))
      .some((tab) => tab !== tabs[0] && activeTab(tab))) return undefined;
  }
  const expectedSubmitterText = typeRoute ? labels.continueSubmit : labels.resultsSubmit;
  const submitters = Array.from(pageDocument.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
    'input[type="submit" i], button[type="submit" i], button:not([type])',
  )).filter((control) => control.form === form &&
    (control instanceof HTMLInputElement ? control.value.trim() === expectedSubmitterText : text(control) === expectedSubmitterText) &&
    visible(control) && enabled(control));
  const expectedPath = typeRoute ? SEARCH_PAGE_PATH : SEARCH_RESULTS_PATH;
  if (submitters.length !== 1 || !safeDestination(form, submitters[0]!, pageDocument.URL, expectedPath, context.origin)) return undefined;
  return { form, from, to, submitter: submitters[0]! };
}

function sameForm(left: SearchForm, right: SearchForm | undefined): right is SearchForm {
  return !!right && left.form === right.form && left.from === right.from && left.to === right.to &&
    left.submitter === right.submitter;
}

function displayDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

/** ISOLATED-world action. The lock is document-scoped, including separate executor instances. */
export async function searchClaims(pageDocument: Document, input: unknown): Promise<SearchResult> {
  if (!isValidSearchInput(input)) return failure("INVALID_INPUT");
  if (!isSearchToolUrl(pageDocument.URL)) {
    return failure("UNSUPPORTED_PAGE");
  }
  if (busyDocuments.has(pageDocument) || dispatchedDocuments.has(pageDocument)) return failure("SEARCH_IN_PROGRESS");
  busyDocuments.add(pageDocument);
  try {
    const controls = inspectForm(pageDocument);
    if (!controls) return failure("FORM_UNAVAILABLE");
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setValue) return failure("FORM_UNAVAILABLE");
    const from = displayDate(input.from);
    const to = displayDate(input.to);
    for (const [control, value] of [[controls.from, from], [controls.to, to]] as const) {
      // Site change handlers may synchronously replace controls or change the active destination.
      if (!sameForm(controls, inspectForm(pageDocument))) return failure("FORM_UNAVAILABLE");
      setValue.call(control, value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (!sameForm(controls, inspectForm(pageDocument)) || controls.from.value !== from || controls.to.value !== to) {
      return failure("FORM_UNAVAILABLE");
    }
    pendingDocuments.set(pageDocument, new WeakSet(outcomeNodes(pageDocument)));
    dispatchedDocuments.add(pageDocument);
    controls.submitter.click();
    return { ok: true, data: { status: "submission_requested" } };
  } catch {
    return failure("INTERNAL_ERROR");
  } finally {
    busyDocuments.delete(pageDocument);
  }
}
