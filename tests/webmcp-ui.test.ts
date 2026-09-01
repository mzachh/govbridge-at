import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Claim } from "../src/domain/claim.js";
import { summarizeDashboardCounts } from "../src/ui/dashboard.js";
import { renderPopup } from "../src/ui/popup.js";
import {
  createReadOnlyClaimTools,
  registerPageTools,
  StorageUnavailableError,
} from "../src/webmcp/index.js";
import type {
  ClaimRepository,
  WebMcpToolDefinition,
} from "../src/webmcp/types.js";

const claims: Claim[] = [
  {
    id: "open-1",
    provider: "Dr. Beispiel <img src=x onerror=alert(1)>",
    invoiceDate: "2026-08-14",
    treatmentDate: "2026-08-10",
    invoiceAmount: 185,
    status: "processing",
    source: "oegk",
    lastSeen: "2026-08-30T18:42:00.000Z",
  },
  {
    id: "done-1",
    invoiceDate: "2026-01-03",
    invoiceAmount: 240,
    reimbursementAmount: 94.2,
    reimbursementDate: "2026-02-01",
    responseAvailable: true,
    status: "completed",
    source: "oegk",
    lastSeen: "2026-08-29T10:00:00.000Z",
  },
  {
    id: "unknown-1",
    reimbursementAmount: 12,
    status: "unknown",
    source: "oegk",
    lastSeen: "2026-08-28T10:00:00.000Z",
  },
];

function repository(values: readonly Claim[] = claims): ClaimRepository & { reads: number } {
  return {
    reads: 0,
    async read() {
      this.reads += 1;
      return {
        schemaVersion: 1,
        claims: [...values],
        events: [],
        updatedAt: "2026-08-30T19:00:00.000Z",
      };
    },
  };
}

describe("read-only WebMCP handlers", () => {
  it("reads the latest repository state on every call and returns detached claims", async () => {
    let current = claims;
    const repo: ClaimRepository & { reads: number } = {
      reads: 0,
      async read() {
        this.reads += 1;
        return {
          schemaVersion: 1,
          claims: current,
          events: [],
          updatedAt: "2026-08-30T19:00:00.000Z",
        };
      },
    };
    const tools = createReadOnlyClaimTools(repo);
    const list = tools.find(({ name }) => name === "list_claims")!;
    const first = await list.execute({});
    current = [{ ...claims[0]!, provider: "Aktualisiert" }, ...claims.slice(1)];
    const second = await list.execute({});
    expect(repo.reads).toBe(2);
    expect(first).toMatchObject({ ok: true, data: { count: 3 } });
    expect(second.ok && (second.data as { claims: Claim[] }).claims[0]?.provider).toBe(
      "Aktualisiert",
    );
    if (first.ok) {
      expect((first.data as { claims: Claim[] }).claims[0]).not.toBe(claims[0]);
    }
  });

  it("filters open claims and calculates invoice-year totals only", async () => {
    const tools = createReadOnlyClaimTools(repository());
    const open = await tools.find(({ name }) => name === "get_open_claims")!.execute({});
    const summary = await tools
      .find(({ name }) => name === "get_reimbursement_summary")!
      .execute({ year: 2026 });
    expect(open).toMatchObject({ ok: true, data: { count: 1, claims: [{ id: "open-1" }] } });
    expect(summary).toEqual({
      ok: true,
      data: {
        year: 2026,
        claimCount: 2,
        invoiceAmountKnownCount: 2,
        reimbursementAmountKnownCount: 1,
        invoiceTotal: 425,
        reimbursedTotal: 94.2,
        yearBasis: "invoiceDate",
        currency: "EUR",
      },
    });
  });

  it("strictly rejects missing, extra, malformed and boundary-invalid inputs before reading", async () => {
    const repo = repository();
    const tools = createReadOnlyClaimTools(repo);
    const list = tools.find(({ name }) => name === "list_claims")!;
    const get = tools.find(({ name }) => name === "get_claim")!;
    const summary = tools.find(({ name }) => name === "get_reimbursement_summary")!;
    for (const [tool, input] of [
      [list, { extra: true }],
      [get, {}],
      [get, { claimId: "", extra: true }],
      [get, { claimId: "x".repeat(257) }],
      [summary, { year: 1999 }],
      [summary, { year: 2026.5 }],
      [summary, { year: "2026" }],
    ] as const) {
      await expect(tool.execute(input)).resolves.toMatchObject({
        ok: false,
        error: { code: "INVALID_INPUT" },
      });
    }
    expect(repo.reads).toBe(0);
  });

  it("distinguishes not-found and storage failures without leaking details", async () => {
    const get = createReadOnlyClaimTools(repository())
      .find(({ name }) => name === "get_claim")!;
    expect(await get.execute({ claimId: "missing" })).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Claim not found." },
    });
    const storageTool = createReadOnlyClaimTools({
      async read() {
        throw new StorageUnavailableError("private database bytes");
      },
    })[0]!;
    const otherStorageFailure = createReadOnlyClaimTools({
      async read() {
        throw new Error("secret claim content");
      },
    })[0]!;
    expect(await storageTool.execute({})).toEqual({
      ok: false,
      error: { code: "STORAGE_UNAVAILABLE", message: "Local claim storage is unavailable." },
    });
    expect(await otherStorageFailure.execute({})).toEqual({
      ok: false,
      error: { code: "STORAGE_UNAVAILABLE", message: "Local claim storage is unavailable." },
    });
  });
});

