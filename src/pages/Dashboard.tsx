import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Award, CalendarDays, CalendarPlus, GraduationCap, ShieldAlert, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, useScopeIds } from '../lib/auth';
import { must } from '../lib/errors';
import { addDays, addMonths, certStatus, fmtDate, fmtNum, fmtPct, monthLabel, pct, studentFullName, today } from '../lib/format';
import type { Certificate, Incident, TrainingSession } from '../lib/types';
import { Bars, ChartCard } from '../components/charts';
import { Button, Card, CertBadge, Empty, Spinner, Stat } from '../components/ui';

export default function Dashboard() {
  const { profile, scope } = useAuth();
  const ids = useScopeIds();
  const inIds = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];

  const { data: m } = useQuery({
    queryKey: ['metrics', addMonths(today(), -12), today(), scope],
    queryFn: async () => must(await supabase.rpc('report_metrics', { p_from: addMonths(today(), -12), p_to: today(), p_facility: scope || null }), 'dashboard metrics') as {
      kpis: Record<string, number>;
      by_month: { month: string; trainees: number; certs: number }[];
    },
  });

  const { data: lists, isLoading } = useQuery({
    queryKey: ['dashboard-lists', ids],
    queryFn: async () => {
      const [upcoming, expiring, followups, recent] = await Promise.all([
        supabase.from('training_sessions').select('*, enrollments(count)').in('facility_id', inIds).gte('start_date', today()).neq('status', 'cancelled').order('start_date').limit(6),
        supabase
          .from('student_roster')
          .select('student_id, first_name, middle_initial, last_name, expiration_date, cert_status')
          .in('facility_id', inIds)
          .eq('student_status', 'active')
          .gte('expiration_date', today())
          .lte('expiration_date', addDays(today(), 60))
          .order('expiration_date')
          .limit(8),
        supabase.from('training_incidents').select('id, incident_type, occurred_at, followup_due, followup_status, severity').in('facility_id', inIds).neq('followup_status', 'closed').order('followup_due', { nullsFirst: false }).limit(6),
        supabase.from('certificates').select('id, cert_number, student_name, issue_date, expiration_date, status').in('facility_id', inIds).order('created_at', { ascending: false }).limit(6),
      ]);
      return {
        upcoming: must(upcoming, 'upcoming') as (TrainingSession & { enrollments: { count: number }[] })[],
        expiring: must(expiring, 'expiring') as { student_id: string; first_name: string; middle_initial: string | null; last_name: string; expiration_date: string; cert_status: 'expiring' }[],
        followups: must(followups, 'followups') as Incident[],
        recent: must(recent, 'recent certs') as Certificate[],
      };
    },
  });

  const k = m?.kpis ?? {};
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <div className="no-invert mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-900 via-brand-800 to-[#16465a] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-teal-200">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {greeting}, {profile?.full_name?.split(' ')[0] || 'Instructor'}
            </h1>
            <p className="mt-1 text-sm text-slate-200">Here is where Handle With Care training stands today.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/students/new">
              <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />}>
                New student
              </Button>
            </Link>
            <Link to="/classes">
              <Button variant="secondary" icon={<CalendarPlus className="h-4 w-4" />}>
                Schedule class
              </Button>
            </Link>
            <Link to="/incidents/new">
              <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />}>
                Log incident
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Users className="h-5 w-5" />} label="Active students" value={m ? fmtNum(k.active_students) : '…'} sub={m ? `${fmtNum(k.never_certified)} not yet certified` : undefined} />
        <Stat icon={<ShieldCheck className="h-5 w-5" />} tone="green" label="Compliance" value={m ? fmtPct(pct(k.certified_current, k.active_students)) : '…'} sub={m ? `${fmtNum(k.certified_current)} currently certified` : undefined} />
        <Stat icon={<AlertTriangle className="h-5 w-5" />} tone="gold" label="Expiring in 60 days" value={m ? fmtNum(k.expiring_60) : '…'} sub={m ? `${fmtNum(k.expired)} already expired` : undefined} />
        <Stat icon={<GraduationCap className="h-5 w-5" />} tone="teal" label="Trained (12 months)" value={m ? fmtNum(k.trainees) : '…'} sub={m ? `${fmtNum(k.sessions)} classes · ${fmtNum(k.incidents)} incidents` : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Trainees by month"
          subtitle="Last 12 months"
          rows={m?.by_month ?? []}
          columns={[
            { key: 'month', label: 'Month' },
            { key: 'trainees', label: 'Trainees' },
            { key: 'certs', label: 'Certificates' },
          ]}
          filename="hwc-dashboard-trainees"
          height={240}
        >
          <Bars
            data={m?.by_month ?? []}
            x="month"
            xFormatter={monthLabel}
            series={[
              { key: 'trainees', label: 'Trainees' },
              { key: 'certs', label: 'Certificates' },
            ]}
          />
        </ChartCard>
        <Card title="Upcoming classes" actions={<Link to="/classes" className="text-xs text-brand-600 hover:underline">All classes</Link>}>
          {isLoading ? (
            <Spinner />
          ) : !lists?.upcoming.length ? (
            <Empty icon={<CalendarDays className="h-6 w-6" />} title="Nothing scheduled" />
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {lists.upcoming.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-12 shrink-0 rounded-lg bg-brand-50 py-1 text-center">
                    <div className="text-[10px] font-semibold text-brand-600 uppercase">{fmtDate(s.start_date).split(' ')[0]}</div>
                    <div className="text-lg leading-none font-bold text-brand-800">{s.start_date.slice(8, 10)}</div>
                  </div>
                  <div className="min-w-0">
                    <Link to={`/classes/${s.id}`} className="block truncate text-sm font-medium text-slate-900 hover:underline">
                      {s.title || s.course_type}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {s.enrollments?.[0]?.count ?? 0} enrolled{s.location ? ` · ${s.location}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Certifications expiring soon" actions={<Link to="/reports" className="text-xs text-brand-600 hover:underline">Compliance report</Link>}>
          {isLoading ? (
            <Spinner />
          ) : !lists?.expiring.length ? (
            <Empty icon={<ShieldCheck className="h-6 w-6" />} title="No expirations in the next 60 days" />
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {lists.expiring.map((r) => (
                <li key={r.student_id} className="flex items-center justify-between py-2.5">
                  <Link to={`/students/${r.student_id}`} className="text-sm font-medium text-brand-700 hover:underline">
                    {studentFullName(r)}
                  </Link>
                  <span className="text-xs text-slate-500 tabular-nums">{fmtDate(r.expiration_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Open incident follow-ups" actions={<Link to="/incidents" className="text-xs text-brand-600 hover:underline">All incidents</Link>}>
          {isLoading ? (
            <Spinner />
          ) : !lists?.followups.length ? (
            <Empty icon={<ShieldAlert className="h-6 w-6" />} title="No open follow-ups" />
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {lists.followups.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2.5">
                  <Link to={`/incidents/${i.id}`} className="truncate text-sm font-medium text-brand-700 hover:underline">
                    {i.incident_type}
                  </Link>
                  <span className={`shrink-0 text-xs tabular-nums ${i.followup_due && i.followup_due < today() ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                    {i.followup_due ? `due ${fmtDate(i.followup_due)}` : fmtDate(i.occurred_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recently issued certificates" actions={<Link to="/certificates" className="text-xs text-brand-600 hover:underline">All certificates</Link>}>
          {isLoading ? (
            <Spinner />
          ) : !lists?.recent.length ? (
            <Empty icon={<Award className="h-6 w-6" />} title="No certificates yet" />
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {lists.recent.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link to={`/certificates/${c.id}`} className="block truncate text-sm font-medium text-brand-700 hover:underline">
                      {c.student_name}
                    </Link>
                    <div className="font-mono text-[11px] text-slate-500">{c.cert_number}</div>
                  </div>
                  <CertBadge status={certStatus(c)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
