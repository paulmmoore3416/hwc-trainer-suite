import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Award, Download, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useScopeIds } from '../lib/auth';
import { must } from '../lib/errors';
import { addDays, certStatus, fmtDate, safeSearch, today } from '../lib/format';
import { PAGE_SIZE } from '../lib/config';
import { downloadCsv } from '../lib/csv';
import type { Certificate } from '../lib/types';
import { Button, Card, CertBadge, Empty, Input, PageHeader, Pager, Select, Spinner } from '../components/ui';

export default function Certificates() {
  const nav = useNavigate();
  const ids = useScopeIds();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [program, setProgram] = useState('');
  const [page, setPage] = useState(0);

  function build(count: boolean) {
    let query = supabase
      .from('certificates')
      .select('id, cert_number, student_id, student_name, facility_name, program_verbal, program_physical, issue_date, expiration_date, status, signer_name, created_at', count ? { count: 'exact' } : undefined)
      .in('facility_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    const s = safeSearch(q);
    if (s) query = query.or(`student_name.ilike.%${s}%,cert_number.ilike.%${s}%,signer_name.ilike.%${s}%`);
    const t = today();
    if (status === 'valid') query = query.eq('status', 'active').gt('expiration_date', addDays(t, 60));
    if (status === 'expiring') query = query.eq('status', 'active').gte('expiration_date', t).lte('expiration_date', addDays(t, 60));
    if (status === 'expired') query = query.eq('status', 'active').lt('expiration_date', t);
    if (status === 'revoked') query = query.eq('status', 'revoked');
    if (program === 'both') query = query.eq('program_verbal', true).eq('program_physical', true);
    if (program === 'verbal') query = query.eq('program_verbal', true).eq('program_physical', false);
    if (program === 'physical') query = query.eq('program_physical', true).eq('program_verbal', false);
    return query.order('issue_date', { ascending: false }).order('cert_number', { ascending: false });
  }

  const { data, isLoading } = useQuery({
    queryKey: ['certificates', ids, q, status, program, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await build(true).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      must(res, 'certificates');
      return { rows: (res.data ?? []) as Certificate[], total: res.count ?? 0 };
    },
  });

  async function exportCsv() {
    const rows = must(await build(false).limit(10000), 'export certificates') as Certificate[];
    downloadCsv(
      `hwc-certificates-${today()}`,
      rows.map((c) => ({
        'Certificate #': c.cert_number,
        Student: c.student_name,
        Facility: c.facility_name,
        Verbal: c.program_verbal ? 'Yes' : 'No',
        Physical: c.program_physical ? 'Yes' : 'No',
        'Training date': c.issue_date,
        'Valid through': c.expiration_date,
        Status: certStatus(c),
        Instructor: c.signer_name,
      })),
    );
  }

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <>
      <PageHeader
        icon={<Award className="h-5 w-5" />}
        title="Certificates"
        subtitle="Every student certificate issued in your facilities. Instructor certificates are not managed here."
        actions={
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <Card>
        <div className="-m-5 mb-0 grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input placeholder="Search student, certificate #, instructor…" value={q} onChange={(e) => reset(() => setQ(e.target.value))} className="pl-9" />
          </div>
          <Select
            value={status}
            onChange={(e) => reset(() => setStatus(e.target.value))}
            placeholder="Any status"
            options={[
              { value: 'valid', label: 'Current' },
              { value: 'expiring', label: 'Expiring (60 days)' },
              { value: 'expired', label: 'Expired' },
              { value: 'revoked', label: 'Revoked' },
            ]}
          />
          <Select
            value={program}
            onChange={(e) => reset(() => setProgram(e.target.value))}
            placeholder="Any program"
            options={[
              { value: 'both', label: 'Verbal + Physical' },
              { value: 'verbal', label: 'Verbal only' },
              { value: 'physical', label: 'Physical only' },
            ]}
          />
        </div>
        <div className="-mx-5 -mb-5 overflow-x-auto">
          {isLoading ? (
            <Spinner />
          ) : !data?.rows.length ? (
            <Empty icon={<Award className="h-6 w-6" />} title="No certificates found">
              Certificates are issued when you create a student, from a class roster, or from a student's profile.
            </Empty>
          ) : (
            <>
              <table className="w-full min-w-[820px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Certificate #</th>
                    <th className="th">Student</th>
                    <th className="th">Program</th>
                    <th className="th">Trained</th>
                    <th className="th">Valid through</th>
                    <th className="th">Instructor</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((c) => (
                    <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/certificates/${c.id}`)}>
                      <td className="td font-mono text-xs">{c.cert_number}</td>
                      <td className="td">
                        <div className="font-medium text-slate-900">{c.student_name}</div>
                        <div className="text-xs text-slate-500">{c.facility_name}</div>
                      </td>
                      <td className="td">{[c.program_verbal && 'Verbal', c.program_physical && 'Physical'].filter(Boolean).join(' + ')}</td>
                      <td className="td tabular-nums">{fmtDate(c.issue_date)}</td>
                      <td className="td tabular-nums">{fmtDate(c.expiration_date)}</td>
                      <td className="td">{c.signer_name ?? '—'}</td>
                      <td className="td">
                        <CertBadge status={certStatus(c)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
            </>
          )}
        </div>
      </Card>
    </>
  );
}
