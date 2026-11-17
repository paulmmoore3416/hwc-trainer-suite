/** Date helpers that treat `YYYY-MM-DD` strings as local calendar dates (no timezone drift). */
export function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toISODate(new Date());
}

export function addMonths(iso: string, months: number): string {
  const d = parseDate(iso) ?? new Date();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toISODate(target);
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function fmtDate(d: string | null | undefined, style: 'short' | 'long' = 'short'): string {
  const dt = parseDate(d ?? null);
  if (!dt) return '—';
  return style === 'long'
    ? dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function daysUntil(d: string | null | undefined): number | null {
  const dt = parseDate(d ?? null);
  if (!dt) return null;
  const now = parseDate(today())!;
  return Math.round((dt.getTime() - now.getTime()) / 86_400_000);
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function pct(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

export function fmtPct(v: number | null | undefined): string {
  return v == null ? '—' : `${v}%`;
}

export function fmtNum(v: number | string | null | undefined): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function studentFullName(s: { first_name?: string | null; middle_initial?: string | null; last_name?: string | null }): string {
  const mi = (s.middle_initial ?? '').trim().replace(/\.$/, '');
  return [s.first_name?.trim(), mi ? `${mi}.` : '', s.last_name?.trim()].filter(Boolean).join(' ');
}

export function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function certStatus(c: { status: string; expiration_date: string }): 'revoked' | 'expired' | 'expiring' | 'valid' {
  if (c.status === 'revoked') return 'revoked';
  const d = daysUntil(c.expiration_date) ?? 0;
  if (d < 0) return 'expired';
  if (d <= 60) return 'expiring';
  return 'valid';
}

/** Escape a value for use in a PostgREST `or=(...ilike...)` filter. */
export function safeSearch(q: string): string {
  return q.replace(/[%,()*\\]/g, ' ').trim();
}
