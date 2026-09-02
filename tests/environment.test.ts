import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_ORIGINS,
  DEMO_ORIGIN,
  PRODUCTION_ORIGIN,
  manifestMatchesForProfile,
  pageToolCatalog,
  resolveSiteContext,
  siteContextsForProfile,
} from "../src/webmcp/index.js";
import { isSupportedMeineSvUrl } from "../src/webmcp/scope.js";
import { SEARCH_PAGE_PATH } from "../src/webmcp/catalog.js";

describe("approved SiteContext environments", () => {
  it("accepts the approved production and loopback origins in the default package", () => {
    expect(DEMO_ORIGIN).toBeUndefined();
    expect(resolveSiteContext(`${PRODUCTION_ORIGIN}${SEARCH_PAGE_PATH}`)).toEqual({
      origin: PRODUCTION_ORIGIN,
      environment: "production",
    });
    expect(isSupportedMeineSvUrl(`${PRODUCTION_ORIGIN}${SEARCH_PAGE_PATH}`)).toBe(true);
    for (const origin of DEVELOPMENT_ORIGINS) {
      expect(resolveSiteContext(`${origin}${SEARCH_PAGE_PATH}`)).toEqual({
        origin,
        environment: "development",
      });
      expect(isSupportedMeineSvUrl(`${origin}${SEARCH_PAGE_PATH}`)).toBe(true);
    }
    expect(resolveSiteContext("https://www.meinesv.at.evil.invalid/vsInfo/views/KE/einreichungListe.xhtml")).toBeUndefined();
    expect(resolveSiteContext("http://www.meinesv.at/vsInfo/views/KE/einreichungListe.xhtml")).toBeUndefined();
    expect(resolveSiteContext("https://www.meinesv.at:8443/vsInfo/views/KE/einreichungListe.xhtml")).toBeUndefined();
  });

  it("accepts only the fixed loopback origins and exact port in development", () => {
    expect(DEVELOPMENT_ORIGINS).toEqual(["http://localhost:4173", "http://127.0.0.1:4173"]);
    for (const origin of DEVELOPMENT_ORIGINS) {
      expect(resolveSiteContext(`${origin}${SEARCH_PAGE_PATH}`, "development")).toEqual({
        origin,
        environment: "development",
      });
      expect(isSupportedMeineSvUrl(`${origin}${SEARCH_PAGE_PATH}`, "development")).toBe(true);
    }
    expect(resolveSiteContext("http://localhost:4174/vsInfo/views/KE/einreichungListe.xhtml", "development")).toBeUndefined();
    expect(resolveSiteContext("http://127.0.0.1/vsInfo/views/KE/einreichungListe.xhtml", "development")).toBeUndefined();
    expect(resolveSiteContext("http://0.0.0.0:4173/vsInfo/views/KE/einreichungListe.xhtml", "development")).toBeUndefined();
    expect(resolveSiteContext("https://www.meinesv.at/vsInfo/views/KE/einreichungListe.xhtml", "development")).toMatchObject({ environment: "production" });
  });

  it("uses the profile policy for manifest scope and page registration metadata", () => {
    expect(manifestMatchesForProfile("production")).toEqual([
      "https://www.meinesv.at/vsInfo/views/KE/*",
      "http://localhost:4173/vsInfo/views/KE/*",
      "http://127.0.0.1:4173/vsInfo/views/KE/*",
    ]);
    expect(manifestMatchesForProfile("development")).toEqual([
      "https://www.meinesv.at/vsInfo/views/KE/*",
      "http://localhost:4173/vsInfo/views/KE/*",
      "http://127.0.0.1:4173/vsInfo/views/KE/*",
    ]);
    expect(siteContextsForProfile("development").map(({ environment }) => environment)).toEqual([
      "production", "development", "development",
    ]);
    const tools = pageToolCatalog(`http://localhost:4173${SEARCH_PAGE_PATH}`, "development");
    expect(tools.map(({ name }) => name)).toEqual([
      "list_claims", "get_open_claims", "get_claim", "search_claims",
    ]);
    expect(tools.every(({ description }) => !description.includes("Synthetic demo"))).toBe(true);
  });

  it("does not admit an unconfigured demo host through a cross-environment profile", () => {
    expect(resolveSiteContext("https://demo.example.invalid/vsInfo/views/KE/einreichungTyp.xhtml", "production")).toBeUndefined();
    expect(resolveSiteContext("https://demo.example.invalid/vsInfo/views/KE/einreichungTyp.xhtml", "demo")).toBeUndefined();
    expect(isSupportedMeineSvUrl("https://demo.example.invalid/vsInfo/views/KE/einreichungTyp.xhtml", "demo")).toBe(false);
  });
});