describe("extension-page WebMCP registration", () => {
  it("is capability gated, static, read-only, lifecycle-bound and idempotent", async () => {
    const unsupported = await registerPageTools({}, async () => ({ ok: true, data: {} }));
    expect(unsupported).toEqual({ available: false, reason: "unsupported" });

    const definitions: WebMcpToolDefinition[] = [];
    const signals: AbortSignal[] = [];
    const extensionDocument = {
      modelContext: {
        async registerTool(tool: WebMcpToolDefinition, options?: { signal?: AbortSignal }) {
          definitions.push(tool);
          if (options?.signal) signals.push(options.signal);
        },
      },
    };
    const execute = vi.fn(async () => ({ ok: true, data: {} }));
    const first = await registerPageTools(extensionDocument, execute);
    const second = await registerPageTools(extensionDocument, execute);
    expect(first.available).toBe(true);
    expect(second.available).toBe(true);
    expect(definitions.map(({ name }) => name)).toEqual([
      "list_claims",
      "get_open_claims",
      "get_claim",
      "get_reimbursement_summary",
    ]);
    expect(definitions.every(({ annotations }) => annotations.readOnlyHint)).toBe(true);
    await expect(definitions.find(({ name }) => name === "get_claim")!.execute({}))
      .resolves.toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
    expect(execute).not.toHaveBeenCalled();
    await expect(definitions.find(({ name }) => name === "get_claim")!.execute({ claimId: "synthetic" }))
      .resolves.toEqual({ ok: true, data: {} });
    expect(execute).toHaveBeenCalledWith("get_claim", { claimId: "synthetic" });
    expect(signals).toHaveLength(4);
    expect(new Set(signals).size).toBe(1);
    expect(signals[0]!.aborted).toBe(false);
    if (first.available) first.dispose();
    expect(signals[0]!.aborted).toBe(true);
  });

  it("aborts partial registration and fails closed when registration rejects", async () => {
    const observedSignals: AbortSignal[] = [];
    const result = await registerPageTools(
      {
        modelContext: {
          registerTool: vi.fn(async (_tool, options) => {
            if (options?.signal) observedSignals.push(options.signal);
            throw new DOMException("not allowed", "NotAllowedError");
          }),
        },
      },
      async () => ({ ok: true, data: {} }),
    );
    expect(result).toEqual({ available: false, reason: "rejected" });
    expect(observedSignals[0]!.aborted).toBe(true);
  });
});

