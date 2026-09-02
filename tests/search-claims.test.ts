import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchClaims, isSearchPending } from "../src/actions/search-claims.js";
import { isValidSearchInput, pageToolCatalog, SEARCH_ENTRY_PATH, SEARCH_PAGE_PATH, SEARCH_RESULTS_PATH } from "../src/webmcp/catalog.js";

const SEARCH_URL = `https://www.meinesv.at${SEARCH_PAGE_PATH}`;
const ENTRY_URL = `https://www.meinesv.at${SEARCH_ENTRY_PATH}?contentid=10007.815943`;
const RESULTS_URL = `https://www.meinesv.at${SEARCH_RESULTS_PATH}`;
const INPUT = { from: "2021-02-28", to: "2026-02-28" };

function fixture(url = SEARCH_URL): Document {
  const page = document.implementation.createHTMLDocument("Synthetic search fixture");
  Object.defineProperty(page, "URL", { configurable: true, get: () => url });
  Object.defineProperty(page, "baseURI", { configurable: true, get: () => url });
  Object.defineProperty(page, "defaultView", { configurable: true, get: () => window });
  page.body.innerHTML = `<h1>Einreichungen abfragen</h1>
    <form id="generated:vsinfoForm" method="post" action="${SEARCH_PAGE_PATH}">
      <a role="tab" aria-selected="true">Wahlarzt / Wahltherapeut</a>
      <input id="vonDatWAH" name="vonDatWAH" value="old-from">
      <input id="bisDatWAH" name="bisDatWAH" value="old-to">
      <input type="hidden" name="jakarta.faces.ViewState" value="synthetic-do-not-read">
      <input id="generated:search" type="submit" value="Weiter">
    </form>`;
  return page;
}

function resultsFixture(): Document {
  const page = document.implementation.createHTMLDocument("Synthetic results fixture");
  Object.defineProperty(page, "URL", { configurable: true, get: () => RESULTS_URL });
  Object.defineProperty(page, "baseURI", { configurable: true, get: () => RESULTS_URL });
  Object.defineProperty(page, "defaultView", { configurable: true, get: () => window });
  page.body.innerHTML = `<h1>Liste der Einreichungen</h1>
    <form id="generated:vsinfoForm" method="post" action="${SEARCH_RESULTS_PATH}">
      <input id="vonDat" name="vonDat" placeholder="TT.MM.JJJJ" value="old-from">
      <input id="bisDat" name="bisDat" placeholder="TT.MM.JJJJ" value="old-to">
      <input id="generated:search" type="submit" value="OK">
    </form>`;
  return page;
}

function controls(page: Document) {
  return {
    form: page.querySelector("form")!,
    from: page.querySelector<HTMLInputElement>("#vonDatWAH")!,
    to: page.querySelector<HTMLInputElement>("#bisDatWAH")!,
    submitter: page.querySelector<HTMLInputElement>('input[type="submit"]')!,
    tab: page.querySelector<HTMLElement>('[role="tab"]')!,
  };
}

