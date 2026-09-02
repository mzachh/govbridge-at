import {
  type ClaimExtractionResult,
  type ClaimObservation,
  type ClaimPageKind,
  type ClaimStatus,
  normalizeEuroAmount,
  normalizeLocalDate,
  normalizeText
} from "../domain/claim";
import { PRODUCTION_ORIGIN } from "../environment/site-context.js";
import { labelsForOrigin, type OegkLabels } from "../environment/demo-labels.js";

export interface OegkAdapterLocation {
  origin: string;
  pathname: string;
}

export interface OegkAdapterOptions {
  document?: Document;
  location?: OegkAdapterLocation;
  /** The approved origin resolved by the live reader. */
  expectedOrigin?: string;
  /** @deprecated Explicit test fixture hook; never derived from page input. */
  fixtureOrigin?: string;
  debug?: boolean;
  debugLog?: (message: string) => void;
}

const LIVE_ORIGIN = PRODUCTION_ORIGIN;
const PATHS: Record<ClaimPageKind, string> = {
  "type-range": "/vsInfo/views/KE/einreichungTyp.xhtml",
  results: "/vsInfo/views/KE/einreichungListe.xhtml",
  "open-rejected-detail": "/vsInfo/views/KE/einreichungDetailOA.xhtml",
  "reimbursed-detail": "/vsInfo/views/KE/einreichungDetail.xhtml"
};
function statusHeadings(labels: OegkLabels): Map<string, ClaimStatus> {
  return new Map<string, ClaimStatus>([
    [labels.openClaims, "processing"],
    [labels.rejectedClaims, "rejected"],
    [labels.reimbursedClaims, "completed"]
  ]);
}

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

/**
 * Read text that is actually rendered. A visible row can contain hidden field
 * values (for example, a responsive duplicate or an expanded private section),
 * so using textContent on the row itself would cross the page-data boundary.
 */
function visibleText(element: Element | null): string | undefined {
  if (!element || !shown(element)) return undefined;
  const chunks: string[] = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 3) {
      if (child.textContent) chunks.push(child.textContent);
    } else if (child.nodeType === 1) {
      const text = visibleText(child as Element);
      if (text) chunks.push(text);
    }
  }
  return normalizeText(chunks.join(" "));
}

function knownText(value: unknown): string | undefined {
  const text = normalizeText(value);
  if (!text || /^(?:-|—|n\/?a|not available|nicht verfügbar|unknown|unbekannt)$/iu.test(text)) return undefined;
  return text;
}

/**
 * Read only visible label/value pairs in the supplied scope. Results rows use
 * a claim-fields definition list, while the existing detail page uses a table.
 */
function labeledValues(scope: ParentNode, acceptedLabels: readonly string[]): Map<string, string> {
  const accepted = new Set(acceptedLabels);
  const values = new Map<string, string>();
  for (const row of Array.from(scope.querySelectorAll("tr"))) {
    if (!shown(row)) continue;
    const header = row.querySelector("th");
    const value = row.querySelector("td");
    const label = visibleText(header);
    if (!label || !accepted.has(label)) continue;
    const text = visibleText(value);
    if (text) values.set(label, text);
  }
  for (const field of Array.from(scope.querySelectorAll("dl.claim-fields > div"))) {
    if (!shown(field)) continue;
    const label = visibleText(field.querySelector("dt"));
    if (!label || !accepted.has(label)) continue;
    const value = visibleText(field.querySelector("dd"));
    if (value) values.set(label, value);
  }
  return values;
}

function hasVisibleLabel(scope: ParentNode, expected: string): boolean {
  return Array.from(scope.querySelectorAll("tr, dl.claim-fields > div")).some((row) =>
    shown(row) && visibleText(row.querySelector("th, dt")) === expected);
}

function allCardSections(document: Document): Element[] {
  return Array.from(document.querySelectorAll(".card_container")).filter((container) =>
    container.querySelector(".card_title h2") !== null &&
    container.querySelector('[role="grid"].card_content') !== null);
}

function emptyAlert(document: Document, labels: OegkLabels): boolean {
  return Array.from(document.querySelectorAll('#infolist.infobox.yellow[role="alert"]'))
    .some((alert) => shown(alert) && normalizeText(alert.textContent)?.includes(labels.empty));
}

