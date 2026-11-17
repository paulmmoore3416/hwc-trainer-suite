import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, Plus, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useScopeIds } from '../lib/auth';
import { must } from '../lib/errors';
import { useLookup } from '../lib/queries';
import { fmtDate, fmtDateTime, titleCase, today } from '../lib/format';
import { PAGE_SIZE } from '../lib/config';
import { downloadCsv } from '../lib/csv';
import type { Incident } from '../lib/types';
import { Badge, Button, Card, Empty, PageHeader, Pager, Select, Spinner } from '../components/ui';

export function severityTone(s: string) {
  return s === 'severe' ? 'red' : s === 'moderate' ? 'orange' : s === 'minor' ? 'amber' : 'gray';
}

export default function Incidents() {
  const nav = useNavigate();
  const ids = useScopeIds();
  const types = useLookup('incident_type');
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [follow, setFollow] = useState('');
  const [page, setPage] = useState(0);

  function build(count: boolean) {
    let q = supabase.from('training_incidents').select('*', count ? { count: 'exact' } : undefined).in('facility_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    if (type) q = q.eq('incident_type', type);
    if (severity) q = q.eq('severity', severity);
    if (follow === 'open') q = q.neq('followup_status', 'closed');
    if (follow === 'overdue') q = q.neq('followup_status', 'closed').lt('followup_due', today());
    if (follow === 'closed') q = q.eq('followup_status', 'closed');
    return q.order('occurred_at', { ascending: false });
  }

  const { data, isLoading } = useQuery({
    queryKey: ['incidents', ids, type, severity, follow, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await build(true).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      must(res, 'incidents');
      return { rows: (res.data ?? []) as Incident[], total: res.count ?? 0 };
    },
  });

  async function exportCsv() {
    const rows = must(await build(false).limit(10000), 'export incidents') as Incident[];
    downloadCsv(
      `hwc-training-incidents-${today()}`,
      rows.map((i) => ({
        'Occurred at': i.occurred_at,
        Type: i.incident_type,
        Severity: i.severity,
        Technique: i.technique,
        'Body part': i.body_part,
        'Involved role': i.involved_role,
        Location: i.location,
        Injury: i.injury ? 'Yes' : 'No',
        'First aid': i.first_aid ? 'Yes' : 'No',
        'Medical referral': i.medical_referral ? 'Yes' : 'No',
        'Lost time': i.lost_time ? 'Yes' : 'No',
        'Contributing factors': i.contributing_factors.join('; '),
        Description: i.description,
        'Corrective action': i.corrective_action,
        'Follow-up owner': i.followup_owner,
        'Follow-up due': i.followup_due,
        'Follow-up status': i.followup_status,
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
        icon={<ShieldAlert className="h-5 w-5" />}
        title="Training incidents"
        subtitle="Injuries, near misses and technique problems during HWC training, tracked to make training safer."
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
              Export CSV
            </Button>
            <Link to="/incidents/new">
              <Button icon={<Plus className="h-4 w-4" />}>Log incident</Button>
            </Link>
          </>
        }
      />
      <Card>
        <div className="-m-5 mb-0 flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <Select className="w-52" value={type} onChange={(e) => reset(() => setType(e.target.value))} options={types} placeholder="All incident types" />
          <Select className="w-40" value={severity} onChange={(e) => reset(() => setSeverity(e.target.value))} options={['none', 'minor', 'moderate', 'severe'].map((v) => ({ value: v, label: titleCase(v) }))} placeholder="Any severity" />
          <Select
            className="w-48"
            value={follow}
            onChange={(e) => reset(() => setFollow(e.target.value))}
            placeholder="Any follow-up"
            options={[
              { value: 'open', label: 'Open follow-ups' },
              { value: 'overdue', label: 'Overdue follow-ups' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
        </div>
        <div className="-mx-5 -mb-5 overflow-x-auto">
          {isLoading ? (
            <Spinner />
          ) : !data?.rows.length ? (
            <Empty icon={<ShieldAlert className="h-6 w-6" />} title="No training incidents recorded">
              Logging near misses as well as injuries gives the clearest picture of training safety.
            </Empty>
          ) : (
            <>
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">When</th>
                    <th className="th">Incident</th>
                    <th className="th">Severity</th>
                    <th className="th">Outcome</th>
                    <th className="th">Follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((i) => {
                    const overdue = i.followup_status !== 'closed' && i.followup_due && i.followup_due < today();
                    return (
                      <tr key={i.id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/incidents/${i.id}`)}>
                        <td className="td tabular-nums">{fmtDateTime(i.occurred_at)}</td>
                        <td className="td">
                          <div className="font-medium text-slate-900">{i.incident_type}</div>
                          <div className="text-xs text-slate-500">{[i.technique, i.body_part, titleCase(i.involved_role)].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td className="td">
                          <Badge tone={severityTone(i.severity)}>{titleCase(i.severity)}</Badge>
                        </td>
                        <td className="td text-xs">
                          {[i.injury && 'Injury', i.first_aid && 'First aid', i.medical_referral && 'Medical referral', i.lost_time && 'Lost time'].filter(Boolean).join(', ') || 'No injury'}
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <Badge tone={i.followup_status === 'closed' ? 'green' : overdue ? 'red' : 'amber'} icon={overdue ? <AlertTriangle className="h-3 w-3" /> : undefined}>
                              {overdue ? 'Overdue' : titleCase(i.followup_status)}
                            </Badge>
                            {i.followup_due && i.followup_status !== 'closed' && <span className="text-xs text-slate-500">due {fmtDate(i.followup_due)}</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
