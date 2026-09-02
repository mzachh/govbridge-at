import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchClaims, isSearchPending } from "../src/actions/search-claims.js";
import { OegkAdapter } from "../src/adapter/oegk.js";
import {
  ENGLISH_LABELS,
  GERMAN_LABELS,
  labelsForOrigin,
} from "../src/environment/demo-labels.js";
import { PRODUCTION_ORIGIN } from "../src/environment/site-context.js";
import { SEARCH_PAGE_PATH, SEARCH_RESULTS_PATH } from "../src/webmcp/catalog.js";

const DEV_ORIGIN = "http://localhost:4173";
const TYPE_PATH = "/vsInfo/views/KE/einreichungTyp.xhtml";
const DETAIL_PATH = "/vsInfo/views/KE/einreichungDetailOA.xhtml";

function documentFor(markup: string, pathname: string, origin = DEV_ORIGIN, language?: "en" | "de"): Document {
  const page = new DOMParser().parseFromString(markup, "text/html");
  if (language) page.documentElement.lang = language;
  const url = `${origin}${pathname}`;
  Object.defineProperty(page, "URL", { configurable: true, value: url });
  Object.defineProperty(page, "baseURI", { configurable: true, value: url });
  Object.defineProperty(page, "defaultView", { configurable: true, value: window });
  return page;
}

function adapter(page: Document, pathname: string, origin = DEV_ORIGIN): OegkAdapter {
  return new OegkAdapter({
    document: page,
    location: { origin, pathname },
    expectedOrigin: origin,
  });
}

function searchForm(language: "en" | "de" = "en", origin = DEV_ORIGIN): Document {
  const labels = language === "en"
    ? { heading: "Search claims", tab: "Private doctor / therapist", placeholder: "DD.MM.YYYY", submit: "Continue" }
    : { heading: "Einreichungen abfragen", tab: "Wahlarzt / Wahltherapeut", placeholder: "TT.MM.JJJJ", submit: "Weiter" };
  const page = documentFor(`<h1>Search claims</h1>
    <form method="post" action="${SEARCH_PAGE_PATH}">
      <a role="tab" aria-selected="true">${labels.tab}</a>
      <input id="vonDatWAH" name="vonDatWAH" placeholder="${labels.placeholder}" value="old-from">
      <input id="bisDatWAH" name="bisDatWAH" placeholder="${labels.placeholder}" value="old-to">
      <input id="search" type="submit" value="${labels.submit}">
    </form>`, TYPE_PATH, origin, language);
  page.querySelector("h1")!.textContent = labels.heading;
  return page;
}

beforeEach(() => {
  // jsdom has no layout; model visible fixture boxes while exercising hidden checks.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
});

afterEach(() => vi.restoreAllMocks());

