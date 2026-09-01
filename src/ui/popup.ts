import type { Claim, ClaimStatus } from "../domain/claim.js";

export interface PopupViewModel {
  state: "loading" | "ready" | "error";
  claims?: readonly Claim[];
  hasObserved?: boolean;
  demo?: boolean;
  stale?: boolean;
}

const STATUS_LABELS: Record<ClaimStatus, string> = {
  submitted: "EINGEREICHT",
  processing: "OFFEN",
  completed: "ERSTATTET",
  rejected: "ABGELEHNT",
  unknown: "STATUS UNBEKANNT",
};

const dateFormatter = new Intl.DateTimeFormat("de-AT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const amountFormatter = new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
});

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function addDetail(document: Document, list: HTMLDListElement, label: string, value: string): void {
  list.append(element(document, "dt", label), element(document, "dd", value));
}

function renderClaim(document: Document, claim: Claim): HTMLLIElement {
  const item = element(document, "li");
  item.className = `claim claim--${claim.status}`;
  item.append(element(document, "h3", claim.provider ?? "Arzt/Einrichtung nicht verfügbar"));
  const status = element(document, "p", STATUS_LABELS[claim.status]);
  status.className = "claim__status";
  item.append(status);
  const details = element(document, "dl");
  if (claim.invoiceAmount !== undefined) {
    addDetail(document, details, "Rechnungsbetrag", amountFormatter.format(claim.invoiceAmount));
  }
  if (claim.invoiceDate) addDetail(document, details, "Rechnungsdatum", formatDate(claim.invoiceDate));
  if (claim.treatmentDate) {
    const range = claim.treatmentEndDate
      ? `${formatDate(claim.treatmentDate)} – ${formatDate(claim.treatmentEndDate)}`
      : formatDate(claim.treatmentDate);
    addDetail(document, details, "Behandlung", range);
  }
  if (claim.submittedDate) addDetail(document, details, "Eingereicht", formatDate(claim.submittedDate));
  if (claim.reimbursementDate) {
    addDetail(document, details, "Erstattungsdatum", formatDate(claim.reimbursementDate));
  }
  if (claim.reimbursementAmount !== undefined) {
    addDetail(
      document,
      details,
      "Erstattungsbetrag",
      amountFormatter.format(claim.reimbursementAmount),
    );
  }
  if (claim.responseAvailable !== undefined) {
    addDetail(
      document,
      details,
      "Antwort/Entscheidung",
      claim.responseAvailable ? "Verfügbar" : "Nicht verfügbar",
    );
  }
  item.append(details);
  if (!claim.provider || claim.invoiceAmount === undefined) {
    item.append(element(document, "p", "Details noch nicht beobachtet"));
  }
  item.append(element(document, "p", `Zuletzt beobachtet: ${new Date(claim.lastSeen).toLocaleString("de-AT")}`));
  return item;
}

function renderYearSummaries(document: Document, claims: readonly Claim[]): HTMLElement {
  const section = element(document, "section");
  section.setAttribute("aria-labelledby", "yearly-summary-heading");
  const heading = element(document, "h2", "Jahressummen nach Rechnungsdatum");
  heading.id = "yearly-summary-heading";
  section.append(heading);
  const years = [...new Set(claims.flatMap((claim) => claim.invoiceDate?.slice(0, 4) ?? []))].sort(
    (a, b) => b.localeCompare(a),
  );
  for (const year of years) {
    const matching = claims.filter((claim) => claim.invoiceDate?.startsWith(`${year}-`));
    const invoiceKnown = matching.filter((claim) => claim.invoiceAmount !== undefined);
    const reimbursementKnown = matching.filter((claim) => claim.reimbursementAmount !== undefined);
    const block = element(document, "section");
    block.append(element(document, "h3", year));
    const details = element(document, "dl");
    addDetail(
      document,
      details,
      "Rechnungsbetrag",
      invoiceKnown.length
        ? amountFormatter.format(invoiceKnown.reduce((sum, claim) => sum + (claim.invoiceAmount ?? 0), 0))
        : "Nicht verfügbar",
    );
    addDetail(
      document,
      details,
      "Erstattet",
      reimbursementKnown.length
        ? amountFormatter.format(reimbursementKnown.reduce((sum, claim) => sum + (claim.reimbursementAmount ?? 0), 0))
        : "Nicht verfügbar",
    );
    block.append(details);
    const missingInvoice = matching.length - invoiceKnown.length;
    const missingReimbursement = matching.length - reimbursementKnown.length;
    if (missingInvoice || missingReimbursement) {
      block.append(
        element(
          document,
          "p",
          `Fehlende Beträge: Rechnung ${missingInvoice}, Erstattung ${missingReimbursement}.`,
        ),
      );
    }
    section.append(block);
  }
  const unknownYearCount = claims.filter((claim) => !claim.invoiceDate).length;
  if (unknownYearCount) {
    section.append(element(document, "p", `Rechnungsdatum unbekannt: ${unknownYearCount}`));
  }
  return section;
}

export function renderPopup(root: HTMLElement, model: PopupViewModel): void {
  const document = root.ownerDocument;
  if (model.state === "loading") {
    if (!root.hasChildNodes()) root.append(element(document, "p", "Lokale Daten werden geladen …"));
    return;
  }
  if (model.state === "error") {
    if (!root.hasChildNodes()) {
      root.append(element(document, "p", "Lokale Daten konnten nicht geladen werden."));
    } else if (!root.querySelector("[role='alert']")) {
      const error = element(document, "p", "Lokale Daten konnten nicht aktualisiert werden.");
      error.setAttribute("role", "alert");
      root.prepend(error);
    }
    return;
  }

  const claims = model.claims ?? [];
  root.replaceChildren();
  root.append(element(document, "h1", "GovBridge AT"));
  if (model.demo) root.append(element(document, "p", "Demo data"));
  if (model.stale) root.append(element(document, "p", "Gespeicherte Daten – möglicherweise nicht aktuell"));
  if (model.hasObserved === false) {
    root.append(
      element(
        document,
        "p",
        "Noch keine Beobachtungen. Öffnen Sie einmal die unterstützte Meine-SV-Seite.",
      ),
    );
    return;
  }
  if (claims.length === 0) {
    root.append(element(document, "p", "Auf der unterstützten Seite wurden keine Einreichungen gefunden."));
    return;
  }

  const openCount = claims.filter(
    ({ status }) => status === "submitted" || status === "processing",
  ).length;
  const unknownCount = claims.filter(({ status }) => status === "unknown").length;
  root.append(
    element(
      document,
      "p",
      `${claims.length} Einreichungen · ${openCount} offen${unknownCount ? ` · ${unknownCount} Status unbekannt` : ""}`,
    ),
  );
  const heading = element(document, "h2", "Einreichungen");
  const list = element(document, "ul");
  list.setAttribute("aria-labelledby", "claims-heading");
  heading.id = "claims-heading";
  for (const claim of claims) list.append(renderClaim(document, claim));
  root.append(heading, list, renderYearSummaries(document, claims));
}
