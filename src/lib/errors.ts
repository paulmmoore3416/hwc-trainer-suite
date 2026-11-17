import { supabase } from './supabase';

type AnyErr = { message?: string; code?: string; details?: string; hint?: string; stack?: string; name?: string };

const FRIENDLY: Record<string, string> = {
  '23505': 'A record with these details already exists.',
  '23503': 'This record is linked to other records and cannot be changed that way.',
  '23514': 'Some values are not allowed. Please check the form.',
  '42501': "You don't have permission to do that.",
  PGRST116: 'That record could not be found or you do not have access to it.',
  PGRST301: 'Your session expired. Please sign in again.',
};

/** Human-friendly message for any thrown value (Postgrest, Auth, Error, string). */
export function errMessage(err: unknown): string {
  if (!err) return 'Something went wrong.';
  if (typeof err === 'string') return err;
  const e = err as AnyErr;
  if (e.code && FRIENDLY[e.code]) {
    if (e.code === '23505' && e.message?.includes('students_facility_employee_uidx')) {
      return 'A student with this employee ID already exists at this facility.';
    }
    return FRIENDLY[e.code];
  }
  if (e.message?.includes('Database error saving new user') || e.message?.includes('invitation only')) {
    return 'Registration is by invitation only. Ask an approved instructor to invite you.';
  }
  if (e.message === 'Failed to fetch') return 'Network error — check your connection and try again.';
  return e.message || 'Something went wrong.';
}

const recent = new Map<string, number>();

/** Report an error to the super-admin System Logs (throttled), and to the console. */
export function logError(err: unknown, context?: Record<string, unknown>, level: 'warn' | 'error' | 'fatal' = 'error') {
  const e = (err ?? {}) as AnyErr;
  const message = typeof err === 'string' ? err : e.message || String(err);
  const key = level + message;
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - 15_000) return;
  recent.set(key, now);
  if (recent.size > 200) recent.clear();
  console.error('[HWC]', err, context ?? '');
  void supabase
    .rpc('log_client_error', {
      p_level: level,
      p_message: message.slice(0, 2000),
      p_stack: (e.stack ?? [e.details, e.hint, e.code].filter(Boolean).join(' | ')).slice(0, 8000) || null,
      p_route: window.location.hash.replace(/token_hash=[^&]+/, 'token_hash=***').slice(0, 500),
      p_context: context ? JSON.parse(JSON.stringify(context)) : null,
      p_user_agent: navigator.userAgent,
      p_source: 'client',
    })
    .then(
      () => {},
      () => {},
    );
}

export function installGlobalErrorHandlers() {
  window.addEventListener('error', (ev) => {
    if (ev.message?.includes('ResizeObserver loop')) return;
    logError(ev.error ?? ev.message, { kind: 'window.onerror', file: ev.filename, line: ev.lineno, col: ev.colno });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    logError(ev.reason, { kind: 'unhandledrejection' });
  });
}

/** Unwrap a Supabase response: throws (and logs unexpected errors) when `error` is set. */
export function must<T>(res: { data: T; error: unknown }, context?: string): NonNullable<T> {
  if (res.error) {
    const code = (res.error as AnyErr).code ?? '';
    // Validation / permission errors are user mistakes, not system faults: don't spam the log with them.
    if (!['23505', '23514', '42501', 'PGRST116'].includes(code)) logError(res.error, { context });
    throw res.error;
  }
  return res.data as NonNullable<T>;
}

/** Record a sign-in/out/password event. Supabase queries are lazy, so `.then()` is required to actually send it. */
export function logAuth(event: string, extra: { p_email?: string; p_detail?: Record<string, unknown> } = {}) {
  supabase
    .rpc('log_auth_event', { p_event: event, p_user_agent: navigator.userAgent, ...extra })
    .then(
      () => {},
      () => {},
    );
}
