import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CLAIMS, DEFAULT_FROM, GOLDEN, REFERENCE_DATE, type Scenario } from "../demo-site/fixtures/claims";
import { detail, results, typePage, type Context } from "../demo-site/server/render";
import { localizeHtml } from "../demo-site/server/i18n";
import { DETAIL, LIST, OPEN, TYPE } from "../demo-site/server/validation";
import { OegkAdapter } from "../src/adapter/oegk.js";
import { LiveClaimReader } from "../src/live/reader.js";
import { searchClaims } from "../src/actions/search-claims.js";
import { PRODUCTION_ORIGIN } from "../src/environment/site-context.js";

const DEVELOPMENT_ORIGIN = "http://localhost:4173";

const context = (scenario: Scenario = "mixed", page = 1): Context => ({
  scenario,
  from: DEFAULT_FROM,
  to: REFERENCE_DATE,
  page,
});

function documentFor(markup: string, pathname: string, origin = PRODUCTION_ORIGIN): Document {
  const page = new DOMParser().parseFromString(markup, "text/html");
  const url = `${origin}${pathname}`;
  Object.defineProperty(page, "URL", { configurable: true, value: url });
  Object.defineProperty(page, "baseURI", { configurable: true, value: url });
  Object.defineProperty(page, "defaultView", { configurable: true, value: window });
  return page;
}

function resultsDocument(scenario: Scenario = "mixed", page = 1): Document {
  return documentFor(results(context(scenario, page)), LIST);
}

function typeDocument(scenario: Scenario = "mixed"): Document {
  return documentFor(typePage(context(scenario)), TYPE);
}

function searchForm(page: Document, fromId: "vonDatWAH" | "vonDat"): HTMLFormElement {
  return Array.from(page.querySelectorAll<HTMLFormElement>('form[method="post"]'))
    .find((form) => form.querySelector(`#${fromId}[name="${fromId}"]`))!;
}

async function extract(document: Document, pathname: string = LIST, origin = PRODUCTION_ORIGIN) {
  return new OegkAdapter({
    document,
    location: { origin, pathname },
    expectedOrigin: origin,
  }).extractClaims();
}

