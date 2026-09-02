import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Claim } from "../src/domain/claim.js";
import { renderPopup } from "../src/ui/popup.js";
import { createReadOnlyClaimTools } from "../src/webmcp/handlers.js";
import type { LiveReader } from "../src/live/reader.js";
import type { ToolResult, WebMcpToolDefinition } from "../src/webmcp/types.js";
import { registerPageTools } from "../src/webmcp/registrar.js";

const claims: Claim[] = [
  {
    id: "live-v1-document-digest-0",
    provider: "Dr. Beispiel",
    invoiceDate: "2026-08-14",
    invoiceAmount: 185,
    status: "processing",
    source: "oegk",
    lastSeen: "2026-08-30T18:42:00.000Z",
  },
  {
    id: "live-v1-document-digest-1",
    invoiceDate: "2026-01-03",
    invoiceAmount: 240,
    reimbursementAmount: 94.2,
    reimbursementDate: "2026-02-01",
    responseAvailable: true,
    status: "completed",
    source: "oegk",
    lastSeen: "2026-08-30T18:42:00.000Z",
  },
  {
    id: "live-v1-document-digest-2",
    reimbursementAmount: 12,
    status: "unknown",
    source: "oegk",
    lastSeen: "2026-08-30T18:42:00.000Z",
  },
];

const page = {
  scope: "current-page" as const,
  pageKind: "results" as const,
  readAt: "2026-08-30T18:42:00.000Z",
  completeness: "complete" as const,
  skippedCount: 0,
};

function reader(values: readonly Claim[] = claims): LiveReader & { reads: number } {
  let reads = 0;
  return {
    get reads() {
      return reads;
    },
    async read(): Promise<ToolResult<{ claims: Claim[]; page: typeof page }>> {
      reads += 1;
      return { ok: true, data: { claims: values.map((claim) => ({ ...claim })), page } };
    },
  };
}

describe("technical popup", () => {
  it("renders only workflow and capability guidance, with no claim data read", () => {
    document.body.innerHTML = "<main id='app'></main>";
    const root = document.querySelector<HTMLElement>("#app")!;
    const openDashboard = vi.fn();

    renderPopup(root, { onOpenDashboard: openDashboard });

    expect(root.textContent).toContain("GovBridge AT");
    expect(root.textContent).toContain("current-page");
    expect(root.textContent).toContain("Keine Speicherung");
    expect(root.textContent).not.toContain("Lokale Daten");
    expect(root.querySelectorAll("input, form, a")).toHaveLength(0);
    expect(root.querySelector("#claim-count")).toBeNull();
    expect(openDashboard).not.toHaveBeenCalled();

    root.querySelector<HTMLButtonElement>("button")!.click();
    expect(openDashboard).toHaveBeenCalledOnce();
  });
});

