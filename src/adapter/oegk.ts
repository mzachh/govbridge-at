import {
  type ClaimExtractionResult,
  type ClaimObservation,
  type ClaimPageKind,
  type ClaimStatus,
  normalizeEuroAmount,
  normalizeLocalDate,
  normalizeText
} from "../domain/claim";

export interface OegkAdapterLocation {
  origin: string;
  pathname: string;
}

export interface OegkAdapterOptions {
  document?: Document;
  location?: OegkAdapterLocation;
  fixtureOrigin?: string;
  debug?: boolean;
  debugLog?: (message: string) => void;
}

const LIVE_ORIGIN = "https://www.meinesv.at";
const PATHS: Record<ClaimPageKind, string> = {
  "type-range": "/vsInfo/views/KE/einreichungTyp.xhtml",
  results: "/vsInfo/views/KE/einreichungListe.xhtml",
  "open-rejected-detail": "/vsInfo/views/KE/einreichungDetailOA.xhtml",
  "reimbursed-detail": "/vsInfo/views/KE/einreichungDetail.xhtml"
};
const STATUS_HEADINGS = new Map<string, ClaimStatus>([
  ["offene Einreichungen", "processing"],
  ["abgelehnte Einreichungen", "rejected"],
  ["erstattete Einreichungen", "completed"]
]);
const EMPTY_MESSAGE = "In diesem Abfragezeitraum wurde keine Kostenerstattung bzw. kein Onlineantrag gefunden.";
const RANGE_ERROR = "Der Abfragezeitraum darf höchstens 5 Jahre betragen.";
const VALIDATION_ERROR = "Fehlerhafte Eingaben im Formular";

function shown(element: Element): boolean {
  if (element.closest('[hidden], [aria-hidden="true"]')) return false;
  const view = element.ownerDocument.defaultView;
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = view?.getComputedStyle(node);
    if (style?.display === "none" || style?.visibility === "hidden") return false;
  }
  return true;
}

function exactText(element: Element | null, expected: string): boolean {
  return normalizeText(element?.textContent) === expected;
}

function hasHeading(document: Document, level: "h1" | "h2", expected: string): boolean {
  return Array.from(document.querySelectorAll(level)).some((heading) => exactText(heading, expected));
}

function tableValues(document: Document): Map<string, string> {
  const values = new Map<string, string>();
  for (const header of Array.from(document.querySelectorAll("th"))) {
    const label = normalizeText(header.textContent);
    const value = normalizeText(header.parentElement?.querySelector("td")?.textContent);
    if (label && value) values.set(label, value);
  }
  return values;
}

function allCardSections(document: Document): Element[] {
  return Array.from(document.querySelectorAll(".card_container")).filter((container) =>
    container.querySelector(".card_title h2") !== null &&
    container.querySelector('[role="grid"].card_content') !== null);
}

function emptyAlert(document: Document): boolean {
  return Array.from(document.querySelectorAll('#infolist.infobox.yellow[role="alert"]'))
    .some((alert) => shown(alert) && normalizeText(alert.textContent)?.includes(EMPTY_MESSAGE));
}

function inferPageKind(document: Document, pathname: string): ClaimPageKind | undefined {
  if (pathname === PATHS["type-range"] && hasHeading(document, "h1", "Einreichungen abfragen")) {
    if (emptyAlert(document)) return "type-range";
    const form = Array.from(document.querySelectorAll('form[method="post" i]')).find((candidate) =>
      Array.from(candidate.querySelectorAll('a[role="tab"]')).some((tab) => exactText(tab, "Wahlarzt / Wahltherapeut")) &&
      candidate.querySelector('input#vonDatWAH[name="vonDatWAH"][placeholder="TT.MM.JJJJ"]') &&
      candidate.querySelector('input#bisDatWAH[name="bisDatWAH"][placeholder="TT.MM.JJJJ"]') &&
      Array.from(candidate.querySelectorAll('input[type="submit"], button[type="submit"]'))
        .some((control) => control instanceof HTMLInputElement ? control.value === "Weiter" : exactText(control, "Weiter")));
    if (form) return "type-range";
  }
  if (pathname === PATHS.results && hasHeading(document, "h1", "Liste der Einreichungen")) return "results";
  if (pathname === PATHS["open-rejected-detail"] && hasHeading(document, "h1", "Einreichung Detail")) {
    return "open-rejected-detail";
  }
  if (pathname === PATHS["reimbursed-detail"] && hasHeading(document, "h1", "Einreichung Detail")) {
    return "reimbursed-detail";
  }
  return undefined;
}

