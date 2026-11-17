import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ShieldX, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../lib/format';
import { programText } from '../lib/certificate';
import type { CertLayout } from '../lib/types';
import { BadgeShare } from '../components/Badge';
import { Spinner } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';

interface Credential {
  cert_number: string;
  student_name: string;
  facility_name: string;
  program_verbal: boolean;
  program_physical: boolean;
  program_label: string;
  issue_date: string;
  expiration_date: string;
  theme: string;
  layout: CertLayout;
  status: 'valid' | 'expired' | 'revoked';
}

/** Public, shareable credential page for a certificate's digital badge (linked from LinkedIn and social posts). */
export default function BadgePage() {
  const { code = '' } = useParams();
  const [state, setState] = useState<{ loading: boolean; c: Credential | null }>({ loading: true, c: null });

  useEffect(() => {
    supabase.rpc('verify_certificate', { p_code: code }).then(({ data }) => setState({ loading: false, c: (data as Credential) ?? null }));
  }, [code]);

  useEffect(() => {
    if (state.c) document.title = `${state.c.student_name} — Handle With Care Certified`;
    return () => {
      document.title = 'HWC Trainer Suite';
    };
  }, [state.c]);

  const c = state.c;
  const status =
    c?.status === 'valid'
      ? { cls: 'bg-green-50 text-green-800 ring-green-200', icon: <CheckCircle2 className="h-4 w-4" />, label: 'Verified · Active credential' }
      : c?.status === 'expired'
        ? { cls: 'bg-amber-50 text-amber-800 ring-amber-200', icon: <XCircle className="h-4 w-4" />, label: 'Verified · Expired' }
        : { cls: 'bg-red-50 text-red-800 ring-red-200', icon: <ShieldX className="h-4 w-4" />, label: 'Revoked' };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-white to-slate-100 px-4 py-10">
      <div className="mx-auto flex max-w-4xl justify-end">
        <ThemeToggle />
      </div>
      <div className="mx-auto mt-2 max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="no-invert bg-gradient-to-r from-brand-900 via-brand-800 to-[#16465a] px-8 py-6 text-white">
          <div className="font-serif text-3xl font-semibold italic">Handle With Care</div>
          <div className="text-xs tracking-[0.3em] text-teal-200 uppercase">Digital Credential</div>
        </div>
        {state.loading ? (
          <Spinner label="Loading credential…" />
        ) : !c ? (
          <div className="p-10 text-center">
            <ShieldX className="mx-auto h-10 w-10 text-red-500" />
            <h1 className="mt-3 text-xl font-semibold text-slate-900">Credential not found</h1>
            <p className="mt-1 text-sm text-slate-500">Check the link, or ask the issuing instructor to resend it.</p>
          </div>
        ) : (
          <div className="grid gap-8 p-8 md:grid-cols-[1fr_1.1fr]">
            <div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${status.cls}`}>
                {status.icon}
                {status.label}
              </span>
              <h1 className="mt-4 text-3xl font-bold text-slate-900">{c.student_name}</h1>
              <p className="mt-1 text-slate-600">
                earned the <strong>Handle With Care Certification</strong> — {programText(c.program_verbal, c.program_physical)}
              </p>
              <dl className="mt-6 space-y-3 text-sm">
                {[
                  ['Program', c.program_label],
                  ['Issued at', c.facility_name],
                  ['Training date', fmtDate(c.issue_date, 'long')],
                  ['Valid through', fmtDate(c.expiration_date, 'long')],
                  ['Credential ID', c.cert_number],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-right font-medium text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-xs leading-relaxed text-slate-500">
                Handle With Care is a behavior management training system. This credential confirms completion of instructor-led training and competency assessment
                {c.program_physical ? ' in verbal de-escalation and physical intervention techniques' : ' in verbal de-escalation'}. Certification is valid for the period shown.
              </p>
              <Link to={`/verify/${code}`} className="mt-3 inline-block text-xs text-brand-600 hover:underline">
                Open verification record
              </Link>
            </div>
            <div className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
              <BadgeShare
                theme={c.theme}
                layout={c.layout}
                studentName={c.student_name}
                disabled={c.status === 'revoked'}
                share={{
                  code,
                  certNumber: c.cert_number,
                  facilityName: c.facility_name,
                  programVerbal: c.program_verbal,
                  programPhysical: c.program_physical,
                  issueDate: c.issue_date,
                  expirationDate: c.expiration_date,
                }}
              />
            </div>
          </div>
        )}
      </div>
      <p className="mx-auto mt-6 max-w-4xl text-center text-xs text-slate-400">Issued through the Handle With Care Trainer Suite</p>
    </div>
  );
}
