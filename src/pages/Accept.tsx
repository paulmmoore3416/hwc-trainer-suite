import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { errMessage, logError } from '../lib/errors';
import { Button, ErrorNote, Field, Input, Spinner } from '../components/ui';

/** Handles invite links (#/accept?token_hash=…&type=invite|recovery) and password-recovery sessions (#/set-password). */
export default function Accept() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { session, profile, refresh, setRecovery } = useAuth();
  const tokenHash = params.get('token_hash');
  const type = (params.get('type') ?? 'invite') as EmailOtpType;
  const [verifying, setVerifying] = useState(!!tokenHash);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!tokenHash || ran.current) return;
    ran.current = true;
    (async () => {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        setVerifyError(
          /expired|invalid/i.test(error.message)
            ? 'This link has expired or was already used. Ask the instructor who invited you to send a new link.'
            : errMessage(error),
        );
        logError(error, { context: 'accept-invite', type }, 'warn');
      } else {
        setRecovery(true);
        window.history.replaceState(null, '', window.location.pathname + '#/set-password');
      }
      setVerifying(false);
    })();
  }, [tokenHash, type, setRecovery]);

  useEffect(() => {
    if (profile?.full_name && !fullName) setFullName(profile.full_name);
  }, [profile?.full_name, fullName]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError('Use at least 10 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      if (profile && fullName.trim() && fullName.trim() !== profile.full_name) {
        await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', profile.id);
      }
      await supabase.rpc('log_auth_event', { p_event: 'password_set', p_user_agent: navigator.userAgent });
      setRecovery(false);
      await refresh();
      nav('/', { replace: true });
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-[#16465a] p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src="./brand/archvista-logo.png" alt="Arch Vista Behavioral Health" className="h-12" />
        </div>
        {verifying ? (
          <Spinner label="Checking your link…" />
        ) : verifyError ? (
          <>
            <h1 className="text-xl font-bold text-slate-900">Link problem</h1>
            <div className="mt-4">
              <ErrorNote error={verifyError} />
            </div>
            <Button className="mt-6" variant="secondary" onClick={() => nav('/login')}>
              Go to sign in
            </Button>
          </>
        ) : !session ? (
          <>
            <h1 className="text-xl font-bold text-slate-900">Your session has ended</h1>
            <p className="mt-2 text-sm text-slate-600">Open your invitation or reset link again, or sign in.</p>
            <Button className="mt-6" onClick={() => nav('/login')}>
              Sign in
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-teal-brand">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold tracking-wider uppercase">Secure account setup</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Welcome to the HWC Trainer Suite</h1>
            <p className="mt-1 text-sm text-slate-500">Set your password to finish setting up {session.user.email}.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Full name (as it should appear on certificates)">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
              </Field>
              <Field label="New password" hint="At least 10 characters.">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
              </Field>
              <Field label="Confirm password">
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
              </Field>
              <ErrorNote error={error} />
              <Button type="submit" loading={busy} className="w-full py-2.5" icon={<KeyRound className="h-4 w-4" />}>
                Save password & continue
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