function withOptional<T extends object, K extends string, V>(base: T, key: K, value: V | undefined): T & Partial<Record<K, V>> {
  return value === undefined ? base : { ...base, [key]: value };
}

function parseResultRow(row: Element, status: ClaimStatus): ClaimObservation | undefined {
  const provider = normalizeText(row.querySelector(".cb_title > h4")?.textContent);
  const title = normalizeText(row.querySelector(".cb_title")?.textContent) ?? "";
  const invoiceMatch = /(?:^|\s)Rechnung vom\s+(\d{2}\.\d{2}\.\d{4})(?:\s|$)/u.exec(title);
  const invoiceDate = normalizeLocalDate(invoiceMatch?.[1]);
  let reimbursementAmount: number | undefined;
  if (status === "completed") {
    const badge = normalizeText(row.querySelector(".cb_status .badge")?.textContent) ?? "";
    const amountMatch = /^Rückerstattung:\s*(?:↪\s*)?([0-9][0-9., \u00a0\u202f]*)\s*€$/iu.exec(badge);
    reimbursementAmount = normalizeEuroAmount(amountMatch?.[1]);
  }
  if (!provider && !invoiceDate && reimbursementAmount === undefined) return undefined;
  let observation: ClaimObservation = { status, source: "oegk" };
  observation = withOptional(observation, "provider", provider);
  observation = withOptional(observation, "invoiceDate", invoiceDate);
  observation = withOptional(observation, "reimbursementAmount", reimbursementAmount);
  return observation;
}

function parseRange(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return normalizeLocalDate(value);
}

function observedRange(document: Document): { from: string; to: string } | undefined {
  const from = parseRange((document.querySelector<HTMLInputElement>("#vonDat") ??
    document.querySelector<HTMLInputElement>("#vonDatWAH"))?.value);
  const to = parseRange((document.querySelector<HTMLInputElement>("#bisDat") ??
    document.querySelector<HTMLInputElement>("#bisDatWAH"))?.value);
  return from && to ? { from, to } : undefined;
}

function parseTreatmentRange(value: string | undefined): { start?: string; end?: string } {
  if (!value) return {};
  const dates = value.match(/\d{2}\.\d{2}\.\d{4}/gu) ?? [];
  const start = normalizeLocalDate(dates[0]);
  const end = normalizeLocalDate(dates[1]);
  return {
    ...(start ? { start } : {}),
    ...(end ? { end } : {})
  };
}

function parseDetail(document: Document, pageKind: "open-rejected-detail" | "reimbursed-detail"): ClaimObservation | undefined {
  const values = tableValues(document);
  const provider = normalizeText(values.get("Behandler:"));
  const invoiceAmount = normalizeEuroAmount(values.get("Rechnungsbetrag:"));
  const reimbursementAmount = normalizeEuroAmount(values.get("Höhe der Kostenerstattung:"));
  const reimbursementDate = normalizeLocalDate(values.get("Datum der Erstattung:"));
  const transientSourceId = normalizeText(values.get("Antragsnummer:"));
  const treatment: { start?: string; end?: string } = pageKind === "open-rejected-detail"
    ? (() => { const start = normalizeLocalDate(values.get("Behandlung ab:")); return start ? { start } : {}; })()
    : parseTreatmentRange(values.get("Behandlungszeitraum:"));
  const rejected = values.has("Ablehnungsgrund:");
  const status: ClaimStatus = pageKind === "reimbursed-detail" ? "completed" : rejected ? "rejected" : "processing";
  if (!provider && invoiceAmount === undefined && reimbursementAmount === undefined && !reimbursementDate && !treatment.start) {
    return undefined;
  }
  let observation: ClaimObservation = { status, source: "oegk" };
  observation = withOptional(observation, "provider", provider);
  observation = withOptional(observation, "invoiceAmount", invoiceAmount);
  observation = withOptional(observation, "reimbursementAmount", reimbursementAmount);
  observation = withOptional(observation, "reimbursementDate", reimbursementDate);
  observation = withOptional(observation, "treatmentDate", treatment.start);
  observation = withOptional(observation, "treatmentEndDate", treatment.end);
  observation = withOptional(observation, "transientSourceId", transientSourceId);
  return observation;
}

