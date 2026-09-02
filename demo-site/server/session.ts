const COOKIE = 'govbridge_demo';
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
async function signature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return encode(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
    ),
  );
}
export async function token(secret: string, now = Date.now()): Promise<string> {
  const payload =
    String(Math.floor(now / 1000) + 3600) + '.' + crypto.randomUUID();
  return payload + '.' + (await signature(payload, secret));
}
export async function authenticated(
  request: Request,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + '='))
    ?.slice(COOKIE.length + 1);
  if (!value || value.length > 200) return false;
  const parts = value.split('.');
  if (
    parts.length !== 3 ||
    !/^\d{10}$/.test(parts[0]!) ||
    !/^[-a-f\d]{36}$/.test(parts[1]!)
  )
    return false;
  const expiry = Number(parts[0]);
  if (
    expiry <= Math.floor(now / 1000) ||
    expiry > Math.floor(now / 1000) + 3600
  )
    return false;
  const expected = await signature(parts[0] + '.' + parts[1], secret);
  if (expected.length !== parts[2]!.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++)
    mismatch |= expected.charCodeAt(i) ^ parts[2]!.charCodeAt(i);
  return mismatch === 0;
}
export function cookie(value: string, secure: boolean, clear = false): string {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 3600}${secure ? '; Secure' : ''}`;
}
