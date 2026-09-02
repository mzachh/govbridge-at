import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect, vi } from 'vitest';
import { results } from '../demo-site/server/render';
import { localizeHtml, type Language } from '../demo-site/server/i18n';
import type { Scenario } from '../demo-site/fixtures/claims';

const script = readFileSync('demo-site/public/demo.js', 'utf8');
const context = { from: '2021-09-03', to: '2026-09-02', page: 1 };
function setup(scenario: Scenario, response?: string, language: Language = 'de') {
  const render = () => language === 'en' ? localizeHtml(results({ ...context, scenario }), language) : results({ ...context, scenario });
  const dom = new JSDOM(render(), { url: 'http://localhost:4173/vsInfo/views/KE/einreichungListe.xhtml', runScripts: 'outside-only' });
  const fetch = vi.fn().mockResolvedValue({ text: async () => response ?? render() });
  Object.assign(dom.window, { fetch });
  dom.window.eval(script);
  const submit = () => dom.window.document.querySelector('form[data-search]')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  return { dom, fetch, submit };
}
describe('synthetic page behavior', () => {
  it('structural AJAX replaces rows and settles only after a recognized response', async () => {
    const { dom, fetch, submit } = setup('ajax-replace');
    const before = dom.window.document.querySelector('[data-fixture]');
    submit(); submit();
    expect(dom.window.document.querySelector('[aria-busy=true]')).not.toBeNull();
    await vi.waitFor(() => expect(dom.window.document.querySelector('[aria-busy=true]')).toBeNull());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(dom.window.document.querySelectorAll('[data-fixture]')).toHaveLength(20);
    expect(dom.window.document.querySelector('[data-fixture]')).not.toBe(before);
    dom.window.close();
  });
  it('text-only AJAX stays explicitly not ready', async () => {
    const { dom, submit } = setup('ajax-text-only'); submit();
    await vi.waitFor(() => expect(dom.window.document.querySelector('.badge')?.textContent).toBe('↪ 123.45 €'));
    expect(dom.window.document.querySelector('[aria-busy=true]')).not.toBeNull();
    dom.window.close();
  });
  it('unexpected login HTML and network failure never release retained rows as ready', async () => {
    for (const failure of [false, true]) {
      const { dom, fetch, submit } = setup('ajax-replace', '<h1>Demo login</h1>');
      if (failure) fetch.mockRejectedValue(new Error('offline'));
      submit();
      await vi.waitFor(() => expect(dom.window.document.querySelector('[aria-busy=true]')?.textContent).toContain('Suchausgang unklar'));
      expect(fetch).toHaveBeenCalledTimes(1); dom.window.close();
    }
  });
  it('developer controls mutate only the current rendered document', () => {
    const { dom } = setup('mixed');
    expect(dom.window.document.querySelectorAll('.claim-fields')).toHaveLength(0);
    expect(dom.window.document.querySelectorAll('.cb_date')).toHaveLength(20);
    expect(dom.window.document.querySelectorAll('.cb_details')).toHaveLength(20);
    for (const action of ['amount', 'status', 'remove']) (dom.window.document.querySelector(`[data-mutate=${action}]`) as HTMLElement).click();
    expect(dom.window.document.querySelector('.badge')?.textContent).toBe('↪ 123.45 €');
    expect(dom.window.document.querySelector('.card_title h2')?.textContent).toBe('abgelehnte Einreichungen');
    expect(dom.window.document.querySelectorAll('[data-fixture]')).toHaveLength(19);
    const fresh = setup('mixed'); expect(fresh.dom.window.document.querySelectorAll('[data-fixture]')).toHaveLength(20);
    dom.window.close(); fresh.dom.window.close();
  });
  it('renders the English synthetic presentation without changing selectors or values', () => {
    const { dom } = setup('mixed', undefined, 'en');
    expect(dom.window.document.documentElement.lang).toBe('en');
    expect(dom.window.document.querySelector('h1')?.textContent).toBe('Claims');
    expect(dom.window.document.querySelector('input#vonDat[placeholder="DD.MM.YYYY"]')).not.toBeNull();
    expect(dom.window.document.querySelector('.card_title h2')?.textContent).toBe('Open claims');
    expect(dom.window.document.querySelector('.cb_title')?.textContent).toContain('Invoice dated');
    expect(dom.window.document.querySelectorAll('[data-fixture]')).toHaveLength(20);
    expect(dom.window.document.querySelectorAll('.claim-fields')).toHaveLength(0);
    expect(dom.window.document.querySelector('[data-mutate=amount]')).not.toBeNull();
    dom.window.close();
  });
});