beforeEach(() => {
  // jsdom has no layout; model visible fixture boxes while still exercising CSS/hidden checks.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("GovBridge closed search dates and page catalog", () => {
  it.each([
    null, [], {}, { ...INPUT, extra: true }, { from: 2021, to: "2026-01-01" },
    { from: "2026-1-01", to: "2026-01-01" }, { from: "0000-01-01", to: "0001-01-01" },
    { from: "2025-02-29", to: "2026-01-01" }, { from: "2024-04-31", to: "2026-01-01" },
    { from: "2026-00-01", to: "2026-01-01" }, { from: "2026-13-01", to: "2026-01-01" },
    { from: "2026-01-00", to: "2026-01-01" }, { from: "2026-01-02", to: "2026-01-01" },
    { from: "2020-02-29", to: "2025-03-01" }, { from: "2021-01-01", to: "2026-01-02" },
    { from: "1900-02-29", to: "1900-03-01" },
  ])("rejects invalid, impossible, reversed or overlong bounds: %j", (input) => {
    expect(isValidSearchInput(input)).toBe(false);
  });

  it.each([
    { from: "2026-01-01", to: "2026-01-01" },
    { from: "2020-02-29", to: "2025-02-28" },
    { from: "2023-03-01", to: "2028-03-01" },
    { from: "2000-02-29", to: "2005-02-28" },
    { from: "9999-12-31", to: "9999-12-31" },
    INPUT,
  ])("accepts inclusive calendar bounds and clamped fifth anniversary: %j", (input) => {
    expect(isValidSearchInput(input)).toBe(true);
  });

  it("adds the mutating action on the query, entry, and results routes", () => {
    expect(pageToolCatalog(SEARCH_URL).map(({ name }) => name)).toHaveLength(5);
    expect(pageToolCatalog(`${SEARCH_URL}?synthetic=1`).at(-1)?.name).toBe("search_claims");
    expect(pageToolCatalog(ENTRY_URL).at(-1)?.name).toBe("search_claims");
    expect(pageToolCatalog(`${ENTRY_URL}&portal=other`).at(-1)?.name).toBe("search_claims");
    expect(pageToolCatalog(RESULTS_URL).at(-1)?.name).toBe("search_claims");
    for (const url of [undefined, SEARCH_URL.replace("https:", "http:"), SEARCH_URL.replace("www.meinesv.at", "evil.invalid"),
      SEARCH_URL.replace("einreichungTyp", "einreichungDetailOA"), `${SEARCH_URL}/extra`,
      "https://www.meinesv.at/vsInfo/views/KE/?contentid=other"] ) {
      expect(pageToolCatalog(url)).toHaveLength(4);
    }
  });
});

