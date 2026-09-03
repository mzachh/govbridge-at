export type Language = 'en' | 'de';
export const HEADER_TITLE = 'GovBridge AT: OEGK (meinesv.at) demo server';

// Presentation-only dictionary. No fixture records or extension API are exposed.
const translations: Record<string, string> = {
  'Einreichungen abfragen': 'Search claims',
  'Liste der Einreichungen': 'Claims',
  'Einreichung Detail': 'Claim details',
  'Wahlarzt / Wahltherapeut': 'Private doctor / therapist',
  'Heilbehelfe / Hilfsmittel': 'Medical aids / appliances',
  Sonstiges: 'Other',
  'Art der Einreichung': 'Claim category',
  'Wählen Sie die Art der Rechnung und den gewünschten Abfragezeitraum.':
    'Select the claim category and the date range you want to search.',
  'Zeitraum von': 'Date range from',
  'Zeitraum bis': 'Date range to',
  Weiter: 'Continue',
  'TT.MM.JJJJ': 'DD.MM.YYYY',
  'offene Einreichungen': 'Open claims',
  'abgelehnte Einreichungen': 'Rejected claims',
  'erstattete Einreichungen': 'Reimbursed claims',
  'unbekannte Einreichungen': 'Unknown claims',
  'Rechnung vom': 'Invoice dated',
  'Rückerstattung:': 'Reimbursement:',
  'Behandler:': 'Provider:',
  'Rechnungsbetrag:': 'Invoice amount:',
  'Antragsnummer:': 'Claim reference:',
  'Behandlung ab:': 'Treatment from:',
  'Behandlungszeitraum:': 'Treatment period:',
  'Höhe der Kostenerstattung:': 'Reimbursement amount:',
  'Datum der Erstattung:': 'Reimbursement date:',
  'Ablehnungsgrund:': 'Reason for rejection:',
  'Person:': 'Person:',
  'Bankverbindung:': 'Bank account:',
  'Sozialversicherungsnummer:': 'Social security number:',
  Unbekannt: 'Unknown',
  'Für diese Leistung ist keine Kostenerstattung vorgesehen.':
    'This service is not eligible for reimbursement.',
  'In diesem Abfragezeitraum wurde keine Kostenerstattung bzw. kein Onlineantrag gefunden.':
    'No reimbursement or online claim was found for this date range.',
  'ACHTUNG: Fehlerhafte Eingaben im Formular. Bitte gültige Datumswerte eingeben. Der Abfragezeitraum darf höchstens 5 Jahre betragen.':
    'WARNING: Invalid form entries. Please enter valid dates. The date range must not exceed 5 years.',
  'Willkommen in der Demo': 'Welcome to the demo',
  'Demo-Anmeldung': 'Demo login',
  'Öffentliche Zugangsdaten:': 'Public demo credentials:',
  'Keine ID Austria. Bitte niemals ein echtes Passwort eingeben.':
    'No ID Austria. Never enter a real password.',
  'Anmeldung nicht möglich. Bitte die Demo-Zugangsdaten verwenden.':
    'Sign-in failed. Please use the public demo credentials.',
  Benutzername: 'Username',
  Passwort: 'Password',
  Anmelden: 'Sign in',
  'Demo abmelden': 'Sign out of demo',
  Abmelden: 'Sign out',
  Startseite: 'Home',
  'Rechnungen abfragen': 'Search claims',
  'Synthetische Demo — nicht MeineSV oder OEGK. Alle Daten sind frei erfunden.':
    'Synthetic demo — not MeineSV or OEGK. All records are fictional.',
  'Synthetische Daten': 'Synthetic data',
  Referenzdatum: 'Reference date',
  'Keine offizielle Verbindung zu OEGK': 'Not affiliated with OEGK',
  'Entwickler-Werkzeuge · synthetische Daten':
    'Developer tools · synthetic data',
  'Suchbasis: Rechnungsdatum, inklusive Grenzen. Dies ist eine Simulatorregel, keine Aussage zur echten OEGK-Suche.':
    'Search uses invoice dates, including both endpoints. This is a simulator rule, not a statement about the real OEGK search.',
  'Szenario auswählen': 'Choose a scenario',
  'Dokument zurücksetzen': 'Reset page',
  'Erstattung ändern': 'Change reimbursement',
  'Status ändern': 'Change status',
  'Erste Zeile entfernen': 'Remove first row',
  'Absichtlich unlesbare Demozeile': 'Intentionally malformed demo row',
  'Absichtlich beschädigte Ergebnisstruktur.':
    'Intentionally broken results structure.',
  Ergebnisseiten: 'Result pages',
  'nur sichtbare Zeilen werden gelesen': 'only visible rows are read',
  'Seite ': 'Page ',
  'Demo lädt': 'Demo loading',
  'Ergebnisse werden geladen …': 'Loading results …',
  'Andere Art der Einreichung auswählen': 'Choose another claim category',
  'PDF-Beleg: in dieser Demo nicht verfügbar':
    'PDF receipt: unavailable in this demo',
  'Zurück zur Liste': 'Back to claims',
  'erfundener Testfall': 'fictional test case',
  'Demo-Szenarien': 'Demo scenarios',
  'Deterministische Testfälle. Keine echten Daten; keine unabhängigen WebMCP-Tools auf der Website.':
    'Deterministic test cases. No real data; the website does not register its own WebMCP tools.',
  'Nicht gefunden': 'Not found',
  'Diese Demoseite existiert nicht.': 'This demo page does not exist.',
  'Unbekannte Demo-Einreichung.': 'Unknown demo claim.',
  'Praxis am Park': 'Parkside Practice',
  'Therapiezentrum Sonnenweg': 'Sonnenweg Therapy Center',
  Dermatologie: 'Dermatology',
  Allgemeinmedizin: 'General medicine',
  Orthopädie: 'Orthopedics',
  Augenheilkunde: 'Ophthalmology',
  Physiotherapie: 'Physiotherapy',
  'Innere Medizin': 'Internal medicine',
  Neurologie: 'Neurology',
  HNO: 'ENT',
};
const pattern = new RegExp(
  Object.keys(translations)
    .sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g',
);
export function translateText(text: string): string {
  return text.replace(pattern, (key) => translations[key]!);
}