describe("live query handler contracts", () => {
  it("reads the current page for every call and includes page metadata", async () => {
    const liveReader = reader();
    const tools = createReadOnlyClaimTools(liveReader);
    const list = tools.find(({ name }) => name === "list_claims")!;
    const first = await list.execute({});
    const changed = { ...claims[0]!, provider: "Aktualisiert" };
    const secondReader = reader([changed]);
    const second = await createReadOnlyClaimTools(secondReader).find(({ name }) => name === "list_claims")!.execute({});

    expect(liveReader.reads).toBe(1);
    expect(first).toMatchObject({ ok: true, data: { count: 3, page: { scope: "current-page" } } });
    expect(second).toMatchObject({ ok: true, data: { claims: [{ provider: "Aktualisiert" }], page } });
  });

  it("filters open claims and sums only known invoice-year amounts", async () => {
    const tools = createReadOnlyClaimTools(reader());
    const open = await tools.find(({ name }) => name === "get_open_claims")!.execute({});
    const summary = await tools.find(({ name }) => name === "get_reimbursement_summary")!.execute({ year: 2026 });

    expect(open).toMatchObject({ ok: true, data: { count: 1, claims: [{ id: claims[0]!.id }], page } });
    expect(summary).toMatchObject({
      ok: true,
      data: {
        year: 2026,
        claimCount: 2,
        invoiceAmountKnownCount: 2,
        reimbursementAmountKnownCount: 1,
        invoiceTotal: 425,
        reimbursedTotal: 94.2,
        page,
      },
    });
  });

  it("validates inputs before a live read and resolves only current temporary IDs", async () => {
    const liveReader = reader();
    const tools = createReadOnlyClaimTools(liveReader);
    const list = tools.find(({ name }) => name === "list_claims")!;
    const get = tools.find(({ name }) => name === "get_claim")!;

    await expect(list.execute({ extra: true })).resolves.toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
    await expect(get.execute({ claimId: "local-v1-legacy" })).resolves.toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    await expect(get.execute({ claimId: claims[0]!.id })).resolves.toMatchObject({ ok: true, data: { claim: { id: claims[0]!.id }, page } });
    expect(liveReader.reads).toBe(2);
  });

  it("returns redacted live page failures without falling back to storage", async () => {
    const liveReader: LiveReader = {
      async read() {
        return { ok: false, error: { code: "PAGE_NOT_READY", message: "Search outcome is not yet confirmed." } };
      },
    };
    const result = await createReadOnlyClaimTools(liveReader)[0]!.execute({});
    expect(result).toEqual({ ok: false, error: { code: "PAGE_NOT_READY", message: "Search outcome is not yet confirmed." } });
    expect(JSON.stringify(result)).not.toMatch(/storage|claim content|html/iu);
  });
});

describe("page registration and technical dashboard", () => {
  it("registers exactly the four packaged read-only query capabilities", async () => {
    const definitions: WebMcpToolDefinition[] = [];
    const result = await registerPageTools(
      { modelContext: { async registerTool(tool) { definitions.push(tool); } } },
      async () => ({ ok: true, data: {} }),
    );

    expect(result.available).toBe(true);
    expect(definitions.map(({ name }) => name)).toEqual([
      "list_claims",
      "get_open_claims",
      "get_claim",
      "get_reimbursement_summary",
    ]);
    expect(definitions.every(({ annotations }) => annotations.readOnlyHint)).toBe(true);
    if (result.available) result.dispose();
  });

  it("documents current-page contracts without metrics, storage reads, or remote assets", () => {
    const html = readFileSync(resolve(process.cwd(), "dashboard.html"), "utf8");
    const page = new DOMParser().parseFromString(html, "text/html");
    expect(Array.from(page.querySelectorAll(".tool-card__top code"), (node) => node.textContent)).toEqual([
      "search_claims",
      "list_claims",
      "get_open_claims",
      "get_claim",
      "get_reimbursement_summary",
    ]);
    expect(page.body.textContent).toContain("current page");
    expect(page.body.textContent).toContain("temporary");
    expect(page.body.textContent).toContain("Legacy bytes");
    expect(page.body.textContent).toContain("readOnlyHint: false");
    expect(page.body.textContent).toContain("submission_requested");
    expect(page.body.textContent).toContain("document.modelContext");
    expect(page.body.textContent).not.toContain("Local storage");
    expect(page.querySelectorAll(".metric-card, #claim-count, #open-count, #closed-count, #unknown-count")).toHaveLength(0);
    expect(page.querySelectorAll("button, input, form")).toHaveLength(0);
    expect(page.querySelectorAll("script[src^='http'], link[href^='http']")).toHaveLength(0);
  });

  it("keeps popup and dashboard entries free of runtime claim reads", () => {
    const popupEntry = readFileSync(resolve(process.cwd(), "src/entries/popup.ts"), "utf8");
    const dashboardEntry = readFileSync(resolve(process.cwd(), "src/entries/dashboard.ts"), "utf8");
    expect(popupEntry).toContain("chrome.tabs.create");
    expect(popupEntry).not.toContain("chrome.runtime.sendMessage");
    expect(dashboardEntry).not.toContain("sendMessage");
    expect(dashboardEntry).not.toContain("claims.read");
    expect(dashboardEntry).not.toContain("chrome.storage");
    expect(dashboardEntry).not.toContain("localStorage");
  });
});