describe("GovBridge isolated form preflight", () => {
  it.each([
    ["wrong origin", "https://evil.invalid/vsInfo/views/KE/einreichungTyp.xhtml", "UNSUPPORTED_PAGE"],
    ["results route without form", "https://www.meinesv.at/vsInfo/views/KE/einreichungListe.xhtml", "FORM_UNAVAILABLE"],
    ["HTTP", SEARCH_URL.replace("https:", "http:"), "UNSUPPORTED_PAGE"],
  ])("rejects %s without mutation", async (_name, url, code) => {
    const page = fixture(url);
    const click = vi.spyOn(controls(page).submitter, "click").mockImplementation(() => undefined);
    expect(await searchClaims(page, INPUT)).toMatchObject({ ok: false, error: { code } });
    expect(controls(page).from.value).toBe("old-from");
    expect(click).not.toHaveBeenCalled();
  });

  it("fills and dispatches the retained results-page date form once", async () => {
    const page = resultsFixture();
    const submitter = page.querySelector<HTMLInputElement>('input[type="submit"]')!;
    const click = vi.spyOn(submitter, "click").mockImplementation(() => undefined);
    const from = page.querySelector<HTMLInputElement>("#vonDat")!;
    const to = page.querySelector<HTMLInputElement>("#bisDat")!;
    const inputEvents: string[] = [];
    from.addEventListener("input", () => inputEvents.push("from:input"));
    from.addEventListener("change", () => inputEvents.push("from:change"));
    to.addEventListener("input", () => inputEvents.push("to:input"));
    to.addEventListener("change", () => inputEvents.push("to:change"));

    expect(await searchClaims(page, INPUT)).toEqual({ ok: true, data: { status: "submission_requested" } });
    expect(from.value).toBe("28.02.2021");
    expect(to.value).toBe("28.02.2026");
    expect(inputEvents).toEqual(["from:input", "from:change", "to:input", "to:change"]);
    expect(click).toHaveBeenCalledOnce();
  });

  const invalidForms: [string, (page: Document) => void][] = [
    ["wrong heading", (page) => { page.querySelector("h1")!.textContent = "Other service"; }],
    ["hidden heading", (page) => { page.querySelector("h1")!.hidden = true; }],
    ["duplicate heading", (page) => { page.body.append(page.querySelector("h1")!.cloneNode(true)); }],
    ["inactive tab", (page) => { controls(page).tab.setAttribute("aria-selected", "false"); }],
    ["unknown tab selection", (page) => { controls(page).tab.removeAttribute("aria-selected"); }],
    ["wrong tab", (page) => { controls(page).tab.textContent = "Zahnarzt"; }],
    ["duplicate tab", (page) => { controls(page).form.append(controls(page).tab.cloneNode(true)); }],
    ["another active tab", (page) => { const tab = controls(page).tab.cloneNode(true) as HTMLElement; tab.textContent = "Other"; controls(page).form.append(tab); }],
    ["hidden form", (page) => { controls(page).form.style.display = "none"; }],
    ["wrong method", (page) => { controls(page).form.method = "get"; }],
    ["missing method", (page) => { controls(page).form.removeAttribute("method"); }],
    ["external action", (page) => { controls(page).form.action = "https://evil.invalid/search"; }],
    ["wrong action path", (page) => { controls(page).form.action = "/vsInfo/views/KE/submit.xhtml"; }],
    ["new tab", (page) => { controls(page).form.target = "_blank"; }],
    ["named target", (page) => { controls(page).form.target = "other"; }],
    ["base target", (page) => { page.head.innerHTML = '<base target="_blank">'; }],
    ["submit override destination", (page) => { controls(page).submitter.setAttribute("formaction", "https://evil.invalid"); }],
    ["submit override method", (page) => { controls(page).submitter.setAttribute("formmethod", "get"); }],
    ["submit override target", (page) => { controls(page).submitter.setAttribute("formtarget", "_top"); }],
    ["duplicate date", (page) => { controls(page).form.append(controls(page).from.cloneNode(true)); }],
    ["duplicate date name", (page) => { const duplicate = page.createElement("input"); duplicate.name = "vonDatWAH"; controls(page).form.append(duplicate); }],
    ["mismatched date name", (page) => { controls(page).from.name = "other"; }],
    ["readonly date", (page) => { controls(page).from.readOnly = true; }],
    ["disabled date", (page) => { controls(page).to.disabled = true; }],
    ["hidden date", (page) => { controls(page).from.hidden = true; }],
    ["invisible date", (page) => { controls(page).from.style.visibility = "hidden"; }],
    ["zero-area date", (page) => { vi.spyOn(controls(page).from, "getClientRects").mockReturnValue({ length: 0 } as DOMRectList); }],
    ["hidden date type", (page) => { controls(page).from.type = "hidden"; }],
    ["foreign date owner", (page) => { controls(page).to.setAttribute("form", "missing"); }],
    ["disabled fieldset", (page) => { const fieldset = page.createElement("fieldset"); fieldset.disabled = true; controls(page).form.append(fieldset); fieldset.append(controls(page).from); }],
    ["disabled submit", (page) => { controls(page).submitter.disabled = true; }],
    ["hidden submit", (page) => { controls(page).submitter.hidden = true; }],
    ["duplicate submit", (page) => { controls(page).form.append(controls(page).submitter.cloneNode(true)); }],
    ["foreign submit owner", (page) => { controls(page).submitter.setAttribute("form", "missing"); }],
  ];
  it.each(invalidForms)("rejects %s before changing dates", async (_name, mutate) => {
    const page = fixture();
    const { from, to, submitter } = controls(page);
    const click = vi.spyOn(submitter, "click").mockImplementation(() => undefined);
    mutate(page);
    expect(await searchClaims(page, INPUT)).toMatchObject({ ok: false, error: { code: "FORM_UNAVAILABLE" } });
    expect(from.value).toBe("old-from");
    expect(to.value).toBe("old-to");
    expect(click).not.toHaveBeenCalled();
  });

  it("rejects invalid dates before mutation", async () => {
    const page = fixture();
    expect(await searchClaims(page, { ...INPUT, from: "impossible" })).toMatchObject({ error: { code: "INVALID_INPUT" } });
    expect(controls(page).from.value).toBe("old-from");
  });
});

