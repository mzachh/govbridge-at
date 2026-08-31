import { describe, expect, it } from "vitest";
import {
  classifyStatus,
  normalizeEuroAmount,
  normalizeLocalDate,
  normalizeText,
  sortClaims,
  summarizeClaimsByInvoiceYear,
  validateClaim,
  type Claim
} from "../src/domain/claim";
import { OegkAdapter } from "../src/adapter/oegk";

const FIXTURE_ORIGIN = "https://fixture.invalid";

function fixture(markup: string, pathname: string): OegkAdapter {
  const document = new DOMParser().parseFromString(markup, "text/html");
  return new OegkAdapter({
    document,
    fixtureOrigin: FIXTURE_ORIGIN,
    location: { origin: FIXTURE_ORIGIN, pathname }
  });
}

function claim(overrides: Partial<Claim>): Claim {
  return {
    id: "local-synthetic-1",
    status: "processing",
    source: "oegk",
    lastSeen: "2026-08-30T12:00:00.000Z",
    ...overrides
  };
}

describe("OEGK-CLAIM-001 OEGK-CLAIM-002 canonical domain", () => {
  it("OEGK-CLAIM-001 validates only the closed canonical record", () => {
    expect(validateClaim(claim({}))).toBe(true);
    expect(validateClaim({ status: "processing", source: "oegk", lastSeen: "2026-08-30T12:00:00.000Z" })).toBe(false);
    expect(validateClaim({ ...claim({}), rawHtml: "<p>synthetic</p>" })).toBe(false);
  });

  it("OEGK-CLAIM-003 OEGK-CLAIM-004 OEGK-CLAIM-005 normalizes dates, EUR, and text conservatively", () => {
    expect(normalizeLocalDate("31.08.2026")).toBe("2026-08-31");
    expect(normalizeLocalDate("31.02.2026")).toBeUndefined();
    expect(normalizeEuroAmount("1.234,56 €")).toBe(1234.56);
    expect(normalizeEuroAmount("1,234.56 EUR")).toBeUndefined();
    expect(normalizeEuroAmount("94.20 €")).toBe(94.2);
    expect(normalizeEuroAmount("-1,00 €")).toBeUndefined();
    expect(normalizeEuroAmount("12.00 USD")).toBeUndefined();
    expect(normalizeText("  Praxis\n  Beispiel  ")).toBe("Praxis Beispiel");
  });

  it("OEGK-CLAIM-006 OEGK-STORAGE-005 sorts statuses and dates deterministically", () => {
    const sorted = sortClaims([
      claim({ id: "closed", status: "completed", invoiceDate: "2026-08-20" }),
      claim({ id: "unknown", status: "unknown", invoiceDate: "2026-08-30" }),
      claim({ id: "undated", status: "processing" }),
      claim({ id: "open", status: "submitted", invoiceDate: "2026-08-01" })
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["open", "undated", "unknown", "closed"]);
    expect(classifyStatus("submitted")).toBe("open");
    expect(classifyStatus("unknown")).toBe("unknown");
    expect(classifyStatus("rejected")).toBe("closed");
  });

  it("OEGK-UI-005 OEGK-WEBMCP-008 summarizes only the invoice year and known values", () => {
    const summary = summarizeClaimsByInvoiceYear([
      claim({ id: "a", invoiceDate: "2026-01-02", invoiceAmount: 100, reimbursementAmount: 40 }),
      claim({ id: "b", invoiceDate: "2026-05-06" }),
      claim({ id: "c", treatmentDate: "2026-05-06", invoiceAmount: 999 })
    ], 2026);
    expect(summary).toEqual({
      year: 2026,
      claimCount: 2,
      invoiceAmountKnownCount: 1,
      reimbursementAmountKnownCount: 1,
      invoiceTotal: 100,
      reimbursedTotal: 40,
      yearBasis: "invoiceDate",
      currency: "EUR"
    });
  });
});

describe("OEGK-ADAPTER fixture extraction", () => {
  it("OEGK-ADAPTER-001 OEGK-ADAPTER-009 recognizes only origin, path, and landmarks", () => {
    const markup = `<!doctype html><h1>Einreichungen abfragen</h1>
      <form method="post"><a role="tab">Wahlarzt / Wahltherapeut</a>
      <input id="vonDatWAH" name="vonDatWAH" placeholder="TT.MM.JJJJ"><input id="bisDatWAH" name="bisDatWAH" placeholder="TT.MM.JJJJ">
      <input type="submit" value="Weiter"></form>`;
    expect(fixture(markup, "/vsInfo/views/KE/einreichungTyp.xhtml").canHandlePage()).toBe(true);
    expect(fixture(markup, "/unrelated.xhtml").canHandlePage()).toBe(false);
    const document = new DOMParser().parseFromString(markup, "text/html");
    expect(new OegkAdapter({ document, location: { origin: "https://unrelated.invalid", pathname: "/vsInfo/views/KE/einreichungTyp.xhtml" } }).canHandlePage()).toBe(false);
  });

  it("OEGK-ADAPTER-003 OEGK-ADAPTER-004 OEGK-ADAPTER-006 OEGK-ADAPTER-011 extracts scoped duplicate-looking list rows", async () => {
    const adapter = fixture(`<!doctype html><h1>Liste der Einreichungen</h1><form method="post">
      <input id="vonDat" value="01.01.2026"><input id="bisDat" value="31.12.2026">
      <section class="card_container"><div class="card_title"><h2>offene Einreichungen</h2></div>
        <div role="grid" class="card_content">
          <div role="row"><div class="cb_date">NICHT VERWENDEN</div><div class="cb_title"><h4>Praxis Alpha</h4>Rechnung vom 14.08.2026</div></div>
          <div role="row"><div class="cb_title"><h4>Praxis Alpha</h4>Rechnung vom 14.08.2026</div></div>
          <div role="row"><div class="cb_date">malformed synthetic sibling</div></div>
        </div></section>
      <section class="card_container"><div class="card_title"><h2>abgelehnte Einreichungen</h2></div>
        <div role="grid" class="card_content"><div role="row"><div class="cb_title">Rechnung vom 15.08.2026</div><div class="cb_status"><span class="badge error">abgelehnt</span></div></div></div>
      </section>
      <section class="card_container"><div class="card_title"><h2>erstattete Einreichungen</h2></div>
        <div role="grid" class="card_content"><div role="row"><div class="cb_title"><h4>Praxis Beta</h4>Rechnung vom 16.08.2026</div><div class="cb_status"><span class="badge">RÜCKERSTATTUNG: ↪ 94.20 €</span></div><div class="cb_download"><a href="#">PDF</a></div></div></div>
      </section>
      <section class="card_container"><div class="card_title"><h2>synthetischer neuer Status</h2></div>
        <div role="grid" class="card_content"><div role="row"><div class="cb_title"><h4>Praxis Delta</h4>Rechnung vom 17.08.2026</div></div></div>
      </section></form>`, "/vsInfo/views/KE/einreichungListe.xhtml");
    const result = await adapter.extractClaims();
    expect(result.state).toBe("complete");
    expect(result.snapshotComplete).toBe(true);
    expect(result.observedRange).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(result.observations).toHaveLength(5);
    expect(result.observations.map((item) => item.status)).toEqual(["processing", "processing", "rejected", "completed", "unknown"]);
    expect(result.diagnostics).toEqual({ candidateCount: 6, skippedCount: 1 });
    expect(result.observations[0]).not.toHaveProperty("submittedDate");
    expect(result.observations[3]?.reimbursementAmount).toBe(94.2);
  });

  it("OEGK-ADAPTER-005 OEGK-ADAPTER-008 OEGK-ADAPTER-010 distinguishes empty, partial, and unsupported", async () => {
    const empty = fixture(`<!doctype html><h1>Liste der Einreichungen</h1><form method="post">
      <div id="infolist" class="infobox yellow" role="alert">In diesem Abfragezeitraum wurde keine Kostenerstattung bzw. kein Onlineantrag gefunden.</div></form>`, "/vsInfo/views/KE/einreichungListe.xhtml");
    expect(await empty.extractClaims()).toMatchObject({ state: "empty", snapshotComplete: true, observations: [] });

    const loading = fixture(`<!doctype html><h1>Liste der Einreichungen</h1><div role="progressbar"></div>`, "/vsInfo/views/KE/einreichungListe.xhtml");
    expect(await loading.extractClaims()).toMatchObject({ state: "loading", snapshotComplete: false });
    expect(await fixture("<h1>Unrelated</h1>", "/unrelated.xhtml").extractClaims()).toMatchObject({ state: "unsupported", snapshotComplete: false });
  });

  it("OEGK-ADAPTER-008 OEGK-ADAPTER-012 extracts allowed detail values and excludes sensitive rows", async () => {
    const detail = fixture(`<!doctype html><h1>Einreichung Detail</h1><table>
      <tr><th>Behandlung für:</th><td>Synthetic Person</td></tr>
      <tr><th>Behandlungszeitraum:</th><td>01.08.2026 - 03.08.2026</td></tr>
      <tr><th>Rechnungsbetrag:</th><td>200,00 €</td></tr>
      <tr><th>Behandler:</th><td>Praxis Gamma</td></tr>
      <tr><th>Höhe der Kostenerstattung:</th><td>80,00 €</td></tr>
      <tr><th>Datum der Erstattung:</th><td>20.08.2026</td></tr>
      <tr><th>Erstattung auf das Konto:</th><td>REDACTED SYNTHETIC</td></tr>
      <tr><th>abzüglich Einbehalt(e)</th><td>2,00 €</td></tr>
      </table>`, "/vsInfo/views/KE/einreichungDetail.xhtml");
    const result = await detail.extractClaims();
    expect(result).toMatchObject({ state: "complete", pageKind: "reimbursed-detail", snapshotComplete: false });
    expect(result.observations[0]).toEqual({
      status: "completed", source: "oegk", provider: "Praxis Gamma",
      treatmentDate: "2026-08-01", treatmentEndDate: "2026-08-03",
      invoiceAmount: 200, reimbursementAmount: 80, reimbursementDate: "2026-08-20"
    });
    expect(JSON.stringify(result.observations)).not.toContain("REDACTED");
  });
});
