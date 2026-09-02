export interface PopupViewModel {
  /** Open the technical dashboard without reading the active tab or claim data. */
  onOpenDashboard?: () => void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Render the extension's technical introduction.
 *
 * The popup deliberately has no claim model, loading state, storage read, or
 * active-tab inspection. The only action is opening the packaged dashboard.
 */
export function renderPopup(root: HTMLElement, model: PopupViewModel = {}): void {
  const document = root.ownerDocument;
  root.replaceChildren();

  root.append(
    element(document, "h1", "GovBridge AT"),
    element(
      document,
      "p",
      "Live, current-page OEGK tools for WebMCP. Claim data is read only when an agent invokes a tool on a supported Meine-SV page.",
    ),
  );

  const heading = element(document, "h2", "Was die Erweiterung bereitstellt");
  heading.id = "capabilities-heading";
  const capabilities = element(document, "ul");
  capabilities.setAttribute("aria-labelledby", heading.id);
  for (const text of [
    "Drei schreibgeschützte Abfragen für die aktuell gerenderte Seite",
    "Eine begrenzte search_claims-Aktion für das Wahlarzt-/Wahltherapeut-Formular",
    "Keine Speicherung, Kontenaggregation oder PDF-/Dokumentabfrage",
  ]) {
    capabilities.append(element(document, "li", text));
  }

  const note = element(
    document,
    "p",
    "Die Ergebnisse sind seitenbezogen und können unvollständig sein. Temporäre IDs gelten nur für den aktuellen Dokument-Snapshot.",
  );
  note.className = "muted";

  const button = element(document, "button", "WebMCP-Dashboard öffnen");
  button.type = "button";
  button.addEventListener("click", () => model.onOpenDashboard?.());

  root.append(heading, capabilities, note, button);
}
