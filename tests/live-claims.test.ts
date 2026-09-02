import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveClaimReader, type LiveSnapshot } from "../src/live/reader.js";
import { createReadOnlyClaimTools } from "../src/webmcp/handlers.js";
import { OegkAdapter } from "../src/adapter/oegk.js";
import { searchClaims } from "../src/actions/search-claims.js";
import { installContentBridge } from "../src/webmcp/content-bridge.js";
import { createBridgeRequest } from "../src/webmcp/protocol.js";
import type { ToolResult } from "../src/webmcp/types.js";
import type { Claim } from "../src/domain/claim.js";
import { isSupportedMeineSvUrl } from "../src/webmcp/scope.js";

const root = "https://www.meinesv.at/vsInfo/views/KE/";
const empty = '<div id="infolist" class="infobox yellow" role="alert">In diesem Abfragezeitraum wurde keine Kostenerstattung bzw. kein Onlineantrag gefunden.</div>';
const row = (provider = "Synthetic Alpha", date = "01.03.2026", amount = "") => `<div role="row"><div class="cb_title"><h4>${provider}</h4> Rechnung vom ${date}</div>${amount ? `<div class="cb_status"><span class="badge">Rückerstattung: ${amount} €</span></div>` : ""}</div>`;
const section = (rows = row(), status = "offene Einreichungen") => `<section class="card_container"><div class="card_title"><h2>${status}</h2></div><div class="card_content" role="grid">${rows}</div></section>`;
const results = (rows = row()) => `<h1>Liste der Einreichungen</h1><input id="vonDat" value="01.01.2026"><input id="bisDat" value="31.12.2026">${section(rows)}`;
const mask = `<h1>Einreichungen abfragen</h1><form method="post" action="${root}einreichungTyp.xhtml"><a role="tab" aria-selected="true">Wahlarzt / Wahltherapeut</a><input id="vonDatWAH" name="vonDatWAH" placeholder="TT.MM.JJJJ"><input id="bisDatWAH" name="bisDatWAH" placeholder="TT.MM.JJJJ"><input type="submit" value="Weiter"></form>`;