describe("bounded synthetic English labels", () => {
  it("selects English only for an approved non-production origin", () => {
    expect(labelsForOrigin(DEV_ORIGIN, DEV_ORIGIN, "en")).toBe(ENGLISH_LABELS);
    expect(labelsForOrigin(DEV_ORIGIN, DEV_ORIGIN, "de")).toBe(GERMAN_LABELS);
    expect(labelsForOrigin(DEV_ORIGIN, DEV_ORIGIN)).toBe(GERMAN_LABELS);
    expect(labelsForOrigin(PRODUCTION_ORIGIN, PRODUCTION_ORIGIN, "en")).toBe(GERMAN_LABELS);
    expect(labelsForOrigin(DEV_ORIGIN, PRODUCTION_ORIGIN, "en")).toBe(GERMAN_LABELS);
    expect(labelsForOrigin("https://evil.invalid", "https://evil.invalid", "en")).toBe(GERMAN_LABELS);
  });

  it("extracts English type, list, and detail pages with the existing DOM contract", async () => {
    const type = documentFor(`<h1>Search claims</h1><form method="post">
      <a role="tab" aria-selected="true">Private doctor / therapist</a>
      <input id="vonDatWAH" name="vonDatWAH" placeholder="DD.MM.YYYY">
      <input id="bisDatWAH" name="bisDatWAH" placeholder="DD.MM.YYYY">
      <input type="submit" value="Continue"></form>`, TYPE_PATH, DEV_ORIGIN, "en");
    expect(adapter(type, TYPE_PATH).canHandlePage()).toBe(true);
    expect(await adapter(type, TYPE_PATH).extractClaims()).toMatchObject({
      state: "complete", pageKind: "type-range",
    });

    const list = documentFor(`<h1>Claims</h1>
      <input id="vonDat" value="01.01.2026"><input id="bisDat" value="31.12.2026">
      <section class="card_container"><div class="card_title"><h2>Open claims</h2></div>
        <div role="grid" class="card_content"><div role="row"><div class="cb_title"><h4>Practice Alpha</h4> Invoice dated 14.08.2026</div></div></div>
      </section><section class="card_container"><div class="card_title"><h2>Rejected claims</h2></div>
        <div role="grid" class="card_content"><div role="row"><div class="cb_title">Invoice dated 15.08.2026</div></div></div>
      </section><section class="card_container"><div class="card_title"><h2>Reimbursed claims</h2></div>
        <div role="grid" class="card_content"><div role="row"><div class="cb_title"><h4>Practice Beta</h4> Invoice dated 16.08.2026</div><div class="cb_status"><span class="badge">Reimbursement: 94,20 €</span></div></div></div>
      </section>`, SEARCH_RESULTS_PATH, DEV_ORIGIN, "en");
    await expect(adapter(list, SEARCH_RESULTS_PATH).extractClaims()).resolves.toMatchObject({
      state: "complete", pageKind: "results", diagnostics: { candidateCount: 3, skippedCount: 0 },
      observations: [
        { status: "processing", provider: "Practice Alpha", invoiceDate: "2026-08-14" },
        { status: "rejected", invoiceDate: "2026-08-15" },
        { status: "completed", provider: "Practice Beta", invoiceDate: "2026-08-16", reimbursementAmount: 94.2 },
      ],
    });

    const detail = documentFor(`<h1>Claim details</h1><table>
      <tr><th>Provider:</th><td>Practice Gamma</td></tr>
      <tr><th>Invoice amount:</th><td>200,00 €</td></tr>
      <tr><th>Treatment from:</th><td>01.08.2026</td></tr>
      <tr><th>Reason for rejection:</th><td>synthetic test reason</td></tr>
    </table>`, DETAIL_PATH, DEV_ORIGIN, "en");
    await expect(adapter(detail, DETAIL_PATH).extractClaims()).resolves.toMatchObject({
      state: "complete", pageKind: "open-rejected-detail",
      observations: [{ status: "rejected", provider: "Practice Gamma", invoiceAmount: 200, treatmentDate: "2026-08-01" }],
    });
  });

  it("keeps English pages unsupported on production, including error and empty text", async () => {
    const page = documentFor(`<h1>Search claims</h1><form method="post">
      <a role="tab" aria-selected="true">Private doctor / therapist</a>
      <input id="vonDatWAH" name="vonDatWAH" placeholder="DD.MM.YYYY"><input id="bisDatWAH" name="bisDatWAH" placeholder="DD.MM.YYYY">
      <input type="submit" value="Continue"></form>`, TYPE_PATH, PRODUCTION_ORIGIN, "en");
    const productionAdapter = adapter(page, TYPE_PATH, PRODUCTION_ORIGIN);
    expect(productionAdapter.canHandlePage()).toBe(false);
    await expect(productionAdapter.extractClaims()).resolves.toMatchObject({ state: "unsupported" });
    await expect(searchClaims(page, { from: "2021-01-01", to: "2026-01-01" })).resolves.toMatchObject({
      ok: false, error: { code: "FORM_UNAVAILABLE" },
    });
  });

  it("recognizes English pending alerts only on the approved synthetic origin", async () => {
    const page = searchForm("en");
    const submitter = page.querySelector<HTMLInputElement>("input[type=submit]")!;
    vi.spyOn(submitter, "click").mockImplementation(() => undefined);
    page.body.insertAdjacentHTML("beforeend", '<div id="infolist" role="alert">No reimbursement or online claim was found for this date range.</div>');
    await expect(searchClaims(page, { from: "2021-01-01", to: "2026-01-01" })).resolves.toMatchObject({ ok: true });
    expect(isSearchPending(page)).toBe(true);
    page.querySelector("#infolist")!.replaceWith(page.querySelector("#infolist")!.cloneNode(true));
    expect(isSearchPending(page)).toBe(false);

    const production = searchForm("en", PRODUCTION_ORIGIN);
    const productionSubmitter = production.querySelector<HTMLInputElement>("input[type=submit]")!;
    vi.spyOn(productionSubmitter, "click").mockImplementation(() => undefined);
    production.body.insertAdjacentHTML("beforeend", '<div id="infolist" role="alert">No reimbursement or online claim was found for this date range.</div>');
    expect(await searchClaims(production, { from: "2021-01-01", to: "2026-01-01" })).toMatchObject({
      ok: false, error: { code: "FORM_UNAVAILABLE" },
    });
  });

  it("retains generic loading detection for English synthetic results", async () => {
    const loading = documentFor(`<h1>Claims</h1><div role="progressbar" aria-label="Loading"></div>`, SEARCH_RESULTS_PATH, DEV_ORIGIN, "en");
    await expect(adapter(loading, SEARCH_RESULTS_PATH).extractClaims()).resolves.toMatchObject({ state: "loading" });
  });

  it("keeps the German synthetic presentation fully supported", async () => {
    const search = searchForm("de");
    const submitter = search.querySelector<HTMLInputElement>("input[type=submit]")!;
    vi.spyOn(submitter, "click").mockImplementation(() => undefined);
    await expect(searchClaims(search, { from: "2021-01-01", to: "2026-01-01" })).resolves.toMatchObject({ ok: true });

    const empty = documentFor(`<h1>Liste der Einreichungen</h1>
      <div id="infolist" class="infobox yellow" role="alert">In diesem Abfragezeitraum wurde keine Kostenerstattung bzw. kein Onlineantrag gefunden.</div>`, SEARCH_RESULTS_PATH, DEV_ORIGIN, "de");
    await expect(adapter(empty, SEARCH_RESULTS_PATH).extractClaims()).resolves.toMatchObject({ state: "empty" });

    const detail = documentFor(`<h1>Einreichung Detail</h1><table>
      <tr><th>Behandler:</th><td>Praxis German</td></tr><tr><th>Rechnungsbetrag:</th><td>100,00 €</td></tr>
      <tr><th>Behandlung ab:</th><td>01.08.2026</td></tr></table>`, DETAIL_PATH, DEV_ORIGIN, "de");
    await expect(adapter(detail, DETAIL_PATH).extractClaims()).resolves.toMatchObject({
      state: "complete", observations: [{ status: "processing", provider: "Praxis German", invoiceAmount: 100, treatmentDate: "2026-08-01" }],
    });
  });
});
