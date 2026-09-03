import { describe, expect, it } from 'vitest';
import { handle } from '../server/handler';
import { token } from '../server/session';
import { LIST, TYPE, safeReturn } from '../server/validation';

const origin = 'http://localhost:4173';
const secret = 'local-only-demo-session-key-not-for-deployment';
const matching = ['04.09.2023', '03.09.2026'] as const;
const empty = ['03.09.2026', '03.09.2026'] as const;

async function request(path: string, dates?: readonly [string, string]) {
  const isType = new URL(path, origin).pathname === TYPE;
  return handle(
    new Request(origin + path, {
      method: dates ? 'POST' : 'GET',
      headers: {
        cookie: 'govbridge_demo=' + (await token(secret)),
        ...(dates
          ? { origin, 'content-type': 'application/x-www-form-urlencoded' }
          : {}),
      },
      body: dates
        ? new URLSearchParams({
            [isType ? 'vonDatWAH' : 'vonDat']: dates[0],
            [isType ? 'bisDatWAH' : 'bisDat']: dates[1],
          })
        : undefined,
    }),
  );
}

function searchAction(html: string) {
  const match = html.match(/<form method="post" action="([^"]+)" data-search=/);
  expect(match).not.toBeNull();
  return match![1]!.replaceAll('&amp;', '&');
}

async function submit(path: string, dates: readonly [string, string]) {
  const response = await request(path, dates);
  expect(response.status).toBe(303);
  const location = response.headers.get('location')!;
  const page = await request(location);
  expect(page.status).toBe(200);
  return { url: new URL(location, origin), html: await page.text() };
}

// Spec 013: a natural empty outcome must never select a forced-empty scenario.
describe('recoverable empty searches', () => {
  for (const lang of ['en', 'de']) {
    it(`recovers directly from a reloaded empty type page (${lang})`, async () => {
      const noMatches = await submit(`${TYPE}?lang=${lang}`, empty);
      const reloaded = await request(
        noMatches.url.pathname + noMatches.url.search,
      );
      const recovered = await submit(
        searchAction(await reloaded.text()),
        matching,
      );
      expect(recovered.url.pathname).toBe(LIST);
      expect(recovered.url.searchParams.get('scenario')).toBe('mixed');
      expect(recovered.html.match(/data-fixture=/g)).toHaveLength(12);
    });

    for (const route of [TYPE, LIST]) {
      it(`recovers 12 → 0 → 12 using rendered form actions (${lang}, ${route})`, async () => {
        const first = await submit(`${route}?lang=${lang}`, matching);
        expect(first.html.match(/data-fixture=/g)).toHaveLength(12);
        const noMatches = await submit(searchAction(first.html), empty);
        expect(noMatches.url.pathname).toBe(TYPE);
        expect(noMatches.url.searchParams.get('scenario')).toBe('mixed');
        expect(noMatches.url.searchParams.get('searched')).toBe('1');
        expect(noMatches.url.searchParams.get('lang')).toBe(lang);
        expect(noMatches.html).toContain('id="infolist"');
        expect(noMatches.html).not.toContain('data-fixture=');
        const action = searchAction(noMatches.html);
        expect(action).not.toContain('searched=');
        const recovered = await submit(action, matching);
        expect(recovered.url.pathname).toBe(LIST);
        expect(recovered.url.searchParams.get('scenario')).toBe('mixed');
        expect(recovered.url.searchParams.get('lang')).toBe(lang);
        expect(recovered.url.searchParams.has('searched')).toBe(false);
        expect(recovered.html.match(/data-fixture=/g)).toHaveLength(12);
        expect(recovered.html).not.toContain('id="infolist"');
      });
    }

    it(`keeps an unsubmitted mask distinct from an empty outcome (${lang})`, async () => {
      const path = `${TYPE}?from=2026-09-03&to=2026-09-03&lang=${lang}`;
      expect(await (await request(path)).text()).not.toContain('id="infolist"');
      const completed = await (await request(path + '&searched=1')).text();
      expect(completed).toContain('id="infolist"');
      const other = lang === 'en' ? 'de' : 'en';
      const switchLink = completed.match(
        new RegExp(`href="([^"]+)" lang="${other}"`),
      );
      expect(switchLink).not.toBeNull();
      const switchPath = switchLink![1]!.replaceAll('&amp;', '&');
      expect(new URL(switchPath, origin).searchParams.get('searched')).toBe(
        '1',
      );
      const switched = await request(switchPath);
      expect(switched.headers.get('content-language')).toBe(other);
      expect(await switched.text()).toContain('id="infolist"');
      const matchingPage = await request(
        `${TYPE}?from=2023-09-04&to=2026-09-03&searched=1&lang=${lang}`,
      );
      expect(await matchingPage.text()).not.toContain('id="infolist"');
    });

    it(`keeps validation authoritative after an empty outcome (${lang})`, async () => {
      const response = await request(
        `${TYPE}?from=2026-09-03&to=2026-09-03&searched=1&lang=${lang}`,
        ['31.02.2026', '03.09.2026'],
      );
      expect(response.status).toBe(422);
      const html = await response.text();
      expect(html).toContain('class="infobox error"');
      expect(html).not.toContain('id="infolist"');
    });

    for (const scenario of ['empty-type', 'empty-results']) {
      it(`preserves deliberately forced ${scenario} (${lang})`, async () => {
        const route = scenario === 'empty-type' ? TYPE : LIST;
        const first = await submit(
          `${route}?scenario=${scenario}&lang=${lang}`,
          empty,
        );
        const next = await submit(searchAction(first.html), matching);
        for (const page of [first, next]) {
          expect(page.url.pathname).toBe(route);
          expect(page.url.searchParams.get('scenario')).toBe(scenario);
          expect(page.html).toContain('id="infolist"');
        }
      });
    }
  }

  for (const scenario of ['ajax-replace', 'ajax-text-only']) {
    it(`preserves ${scenario} across a natural empty outcome`, async () => {
      const page = await submit(`${LIST}?scenario=${scenario}`, empty);
      expect(page.url.searchParams.get('scenario')).toBe(scenario);
      expect(page.html).toContain(`data-search="${scenario}"`);
      expect(page.html).toContain('id="infolist"');
    });
  }

  it('bounds the marker to searched=1 on the type route', async () => {
    for (const path of [
      TYPE + '?searched=0',
      TYPE + '?searched=1&searched=1',
      LIST + '?searched=1',
    ]) {
      expect((await request(path)).status).toBe(400);
    }
    expect(
      safeReturn(TYPE + '?from=2026-09-03&to=2026-09-03&searched=1&lang=de'),
    ).toContain('searched=1');
    expect(safeReturn(LIST + '?searched=1')).not.toContain('searched=');
    expect(safeReturn(TYPE + '?searched=invalid')).not.toContain('searched=');
  });
});
