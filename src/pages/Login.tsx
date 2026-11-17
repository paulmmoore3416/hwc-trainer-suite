import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Award, BarChart3, KeyRound, Lock, Mail, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { errMessage, logAuth, logError } from '../lib/errors';
import { appBaseUrl, APP_NAME } from '../lib/config';
import { Button, ErrorNote, Field, Input } from '../components/ui';

type Mode = 'signin' | 'forgot' | 'owner';

export default function Login() {
  const { session, loading } = useAuth();
  const loc = useLocation();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error'));
  const [notice, setNotice] = useState<string | null>(null);

  if (!loading && session) {
    const from = (loc.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const addr = email.trim().toLowerCase();
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
        if (error) {
          logAuth('sign_in_failed', { p_email: addr, p_detail: { reason: error.message } });
          throw error.message === 'Invalid login credentials' ? new Error('Incorrect email or password.') : error;
        }
        logAuth('sign_in');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: appBaseUrl() });
        logAuth('password_reset_requested', { p_email: addr });
        if (error) throw error;
        setNotice('If that email has an account, a reset link is on its way. You can also ask an administrator for a one-time reset link.');
      } else {
        if (password.length < 10) throw new Error('Use at least 10 characters for your password.');
        const { data, error } = await supabase.auth.signUp({
          email: addr,
          password,
          options: { emailRedirectTo: appBaseUrl(), data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        if (data.session) logAuth('sign_in');
        else setNotice('Account created. Check your inbox to confirm your email, then sign in.');
      }
    } catch (err) {
      const msg = errMessage(err);
      setError(msg);
      if (!/incorrect email|invitation only|rate limit/i.test(msg)) logError(err, { context: `login:${mode}` }, 'warn');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-[#16465a] px-8 py-10 text-white lg:flex lg:w-[52%] lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <svg className="pointer-events-none absolute -top-10 -left-10 opacity-20" width="420" height="420" viewBox="0 0 420 420" aria-hidden>
          <polygon points="0,0 260,0 0,260" fill="#1f8a8a" />
          <polygon points="290,0 340,0 0,340 0,290" fill="#8ab85a" />
        </svg>
        <svg className="pointer-events-none absolute -right-10 -bottom-10 opacity-20" width="420" height="420" viewBox="0 0 420 420" aria-hidden>
          <polygon points="420,420 160,420 420,160" fill="#1f8a8a" />
          <polygon points="130,420 80,420 420,80 420,130" fill="#c29a2c" />
        </svg>
        <div className="relative">
          <div className="inline-block rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-white/30">
            <img src="./brand/archvista-logo.png" alt="Arch Vista Behavioral Health" className="h-24 w-auto sm:h-32" />
          </div>
          <h1 className="mt-8 font-serif text-4xl leading-tight font-semibold italic sm:text-5xl">Handle With Care</h1>
          <p className="mt-1 text-sm tracking-[0.3em] text-teal-200 uppercase">Trainer Suite</p>
          <p className="mt-5 max-w-md text-slate-200">
            Training records, certificates, training-incident tracking and compliance reporting for Handle With Care instructors.
          </p>
        </div>
        <ul className="relative mt-8 grid max-w-lg grid-cols-2 gap-3 text-sm text-slate-100">
          {[
            [<Users key="u" className="h-4 w-4" />, 'Student profiles'],
            [<Award key="a" className="h-4 w-4" />, 'Signed certificates'],
            [<BarChart3 key="b" className="h-4 w-4" />, 'Metrics & reporting'],
            [<ShieldCheck key="s" className="h-4 w-4" />, 'Invite-only & secure'],
          ].map(([icon, label]) => (
            <li key={label as string} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 backdrop-blur">
              {icon}
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            {mode === 'signin' ? 'Instructor sign in' : mode === 'forgot' ? 'Reset your password' : 'Owner account setup'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'signin'
              ? 'Access is by invitation from an approved instructor.'
              : mode === 'forgot'
                ? 'We will email you a secure reset link.'
                : 'For pre-approved suite owners only. Everyone else joins through an invitation link.'}
          </p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === 'owner' && (
              <Field label="Full name">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
              </Field>
            )}
            <Field label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className="pl-9" />
              </div>
            </Field>
            {mode !== 'forgot' && (
              <Field label="Password" hint={mode === 'owner' ? 'At least 10 characters.' : undefined}>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'owner' ? 'new-password' : 'current-password'}
                    required
                    minLength={mode === 'owner' ? 10 : undefined}
                    className="pl-9"
                  />
                </div>
              </Field>
            )}
            <ErrorNote error={error} />
            {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div>}
            <Button type="submit" loading={busy} className="w-full py-2.5" icon={<KeyRound className="h-4 w-4" />}>
              {mode === 'signin' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Create owner account'}
            </Button>
          </form>
          <div className="mt-6 flex flex-col gap-2 text-sm">
            {mode !== 'signin' && (
              <button className="text-left text-brand-600 hover:underline" onClick={() => setMode('signin')}>
                ← Back to sign in
              </button>
            )}
            {mode === 'signin' && (
              <>
                <button className="text-left text-brand-600 hover:underline" onClick={() => setMode('forgot')}>
                  Forgot your password?
                </button>
                <button className="text-left text-slate-500 hover:underline" onClick={() => setMode('owner')}>
                  Suite owner? Set up your account
                </button>
              </>
            )}
          </div>
          <p className="mt-10 text-xs text-slate-400">
            {APP_NAME}. Training records only — never enter patient or protected health information.
          </p>
        </div>
      </div>
    </div>
  );
}