function page(markup = results(), route = "einreichungListe.xhtml"): Document {
  const doc = new DOMParser().parseFromString(markup, "text/html");
  Object.defineProperty(doc, "URL", { configurable: true, value: root + route });
  Object.defineProperty(doc, "baseURI", { configurable: true, value: root + route });
  Object.defineProperty(doc, "defaultView", { value: window });
  return doc;
}
function success<T>(result: ToolResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result.data;
}
async function read(doc: Document): Promise<LiveSnapshot> { return success(await new LiveClaimReader(doc).read()); }
function tools(doc: Document) {
  const definitions = createReadOnlyClaimTools(new LiveClaimReader(doc));
  return (name: string, input: unknown = {}) => definitions.find((tool) => tool.name === name)!.execute(input);
}
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("invocation-local data and identity", () => {
  it("re-extracts changed and removed rows without observation; unchanged snapshots keep IDs and new read times", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
    const doc = page(results(row() + row("Synthetic Beta")));
    const first = await read(doc);
    vi.setSystemTime(new Date("2026-09-01T10:01:00Z"));
    const unchanged = await read(doc);
    expect(unchanged.claims.map((c) => c.id)).toEqual(first.claims.map((c) => c.id));
    expect(unchanged.claims[0]!.lastSeen).toBe(unchanged.page.readAt);
    expect(unchanged.page.readAt).not.toBe(first.page.readAt);
    doc.querySelector("h4")!.textContent = "Synthetic Updated";
    const changed = await read(doc);
    expect(changed.claims[0]!.provider).toBe("Synthetic Updated");
    expect(changed.claims.every((c) => !first.claims.some((old) => old.id === c.id))).toBe(true);
    expect(await tools(doc)("get_claim", { claimId: first.claims[0]!.id })).toMatchObject({ error: { code: "NOT_FOUND" } });
    doc.querySelectorAll('[role="row"]')[1]!.remove();
    expect((await read(doc)).claims).toHaveLength(1);
    expect(success(await tools(doc)("get_claim", { claimId: (await read(doc)).claims[0]!.id }))).toHaveProperty("page.environment", "production");
  });

  it("keeps duplicate rows distinct, ignores excluded fields for identity, and never shares IDs or data across documents", async () => {
    const firstDoc = page(results(row() + row()));
    const first = await read(firstDoc);
    expect(new Set(first.claims.map((c) => c.id)).size).toBe(2);
    firstDoc.body.append(firstDoc.createElement("aside"));
    expect((await read(firstDoc)).claims.map((c) => c.id)).toEqual(first.claims.map((c) => c.id));
    const other = await read(page(results(row() + row())));
    expect(other.claims[0]!.id).not.toBe(first.claims[0]!.id);
    expect((await read(page(results(row("Other tab"))))).claims[0]!.provider).toBe("Other tab");
    expect(await tools(firstDoc)("get_claim", { claimId: other.claims[0]!.id })).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(await tools(firstDoc)("get_claim", { claimId: "local-v1-legacy" })).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("returns only rendered rows and does not traverse a pagination control", async () => {
    const doc = page(results(row() + '<div role="row" hidden><div class="cb_title"><h4>Hidden record</h4></div></div>') + '<a href="next.xhtml">Next</a>');
    const click = vi.spyOn(doc.querySelector("a")!, "click");
    expect((await read(doc)).claims).toHaveLength(1);
    expect(click).not.toHaveBeenCalled();
  });
});

describe("explicit live states", () => {
  it("distinguishes a search mask from type-page and result-page empty results", async () => {
    expect(await new LiveClaimReader(page(mask, "einreichungTyp.xhtml")).read()).toMatchObject({ error: { code: "PAGE_NOT_READY" } });
    expect(await new LiveClaimReader(page(mask, "?contentid=10007.815943")).read()).toMatchObject({ error: { code: "PAGE_NOT_READY" } });
    for (const [markup, route] of [[mask + empty, "einreichungTyp.xhtml"], ["<h1>Liste der Einreichungen</h1>" + empty, "einreichungListe.xhtml"]]) {
      expect(await read(page(markup, route))).toMatchObject({ claims: [], page: { completeness: "complete", skippedCount: 0 } });
    }
  });

  it("prioritizes loading and validation errors over retained rows and empty alerts", async () => {
    const doc = page(results() + empty + '<div role="alert">ACHTUNG: Fehlerhafte Eingaben im Formular</div><div aria-busy="true"></div>');
    const reader = new LiveClaimReader(doc);
    expect(await reader.read()).toMatchObject({ error: { code: "PAGE_NOT_READY" } });
    doc.querySelector('[aria-busy]')!.remove();
    expect(await reader.read()).toMatchObject({ error: { code: "EXTRACTION_FAILED" } });
    doc.querySelectorAll('[role="alert"]')[1]!.remove();
    expect(success(await reader.read()).claims).toEqual([]);
  });

  it("reports partial malformed rows and fails recognized broken layouts instead of claiming emptiness", async () => {
    const partial = await read(page(results(row() + '<div role="row">Malformed row</div>')));
    expect(partial).toMatchObject({ page: { completeness: "partial", skippedCount: 1, scope: "current-page", visibleRange: { from: "2026-01-01", to: "2026-12-31" } } });
    expect(partial.claims).toHaveLength(1);
    for (const [markup, route] of [["<h1>Liste der Einreichungen</h1>", "einreichungListe.xhtml"], ["<h1>Einreichung Detail</h1>", "einreichungDetailOA.xhtml"]]) {
      expect(await new LiveClaimReader(page(markup, route)).read()).toMatchObject({ error: { code: "EXTRACTION_FAILED" } });
    }
    expect(await new LiveClaimReader(page("<h1>Login</h1>")).read()).toMatchObject({ error: { code: "UNSUPPORTED_PAGE" } });
    expect(await new LiveClaimReader(page(results(), "unrelated.xhtml")).read()).toMatchObject({ error: { code: "UNSUPPORTED_PAGE" } });
    const wrong = page(); Object.defineProperty(wrong, "URL", { value: "https://evil.invalid/vsInfo/views/KE/einreichungListe.xhtml" });
    expect(await new LiveClaimReader(wrong).read()).toMatchObject({ error: { code: "UNSUPPORTED_PAGE" } });
  });

  it("does not mistake a hidden loader for a busy page", async () => {
    expect((await read(page(results() + '<div role="progressbar" hidden></div>'))).claims).toHaveLength(1);
  });

  it("does not report zero claims while grids have no rendered rows and no explicit empty alert", async () => {
    for (const markup of [results(""), results('<div role="row" hidden><div class="cb_title"><h4>Not rendered yet</h4></div></div>')]) {
      expect(await new LiveClaimReader(page(markup)).read()).toMatchObject({ error: { code: "PAGE_NOT_READY" } });
    }
  });
});

describe("query contracts and excluded data", () => {
  it("filters only this invocation and preserves partial disclosure", async () => {
    const doc = page('<h1>Liste der Einreichungen</h1>' + section(row()) + section(row("Paid", "02.03.2026", "40,20") + row("Other year", "02.03.2025", "90") + '<div role="row">Malformed</div>', "erstattete Einreichungen"));
    const invoke = tools(doc);
    expect(success(await invoke("list_claims"))).toMatchObject({ count: 3 });
    expect(success(await invoke("get_open_claims"))).toMatchObject({ count: 1, claims: [{ status: "processing" }], page: { completeness: "partial" } });
    doc.querySelector(".card_container")!.remove();
    expect(success(await invoke("get_open_claims"))).toMatchObject({ count: 0, claims: [] });
  });

  it("keeps compact overview fields sparse across list, open, and get", async () => {
    const openRow = `<div role="row"><div class="cb_date">16.08.2026</div><div class="cb_title"><h4>Praxis Morgenstern</h4><span class="invoice">Rechnung vom 14.08.2026</span></div><div class="cb_status"></div><a class="cb_details" href="/detail.xhtml">›</a><div class="cb_download" aria-disabled="true">PDF</div></div>`;
    const paidRow = `<div role="row"><div class="cb_date">17.08.2026</div><div class="cb_title"><h4>Praxis Abendrot</h4><span class="invoice">Rechnung vom 15.08.2026</span></div><div class="cb_status"><span class="badge">Rückerstattung: 80,00 €</span></div><a class="cb_details" href="/detail.xhtml">›</a><div class="cb_download" aria-disabled="true">PDF</div></div>`;
    const doc = page('<h1>Liste der Einreichungen</h1>' + section(openRow) + section(paidRow, "erstattete Einreichungen"));
    const invoke = tools(doc);
    const listed = success(await invoke("list_claims")) as { claims: Claim[]; count: number };
    expect(listed.claims[0]).toMatchObject({
      provider: "Praxis Morgenstern", invoiceDate: "2026-08-14", status: "processing",
    });
    expect(listed.claims[0]).not.toHaveProperty("invoiceAmount");
    expect(listed.claims[0]).not.toHaveProperty("treatmentDate");
    expect(listed.claims[0]).not.toHaveProperty("reimbursementDate");
    expect(listed.claims[1]).toMatchObject({
      provider: "Praxis Abendrot", invoiceDate: "2026-08-15", status: "completed", reimbursementAmount: 80,
    });
    const open = success(await invoke("get_open_claims"));
    expect(open).toMatchObject({ count: 1, claims: [{
      provider: "Praxis Morgenstern", invoiceDate: "2026-08-14", status: "processing",
    }] });
    expect(success(await invoke("get_claim", { claimId: listed.claims[0]!.id }))).toMatchObject({ claim: {
      id: listed.claims[0]!.id, provider: "Praxis Morgenstern", invoiceDate: "2026-08-14", status: "processing",
    } });
  });

  it("reads a detail singleton without earlier list enrichment or sensitive table values", async () => {
    await read(page());
    const doc = page('<h1>Einreichung Detail</h1><table><tr><th>Antragsnummer:</th><td>SECRET-ID</td></tr><tr><th>Behandler:</th><td>Synthetic Detail</td></tr><tr><th>Rechnungsbetrag:</th><td>200,00 €</td></tr><tr><th>Behandlung für:</th><td>SECRET-PERSON</td></tr><tr><th>Erstattung auf das Konto:</th><td>SECRET-ACCOUNT</td></tr><tr><th>Ablehnungsgrund:</th><td>SECRET-REASON</td></tr></table><a href="https://example.invalid/SECRET-PDF">PDF</a>', "einreichungDetailOA.xhtml");
    const value = await read(doc);
    expect(value.claims).toHaveLength(1);
    expect(value.claims[0]).toMatchObject({ provider: "Synthetic Detail", invoiceAmount: 200, status: "rejected" });
    expect(value.claims[0]).not.toHaveProperty("invoiceDate");
    expect(JSON.stringify(value)).not.toMatch(/SECRET|transientSourceId|href/);
  });

  it("explicitly allowlists adapter observations before hashing and sending across the bridge", async () => {
    vi.spyOn(OegkAdapter.prototype, "extractClaims").mockResolvedValue({ state: "complete", pageKind: "results", snapshotComplete: true, diagnostics: { candidateCount: 1, skippedCount: 0 }, observations: [Object.assign({ status: "processing" as const, source: "oegk" as const, provider: "Synthetic" }, { transientSourceId: "SECRET", rawHtml: "SECRET", documentLink: "SECRET", bankAccount: "SECRET", node: document.body })] });
    const doc = page();
    const invoke = tools(doc);
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const dispose = installContentBridge(window, invoke);
    window.dispatchEvent(new MessageEvent("message", { source: window, origin: window.location.origin, data: createBridgeRequest("live", "list_claims", {}) }));
    await vi.waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(JSON.stringify(post.mock.calls[0]![0])).not.toMatch(/SECRET|transientSourceId|rawHtml|documentLink|bankAccount/);
    expect(post.mock.calls[0]![0]).toMatchObject({ result: { ok: true, data: { count: 1, page: { scope: "current-page" } } } });
    dispose();
  });

  it("rejects malformed inputs before reading and redacts extraction failures", async () => {
    const extract = vi.spyOn(OegkAdapter.prototype, "extractClaims");
    const invoke = tools(page());
    for (const [name, input] of [["list_claims", { extra: true }], ["get_open_claims", null], ["get_claim", {}]]) {
      expect(await invoke(name as string, input)).toMatchObject({ error: { code: "INVALID_INPUT" } });
    }
    expect(createReadOnlyClaimTools(new LiveClaimReader(page())).some(({ name }) => name === "get_reimbursement_summary")).toBe(false);
    expect(extract).not.toHaveBeenCalled();
    extract.mockRejectedValue(new Error("SECRET PAGE DATA"));
    const result = await invoke("list_claims");
    expect(result).toMatchObject({ error: { code: "EXTRACTION_FAILED" } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});

describe("search navigation and unsettled results", () => {
  it("rejects retained rows after dispatch, supports structural JSF replacement, and never unlocks duplicate submission", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    const doc = page(mask + section(), "einreichungTyp.xhtml");
    const click = vi.spyOn(doc.querySelector<HTMLInputElement>('[type="submit"]')!, "click").mockImplementation(() => undefined);
    const input = { from: "2026-01-01", to: "2026-01-02" };
    expect(await searchClaims(doc, input)).toMatchObject({ data: { status: "submission_requested" } });
    expect(await new LiveClaimReader(doc).read()).toMatchObject({ error: { code: "PAGE_NOT_READY" } });
    doc.querySelector("h4")!.textContent = "Unconfirmed in-place change";
    doc.body.insertAdjacentHTML("beforeend", '<div role="alert">Unrelated announcement</div>');
    expect(await new LiveClaimReader(doc).read()).toMatchObject({ error: { code: "PAGE_NOT_READY" } });
    doc.body.insertAdjacentHTML("beforeend", empty);
    expect((await read(doc)).claims).toEqual([]);
    expect(await searchClaims(doc, input)).toMatchObject({ error: { code: "SEARCH_IN_PROGRESS" } });
    expect(click).toHaveBeenCalledOnce();
    expect((await read(page(results(row("New document"))))).claims[0]!.provider).toBe("New document");
  });

  it("keeps exact supported page scope", () => {
    expect(isSupportedMeineSvUrl(root + "einreichungListe.xhtml")).toBe(true);
    expect(isSupportedMeineSvUrl("https://www.meinesv.at/other")).toBe(false);
    expect(isSupportedMeineSvUrl("https://evil.invalid/vsInfo/views/KE/einreichungListe.xhtml")).toBe(false);
  });
});
