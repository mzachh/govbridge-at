import assert from 'node:assert/strict';
const origin = process.argv[2] ?? 'http://localhost:4173';
if (!['http://localhost:4173', 'http://127.0.0.1:4173'].includes(origin))
  throw new Error('Local demo origins only');
const base = '/vsInfo/views/KE/';
let session = '';
async function request(path, fields) {
  return fetch(origin + path, {
    redirect: 'manual',
    method: fields ? 'POST' : 'GET',
    headers: {
      ...(session ? { Cookie: session } : {}),
      ...(fields
        ? {
            Origin: origin,
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        : {}),
    },
    body: fields ? new URLSearchParams(fields) : undefined,
  });
}
assert.equal((await request('/healthz')).status, 200);
assert.equal((await request(base + 'einreichungListe.xhtml')).status, 303);
const login = await request('/login', {
  username: 'peter',
  password: 'ThisIsJustADemo$',
});
assert.equal(login.status, 303);
session = login.headers.get('set-cookie').split(';')[0];
const list = await request(login.headers.get('location'));
assert.equal(list.status, 200);
assert.equal(((await list.text()).match(/data-fixture=/g) ?? []).length, 20);
for (const [path, fields] of [
  [
    'einreichungTyp.xhtml',
    { vonDatWAH: '03.09.2021', bisDatWAH: '02.09.2026' },
  ],
  ['einreichungListe.xhtml', { vonDat: '03.09.2021', bisDat: '02.09.2026' }],
]) {
  const response = await request(base + path, fields);
  assert.equal(response.status, 303);
  const html = await (await request(response.headers.get('location'))).text();
  assert.equal((html.match(/data-fixture=/g) ?? []).length, 20);
}
const invalid = await request(base + 'einreichungTyp.xhtml', {
  vonDatWAH: '<script>bad</script>',
  bisDatWAH: '02.09.2026',
});
assert.equal(invalid.status, 422);
const invalidHtml = await invalid.text();
assert.ok(invalidHtml.includes('&lt;script&gt;bad&lt;/script&gt;'));
assert.ok(!invalidHtml.includes('<script>bad</script>'));
assert.equal((await request('/logout', {})).status, 303);
session = '';
assert.equal((await request(base + 'einreichungListe.xhtml')).status, 303);
console.log(
  'Local HTTP smoke passed: login, 20 rows, both POST/redirect searches, escaped validation, logout.',
);
