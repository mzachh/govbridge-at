import { describe, expect, it } from "vitest";
import { isSupportedMeineSvUrl, parseExtensionRequest } from "../src/entries/messages.js";

const validResult = {
  state: "complete",
  pageKind: "results",
  snapshotComplete: true,
  observations: [{ provider: "Synthetic Clinic", invoiceDate: "2026-08-01", status: "processing", source: "oegk" }],
  observedRange: { from: "2026-01-01", to: "2026-08-30" },
  diagnostics: { candidateCount: 1, skippedCount: 0 },
};

describe("OEGK-SEC-002 OEGK-SEC-003 closed extension messages", () => {
  it("accepts only the exact observation envelope", () => {
    expect(parseExtensionRequest({ type: "claims.observe", result: validResult })?.type).toBe("claims.observe");
    expect(parseExtensionRequest({ type: "claims.observe", result: validResult, rawHtml: "forbidden" })).toBeUndefined();
  });

  it("rejects extra, malformed, and unknown read requests", () => {
    expect(parseExtensionRequest({ type: "claims.read" })?.type).toBe("claims.read");
    expect(parseExtensionRequest({ type: "claims.read", key: "all" })).toBeUndefined();
    expect(parseExtensionRequest({ type: "unknown" })).toBeUndefined();
  });

  it("rejects observations containing excluded or malformed fields", () => {
    expect(parseExtensionRequest({ type: "claims.observe", result: {
      ...validResult,
      observations: [{ ...validResult.observations[0], bankAccount: "SYNTHETIC-FORBIDDEN" }],
    } })).toBeUndefined();
    expect(parseExtensionRequest({ type: "claims.observe", result: {
      ...validResult,
      observations: [{ ...validResult.observations[0], invoiceDate: "31.02.2026" }],
    } })).toBeUndefined();
  });
});

describe("OEGK-SEC-001 exact content-script sender scope", () => {
  it("accepts only the exact origin and supported paths", () => {
    expect(isSupportedMeineSvUrl("https://www.meinesv.at/vsInfo/views/KE/einreichungListe.xhtml")).toBe(true);
    expect(isSupportedMeineSvUrl("https://www.meinesv.at/vsInfo/views/KE/einreichungDetailOA.xhtml?x=1")).toBe(true);
    expect(isSupportedMeineSvUrl("https://evil.example/vsInfo/views/KE/einreichungListe.xhtml")).toBe(false);
    expect(isSupportedMeineSvUrl("https://www.meinesv.at/other")).toBe(false);
  });
});
