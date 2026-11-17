import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ShieldX, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../lib/format';
import { Spinner } from '../components/ui';
import { Link } from 'react-router-dom';

interface Result {
  cert_number: string;
  student_name: string;
  facility_name: string;
  program_verbal: boolean;
  program_physical: boolean;
  program_label: string;
  issue_date: string;
  expiration_date: string;
  status: 'valid' | 'expired' | 'revoked';
}

/** Public page reached from the QR code on a certificate. Shows only what is printed on the certificate. */
export default function Verify() {
  const { code = '' } = useParams();
  const [state, setState] = useState<{ loading: boolean; result: Result | null }>({ loading: true, result: null });

  useEffect(() => {
    supabase.rpc('verify_certificate', { p_code: code }).then(({ data }) => setState({ loading: false, result: (data as Result) ?? null }));
  }, [code]);

  const r = state.result;
  const tone =
    r?.status === 'valid'
      ? { bg: 'bg-green-50 border-green-200', text: 'text-green-800', icon: <CheckCircle2 className="h-8 w-8 text-green-600" />, label: 'Valid certification' }
      : r?.status === 'expired'
        ? { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: <XCircle className="h-8 w-8 text-amber-600" />, label: 'Certification expired' }
        : { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: <ShieldX className="h-8 w-8 text-red-600" />, label: r ? 'Certificate revoked' : 'Certificate not found' };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="font-serif text-3xl font-semibold text-brand-800 italic">Handle With Care</div>
          <div className="text-xs tracking-[0.25em] text-slate-500 uppercase">Certificate Verification</div>
        </div>
        {state.loading ? (
          <Spinner label="Verifying…" />
        ) : (
          <>
            <div className={`mt-6 flex items-center gap-3 rounded-xl border p-4 ${tone.bg}`}>
              {tone.icon}
              <div className={`text-lg font-semibold ${tone.text}`}>{tone.label}</div>
            </div>
            {r && (
              <dl className="mt-6 grid grid-cols-3 gap-y-3 text-sm">
                <dt className="text-slate-500">Name</dt>
                <dd className="col-span-2 font-semibold text-slate-900">{r.student_name}</dd>
                <dt className="text-slate-500">Facility</dt>
                <dd className="col-span-2 text-slate-900">{r.facility_name}</dd>
                <dt className="text-slate-500">Program</dt>
                <dd className="col-span-2 text-slate-900">
                  {r.program_label} — {[r.program_verbal && 'Verbal', r.program_physical && 'Physical'].filter(Boolean).join(' & ')}
                </dd>
                <dt className="text-slate-500">Trained</dt>
                <dd className="col-span-2 text-slate-900">{fmtDate(r.issue_date, 'long')}</dd>
                <dt className="text-slate-500">Valid through</dt>
                <dd className="col-span-2 text-slate-900">{fmtDate(r.expiration_date, 'long')}</dd>
                <dt className="text-slate-500">Certificate #</dt>
                <dd className="col-span-2 font-mono text-slate-900">{r.cert_number}</dd>
              </dl>
            )}
            {r && r.status !== 'revoked' && (
              <Link to={`/badge/${code}`} className="mt-6 block rounded-lg bg-brand-800 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700">
                View digital badge & share
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
