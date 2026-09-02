/**
 * The real MeineSV site is German-only for the purposes of this adapter. The
 * synthetic loopback server may render an English equivalent, but only on an
 * origin that has already been approved by the site-context policy.
 */
import { resolveSiteContext } from "./site-context.js";

export interface OegkLabels {
  readonly typeHeading: string;
  readonly resultsHeading: string;
  readonly detailHeading: string;
  readonly doctorTab: string;
  readonly continueSubmit: string;
  readonly resultsSubmit: string;
  readonly openClaims: string;
  readonly rejectedClaims: string;
  readonly reimbursedClaims: string;
  readonly invoiceDated: string;
  readonly reimbursement: string;
  readonly provider: string;
  readonly invoiceAmount: string;
  readonly claimReference: string;
  readonly treatmentFrom: string;
  readonly treatmentPeriod: string;
  readonly reimbursementAmount: string;
  readonly reimbursementDate: string;
  readonly reasonForRejection: string;
  readonly empty: string;
  readonly invalidEntries: string;
  readonly rangeError: string;
  readonly datePlaceholder: string;
}

export const GERMAN_LABELS: OegkLabels = Object.freeze({
  typeHeading: "Einreichungen abfragen",
  resultsHeading: "Liste der Einreichungen",
  detailHeading: "Einreichung Detail",
  doctorTab: "Wahlarzt / Wahltherapeut",
  continueSubmit: "Weiter",
  resultsSubmit: "OK",
  openClaims: "offene Einreichungen",
  rejectedClaims: "abgelehnte Einreichungen",
  reimbursedClaims: "erstattete Einreichungen",
  invoiceDated: "Rechnung vom",
  reimbursement: "Rückerstattung:",
  provider: "Behandler:",
  invoiceAmount: "Rechnungsbetrag:",
  claimReference: "Antragsnummer:",
  treatmentFrom: "Behandlung ab:",
  treatmentPeriod: "Behandlungszeitraum:",
  reimbursementAmount: "Höhe der Kostenerstattung:",
  reimbursementDate: "Datum der Erstattung:",
  reasonForRejection: "Ablehnungsgrund:",
  empty: "In diesem Abfragezeitraum wurde keine Kostenerstattung bzw. kein Onlineantrag gefunden.",
  invalidEntries: "Fehlerhafte Eingaben im Formular",
  rangeError: "Der Abfragezeitraum darf höchstens 5 Jahre betragen.",
  datePlaceholder: "TT.MM.JJJJ",
});

export const ENGLISH_LABELS: OegkLabels = Object.freeze({
  typeHeading: "Search claims",
  resultsHeading: "Claims",
  detailHeading: "Claim details",
  doctorTab: "Private doctor / therapist",
  continueSubmit: "Continue",
  resultsSubmit: "OK",
  openClaims: "Open claims",
  rejectedClaims: "Rejected claims",
  reimbursedClaims: "Reimbursed claims",
  invoiceDated: "Invoice dated",
  reimbursement: "Reimbursement:",
  provider: "Provider:",
  invoiceAmount: "Invoice amount:",
  claimReference: "Claim reference:",
  treatmentFrom: "Treatment from:",
  treatmentPeriod: "Treatment period:",
  reimbursementAmount: "Reimbursement amount:",
  reimbursementDate: "Reimbursement date:",
  reasonForRejection: "Reason for rejection:",
  empty: "No reimbursement or online claim was found for this date range.",
  invalidEntries: "Invalid form entries",
  rangeError: "The date range must not exceed 5 years.",
  datePlaceholder: "DD.MM.YYYY",
});

/**
 * English is a presentation variant of synthetic pages only. Callers should
 * pass the approved expected origin and the page's language when available;
 * this prevents a fixture or page-provided origin from widening the accepted
 * language set. Missing or unknown language values are deliberately German.
 */
export function labelsForOrigin(origin: string, expectedOrigin?: string, documentLanguage?: string): OegkLabels {
  if (origin !== expectedOrigin && expectedOrigin !== undefined) return GERMAN_LABELS;
  const context = resolveSiteContext(origin);
  return context && context.origin === origin && context.environment !== "production" &&
      documentLanguage?.trim().toLowerCase() === "en"
    ? ENGLISH_LABELS
    : GERMAN_LABELS;
}