function inferPageKind(document: Document, pathname: string, labels: OegkLabels): ClaimPageKind | undefined {
  if (pathname === PATHS["type-range"] && hasHeading(document, "h1", labels.typeHeading)) {
    if (emptyAlert(document, labels)) return "type-range";
    const form = Array.from(document.querySelectorAll('form[method="post" i]')).find((candidate) =>
      Array.from(candidate.querySelectorAll('a[role="tab"]')).some((tab) => exactText(tab, labels.doctorTab)) &&
      candidate.querySelector(`input#vonDatWAH[name="vonDatWAH"][placeholder="${labels.datePlaceholder}"]`) &&
      candidate.querySelector(`input#bisDatWAH[name="bisDatWAH"][placeholder="${labels.datePlaceholder}"]`) &&
      Array.from(candidate.querySelectorAll('input[type="submit"], button[type="submit"]'))
        .some((control) => control instanceof HTMLInputElement ? control.value === labels.continueSubmit : exactText(control, labels.continueSubmit)));
    if (form) return "type-range";
  }
  if (pathname === PATHS.results && hasHeading(document, "h1", labels.resultsHeading)) return "results";
  if (pathname === PATHS["open-rejected-detail"] && hasHeading(document, "h1", labels.detailHeading)) {
    return "open-rejected-detail";
  }
  if (pathname === PATHS["reimbursed-detail"] && hasHeading(document, "h1", labels.detailHeading)) {
    return "reimbursed-detail";
  }
  return undefined;
}

function withOptional<T extends object, K extends string, V>(base: T, key: K, value: V | undefined): T & Partial<Record<K, V>> {
  return value === undefined ? base : { ...base, [key]: value };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function parseResultRow(row: Element, status: ClaimStatus, labels: OegkLabels): ClaimObservation | undefined {
  const provider = knownText(visibleText(row.querySelector(".cb_title > h4")));
  const title = visibleText(row.querySelector(".cb_title")) ?? "";
  const invoiceMatch = new RegExp(`(?:^|\\s)${escapeRegExp(labels.invoiceDated)}\\s+(\\d{2}\\.\\d{2}\\.\\d{4})(?:\\s|$)`, "u").exec(title);
  const invoiceDate = normalizeLocalDate(invoiceMatch?.[1]);
  const values = labeledValues(row, [labels.invoiceAmount, labels.treatmentPeriod, labels.reimbursementAmount, labels.reimbursementDate]);
  const invoiceAmount = normalizeEuroAmount(values.get(labels.invoiceAmount));
  const treatment = parseTreatmentRange(values.get(labels.treatmentPeriod));
  const reimbursementAmountFromField = normalizeEuroAmount(values.get(labels.reimbursementAmount));
  let reimbursementAmount = reimbursementAmountFromField;
  if (reimbursementAmount === undefined) {
    const badge = visibleText(row.querySelector(".cb_status .badge")) ?? "";
    const amountMatch = new RegExp(`^(?:${escapeRegExp(labels.reimbursement)}\\s*(?:↪\\s*)?|↪\\s*)([0-9][0-9., \\u00a0\\u202f]*)\\s*€$`, "iu").exec(badge);
    reimbursementAmount = normalizeEuroAmount(amountMatch?.[1]);
  }
  const reimbursementDate = normalizeLocalDate(values.get(labels.reimbursementDate));
  if (!provider && !invoiceDate && invoiceAmount === undefined && !treatment.start && !treatment.end &&
      reimbursementAmount === undefined && !reimbursementDate) return undefined;
  let observation: ClaimObservation = { status, source: "oegk" };
  observation = withOptional(observation, "provider", provider);
  observation = withOptional(observation, "invoiceDate", invoiceDate);
  observation = withOptional(observation, "invoiceAmount", invoiceAmount);
  observation = withOptional(observation, "treatmentDate", treatment.start);
  observation = withOptional(observation, "treatmentEndDate", treatment.end);
  observation = withOptional(observation, "reimbursementAmount", reimbursementAmount);
  observation = withOptional(observation, "reimbursementDate", reimbursementDate);
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
  const dates = value.match(/(?:\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})/gu) ?? [];
  const start = normalizeLocalDate(dates[0]);
  const end = normalizeLocalDate(dates[1]);
  return {
    ...(start ? { start } : {}),
    ...(end ? { end } : {})
  };
}

