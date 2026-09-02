import { describe, it, expect } from 'vitest';
import { handle } from '../server/handler';
import { token, authenticated } from '../server/session';
import {
  validRange,
  safeReturn,
  LIST,
  TYPE,
  OPEN,
  DETAIL,
} from '../server/validation';
import { CLAIMS, GOLDEN } from '../fixtures/claims';
const origin = 'https://demo.example';
const env = {
  DEMO_SESSION_SECRET: 'synthetic-test-secret-with-at-least-32-characters',
};
async function req(
  path: string,
  options: {
    post?: Record<string, string>;
    session?: boolean;
    cookie?: string;
    origin?: string;
  } = {},
) {
  const headers = new Headers();
  if (options.session)
    headers.set(
      'cookie',
      'govbridge_demo=' + (await token(env.DEMO_SESSION_SECRET)),
    );
  if (options.cookie) headers.set('cookie', options.cookie);
  if (options.post) {
    headers.set('content-type', 'application/x-www-form-urlencoded');
    headers.set('origin', options.origin ?? origin);
  }
  return handle(
    new Request(origin + path, {
      method: options.post ? 'POST' : 'GET',
      headers,
      body: options.post ? new URLSearchParams(options.post) : undefined,
    }),
    env,
  );
}
describe('synthetic data', () => {
  it('has 20 independently keyed records and golden amounts', () => {
    expect(CLAIMS).toHaveLength(20);
    expect(new Set(CLAIMS.map((r) => r.id)).size).toBe(20);
    for (const status of ['processing', 'completed', 'rejected'] as const)
      expect(CLAIMS.filter((r) => r.status === status)).toHaveLength(
        GOLDEN[status],
      );
    expect(
      CLAIMS.filter((r) => r.reimbursementAmount !== undefined),
    ).toHaveLength(10);
    expect(
      CLAIMS.reduce((s, r) => s + (r.reimbursementAmount ?? 0), 0),
    ).toBeCloseTo(492.1);
  });
  it('has four records per fixed rolling year', () => {
    for (let y = 2021; y <= 2025; y++)
      expect(
        CLAIMS.filter(
          (r) =>
            r.invoiceDate >= `${y}-09-03` && r.invoiceDate <= `${y + 1}-09-02`,
        ),
      ).toHaveLength(4);
  });
});
describe('demo login', () => {
  it('redirects protected GET and POST without claims or replay', async () => {
    for (const post of [
      undefined,
      { vonDatWAH: '03.09.2021', bisDatWAH: '02.09.2026' },
    ]) {
      const r = await req(TYPE, { post });
      expect(r.status).toBe(303);
      expect(r.headers.get('location')).toMatch(/^\/login\?/);
      expect(await r.text()).toBe('');
    }
  });
  it('accepts only public credentials and issues a secure cookie', async () => {
    const wrong = await req('/login', {
      post: { username: 'x', password: 'DO-NOT-ECHO' },
    });
    expect(wrong.status).toBe(401);
    expect(await wrong.text()).not.toContain('DO-NOT-ECHO');
    const r = await req('/login', {
      post: {
        username: 'peter',
        password: 'ThisIsJustADemo$',
        returnTo: '//evil.example',
      },
    });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(LIST + '?lang=en');
    expect(r.headers.get('set-cookie')).toMatch(
      /HttpOnly; SameSite=Lax; Max-Age=3600; Secure/,
    );
    expect(
      (await req(LIST, { cookie: r.headers.get('set-cookie')!.split(';')[0] }))
        .status,
    ).toBe(200);
  });
  it('rejects tampering and expiration', async () => {
    const t = await token(env.DEMO_SESSION_SECRET);
    expect(
      await authenticated(
        new Request(origin, {
          headers: { cookie: 'govbridge_demo=' + t + 'x' },
        }),
        env.DEMO_SESSION_SECRET,
      ),
    ).toBe(false);
    const old = await token(env.DEMO_SESSION_SECRET, Date.now() - 3601000);
    expect((await req(LIST, { cookie: 'govbridge_demo=' + old })).status).toBe(
      303,
    );
  });
  it('rejects the retired credential pair', async () => {
    expect(
      (
        await req('/login', {
          post: { username: 'username', password: 'password' },
        })
      ).status,
    ).toBe(401);
  });
  it('logout clears cookie and uses no-store', async () => {
    const r = await req('/logout', { post: {} });
    expect(r.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(r.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects cross-origin login and searches', async () => {
    for (const path of ['/login', TYPE])
      expect(
        (
          await req(path, {
            post: {},
            session: true,
            origin: 'https://evil.example',
          })
        ).status,
      ).toBe(403);
  });
  it('fails closed without deployed signing secret', async () => {
    expect((await handle(new Request(origin + '/login'))).status).toBe(503);
  });
  it('bounds bodies before processing', async () => {
    const r = await req('/login', { post: { password: 'x'.repeat(5000) } });
    expect(r.status).toBe(413);
  });
  it('safe return strips unknown keys and foreign paths', () => {
    expect(safeReturn('https://evil.example')).toBe(LIST);
    expect(safeReturn('/\\evil.example')).toBe(LIST);
    expect(safeReturn(LIST + '?password=secret&scenario=mixed')).toBe(
      LIST + '?scenario=mixed',
    );
  });
});
describe('HTTP compatibility', () => {
  it('renders all twenty only after login', async () => {
    const html = await (await req(LIST, { session: true })).text();
    expect(html.match(/data-fixture=/g)).toHaveLength(20);
    expect(html).toContain('Synthetic demo');
    expect(html).not.toContain('document.modelContext');
  });
  it('search POST uses PRG with bounded invoice dates', async () => {
    const r = await req(TYPE, {
      session: true,
      post: { vonDatWAH: '03.09.2021', bisDatWAH: '02.09.2026' },
    });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toContain(LIST);
    const list = await (
      await req(r.headers.get('location')!, { session: true })
    ).text();
    expect(list.match(/data-fixture=/g)).toHaveLength(20);
  });
  it('empty range redirects to explicit type emptiness', async () => {
    const r = await req(TYPE, {
      session: true,
      post: { vonDatWAH: '01.08.2026', bisDatWAH: '01.08.2026' },
    });
    expect(r.headers.get('location')).toContain('scenario=empty-type');
    const html = await (
      await req(r.headers.get('location')!, { session: true })
    ).text();
    expect(html).toContain('id="infolist"');
  });
  it('server independently rejects invalid calendar dates and >5 years', async () => {
    for (const dates of [
      ['31.02.2026', '02.03.2026'],
      ['01.01.2026', '01.01.2025'],
      ['01.01.2020', '02.01.2025'],
    ]) {
      const r = await req(TYPE, {
        session: true,
        post: { vonDatWAH: dates[0]!, bisDatWAH: dates[1]! },
      });
      expect(r.status).toBe(422);
      expect(await r.text()).toContain('Invalid form entries');
    }
  });
  it('clamps leap anniversaries and allows same day', () => {
    expect(validRange('2024-02-29', '2029-02-28')).toBe(true);
    expect(validRange('2024-02-29', '2029-03-01')).toBe(false);
    expect(validRange('2026-01-01', '2026-01-01')).toBe(true);
  });
  it('separates search requests and pagination', async () => {
    const [a, b] = await Promise.all([
      req(LIST + '?from=2021-09-03&to=2022-09-02', { session: true }),
      req(LIST + '?from=2025-09-03&to=2026-09-02', { session: true }),
    ]);
    expect((await a.text()).match(/data-fixture=/g)).toHaveLength(4);
    expect((await b.text()).match(/data-fixture=/g)).toHaveLength(4);
    for (const page of [1, 2])
      expect(
        (
          await (
            await req(LIST + `?scenario=paginated&page=${page}`, {
              session: true,
            })
          ).text()
        ).match(/data-fixture=/g),
      ).toHaveLength(10);
  });
  it('renders correct detail routes, rejects nonexistent IDs', async () => {
    expect(
      (await req(DETAIL + '?claim=demo-claim-001', { session: true })).status,
    ).toBe(200);
    expect(
      (await req(OPEN + '?claim=demo-claim-003', { session: true })).status,
    ).toBe(200);
    expect(
      (await req(DETAIL + '?claim=demo-claim-999', { session: true })).status,
    ).toBe(404);
    expect(
      (await req(DETAIL + '?claim=demo-claim-003', { session: true })).status,
    ).toBe(404);
  });
  it('rejects unknown selectors and expires the demo session', async () => {
    expect((await req(LIST + '?scenario=nope', { session: true })).status).toBe(
      400,
    );
    expect((await req(LIST + '?page=99', { session: true })).status).toBe(400);
    const r = await req(LIST + '?scenario=expired-session', { session: true });
    expect(r.headers.get('location')).toBe('/login?lang=en');
    expect(r.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
