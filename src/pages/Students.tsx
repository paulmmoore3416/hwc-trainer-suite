import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Search, UserPlus, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, useScopeIds } from '../lib/auth';
import { must } from '../lib/errors';
import { useLookup } from '../lib/queries';
import { fmtDate, safeSearch, studentFullName, titleCase } from '../lib/format';
import { PAGE_SIZE } from '../lib/config';
import { downloadCsv } from '../lib/csv';
import { Button, Card, CertBadge, Empty, Input, PageHeader, Pager, Select, Spinner } from '../components/ui';

interface Row {
  student_id: string;
  facility_id: string;
  first_name: string;
  middle_initial: string | null;
  last_name: string;
  employee_id: string | null;
  job_title: string | null;
  department: string | null;
  student_type: string | null;
  student_status: string;
  expiration_date: string | null;
  cert_status: 'current' | 'expiring' | 'expired' | 'none';
  cert_count: number;
}

export default function Students() {
  const nav = useNavigate();
  const { facilities } = useAuth();
  const ids = useScopeIds();
  const types = useLookup('student_type');
  const depts = useLookup('department');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [dept, setDept] = useState('');
  const [cert, setCert] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  function buildQuery(count: boolean) {
    let query = supabase.from('student_roster').select('*', count ? { count: 'exact' } : undefined).in('facility_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    const s = safeSearch(q);
    if (s) query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,employee_id.ilike.%${s}%,job_title.ilike.%${s}%`);
    if (type) query = query.eq('student_type', type);
    if (dept) query = query.eq('department', dept);
    if (cert) query = query.eq('cert_status', cert);
    if (status) query = query.eq('student_status', status);
    return query.order('last_name').order('first_name');
  }

  const { data, isLoading } = useQuery({
    queryKey: ['students', ids, q, type, dept, cert, status, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await buildQuery(true).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      must(res, 'students list');
      return { rows: (res.data ?? []) as Row[], total: res.count ?? 0 };
    },
  });

  async function exportCsv() {
    setExporting(true);
    try {
      const rows = must(await buildQuery(false).limit(10000), 'export students') as Row[];
      const fac = new Map(facilities.map((f) => [f.id, f.name]));
      downloadCsv(
        `hwc-students-${new Date().toISOString().slice(0, 10)}`,
        rows.map((r) => ({
          Name: studentFullName(r),
          'Employee ID': r.employee_id,
          Facility: fac.get(r.facility_id),
          'Student type': r.student_type,
          Department: r.department,
          'Job title': r.job_title,
          Status: r.student_status,
          Certification: r.cert_status,
          'Valid through': r.expiration_date,
          Certificates: r.cert_count,
        })),
      );
    } finally {
      setExporting(false);
    }
  }

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <>
      <PageHeader
        icon={<Users className="h-5 w-5" />}
        title="Students"
        subtitle="Staff trained in Handle With Care at your facilities."
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={exporting} onClick={exportCsv}>
              Export CSV
            </Button>
            <Link to="/students/new">
              <Button icon={<UserPlus className="h-4 w-4" />}>New student</Button>
            </Link>
          </>
        }
      />
      <Card className="overflow-hidden" title={undefined}>
        <div className="-m-5 mb-0 grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input placeholder="Search name, employee ID, title…" value={q} onChange={(e) => reset(() => setQ(e.target.value))} className="pl-9" />
          </div>
          <Select value={type} onChange={(e) => reset(() => setType(e.target.value))} options={types} placeholder="All student types" />
          <Select value={dept} onChange={(e) => reset(() => setDept(e.target.value))} options={depts} placeholder="All departments" />
          <Select
            value={cert}
            onChange={(e) => reset(() => setCert(e.target.value))}
            placeholder="Any certification"
            options={[
              { value: 'current', label: 'Current' },
              { value: 'expiring', label: 'Expiring (60 days)' },
              { value: 'expired', label: 'Expired' },
              { value: 'none', label: 'Not certified' },
            ]}
          />
          <Select
            value={status}
            onChange={(e) => reset(() => setStatus(e.target.value))}
            placeholder="All statuses"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'on_leave', label: 'On leave' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'separated', label: 'Separated' },
            ]}
          />
        </div>
        <div className="-mx-5 -mb-5 overflow-x-auto">
          {isLoading ? (
            <Spinner />
          ) : !data?.rows.length ? (
            <Empty icon={<Users className="h-6 w-6" />} title="No students found">
              Adjust the filters, or <Link to="/students/new" className="text-brand-600 hover:underline">add a student</Link>.
            </Empty>
          ) : (
            <>
              <table className="w-full min-w-[820px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Type</th>
                    <th className="th">Department</th>
                    <th className="th">Status</th>
                    <th className="th">Certification</th>
                    <th className="th">Valid through</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((r) => (
                    <tr key={r.student_id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/students/${r.student_id}`)}>
                      <td className="td">
                        <div className="font-medium text-slate-900">{studentFullName(r)}</div>
                        <div className="text-xs text-slate-500">{[r.employee_id && `#${r.employee_id}`, r.job_title].filter(Boolean).join(' · ') || '—'}</div>
                      </td>
                      <td className="td">{r.student_type ?? '—'}</td>
                      <td className="td">{r.department ?? '—'}</td>
                      <td className="td">{titleCase(r.student_status)}</td>
                      <td className="td">
                        <CertBadge status={r.cert_status} />
                      </td>
                      <td className="td tabular-nums">{fmtDate(r.expiration_date)}</td>
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
