import { describe, it, expect } from 'vitest';
import { handle } from '../server/handler';
import { token } from '../server/session';
import { localizeHtml, presentPage, HEADER_TITLE } from '../server/i18n';
import { results } from '../server/render';
import { LIST, TYPE, DETAIL } from '../server/validation';
const origin = 'http://localhost:4173';
const secret = 'local-only-demo-session-key-not-for-deployment';
async function get(path: string, body?: Record<string, string>) {
  return handle(
    new Request(origin + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        cookie: 'govbridge_demo=' + (await token(secret)),
        ...(body
          ? { origin, 'content-type': 'application/x-www-form-urlencoded' }
          : {}),
      },
      body: body ? new URLSearchParams(body) : undefined,
    }),
  );
}
describe('English-first presentation', () => {
  it('defaults to English without duplicate German parser content', async () => {
    const response = await get(LIST),
      html = await response.text();
    expect(response.headers.get('content-language')).toBe('en');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<h1>Claims</h1>');
    expect(html).toContain(HEADER_TITLE);
    expect(html).toContain('Open claims');
    expect(html).toContain('Invoice dated');
    expect(html).toContain('Reimbursement:');
    expect(html).not.toContain('offene Einreichungen');
    expect(html).not.toContain('Rechnung vom');
    expect(html.match(/data-fixture=/g)).toHaveLength(20);
  });
  it('keeps German explicit and offers an English switch', async () => {
    const response = await get(LIST + '?lang=de'),
      html = await response.text();
    expect(response.headers.get('content-language')).toBe('de');
    expect(html).toContain('<h1>Liste der Einreichungen</h1>');
    expect(html).toContain('lang="de" aria-current="true">Deutsch');
    expect(html).toContain('lang=en');
    expect(html).toContain(HEADER_TITLE);
  });
  it('preserves current claim/search/page context when switching', async () => {
    const html = await (
      await get(
        DETAIL +
          '?claim=demo-claim-001&from=2021-09-03&to=2022-09-02&scenario=mixed&page=1&lang=en',
      )
    ).text();
    expect(html).toContain(
      'claim=demo-claim-001&amp;from=2021-09-03&amp;to=2022-09-02&amp;scenario=mixed&amp;page=1&amp;lang=de',
    );
    expect(html).toContain('Provider:');
    expect(html).toContain('Invoice amount:');
    expect(html).toContain('Back to claims');
  });
  it('preserves language after search POST, login and logout', async () => {
    for (const lang of ['en', 'de']) {
      const search = await get(TYPE + '?lang=' + lang, {
        vonDatWAH: '03.09.2021',
        bisDatWAH: '02.09.2026',
      });
      expect(search.status).toBe(303);
      expect(search.headers.get('location')).toContain('lang=' + lang);
      const login = await get('/login?lang=' + lang, {
        username: 'peter',
        password: 'ThisIsJustADemo$',
        returnTo: LIST + '?scenario=paginated&page=2',
      });
      expect(login.headers.get('location')).toContain('page=2&lang=' + lang);
      expect(
        (await get('/logout?lang=' + lang, {})).headers.get('location'),
      ).toBe('/login?lang=' + lang);
    }
  });
  it('keeps dates, identifiers, escaped input and amounts intact', () => {
    const html = localizeHtml(
      '<html lang="de"><input id="vonDatWAH" name="vonDatWAH" placeholder="TT.MM.JJJJ" value="&quot;&gt;&lt;script&gt;"><input type="submit" value="Weiter"><p>Rückerstattung: 42,00 € Rechnung vom 14.10.2021</p></html>',
    );
    expect(html).toContain(
      'id="vonDatWAH" name="vonDatWAH" placeholder="DD.MM.YYYY"',
    );
    expect(html).toContain('value="&quot;&gt;&lt;script&gt;"');
    expect(html).toContain('value="Continue"');
    expect(html).toContain('Reimbursement: 42,00 € Invoice dated 14.10.2021');
    expect(localizeHtml('<input name="vonDatWAH" value="Weiter">')).toBe(
      '<input name="vonDatWAH" value="Weiter">',
    );
  });
  it('rejects unknown or repeated languages', async () => {
    for (const q of ['lang=fr', 'lang=en&lang=de', 'lang=%3Cscript%3E'])
      expect((await get(LIST + '?' + q)).status).toBe(400);
  });
  it('does not translate static asset URLs or add hidden German text', () => {
    const html = presentPage(
      results({
        scenario: 'mixed',
        from: '2021-09-03',
        to: '2026-09-02',
        page: 1,
      }),
      'en',
      LIST + '?lang=en',
    );
    expect(html).toContain('href="/portal.css"');
    expect(html).not.toContain('/portal.css?');
    expect(html).not.toContain('Rechnung vom');
  });
});
