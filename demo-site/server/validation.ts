import { SCENARIOS, type Scenario } from '../fixtures/claims';
export const BASE = '/vsInfo/views/KE/';
export const TYPE = BASE + 'einreichungTyp.xhtml';
export const LIST = BASE + 'einreichungListe.xhtml';
export const OPEN = BASE + 'einreichungDetailOA.xhtml';
export const DETAIL = BASE + 'einreichungDetail.xhtml';
export const PATHS = [BASE, TYPE, LIST, OPEN, DETAIL, '/demo/scenarios'];
export function isoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return (
    Number.isFinite(d.getTime()) &&
    d.toISOString().slice(0, 10) === value &&
    +value.slice(0, 4) >= 1900
  );
}
export function localToIso(value: string): string | undefined {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return;
  const result =
    value.slice(6) + '-' + value.slice(3, 5) + '-' + value.slice(0, 2);
  return isoDate(result) ? result : undefined;
}
export function localDate(value: string): string {
  return value.slice(8, 10) + '.' + value.slice(5, 7) + '.' + value.slice(0, 4);
}
export function validRange(from: string, to: string): boolean {
  if (!isoDate(from) || !isoDate(to) || from > to) return false;
  const year = +from.slice(0, 4) + 5;
  let anniversary = String(year) + from.slice(4);
  if (!isoDate(anniversary)) anniversary = String(year) + '-02-28';
  return to <= anniversary;
}
export function scenario(value: string | null): Scenario | undefined {
  return value === null ? 'mixed' : SCENARIOS.find((s) => s === value);
}
export function safeReturn(value: string | null): string {
  if (
    !value ||
    value.length > 512 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  )
    return LIST;
  const u = new URL(value, 'https://demo.invalid');
  if (u.origin !== 'https://demo.invalid' || !PATHS.includes(u.pathname))
    return LIST;
  const p = new URLSearchParams();
  for (const [k, v] of u.searchParams) {
    if (k === 'lang' && (v === 'en' || v === 'de')) p.set(k, v);
    if (k === 'scenario' && scenario(v) && v !== 'expired-session') p.set(k, v);
    if ((k === 'from' || k === 'to') && isoDate(v)) p.set(k, v);
    if (k === 'page' && /^[12]$/.test(v)) p.set(k, v);
    if (k === 'claim' && /^demo-claim-0(0[1-9]|1\d|20)$/.test(v)) p.set(k, v);
  }
  return u.pathname + (p.size ? '?' + p : '');
}