/** Localize only text and presentation attributes, never IDs, URLs or field data. */
export function localizeHtml(html: string, lang: Language = 'en'): string {
  if (lang === 'de') return html;
  return html
    .replace(/>([^<]+)</g, (_, text: string) => '>' + translateText(text) + '<')
    .replace(
      /\b(aria-label|placeholder|title)="([^"]*)"/g,
      (_, key: string, value: string) => `${key}="${translateText(value)}"`,
    )
    .replace(/<input\b[^>]*\btype="submit"[^>]*>/g, (input) =>
      input.replace(/\bvalue="Weiter"/, 'value="Continue"'),
    )
    .replace('<html lang="de">', '<html lang="en">');
}

export function withLanguage(path: string, lang: Language): string {
  const u = new URL(path, 'https://demo.invalid');
  if (u.origin !== 'https://demo.invalid') return path;
  if (
    !['/', '/login', '/logout', '/demo/scenarios'].includes(u.pathname) &&
    !u.pathname.startsWith('/vsInfo/views/KE/')
  )
    return path;
  for (const key of [...u.searchParams.keys()])
    if (
      ![
        'lang',
        'scenario',
        'from',
        'to',
        'page',
        'claim',
        'returnTo',
        'contentid',
        'portal',
        'LO',
        ...(u.pathname === '/vsInfo/views/KE/einreichungTyp.xhtml' &&
        u.searchParams.get('searched') === '1'
          ? ['searched']
          : []),
      ].includes(key)
    )
      u.searchParams.delete(key);
  u.searchParams.set('lang', lang);
  return u.pathname + u.search + u.hash;
}
const esc = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
export function languageLinks(path: string, lang: Language): string {
  return `<nav class="language-switch" aria-label="${lang === 'en' ? 'Language' : 'Sprache'}"><a href="${esc(withLanguage(path, 'en'))}" lang="en"${lang === 'en' ? ' aria-current="true"' : ''}>English</a><a href="${esc(withLanguage(path, 'de'))}" lang="de"${lang === 'de' ? ' aria-current="true"' : ''}>Deutsch</a></nav>`;
}
export function presentPage(
  html: string,
  lang: Language,
  path: string,
): string {
  const translated = localizeHtml(html, lang).replace(
    /\b(href|action)="(\/[^\"]*)"/g,
    (_, key: string, value: string) =>
      `${key}="${esc(withLanguage(value.replace(/&amp;/g, '&'), lang))}"`,
  );
  return translated.replace(
    '</header>',
    languageLinks(path, lang) + '</header>',
  );
}