describe("safe German popup rendering", () => {
  it("renders summaries, localized fields, provenance and adversarial text as text only", () => {
    document.body.innerHTML = "<main id='app'></main>";
    const root = document.querySelector<HTMLElement>("#app")!;
    renderPopup(root, { state: "ready", claims, hasObserved: true, demo: true, stale: true });
    expect(root.textContent).toContain("OEGK Claim Tracker");
    expect(root.textContent).toContain("3 Einreichungen · 1 offen · 1 Status unbekannt");
    expect(root.textContent).toContain("OFFEN");
    expect(root.textContent).toContain("STATUS UNBEKANNT");
    expect(root.textContent).toContain("425,00");
    expect(root.textContent).toContain("94,20");
    expect(root.textContent).toContain("Rechnungsdatum unbekannt: 1");
    expect(root.textContent).toContain("Demo data");
    expect(root.textContent).toContain("möglicherweise nicht aktuell");
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("h3")?.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(root.innerHTML).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(root.querySelectorAll("button, input, form, a")).toHaveLength(0);
    expect(root.querySelector("h1")).not.toBeNull();
    expect(root.querySelector("ul[aria-labelledby='claims-heading']")).not.toBeNull();
  });

  it("distinguishes loading, no-observation, empty and error while preserving prior views", () => {
    document.body.innerHTML = "<main id='app'></main>";
    const root = document.querySelector<HTMLElement>("#app")!;
    renderPopup(root, { state: "loading" });
    expect(root.textContent).toContain("geladen");
    renderPopup(root, { state: "ready", claims: [], hasObserved: false });
    expect(root.textContent).toContain("Noch keine Beobachtungen");
    renderPopup(root, { state: "ready", claims: [], hasObserved: true });
    expect(root.textContent).toContain("keine Einreichungen gefunden");
    const validView = root.textContent;
    renderPopup(root, { state: "error" });
    expect(root.textContent).toContain(validView);
    expect(root.querySelector("[role='alert']")).not.toBeNull();
  });

  it("does not present an all-missing yearly amount as a known zero", () => {
    document.body.innerHTML = "<main id='app'></main>";
    const root = document.querySelector<HTMLElement>("#app")!;
    renderPopup(root, {
      state: "ready",
      hasObserved: true,
      claims: [{ id: "local-v1-synthetic", status: "processing", source: "oegk", lastSeen: "2026-08-30T18:42:00.000Z", invoiceDate: "2026-08-01" }],
    });
    expect(root.textContent).toContain("Nicht verfügbar");
    expect(root.textContent).not.toContain("0,00");
  });
});

describe("hackathon WebMCP dashboard", () => {
  it("shows the exact tool names, contracts, read-only annotation and architecture", () => {
    const html = readFileSync(resolve(process.cwd(), "dashboard.html"), "utf8");
    const page = new DOMParser().parseFromString(html, "text/html");
    expect(Array.from(page.querySelectorAll(".tool-card__top code"), (node) => node.textContent)).toEqual([
      "list_claims",
      "get_open_claims",
      "get_claim",
      "get_reimbursement_summary",
    ]);
    expect(page.querySelector(".read-only-badge")?.textContent).toBe("readOnlyHint: true");
    expect(page.body.textContent).toContain("document.modelContext");
    expect(page.body.textContent).toContain("Chrome storage");
    expect(page.body.textContent).toContain("MAIN-world proxy tools");
    expect(page.querySelectorAll("button, input, form")).toHaveLength(0);
    expect(page.querySelectorAll("script[src^='http'], link[href^='http']")).toHaveLength(0);
  });

  it("derives aggregate-only status groups without exposing claim fields", () => {
    expect(summarizeDashboardCounts(claims)).toEqual({
      observed: 3,
      open: 1,
      closed: 1,
      unknown: 1,
    });
  });
});
