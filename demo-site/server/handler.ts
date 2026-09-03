import { CLAIMS, DEFAULT_FROM, REFERENCE_DATE } from '../fixtures/claims';
import { presentPage, withLanguage } from './i18n';
import { DEMO_USERNAME, DEMO_PASSWORD } from './demo-login';
import { authenticated, cookie, token } from './session';
import {
  BASE,
  TYPE,
  LIST,
  OPEN,
  DETAIL,
  PATHS,
  isoDate,
  localToIso,
  validRange,
  scenario,
  safeReturn,
} from './validation';
import {
  shell,
  login,
  typePage,
  results,
  detail,
  scenarios,
  invalidResults,
  type Context,
} from './render';
export type DemoEnvironment = { DEMO_SESSION_SECRET?: string };
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
  });
}
function redirect(path: string, setCookie?: string) {
  return new Response(null, {
    status: 303,
    headers: {
      ...headers,
      Location: path,
      ...(setCookie ? { 'Set-Cookie': setCookie } : {}),
    },
  });
}
async function handleRequest(
  request: Request,
  env: DemoEnvironment = {},
): Promise<Response> {
  const u = new URL(request.url),
    secure = u.protocol === 'https:';
  const local =
    !secure &&
    ['http://localhost:4173', 'http://127.0.0.1:4173'].includes(u.origin);
  if (request.method !== 'GET' && request.method !== 'POST')
    return new Response('Method not allowed', { status: 405, headers });
  if (u.pathname === '/healthz')
    return Response.json(
      { ok: true, service: 'govbridge-at-demo', version: 1 },
      { headers },
    );
  if (!secure && !local)
    return new Response('HTTPS required', { status: 400, headers });
  // Local fallback is intentionally limited to the two explicit development origins.
  const secret =
    env.DEMO_SESSION_SECRET ||
    (local ? 'local-only-demo-session-key-not-for-deployment' : undefined);
  if (!secret || secret.length < 32)
    return new Response('Demo session configuration unavailable', {
      status: 503,
      headers,
    });
  let body: URLSearchParams | undefined;
  if (request.method === 'POST') {
    if (request.headers.get('origin') !== u.origin)
      return new Response('Cross-origin POST rejected', {
        status: 403,
        headers,
      });
    if (
      !request.headers
        .get('content-type')
        ?.startsWith('application/x-www-form-urlencoded')
    )
      return new Response('Unsupported content type', { status: 415, headers });
    if (Number(request.headers.get('content-length')) > 4096)
      return new Response('Body too large', { status: 413, headers });
    const reader = request.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 4096) {
          await reader.cancel();
          return new Response('Body too large', { status: 413, headers });
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    body = new URLSearchParams(new TextDecoder().decode(bytes));
    if (
      [...body].some(([k, v]) => k.length > 64 || v.length > 512) ||
      [...body.keys()].some((k) => body!.getAll(k).length !== 1)
    )
      return new Response('Invalid form', { status: 400, headers });
  }
  if (u.pathname === '/login') {
    const target = safeReturn(
      body?.get('returnTo') ?? u.searchParams.get('returnTo'),
    );
    if (request.method === 'GET') return html(login(target));
    if (
      body?.get('username') !== DEMO_USERNAME ||
      body.get('password') !== DEMO_PASSWORD
    )
      return html(login(target, true), 401);
    return redirect(target, cookie(await token(secret), secure));
  }
  if (u.pathname === '/logout')
    return request.method === 'POST'
      ? redirect('/login', cookie('', secure, true))
      : html(
          shell(
            'Abmelden',
            '<form method="post" action="/logout"><button type="submit">Demo abmelden</button></form>',
          ),
        );
  if (!PATHS.includes(u.pathname))
    return html(
      shell('Nicht gefunden', '<p>Diese Demoseite existiert nicht.</p>', false),
      404,
    );
  if (!(await authenticated(request, secret)))
    return redirect(
      '/login?' +
        new URLSearchParams({ returnTo: safeReturn(u.pathname + u.search) }),
    );
  if (
    u.searchParams.size > 7 ||
    [...u.searchParams].some(
      ([k, v]) =>
        k.length > 64 ||
        v.length > 128 ||
        u.searchParams.getAll(k).length !== 1,
    )
  )
    return new Response('Invalid query', { status: 400, headers });
  if (
    [...u.searchParams.keys()].some(
      (k) =>
        ![
          'scenario',
          'from',
          'to',
          'page',
          'claim',
          'lang',
          ...(u.pathname === TYPE ? ['searched'] : []),
          ...(u.pathname === BASE ? ['contentid', 'portal', 'LO'] : []),
        ].includes(k),
    )
  )
    return new Response('Unknown query key', { status: 400, headers });
  if (u.searchParams.has('searched') && u.searchParams.get('searched') !== '1')
    return new Response('Invalid search marker', { status: 400, headers });
  const selected = scenario(u.searchParams.get('scenario'));
  if (!selected)
    return new Response('Unknown scenario', { status: 400, headers });
  if (selected === 'expired-session')
    return redirect('/login', cookie('', secure, true));
  const from = u.searchParams.get('from') ?? DEFAULT_FROM,
    to = u.searchParams.get('to') ?? REFERENCE_DATE;
  const pageText = u.searchParams.get('page') ?? '1';
  if (
    !isoDate(from) ||
    !isoDate(to) ||
    !validRange(from, to) ||
    !['1', '2'].includes(pageText)
  )
    return new Response('Invalid demo context', { status: 400, headers });
  const c: Context = { scenario: selected, from, to, page: Number(pageText) };
  if (u.pathname === BASE)
    return redirect(
      TYPE + '?' + new URLSearchParams({ scenario: selected, from, to }),
    );
  if (u.pathname === '/demo/scenarios')
    return request.method === 'GET'
      ? html(scenarios())
      : new Response('Method not allowed', { status: 405, headers });
  if (request.method === 'POST') {
    if (u.pathname !== TYPE && u.pathname !== LIST)
      return new Response('Method not allowed', { status: 405, headers });
    const raw = {
      from: body?.get(u.pathname === TYPE ? 'vonDatWAH' : 'vonDat') ?? '',
      to: body?.get(u.pathname === TYPE ? 'bisDatWAH' : 'bisDat') ?? '',
    };
    const start = localToIso(raw.from),
      end = localToIso(raw.to);
    if (!start || !end || !validRange(start, end) || selected === 'validation')
      return html(
        u.pathname === TYPE ? typePage(c, true, raw) : invalidResults(c, raw),
        422,
      );
    const none = !CLAIMS.some(
      (r) => r.invoiceDate >= start && r.invoiceDate <= end,
    );
    const target =
      selected === 'empty-type' || (none && selected !== 'empty-results')
        ? TYPE
        : LIST;
    return redirect(
      target +
        '?' +
        new URLSearchParams({
          scenario: selected,
          from: start,
          to: end,
          ...(target === TYPE ? { searched: '1' } : {}),
        }),
    );
  }
  if (u.pathname === TYPE)
    return html(typePage(c, false, undefined, u.searchParams.has('searched')));
  if (u.pathname === LIST) return html(results(c));
  const claim = CLAIMS.find((r) => r.id === u.searchParams.get('claim'));
  if (!claim || (u.pathname === DETAIL) !== (claim.status === 'completed'))
    return html(
      shell('Nicht gefunden', '<p>Unbekannte Demo-Einreichung.</p>'),
      404,
    );
  return html(detail(claim, c));
}

export async function handle(
  request: Request,
  env: DemoEnvironment = {},
): Promise<Response> {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') ?? 'en';
  if (
    !['en', 'de'].includes(lang) ||
    url.searchParams.getAll('lang').length > 1
  )
    return new Response('Unsupported language', { status: 400, headers });
  const language = lang === 'de' ? 'de' : 'en';
  const response = await handleRequest(request, env);
  const outgoing = new Headers(response.headers);
  outgoing.set('Content-Language', language);
  const location = outgoing.get('Location');
  if (location) outgoing.set('Location', withLanguage(location, language));
  if (outgoing.get('Content-Type')?.startsWith('text/html')) {
    return new Response(
      presentPage(await response.text(), language, url.pathname + url.search),
      { status: response.status, headers: outgoing },
    );
  }
  return new Response(response.body, {
    status: response.status,
    headers: outgoing,
  });
}