async function read(document: Document) {
  return new LiveClaimReader(document).read();
}

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  // jsdom does not lay out parsed documents; model rendered elements as visible.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GovBridge AT Demo rendered compatibility contract", () => {
  it("renders exactly twenty default claims with the independent golden distribution and provenance", async () => {
    expect(CLAIMS).toHaveLength(GOLDEN.total);
    const page = resultsDocument();
    expect(page.querySelectorAll(".claim-fields")).toHaveLength(0);
    expect(page.querySelectorAll(".cb_date")).toHaveLength(20);
    expect(page.querySelectorAll(".cb_details")).toHaveLength(20);
    expect(page.querySelectorAll(".cb_download button:disabled")).toHaveLength(GOLDEN.completed);
    const parsed = await extract(page);
    expect(parsed).toMatchObject({
      state: "complete",
      snapshotComplete: true,
      pageKind: "results",
      diagnostics: { candidateCount: 20, skippedCount: 0 },
      observedRange: { from: DEFAULT_FROM, to: REFERENCE_DATE },
    });
    expect(parsed.observations).toHaveLength(20);
    expect(parsed.observations).toContainEqual(expect.objectContaining({
      provider: CLAIMS[0]!.provider, invoiceDate: CLAIMS[0]!.invoiceDate, status: CLAIMS[0]!.status,
    }));
    for (const observation of parsed.observations) {
      expect(observation).not.toHaveProperty("overviewDate");
      expect(observation).not.toHaveProperty("submittedDate");
      expect(observation).not.toHaveProperty("treatmentDate");
      expect(observation).not.toHaveProperty("treatmentEndDate");
      expect(observation).not.toHaveProperty("invoiceAmount");
      expect(observation).not.toHaveProperty("reimbursementDate");
    }
    expect(parsed.observations.filter(({ status }) => status === "processing")).toHaveLength(GOLDEN.processing);
    expect(parsed.observations.filter(({ status }) => status === "completed")).toHaveLength(GOLDEN.completed);
    expect(parsed.observations.filter(({ status }) => status === "rejected")).toHaveLength(GOLDEN.rejected);
    const reimbursements = parsed.observations.flatMap(({ reimbursementAmount }) =>
      reimbursementAmount === undefined ? [] : [reimbursementAmount]);
    expect(reimbursements).toHaveLength(GOLDEN.knownReimbursements);
    expect(reimbursements.reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(GOLDEN.reimbursementTotal, 2);

    const live = await read(page);
    expect(live).toMatchObject({ ok: true, data: { claims: { length: 20 }, page: {
      scope: "current-page",
      environment: "production",
      pageKind: "results",
      completeness: "complete",
      skippedCount: 0,
      visibleRange: { from: DEFAULT_FROM, to: REFERENCE_DATE },
    } } });
  });

  it("accepts the English synthetic presentation on loopback while production stays German-only", async () => {
    const germanResults = documentFor(results(context()), LIST, DEVELOPMENT_ORIGIN);
    expect(await extract(germanResults, LIST, DEVELOPMENT_ORIGIN)).toMatchObject({
      state: "complete", pageKind: "results", observations: { length: 20 },
    });
    const germanType = documentFor(typePage(context()), TYPE, DEVELOPMENT_ORIGIN);
    const germanSubmit = germanType.querySelector<HTMLInputElement>("input[type=submit]")!;
    vi.spyOn(germanSubmit, "click").mockImplementation(() => undefined);
    await expect(searchClaims(germanType, { from: "2022-01-01", to: "2026-01-01" })).resolves.toMatchObject({ ok: true });
    expect(germanType.querySelector<HTMLInputElement>("#vonDatWAH")?.value).toBe("01.01.2022");
    const germanEmpty = documentFor(results(context("empty-results")), LIST, DEVELOPMENT_ORIGIN);
    expect(await extract(germanEmpty, LIST, DEVELOPMENT_ORIGIN)).toMatchObject({ state: "empty" });
    const germanDetail = documentFor(
      detail(CLAIMS.find(({ status }) => status === "completed")!, context()), DETAIL, DEVELOPMENT_ORIGIN,
    );
    expect(await extract(germanDetail, DETAIL, DEVELOPMENT_ORIGIN)).toMatchObject({
      state: "complete", pageKind: "reimbursed-detail", observations: { length: 1 },
    });

    const englishResults = documentFor(localizeHtml(results(context())), LIST, DEVELOPMENT_ORIGIN);
    expect(englishResults.documentElement.lang).toBe("en");
    expect(englishResults.querySelector("h1")?.textContent).toBe("Claims");
    expect(englishResults.querySelector(".card_title h2")?.textContent).toBe("Open claims");
    expect(englishResults.querySelector(".cb_title")?.textContent).toContain("Invoice dated");
    expect(englishResults.querySelectorAll(".claim-fields")).toHaveLength(0);
    expect(englishResults.querySelectorAll(".cb_date")).toHaveLength(20);
    expect(await extract(englishResults, LIST, DEVELOPMENT_ORIGIN)).toMatchObject({
      state: "complete", pageKind: "results", observations: { length: 20 },
    });

    const englishType = documentFor(localizeHtml(typePage(context())), TYPE, DEVELOPMENT_ORIGIN);
    expect(englishType.querySelector<HTMLInputElement>("#vonDatWAH")?.placeholder).toBe("DD.MM.YYYY");
    expect(englishType.querySelector<HTMLInputElement>("input[type=submit]")?.value).toBe("Continue");
    expect(await extract(englishType, TYPE, DEVELOPMENT_ORIGIN)).toMatchObject({
      state: "complete", pageKind: "type-range",
    });

    const englishDetail = documentFor(
      localizeHtml(detail(CLAIMS.find(({ status }) => status === "completed")!, context())),
      DETAIL,
      DEVELOPMENT_ORIGIN,
    );
    expect(englishDetail.querySelector("th")?.textContent).toBe("Provider:");
    expect(await extract(englishDetail, DETAIL, DEVELOPMENT_ORIGIN)).toMatchObject({
      state: "complete", pageKind: "reimbursed-detail", observations: { length: 1 },
    });

    const productionEnglish = documentFor(localizeHtml(results(context())), LIST);
    expect(await extract(productionEnglish)).toMatchObject({ state: "unsupported" });
  });

  it("keeps duplicate-looking rows distinct and does not retain claim data across mutation/removal", async () => {
    const duplicatePage = resultsDocument("duplicates");
    const duplicates = await read(duplicatePage);
    expect(duplicates).toMatchObject({ ok: true, data: { claims: { length: 2 } } });
    if (!duplicates.ok) return;
    expect(new Set(duplicates.data.claims.map(({ id }) => id)).size).toBe(2);

    const firstDate = duplicatePage.querySelector(".cb_date")!;
    const firstProvider = duplicatePage.querySelector("h4")!;
    const firstId = duplicates.data.claims[0]!.id;
    firstDate.textContent = "01.01.1999";
    const dateChanged = await read(duplicatePage);
    expect(dateChanged.ok).toBe(true);
    if (!dateChanged.ok) return;
    expect(dateChanged.data.claims[0]?.id).toBe(firstId);
    expect(dateChanged.data.claims[0]).not.toHaveProperty("overviewDate");
    expect(dateChanged.data.claims[0]).not.toHaveProperty("submittedDate");
    firstProvider.textContent = "Changed only inside the current document";
    const changed = await read(duplicatePage);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.data.claims[0]?.provider).toBe("Changed only inside the current document");
    expect(changed.data.claims.every(({ id }) => id !== firstId)).toBe(true);
    duplicatePage.querySelector('[role="row"]')!.remove();
    const removed = await read(duplicatePage);
    expect(removed).toMatchObject({ ok: true, data: { claims: { length: 1 } } });
    if (removed.ok) expect(removed.data.claims[0]!.id).not.toBe(firstId);
  });

  it("reports explicit partial, validation/error, and empty states without success ambiguity", async () => {
    const partial = await extract(resultsDocument("partial"));
    expect(partial).toMatchObject({ state: "complete", snapshotComplete: false, diagnostics: { candidateCount: 21, skippedCount: 1 } });
    const partialLive = await read(resultsDocument("partial"));
    expect(partialLive).toMatchObject({ ok: true, data: { page: { completeness: "partial", skippedCount: 1 } } });

    const validation = await extract(resultsDocument("validation"));
    expect(validation).toMatchObject({ state: "error", snapshotComplete: false, observations: [] });
    expect(await read(resultsDocument("validation"))).toMatchObject({ ok: false, error: { code: "EXTRACTION_FAILED" } });
    const broken = await extract(resultsDocument("broken-layout"));
    expect(broken).toMatchObject({ state: "error", snapshotComplete: false, observations: [] });

    for (const scenario of ["empty-type", "empty-results"] as const) {
      const page = scenario === "empty-type" ? typeDocument(scenario) : resultsDocument(scenario);
      expect(await extract(page, scenario === "empty-type" ? TYPE : LIST)).toMatchObject({
        state: "empty", snapshotComplete: true, observations: [], diagnostics: { candidateCount: 0, skippedCount: 0 },
      });
      expect(await read(page)).toMatchObject({ ok: true, data: { claims: [], page: { completeness: "complete" } } });
    }
  });

  it("does not treat the plain search mask, loading marker, or hidden rows as ready results", async () => {
    expect(await extract(typeDocument("mixed"), TYPE)).toMatchObject({ state: "complete", pageKind: "type-range" });
    expect(await read(typeDocument("mixed"))).toMatchObject({ ok: false, error: { code: "PAGE_NOT_READY" } });
    expect(await read(resultsDocument("loading"))).toMatchObject({ ok: false, error: { code: "PAGE_NOT_READY" } });
    expect(await read(resultsDocument("hidden-rows"))).toMatchObject({ ok: false, error: { code: "PAGE_NOT_READY" } });
  });

  it("extracts both detail contracts and excludes synthetic sentinel fields from live output", async () => {
    const reimbursed = CLAIMS.find(({ status }) => status === "completed")!;
    const reimbursedPage = documentFor(detail(reimbursed, context()), DETAIL);
    const reimbursedResult = await read(reimbursedPage);
    expect(reimbursedResult).toMatchObject({ ok: true, data: { claims: [{
      status: "completed",
      provider: reimbursed.provider,
      invoiceAmount: reimbursed.invoiceAmount,
      treatmentDate: reimbursed.treatmentDate,
      treatmentEndDate: reimbursed.treatmentEndDate,
      reimbursementAmount: reimbursed.reimbursementAmount,
      reimbursementDate: reimbursed.reimbursementDate,
    }], page: { pageKind: "reimbursed-detail" } } });

    const rejected = CLAIMS.find(({ status }) => status === "rejected")!;
    const rejectedPage = documentFor(detail(rejected, context()), OPEN);
    const rejectedResult = await read(rejectedPage);
    expect(rejectedResult).toMatchObject({ ok: true, data: { claims: [{
      status: "rejected", provider: rejected.provider, invoiceAmount: rejected.invoiceAmount,
      treatmentDate: rejected.treatmentDate, treatmentEndDate: rejected.treatmentEndDate,
    }], page: { pageKind: "open-rejected-detail" } } });
    expect(JSON.stringify(reimbursedResult)).not.toContain("SYNTHETIC-");
    expect(JSON.stringify(rejectedResult)).not.toContain("SYNTHETIC-");
    expect(JSON.stringify(rejectedResult)).not.toContain("transientSourceId");
  });

  it("renders only the selected page of paginated claims", async () => {
    const first = await extract(resultsDocument("paginated", 1));
    const second = await extract(resultsDocument("paginated", 2));
    expect(first).toMatchObject({ state: "complete", diagnostics: { candidateCount: 10, skippedCount: 0 } });
    expect(second).toMatchObject({ state: "complete", diagnostics: { candidateCount: 10, skippedCount: 0 } });
    expect(first.observations).toHaveLength(10);
    expect(second.observations).toHaveLength(10);
    expect(first.observations.map(({ provider }) => provider)).not.toEqual(second.observations.map(({ provider }) => provider));
  });

  it("keeps exact type/results form contracts and dispatches one native click", async () => {
    const typePageDocument = typeDocument();
    const typeForm = searchForm(typePageDocument, "vonDatWAH");
    expect(Array.from(typePageDocument.querySelectorAll('form[method="post"]')).filter((form) =>
      form.querySelector('#vonDatWAH[name="vonDatWAH"]') && form.querySelector('#bisDatWAH[name="bisDatWAH"]'))).toHaveLength(1);
    expect(typeForm.action).toContain(`${TYPE}?`);
    expect(typeForm.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(typeForm.querySelectorAll('[role="tab"][aria-selected="true"]')).toHaveLength(1);
    expect(typeForm.querySelector('[role="tab"]')?.textContent?.trim()).toBe("Wahlarzt / Wahltherapeut");
    expect(typeForm.querySelectorAll('input#vonDatWAH[name="vonDatWAH"][placeholder="TT.MM.JJJJ"]')).toHaveLength(1);
    expect(typeForm.querySelectorAll('input#bisDatWAH[name="bisDatWAH"][placeholder="TT.MM.JJJJ"]')).toHaveLength(1);
    const typeSubmit = typeForm.querySelector<HTMLInputElement>('input[type="submit"]')!;
    expect(typeSubmit.value).toBe("Weiter");
    expect(typeForm.querySelectorAll('input[type="submit"]')).toHaveLength(1);
    const typeClick = vi.spyOn(typeSubmit, "click").mockImplementation(() => undefined);
    await expect(searchClaims(typePageDocument, { from: "2022-01-01", to: "2026-01-01" })).resolves.toEqual({
      ok: true, data: { status: "submission_requested" },
    });
    expect(typeClick).toHaveBeenCalledOnce();
    expect(typeForm.querySelector<HTMLInputElement>("#vonDatWAH")?.value).toBe("01.01.2022");
    expect(typeForm.querySelector<HTMLInputElement>("#bisDatWAH")?.value).toBe("01.01.2026");

    const resultsPageDocument = resultsDocument();
    const resultsForm = searchForm(resultsPageDocument, "vonDat");
    expect(resultsForm.action).toContain(`${LIST}?`);
    const resultsSubmit = resultsForm.querySelector<HTMLInputElement>('input[type="submit"]')!;
    expect(resultsSubmit.value).toBe("OK");
    const resultsClick = vi.spyOn(resultsSubmit, "click").mockImplementation(() => undefined);
    await expect(searchClaims(resultsPageDocument, { from: "2022-01-01", to: "2026-01-01" })).resolves.toMatchObject({
      ok: true, data: { status: "submission_requested" },
    });
    expect(resultsClick).toHaveBeenCalledOnce();
  });
});