function parseDetail(document: Document, pageKind: "open-rejected-detail" | "reimbursed-detail", labels: OegkLabels): ClaimObservation | undefined {
  const values = labeledValues(document, [labels.provider, labels.invoiceAmount, labels.treatmentPeriod,
    labels.reimbursementAmount, labels.reimbursementDate, labels.treatmentFrom]);
  const provider = knownText(values.get(labels.provider));
  const invoiceAmount = normalizeEuroAmount(values.get(labels.invoiceAmount));
  const reimbursementAmount = normalizeEuroAmount(values.get(labels.reimbursementAmount));
  const reimbursementDate = normalizeLocalDate(values.get(labels.reimbursementDate));
  const period = parseTreatmentRange(values.get(labels.treatmentPeriod));
  const fallbackStart = normalizeLocalDate(values.get(labels.treatmentFrom));
  const treatment: { start?: string; end?: string } = {
    ...period,
    ...(!period.start && fallbackStart ? { start: fallbackStart } : {}),
  };
  const rejected = hasVisibleLabel(document, labels.reasonForRejection);
  const status: ClaimStatus = pageKind === "reimbursed-detail" ? "completed" : rejected ? "rejected" : "processing";
  if (!provider && invoiceAmount === undefined && reimbursementAmount === undefined && !reimbursementDate &&
      !treatment.start && !treatment.end) {
    return undefined;
  }
  let observation: ClaimObservation = { status, source: "oegk" };
  observation = withOptional(observation, "provider", provider);
  observation = withOptional(observation, "invoiceAmount", invoiceAmount);
  observation = withOptional(observation, "reimbursementAmount", reimbursementAmount);
  observation = withOptional(observation, "reimbursementDate", reimbursementDate);
  observation = withOptional(observation, "treatmentDate", treatment.start);
  observation = withOptional(observation, "treatmentEndDate", treatment.end);
  return observation;
}

export class OegkAdapter {
  private readonly document: Document;
  private readonly location: OegkAdapterLocation;
  private readonly allowedOrigin: string;
  private readonly labels: OegkLabels;
  private readonly debug: boolean;
  private readonly debugLog: (message: string) => void;

  constructor(options: OegkAdapterOptions = {}) {
    this.document = options.document ?? document;
    this.location = options.location ?? { origin: window.location.origin, pathname: window.location.pathname };
    this.allowedOrigin = options.expectedOrigin ?? options.fixtureOrigin ?? LIVE_ORIGIN;
    this.labels = labelsForOrigin(this.location.origin, options.expectedOrigin, this.document.documentElement?.lang);
    this.debug = options.debug ?? false;
    this.debugLog = options.debugLog ?? (() => undefined);
  }

  canHandlePage(): boolean {
    return this.location.origin === this.allowedOrigin && inferPageKind(this.document, this.location.pathname, this.labels) !== undefined;
  }

  async extractClaims(): Promise<ClaimExtractionResult> {
    if (this.location.origin !== this.allowedOrigin) return this.result("unsupported", false, [], 0, 0);
    const pageKind = inferPageKind(this.document, this.location.pathname, this.labels);
    const plausiblePath = Object.values(PATHS).includes(this.location.pathname);
    const loading = plausiblePath && (Array.from(this.document.querySelectorAll('[aria-busy="true"], [role="progressbar"], .loading')).some(shown) ||
      this.document.readyState === "loading");
    if (loading) return this.result("loading", false, [], 0, 0, pageKind);
    const hasError = plausiblePath && Array.from(this.document.querySelectorAll('[role="alert"]'))
      .some((alert) => shown(alert) && [this.labels.rangeError, this.labels.invalidEntries]
        .some((message) => normalizeText(alert.textContent)?.includes(message)));
    if (hasError) return this.result("error", false, [], 0, 0, pageKind);
    if (!pageKind) {
      return this.result("unsupported", false, [], 0, 0);
    }
    if (pageKind === "type-range") {
      const empty = emptyAlert(this.document, this.labels);
      return this.result(empty ? "empty" : "complete", empty, [], 0, 0, pageKind, observedRange(this.document));
    }
    if (pageKind === "results") {
      const range = observedRange(this.document);
      if (emptyAlert(this.document, this.labels)) return this.result("empty", true, [], 0, 0, pageKind, range);
      const sections = allCardSections(this.document).filter(shown);
      if (!sections.length) return this.result("error", false, [], 0, 0, pageKind, range);
      const claims: ClaimObservation[] = [];
      let candidateCount = 0;
      let skippedCount = 0;
      for (const section of sections) {
        const heading = normalizeText(section.querySelector(".card_title h2")?.textContent) ?? "";
        const status = statusHeadings(this.labels).get(heading) ?? "unknown";
        for (const row of Array.from(section.querySelectorAll('[role="grid"].card_content [role="row"]'))) {
          if (!shown(row)) continue;
          candidateCount += 1;
          const claim = parseResultRow(row, status, this.labels);
          if (claim) claims.push(claim); else skippedCount += 1;
        }
      }
      // Site transitions can temporarily hide every row without a busy marker.
      // Only the explicit empty alert is evidence for an empty search result.
      if (candidateCount === 0) return this.result("loading", false, [], 0, 0, pageKind, range);
      return this.result("complete", skippedCount === 0, claims, candidateCount, skippedCount, pageKind, range);
    }
    const detail = parseDetail(this.document, pageKind, this.labels);
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