export class OegkAdapter {
  private readonly document: Document;
  private readonly location: OegkAdapterLocation;
  private readonly allowedOrigin: string;
  private readonly debug: boolean;
  private readonly debugLog: (message: string) => void;

  constructor(options: OegkAdapterOptions = {}) {
    this.document = options.document ?? document;
    this.location = options.location ?? { origin: window.location.origin, pathname: window.location.pathname };
    this.allowedOrigin = options.fixtureOrigin ?? LIVE_ORIGIN;
    this.debug = options.debug ?? false;
    this.debugLog = options.debugLog ?? (() => undefined);
  }

  canHandlePage(): boolean {
    return this.location.origin === this.allowedOrigin && inferPageKind(this.document, this.location.pathname) !== undefined;
  }

  async extractClaims(): Promise<ClaimExtractionResult> {
    if (this.location.origin !== this.allowedOrigin) return this.result("unsupported", false, [], 0, 0);
    const pageKind = inferPageKind(this.document, this.location.pathname);
    const plausiblePath = Object.values(PATHS).includes(this.location.pathname);
    const loading = plausiblePath && (Array.from(this.document.querySelectorAll('[aria-busy="true"], [role="progressbar"], .loading')).some(shown) ||
      this.document.readyState === "loading");
    if (loading) return this.result("loading", false, [], 0, 0, pageKind);
    const hasError = plausiblePath && Array.from(this.document.querySelectorAll('[role="alert"]'))
      .some((alert) => shown(alert) && [RANGE_ERROR, VALIDATION_ERROR].some((message) => normalizeText(alert.textContent)?.includes(message)));
    if (hasError) return this.result("error", false, [], 0, 0, pageKind);
    if (!pageKind) {
      return this.result("unsupported", false, [], 0, 0);
    }
    if (pageKind === "type-range") {
      const empty = emptyAlert(this.document);
      return this.result(empty ? "empty" : "complete", empty, [], 0, 0, pageKind, observedRange(this.document));
    }
    if (pageKind === "results") {
      const range = observedRange(this.document);
      if (emptyAlert(this.document)) return this.result("empty", true, [], 0, 0, pageKind, range);
      const sections = allCardSections(this.document).filter(shown);
      if (!sections.length) return this.result("error", false, [], 0, 0, pageKind, range);
      const claims: ClaimObservation[] = [];
      let candidateCount = 0;
      let skippedCount = 0;
      for (const section of sections) {
        const heading = normalizeText(section.querySelector(".card_title h2")?.textContent) ?? "";
        const status = STATUS_HEADINGS.get(heading) ?? "unknown";
        for (const row of Array.from(section.querySelectorAll('[role="grid"].card_content [role="row"]'))) {
          if (!shown(row)) continue;
          candidateCount += 1;
          const claim = parseResultRow(row, status);
          if (claim) claims.push(claim); else skippedCount += 1;
        }
      }
      // Site transitions can temporarily hide every row without a busy marker.
      // Only the explicit empty alert is evidence for an empty search result.
      if (candidateCount === 0) return this.result("loading", false, [], 0, 0, pageKind, range);
      return this.result("complete", skippedCount === 0, claims, candidateCount, skippedCount, pageKind, range);
    }
    const detail = parseDetail(this.document, pageKind);
    return this.result(detail ? "complete" : "error", !!detail, detail ? [detail] : [], 1, detail ? 0 : 1, pageKind);
  }

  private result(
    state: ClaimExtractionResult["state"], snapshotComplete: boolean, claims: ClaimObservation[],
    candidateCount: number, skippedCount: number, pageKind?: ClaimPageKind,
    range?: { from: string; to: string }
  ): ClaimExtractionResult {
    if (this.debug) this.debugLog(`OEGK adapter: state=${state}; candidates=${candidateCount}; skipped=${skippedCount}`);
    return {
      state, snapshotComplete, observations: claims,
      diagnostics: { candidateCount, skippedCount },
      ...(pageKind ? { pageKind } : {}),
      ...(range ? { observedRange: range } : {})
    };
  }
}

export const OEGK_PATHS = Object.freeze({ ...PATHS });
