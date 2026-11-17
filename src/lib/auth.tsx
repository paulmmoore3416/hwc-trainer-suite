import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { logError } from './errors';
import type { MyContext, Profile } from './types';

interface AuthState {
  session: Session | null;
  ctx: MyContext | null;
  profile: Profile | null;
  isSuper: boolean;
  isAdmin: boolean; // facility admin or super admin
  facilities: MyContext['facilities'];
  loading: boolean;
  recovery: boolean;
  setRecovery: (v: boolean) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Facility scope chosen in the top bar ('' = all my facilities). */
  scope: string;
  setScope: (id: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);
const SCOPE_KEY = 'hwc-scope';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ctx, setCtx] = useState<MyContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(() => sessionStorage.getItem('hwc-recovery') === '1');
  const [scope, setScopeState] = useState<string>(() => {
    try {
      return localStorage.getItem(SCOPE_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const setScope = useCallback((id: string) => {
    setScopeState(id);
    try {
      localStorage.setItem(SCOPE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const loadContext = useCallback(async (s: Session | null) => {
    if (!s) {
      setCtx(null);
      return;
    }
    const { data, error } = await supabase.rpc('my_context');
    if (error) {
      logError(error, { context: 'my_context' });
      setCtx(null);
    } else setCtx((data as MyContext) ?? null);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadContext(data.session);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem('hwc-recovery', '1');
        setRecovery(true);
      }
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Defer: calling Supabase inside the callback can deadlock the auth lock.
        setTimeout(() => void loadContext(s), 0);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadContext]);

  // Drop a stale facility scope (e.g. membership removed).
  useEffect(() => {
    if (ctx && scope && !ctx.facilities.some((f) => f.id === scope)) setScope('');
  }, [ctx, scope, setScope]);

  const value = useMemo<AuthState>(() => {
    const profile = ctx?.profile ?? null;
    const isSuper = !!ctx?.is_super_admin;
    return {
      session,
      ctx,
      profile,
      isSuper,
      isAdmin: isSuper || profile?.role === 'admin',
      facilities: ctx?.facilities ?? [],
      loading,
      recovery,
      setRecovery: (v: boolean) => {
        if (v) sessionStorage.setItem('hwc-recovery', '1');
        else sessionStorage.removeItem('hwc-recovery');
        setRecovery(v);
      },
      refresh: () => loadContext(session),
      signOut: async () => {
        await supabase.rpc('log_auth_event', { p_event: 'sign_out', p_user_agent: navigator.userAgent }).then(
          () => {},
          () => {},
        );
        await supabase.auth.signOut();
        setCtx(null);
      },
      scope,
      setScope,
    };
  }, [session, ctx, loading, recovery, loadContext, scope, setScope]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

/** Facility ids the current view should include: the chosen scope, or all of mine. */
export function useScopeIds(): string[] {
  const { scope, facilities } = useAuth();
  return scope ? [scope] : facilities.map((f) => f.id);
}