describe("GovBridge one-shot native-value and JSF dispatch", () => {
  it("uses native setters, bubbling input/change events and one existing click without reading secrets", async () => {
    const page = fixture();
    const { from, to, submitter, form } = controls(page);
    const ownSetter = vi.fn();
    const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
    Object.defineProperty(from, "value", { get() { return nativeValue.get!.call(from); }, set: ownSetter });
    const hidden = page.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    Object.defineProperty(hidden, "value", { get() { throw new Error("hidden secret must never be read"); } });
    const events: string[] = [];
    for (const event of ["input", "change"]) form.addEventListener(event, (value) => {
      events.push(`${(value.target as HTMLInputElement).id}:${event}`);
    });
    const click = vi.spyOn(submitter, "click").mockImplementation(() => {
      expect(isSearchPending(page)).toBe(true);
      expect(from.value).toBe("28.02.2021");
      expect(to.value).toBe("28.02.2026");
    });
    expect(await searchClaims(page, INPUT)).toEqual({ ok: true, data: { status: "submission_requested" } });
    expect(events).toEqual(["vonDatWAH:input", "vonDatWAH:change", "bisDatWAH:input", "bisDatWAH:change"]);
    expect(ownSetter).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledOnce();
    expect(await searchClaims(page, INPUT)).toMatchObject({ error: { code: "SEARCH_IN_PROGRESS" } });
    expect(click).toHaveBeenCalledOnce();
  });

  it("preserves a site's existing click handler and keeps document locks independent", async () => {
    for (const page of [fixture(), fixture()]) {
      const jsfHandler = vi.fn((event: Event) => { event.preventDefault(); });
      controls(page).submitter.addEventListener("click", jsfHandler);
      expect(await searchClaims(page, INPUT)).toMatchObject({ ok: true });
      expect(jsfHandler).toHaveBeenCalledOnce();
    }
  });

  it.each(["destination", "replace", "value"])("revalidates after site change events: %s", async (change) => {
    const page = fixture();
    const { from, to, form, submitter } = controls(page);
    const click = vi.spyOn(submitter, "click").mockImplementation(() => undefined);
    from.addEventListener("change", () => {
      if (change === "destination") form.action = "https://evil.invalid";
      if (change === "replace") to.replaceWith(to.cloneNode(true));
      if (change === "value") from.value = "01.01.1900";
    });
    expect(await searchClaims(page, INPUT)).toMatchObject({ error: { code: "FORM_UNAVAILABLE" } });
    expect(click).not.toHaveBeenCalled();
    if (change !== "value") expect(to.value).toBe("old-to");
  });

  it("prevents reentrant dispatch from change handlers", async () => {
    const page = fixture();
    let duplicate: Promise<unknown> | undefined;
    controls(page).from.addEventListener("change", () => { duplicate = searchClaims(page, INPUT); });
    const click = vi.spyOn(controls(page).submitter, "click").mockImplementation(() => undefined);
    await searchClaims(page, INPUT);
    await expect(duplicate).resolves.toMatchObject({ error: { code: "SEARCH_IN_PROGRESS" } });
    expect(click).toHaveBeenCalledOnce();
  });

  it("redacts thrown errors and never retries an uncertain click", async () => {
    const page = fixture();
    const click = vi.spyOn(controls(page).submitter, "click").mockImplementation(() => { throw new Error("sensitive page text"); });
    const result = await searchClaims(page, INPUT);
    expect(result).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(result)).not.toContain("sensitive page text");
    expect(await searchClaims(page, INPUT)).toMatchObject({ error: { code: "SEARCH_IN_PROGRESS" } });
    expect(click).toHaveBeenCalledOnce();
  });
});
