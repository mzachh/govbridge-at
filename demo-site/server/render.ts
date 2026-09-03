import {
  CLAIMS,
  DEFAULT_FROM,
  REFERENCE_DATE,
  SCENARIOS,
  type DemoClaim,
  type Scenario,
} from '../fixtures/claims';
import { BASE, TYPE, LIST, OPEN, DETAIL, localDate } from './validation';
import { DEMO_USERNAME, DEMO_PASSWORD } from './demo-login';
export const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const euro = (v: number) => v.toFixed(2).replace('.', ',') + ' €';
export function shell(title: string, body: string, logged = true): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · GovBridge AT Demo</title><meta name="description" content="Synthetic GovBridge AT demonstration. No official or personal claim data."><link rel="stylesheet" href="/portal.css"><script src="/demo.js" defer></script></head><body${logged ? ' data-protected="true"' : ''}><header class="portal-header"><a href="/">GovBridge AT: OEGK (meinesv.at) demo server</a>${logged ? '<form class="logout" method="post" action="/logout"><button type="submit">Abmelden</button></form>' : '<span>MeineSV Simulator</span>'}</header><div class="demo-banner">Synthetische Demo — nicht MeineSV oder OEGK. Alle Daten sind frei erfunden.</div><main class="portal-main"><p class="breadcrumb"><a href="/">Startseite</a> / <a href="${TYPE}">Rechnungen abfragen</a></p><h1>${esc(title)}</h1>${body}</main><footer>GovBridge AT Demo · Synthetische Daten · Referenzdatum 02.09.2026 · Keine offizielle Verbindung zu OEGK</footer></body></html>`;
}
export function login(returnTo: string, error = false): string {
  return shell(
    'Demo-Anmeldung',
    `<section class="login-card"><h2>Willkommen in der Demo</h2><p>Öffentliche Zugangsdaten: <code>${esc(DEMO_USERNAME)}</code> / <code>${esc(DEMO_PASSWORD)}</code>.</p><p>Keine ID Austria. Bitte niemals ein echtes Passwort eingeben.</p>${error ? '<div role="alert" class="infobox error">Anmeldung nicht möglich. Bitte die Demo-Zugangsdaten verwenden.</div>' : ''}<form method="post" action="/login"><input type="hidden" name="returnTo" value="${esc(returnTo)}"><label>Benutzername<input type="text" name="username" autocomplete="off" maxlength="64" required></label><label>Passwort<input type="password" name="password" autocomplete="off" maxlength="64" required></label><button type="submit">Anmelden</button></form></section>`,
    false,
  );
}
export const empty =
  '<div id="infolist" class="infobox yellow" role="alert">In diesem Abfragezeitraum wurde keine Kostenerstattung bzw. kein Onlineantrag gefunden.</div>';
export const error =
  '<div class="infobox error" role="alert">ACHTUNG: Fehlerhafte Eingaben im Formular. Bitte gültige Datumswerte eingeben. Der Abfragezeitraum darf höchstens 5 Jahre betragen.</div>';
export type Context = {
  scenario: Scenario;
  from: string;
  to: string;
  page: number;
};
export function link(
  path: string,
  c: Context,
  extra: Record<string, string> = {},
): string {
  const p = new URLSearchParams({
    scenario: c.scenario,
    from: c.from,
    to: c.to,
    ...extra,
  });
  return path + '?' + p;
}
export function form(
  c: Context,
  type: boolean,
  raw?: { from: string; to: string },
): string {
  const from = type ? 'vonDatWAH' : 'vonDat',
    to = type ? 'bisDatWAH' : 'bisDat';
  return `<form method="post" action="${esc(link(type ? TYPE : LIST, c))}" data-search="${esc(c.scenario)}">${type ? '<nav class="tabs" aria-label="Art der Einreichung"><a role="tab" href="#wahlarzt" aria-selected="true">Wahlarzt / Wahltherapeut</a><a role="tab" aria-disabled="true" aria-selected="false">Heilbehelfe / Hilfsmittel</a><a role="tab" aria-disabled="true" aria-selected="false">Sonstiges</a></nav>' : ''}<div class="search-form"><label for="${from}">Zeitraum von<input type="text" id="${from}" name="${from}" placeholder="TT.MM.JJJJ" value="${esc(raw?.from ?? localDate(c.from))}"></label><label for="${to}">Zeitraum bis<input type="text" id="${to}" name="${to}" placeholder="TT.MM.JJJJ" value="${esc(raw?.to ?? localDate(c.to))}"></label><input type="submit" value="${type ? 'Weiter' : 'OK'}"></div></form>`;
}
export function controls(c: Context): string {
  return `<details class="demo-controls"><summary>Entwickler-Werkzeuge · synthetische Daten</summary><p class="demo-note">Suchbasis: Rechnungsdatum, inklusive Grenzen. Dies ist eine Simulatorregel, keine Aussage zur echten OEGK-Suche.</p><a href="/demo/scenarios">Szenario auswählen</a><a href="${esc(link(LIST, c))}">Dokument zurücksetzen</a><button type="button" data-mutate="amount">Erstattung ändern</button><button type="button" data-mutate="status">Status ändern</button><button type="button" data-mutate="remove">Erste Zeile entfernen</button></details>`;
}
export function typePage(
  c: Context,
  invalid = false,
  raw?: { from: string; to: string },
  searched = false,
): string {
  const noMatches =
    c.scenario === 'empty-type' || (searched && selectedClaims(c).length === 0);
  return shell(
    'Einreichungen abfragen',
    `<p>Wählen Sie die Art der Rechnung und den gewünschten Abfragezeitraum.</p>${form(c, true, raw)}${invalid || c.scenario === 'validation' ? error : noMatches ? empty : ''}${controls(c)}`,
  );
}
export function invalidResults(
  c: Context,
  raw: { from: string; to: string },
): string {
  return shell(
    'Liste der Einreichungen',
    `${form(c, false, raw)}${error}${controls(c)}`,
  );
}
function row(r: DemoClaim, c: Context): string {
  const badge =
    r.status === 'completed' &&
    r.reimbursementAmount !== undefined &&
    c.scenario !== 'missing-fields'
      ? `<span class="badge" title="Rückerstattung:">↪ ${r.reimbursementAmount.toFixed(2)} €</span>`
      : '';
  return `<div role="row" data-fixture="${r.id}"${c.scenario === 'hidden-rows' ? ' hidden' : ''}><span class="light date cb_date">${localDate(r.overviewDate)}</span><div class="cb_title light"><h4>${esc(r.provider)}</h4> <span class="invoice">Rechnung vom ${localDate(r.invoiceDate)}</span> </div>${r.status === 'completed' ? `<span class="cb_status">${badge}</span>` : ''}<span class="cb_details"><a class="row-arrow" aria-label="Details ${esc(r.provider)}" href="${esc(link(r.status === 'completed' ? DETAIL : OPEN, c, { claim: r.id }))}">›</a></span><span class="cb_download">${r.status === 'completed' ? '<button class="document-unavailable" type="button" disabled aria-label="PDF-Beleg: in dieser Demo nicht verfügbar" title="PDF-Beleg: in dieser Demo nicht verfügbar">⇩</button>' : ''}</span></div>`;
}
function claimFields(r: DemoClaim, c: Context): Array<[string, string]> {
  return [
    ['Rechnungsbetrag:', euro(r.invoiceAmount)],
    [
      'Behandlungszeitraum:',
      localDate(r.treatmentDate) + ' – ' + localDate(r.treatmentEndDate),
    ],
    [
      'Höhe der Kostenerstattung:',
      r.reimbursementAmount !== undefined && c.scenario !== 'missing-fields'
        ? euro(r.reimbursementAmount)
        : 'Unbekannt',
    ],
    [
      'Datum der Erstattung:',
      r.reimbursementDate ? localDate(r.reimbursementDate) : 'Unbekannt',
    ],
  ];
}
export function selectedClaims(c: Context): readonly DemoClaim[] {
  return CLAIMS.filter((r) => r.invoiceDate >= c.from && r.invoiceDate <= c.to);
}
export function results(c: Context): string {
  let claims = selectedClaims(c);
  if (c.scenario === 'duplicates')
    claims = claims.filter(
      (r) => r.id === 'demo-claim-019' || r.id === 'demo-claim-020',
    );
  const total = claims.length;
  if (c.scenario === 'paginated')
    claims = claims.slice((c.page - 1) * 10, c.page * 10);
  let cards = '';
  for (const [status, title] of [
    ['processing', 'offene Einreichungen'],
    ['rejected', 'abgelehnte Einreichungen'],
    ['completed', 'erstattete Einreichungen'],
  ] as const) {
    const group = claims.filter((r) => r.status === status);
    if (!group.length) continue;
    cards += `<section class="card_container ${status === 'processing' ? 'open' : ''}"><div class="card_title"><h2>${c.scenario === 'unknown-status' ? 'unbekannte Einreichungen' : title}</h2></div><div role="grid" class="card_content">${group.map((r) => row(r, c)).join('')}${c.scenario === 'partial' && status === 'processing' ? '<div role="row"><span>Absichtlich unlesbare Demozeile</span></div>' : ''}</div></section>`;
  }
  if (c.scenario === 'broken-layout')
    cards = '<p>Absichtlich beschädigte Ergebnisstruktur.</p>';
  const content = c.scenario === 'empty-results' || !total ? empty : cards;
  const pagination =
    c.scenario === 'paginated'
      ? `<nav class="pagination" aria-label="Ergebnisseiten"><a href="${esc(link(LIST, c, { page: '1' }))}">Seite 1</a><a href="${esc(link(LIST, c, { page: '2' }))}">Seite 2</a><span>Seite ${c.page} · nur sichtbare Zeilen werden gelesen</span></nav>`
      : '';
  return shell(
    'Liste der Einreichungen',
    `${form(c, false)}${c.scenario === 'validation' ? error : ''}${c.scenario === 'loading' ? '<div class="loading" aria-busy="true" role="progressbar" aria-label="Demo lädt">Ergebnisse werden geladen …</div>' : ''}<div id="demo-results">${content}</div>${pagination}<a href="${esc(link(TYPE, c))}">‹ Andere Art der Einreichung auswählen</a>${controls(c)}`,
  );
}
export function detail(r: DemoClaim, c: Context): string {
  const fields: Array<[string, string]> = [
    ['Behandler:', r.provider],
    ...claimFields(r, c),
    ['Antragsnummer:', 'SYNTHETIC-' + r.id],
    ['Person:', 'Peter'],
    ['Bankverbindung:', 'AT00 1234 1234 1234 1234'],
    ['Sozialversicherungsnummer:', '1234010196'],
  ];
  if (r.status === 'rejected')
    fields.push([
      'Ablehnungsgrund:',
      'Für diese Leistung ist keine Kostenerstattung vorgesehen.',
    ]);
  return shell(
    'Einreichung Detail',
    `<table class="detail-table"><tbody>${fields.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table><p class="disabled" aria-disabled="true">PDF-Beleg: in dieser Demo nicht verfügbar</p><a href="${esc(link(LIST, c))}">‹ Zurück zur Liste</a>${controls(c)}`,
  );
}
export function scenarios(): string {
  return shell(
    'Demo-Szenarien',
    `<p>Deterministische Testfälle. Keine echten Daten; keine unabhängigen WebMCP-Tools auf der Website.</p><div class="demo-controls">${SCENARIOS.map((s) => `<a href="${esc(link(s === 'empty-type' ? TYPE : LIST, { scenario: s, from: DEFAULT_FROM, to: REFERENCE_DATE, page: 1 }))}">${s}</a>`).join('')}</div>`,
  );
}
