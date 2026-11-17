import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  MapPin,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, useScopeIds } from '../lib/auth';
import { must } from '../lib/errors';
import { addDays, addMonths, daysUntil, fmtDate, fmtNum, fmtPct, monthLabel, pct, studentFullName, today } from '../lib/format';
import { Bars, ChartCard, Meter, SERIES, STATUS, TrendLines } from '../components/charts';
import { Button, Card, CertBadge, Empty, Input, PageHeader, Select, Spinner, Stat, Tabs } from '../components/ui';

type Num = number;
interface NameValue {
  name: string;
  value: Num;
}
interface Metrics {
  range: { from: string; to: string };
  generated_at: string;
  kpis: Record<string, Num | string | null>;
  by_month: { month: string; sessions: Num; trainees: Num; hours: Num; passed: Num; failed: Num; certs: Num; incidents: Num; injuries: Num }[];
  by_course: { name: string; sessions: Num; trainees: Num; passed: Num; failed: Num; avg_score: Num | null; hours: Num }[];
  students_by_type: { name: string; students: Num; current: Num; expiring: Num; expired: Num; never: Num }[];
  outcomes_by_type: { name: string; trainees: Num; passed: Num; failed: Num; avg_score: Num | null }[];
  by_department: { name: string; students: Num; current: Num; expiring: Num; expired: Num; never: Num }[];
  by_facility: { name: string; students: Num; current: Num; expired: Num; never: Num; sessions: Num; trainees: Num; incidents: Num }[];
  by_location: { facility: string; name: string; sessions: Num; trainees: Num; incidents: Num }[];
  by_weekday: { dow: Num; sessions: Num; trainees: Num }[];
  by_instructor: { name: string; cert_expires: string | null; sessions: Num; hours: Num; trainees: Num; passed: Num; failed: Num; incidents: Num }[];
  expiration_forecast: { month: string; expiring: Num }[];
  certs_by_program: { both: Num; verbal_only: Num; physical_only: Num };
  student_status: NameValue[];
  incidents_by_type: (NameValue & { injuries: Num })[];
  incidents_by_severity: NameValue[];
  incidents_by_technique: NameValue[];
  incidents_by_body_part: NameValue[];
  incidents_by_role: NameValue[];
  incidents_by_factor: NameValue[];
  incidents_followup: NameValue[];
}

type TabId = 'overview' | 'training' | 'compliance' | 'outcomes' | 'instructors' | 'locations' | 'types' | 'incidents';
const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'training', label: 'Training Activity', icon: <CalendarDays className="h-4 w-4" /> },
  { id: 'compliance', label: 'Compliance & Expirations', icon: <ShieldCheck className="h-4 w-4" /> },
  { id: 'outcomes', label: 'Outcomes', icon: <Target className="h-4 w-4" /> },
  { id: 'instructors', label: 'Instructors', icon: <UserCheck className="h-4 w-4" /> },
  { id: 'locations', label: 'Locations', icon: <MapPin className="h-4 w-4" /> },
  { id: 'types', label: 'Student Types', icon: <Users className="h-4 w-4" /> },
  { id: 'incidents', label: 'Training Incidents', icon: <ShieldAlert className="h-4 w-4" /> },
];

const PRESETS = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12m', label: 'Last 12 months' },
  { value: '24m', label: 'Last 24 months' },
  { value: 'custom', label: 'Custom range' },
];

const DOW = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COMPLIANCE_SERIES = [
  { key: 'current', label: 'Current', color: STATUS.good },
  { key: 'expiring', label: 'Expiring ≤60d', color: STATUS.warning },
  { key: 'expired', label: 'Expired', color: STATUS.critical },
  { key: 'never', label: 'Not certified', color: STATUS.neutral },
];

function presetRange(p: string): { from: string; to: string } {
  const t = today();
  if (p === '30') return { from: addDays(t, -30), to: t };
  if (p === '90') return { from: addDays(t, -90), to: t };
  if (p === 'ytd') return { from: `${t.slice(0, 4)}-01-01`, to: t };
  if (p === '24m') return { from: addMonths(t, -24), to: t };
  return { from: addMonths(t, -12), to: t };
}

export default function Reports() {
  const { scope, facilities } = useAuth();
  const ids = useScopeIds();
  const [tab, setTab] = useState<TabId>('overview');
  const [preset, setPreset] = useState('12m');
  const [custom, setCustom] = useState(presetRange('12m'));
  const range = preset === 'custom' ? custom : presetRange(preset);

  const { data: m, isLoading } = useQuery({
    queryKey: ['metrics', range.from, range.to, scope],
    queryFn: async () => must(await supabase.rpc('report_metrics', { p_from: range.from, p_to: range.to, p_facility: scope || null }), 'report_metrics') as Metrics,
  });

  const scopeLabel = scope ? facilities.find((f) => f.id === scope)?.name : facilities.length === 1 ? facilities[0].name : 'All facilities';

  return (
    <>
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Reports & Metrics"
        subtitle={`${scopeLabel} · ${fmtDate(range.from)} – ${fmtDate(range.to)}${m ? ` · generated ${new Date(m.generated_at).toLocaleTimeString()}` : ''}`}
        actions={
          <>
            <Select className="w-44" value={preset} onChange={(e) => setPreset(e.target.value)} options={PRESETS} />
            {preset === 'custom' && (
              <>
                <Input type="date" className="w-40" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
                <Input type="date" className="w-40" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </>
            )}
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {isLoading || !m ? (
        <Spinner label="Crunching the numbers…" />
      ) : (
        <div className="space-y-6">
          {tab === 'overview' && <Overview m={m} />}
          {tab === 'training' && <Training m={m} />}
          {tab === 'compliance' && <Compliance m={m} ids={ids} />}
          {tab === 'outcomes' && <Outcomes m={m} />}
          {tab === 'instructors' && <Instructors m={m} />}
          {tab === 'locations' && <Locations m={m} />}
          {tab === 'types' && <StudentTypes m={m} />}
          {tab === 'incidents' && <IncidentsTab m={m} />}
        </div>
      )}
    </>
  );
}

function k(m: Metrics, key: string): number {
  return Number(m.kpis[key] ?? 0);
}

function derived(m: Metrics) {
  const active = k(m, 'active_students');
  const graded = k(m, 'passed') + k(m, 'failed');
  return {
    compliance: pct(k(m, 'certified_current'), active),
    passRate: pct(k(m, 'passed'), graded),
    firstPass: pct(k(m, 'first_attempt_passed'), k(m, 'first_attempt_graded')),
    incidentRate: k(m, 'trainees') ? Math.round((k(m, 'incidents') / k(m, 'trainees')) * 1000) / 10 : null,
    injuryRate: k(m, 'trainees') ? Math.round((k(m, 'injuries') / k(m, 'trainees')) * 1000) / 10 : null,
    attendance: pct(k(m, 'trainees'), k(m, 'trainees') + k(m, 'no_shows')),
    daysSince: m.kpis.last_incident_at ? Math.max(0, -(daysUntil(String(m.kpis.last_incident_at).slice(0, 10)) ?? 0)) : null,
  };
}

const monthRows = (m: Metrics) => m.by_month.map((r) => ({ ...r, label: r.month }));

function Overview({ m }: { m: Metrics }) {
  const d = derived(m);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Users className="h-5 w-5" />} label="Active students" value={fmtNum(k(m, 'active_students'))} sub={`${fmtNum(k(m, 'total_students'))} on record`} />
        <Stat icon={<ShieldCheck className="h-5 w-5" />} tone="green" label="Compliance (current certification)" value={fmtPct(d.compliance)} sub={`${fmtNum(k(m, 'certified_current'))} of ${fmtNum(k(m, 'active_students'))} active`} />
        <Stat icon={<AlertTriangle className="h-5 w-5" />} tone="gold" label="Expiring in 60 days" value={fmtNum(k(m, 'expiring_60'))} sub={`${fmtNum(k(m, 'expiring_30'))} within 30 days`} />
        <Stat icon={<Clock className="h-5 w-5" />} tone="red" label="Expired / never certified" value={`${fmtNum(k(m, 'expired'))} / ${fmtNum(k(m, 'never_certified'))}`} sub="Active staff needing training" />
        <Stat icon={<CalendarDays className="h-5 w-5" />} tone="teal" label="Classes held" value={fmtNum(k(m, 'sessions'))} sub={`${fmtNum(k(m, 'sessions_scheduled'))} upcoming scheduled`} />
        <Stat icon={<GraduationCap className="h-5 w-5" />} tone="teal" label="Trainees" value={fmtNum(k(m, 'trainees'))} sub={`${fmtNum(k(m, 'unique_trainees'))} unique · ${fmtPct(d.attendance)} attendance`} />
        <Stat icon={<Activity className="h-5 w-5" />} tone="slate" label="Training hours delivered" value={fmtNum(k(m, 'hours_delivered'))} sub={`${fmtNum(k(m, 'person_hours'))} person-hours`} />
        <Stat icon={<Award className="h-5 w-5" />} tone="gold" label="Certificates issued" value={fmtNum(k(m, 'certs_issued'))} sub={`${fmtNum(k(m, 'certs_revoked'))} revoked`} />
        <Stat icon={<CheckCircle2 className="h-5 w-5" />} tone="green" label="Pass rate" value={fmtPct(d.passRate)} sub={`First attempt ${fmtPct(d.firstPass)}`} />
        <Stat icon={<BookOpenCheck className="h-5 w-5" />} tone="brand" label="Avg written score" value={m.kpis.avg_written_score == null ? '—' : `${m.kpis.avg_written_score}%`} sub={`${fmtNum(k(m, 'remediations'))} remediations`} />
        <Stat icon={<ShieldAlert className="h-5 w-5" />} tone="red" label="Incidents per 100 trainees" value={d.incidentRate == null ? '—' : d.incidentRate} sub={`${fmtNum(k(m, 'incidents'))} incidents · ${fmtNum(k(m, 'injuries'))} injuries`} />
        <Stat icon={<UserCheck className="h-5 w-5" />} tone="brand" label="Active instructors" value={fmtNum(k(m, 'active_instructors'))} sub={`${fmtNum(k(m, 'instructors_expiring_90'))} instructor certs expire ≤90d`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Training volume by month"
          subtitle="Trainees attending vs certificates issued"
          rows={monthRows(m)}
          columns={[
            { key: 'month', label: 'Month' },
            { key: 'trainees', label: 'Trainees' },
            { key: 'certs', label: 'Certificates' },
            { key: 'incidents', label: 'Incidents' },
          ]}
          filename="hwc-training-by-month"
        >
          <TrendLines
            data={m.by_month}
            x="month"
            xFormatter={monthLabel}
            series={[
              { key: 'trainees', label: 'Trainees' },
              { key: 'certs', label: 'Certificates' },
            ]}
          />
        </ChartCard>
        <Card title="Health check">
          <div className="space-y-4">
            <Meter label="Staff with current certification" value={d.compliance} tone={(d.compliance ?? 0) >= 90 ? 'good' : (d.compliance ?? 0) >= 75 ? 'warning' : 'critical'} />
            <Meter label="Pass rate" value={d.passRate} tone={(d.passRate ?? 0) >= 85 ? 'good' : (d.passRate ?? 0) >= 70 ? 'warning' : 'critical'} />
            <Meter label="First-attempt pass rate" value={d.firstPass} tone={(d.firstPass ?? 0) >= 80 ? 'good' : (d.firstPass ?? 0) >= 65 ? 'warning' : 'critical'} />
            <Meter label="Attendance" value={d.attendance} tone={(d.attendance ?? 0) >= 90 ? 'good' : (d.attendance ?? 0) >= 75 ? 'warning' : 'critical'} />
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-center">
              <div>
                <div className="text-2xl font-bold tabular-nums text-slate-900">{d.daysSince ?? '—'}</div>
                <div className="text-xs text-slate-500">days since last incident</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums text-slate-900">{fmtNum(k(m, 'open_followups'))}</div>
                <div className="text-xs text-slate-500">
                  open follow-ups{k(m, 'overdue_followups') ? ` (${k(m, 'overdue_followups')} overdue)` : ''}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
      <ChartCard
        title="Certification status by facility"
        rows={m.by_facility.map((f) => ({ ...f, expiring: 0 }))}
        columns={[
          { key: 'name', label: 'Facility' },
          { key: 'students', label: 'Active students' },
          { key: 'current', label: 'Current' },
          { key: 'expired', label: 'Expired' },
          { key: 'never', label: 'Not certified' },
          { key: 'sessions', label: 'Classes' },
          { key: 'trainees', label: 'Trainees' },
          { key: 'incidents', label: 'Incidents' },
        ]}
        filename="hwc-facility-compliance"
        height={Math.max(160, m.by_facility.length * 48)}
      >
        <Bars data={m.by_facility} x="name" horizontal stacked series={COMPLIANCE_SERIES.filter((s) => s.key !== 'expiring')} />
      </ChartCard>
    </>
  );
}

function Training({ m }: { m: Metrics }) {
  const weekday = m.by_weekday.map((w) => ({ ...w, day: DOW[w.dow] }));
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Classes by month"
          rows={m.by_month}
          columns={[
            { key: 'month', label: 'Month' },
            { key: 'sessions', label: 'Classes' },
          ]}
          filename="hwc-classes-by-month"
        >
          <Bars data={m.by_month} x="month" xFormatter={monthLabel} series={[{ key: 'sessions', label: 'Classes' }]} />
        </ChartCard>
        <ChartCard
          title="Training hours by month"
          rows={m.by_month}
          columns={[
            { key: 'month', label: 'Month' },
            { key: 'hours', label: 'Hours' },
          ]}
          filename="hwc-hours-by-month"
        >
          <Bars data={m.by_month} x="month" xFormatter={monthLabel} series={[{ key: 'hours', label: 'Hours', color: SERIES[2] }]} />
        </ChartCard>
        <ChartCard
          title="Trainees by month"
          subtitle="Passed vs not passed"
          rows={m.by_month}
          columns={[
            { key: 'month', label: 'Month' },
            { key: 'trainees', label: 'Trainees' },
            { key: 'passed', label: 'Passed' },
            { key: 'failed', label: 'Not passed' },
          ]}
          filename="hwc-trainees-by-month"
        >
          <Bars
            data={m.by_month}
            x="month"
            stacked
            xFormatter={monthLabel}
            series={[
              { key: 'passed', label: 'Passed' },
              { key: 'failed', label: 'Not passed' },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Classes by day of week"
          rows={weekday}
          columns={[
            { key: 'day', label: 'Day' },
            { key: 'sessions', label: 'Classes' },
            { key: 'trainees', label: 'Trainees' },
          ]}
          filename="hwc-weekday"
        >
          <Bars data={weekday} x="day" series={[{ key: 'sessions', label: 'Classes', color: SERIES[6] }]} />
        </ChartCard>
      </div>
      <Card title="By course type">
        <ReportTable
          rows={m.by_course}
          cols={[
            ['name', 'Course'],
            ['sessions', 'Classes'],
            ['trainees', 'Trainees'],
            ['hours', 'Hours'],
            ['passed', 'Passed'],
            ['failed', 'Not passed'],
            ['avg_score', 'Avg score'],
          ]}
          extra={(r) => fmtPct(pct(Number(r.passed), Number(r.passed) + Number(r.failed)))}
          extraLabel="Pass rate"
        />
      </Card>
    </>
  );
}

interface ExpRow {
  student_id: string;
  first_name: string;
  middle_initial: string | null;
  last_name: string;
  department: string | null;
  student_type: string | null;
  expiration_date: string | null;
  cert_status: 'current' | 'expiring' | 'expired' | 'none';
}

function Compliance({ m, ids }: { m: Metrics; ids: string[] }) {
  const { data: lists, isLoading } = useQuery({
    queryKey: ['compliance-lists', ids],
    queryFn: async () => {
      const base = () =>
        supabase
          .from('student_roster')
          .select('student_id, first_name, middle_initial, last_name, department, student_type, expiration_date, cert_status')
          .in('facility_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
          .eq('student_status', 'active');
      const [soon, expired, never] = await Promise.all([
        base().gte('expiration_date', today()).lte('expiration_date', addDays(today(), 90)).order('expiration_date').limit(200),
        base().eq('cert_status', 'expired').order('expiration_date').limit(200),
        base().eq('cert_status', 'none').order('last_name').limit(200),
      ]);
      return { soon: must(soon, 'expiring') as ExpRow[], expired: must(expired, 'expired') as ExpRow[], never: must(never, 'never') as ExpRow[] };
    },
  });
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Expiration forecast — next 12 months"
          subtitle="Active staff whose latest certification expires each month"
          rows={m.expiration_forecast}
          columns={[
            { key: 'month', label: 'Month' },
            { key: 'expiring', label: 'Expiring' },
          ]}
          filename="hwc-expiration-forecast"
        >
          <Bars data={m.expiration_forecast} x="month" xFormatter={monthLabel} series={[{ key: 'expiring', label: 'Certifications expiring', color: SERIES[3] }]} />
        </ChartCard>
        <ChartCard
          title="Certification status by department"
          rows={m.by_department}
          columns={[
            { key: 'name', label: 'Department' },
            { key: 'current', label: 'Current' },
            { key: 'expiring', label: 'Expiring' },
            { key: 'expired', label: 'Expired' },
            { key: 'never', label: 'Not certified' },
          ]}
          filename="hwc-department-compliance"
          height={Math.max(220, m.by_department.length * 34)}
        >
          <Bars data={m.by_department} x="name" horizontal stacked series={COMPLIANCE_SERIES} />
        </ChartCard>
      </div>
      {isLoading || !lists ? (
        <Spinner />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <PeopleList title="Expiring in the next 90 days" rows={lists.soon} />
          <PeopleList title="Expired — retraining needed" rows={lists.expired} />
          <PeopleList title="Active staff never certified" rows={lists.never} />
        </div>
      )}
    </>
  );
}

function PeopleList({ title, rows }: { title: string; rows: ExpRow[] }) {
  return (
    <Card title={`${title} (${rows.length}${rows.length === 200 ? '+' : ''})`}>
      {rows.length === 0 ? (
        <Empty title="Nobody — nice work" />
      ) : (
        <ul className="-my-2 max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.student_id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <Link to={`/students/${r.student_id}`} className="block truncate text-sm font-medium text-brand-700 hover:underline">
                  {studentFullName(r)}
                </Link>
                <div className="truncate text-xs text-slate-500">{[r.department, r.student_type].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <div className="shrink-0 text-right">
                <CertBadge status={r.cert_status} />
                {r.expiration_date && <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">{fmtDate(r.expiration_date)}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Outcomes({ m }: { m: Metrics }) {
  const d = derived(m);
  const prog = [
    { name: 'Verbal + Physical', value: m.certs_by_program.both },
    { name: 'Verbal only', value: m.certs_by_program.verbal_only },
    { name: 'Physical only', value: m.certs_by_program.physical_only },
  ];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<CheckCircle2 className="h-5 w-5" />} tone="green" label="Pass rate" value={fmtPct(d.passRate)} sub={`${fmtNum(k(m, 'passed'))} passed · ${fmtNum(k(m, 'failed'))} not passed`} />
        <Stat icon={<Target className="h-5 w-5" />} tone="teal" label="First-attempt pass rate" value={fmtPct(d.firstPass)} />
        <Stat icon={<BookOpenCheck className="h-5 w-5" />} tone="brand" label="Average written score" value={m.kpis.avg_written_score == null ? '—' : `${m.kpis.avg_written_score}%`} />
        <Stat icon={<Activity className="h-5 w-5" />} tone="gold" label="Remediations / retakes" value={fmtNum(k(m, 'remediations'))} sub={`${fmtNum(k(m, 'incomplete'))} incomplete`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Results by course type"
          rows={m.by_course}
          columns={[
            { key: 'name', label: 'Course' },
            { key: 'passed', label: 'Passed' },
            { key: 'failed', label: 'Not passed' },
          ]}
          filename="hwc-results-by-course"
          height={Math.max(200, m.by_course.length * 44)}
        >
          <Bars
            data={m.by_course}
            x="name"
            horizontal
            stacked
            series={[
              { key: 'passed', label: 'Passed' },
              { key: 'failed', label: 'Not passed' },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Results by student type"
          rows={m.outcomes_by_type}
          columns={[
            { key: 'name', label: 'Student type' },
            { key: 'passed', label: 'Passed' },
            { key: 'failed', label: 'Not passed' },
            { key: 'avg_score', label: 'Avg score' },
          ]}
          filename="hwc-results-by-type"
          height={Math.max(200, m.outcomes_by_type.length * 36)}
        >
          <Bars
            data={m.outcomes_by_type}
            x="name"
            horizontal
            stacked
            series={[
              { key: 'passed', label: 'Passed' },
              { key: 'failed', label: 'Not passed' },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Certificates issued by program"
          rows={prog}
          columns={[
            { key: 'name', label: 'Program' },
            { key: 'value', label: 'Certificates' },
          ]}
          filename="hwc-certs-by-program"
          height={180}
        >
          <Bars data={prog} x="name" horizontal series={[{ key: 'value', label: 'Certificates', color: SERIES[0] }]} />
        </ChartCard>
        <ChartCard
          title="Average written score by course"
          rows={m.by_course}
          columns={[
            { key: 'name', label: 'Course' },
            { key: 'avg_score', label: 'Avg score' },
          ]}
          filename="hwc-score-by-course"
          height={Math.max(180, m.by_course.length * 40)}
        >
          <Bars data={m.by_course} x="name" horizontal series={[{ key: 'avg_score', label: 'Avg score', color: SERIES[6] }]} />
        </ChartCard>
      </div>
    </>
  );
}

function Instructors({ m }: { m: Metrics }) {
  return (
    <>
      <ChartCard
        title="Trainees taught by lead instructor"
        rows={m.by_instructor}
        columns={[
          { key: 'name', label: 'Instructor' },
          { key: 'sessions', label: 'Classes' },
          { key: 'trainees', label: 'Trainees' },
          { key: 'hours', label: 'Hours' },
          { key: 'passed', label: 'Passed' },
          { key: 'failed', label: 'Not passed' },
          { key: 'incidents', label: 'Incidents' },
        ]}
        filename="hwc-instructors"
        height={Math.max(200, m.by_instructor.length * 40)}
      >
        <Bars data={m.by_instructor} x="name" horizontal series={[{ key: 'trainees', label: 'Trainees' }]} />
      </ChartCard>
      <Card title="Instructor scorecard">
        <ReportTable
          rows={m.by_instructor}
          cols={[
            ['name', 'Instructor'],
            ['sessions', 'Classes'],
            ['trainees', 'Trainees'],
            ['hours', 'Hours'],
            ['passed', 'Passed'],
            ['failed', 'Not passed'],
            ['incidents', 'Incidents'],
          ]}
          extra={(r) => (
            <span className="whitespace-nowrap">
              {fmtPct(pct(Number(r.passed), Number(r.passed) + Number(r.failed)))}
              <span className="ml-3 text-slate-500">{r.cert_expires ? `cert exp. ${fmtDate(String(r.cert_expires))}` : 'cert date not set'}</span>
            </span>
          )}
          extraLabel="Pass rate · HWC cert"
        />
      </Card>
    </>
  );
}

function Locations({ m }: { m: Metrics }) {
  const rows = m.by_location.map((l) => ({ ...l, label: m.by_facility.length > 1 ? `${l.name} (${l.facility})` : l.name }));
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Classes by location"
          rows={rows}
          columns={[
            { key: 'label', label: 'Location' },
            { key: 'sessions', label: 'Classes' },
            { key: 'trainees', label: 'Trainees' },
            { key: 'incidents', label: 'Incidents' },
          ]}
          filename="hwc-locations"
          height={Math.max(200, rows.length * 40)}
        >
          <Bars data={rows} x="label" horizontal series={[{ key: 'sessions', label: 'Classes', color: SERIES[2] }]} />
        </ChartCard>
        <ChartCard
          title="Training incidents by location"
          rows={rows}
          columns={[
            { key: 'label', label: 'Location' },
            { key: 'incidents', label: 'Incidents' },
          ]}
          filename="hwc-incidents-by-location"
          height={Math.max(200, rows.length * 40)}
        >
          <Bars data={rows} x="label" horizontal series={[{ key: 'incidents', label: 'Incidents', color: SERIES[1] }]} />
        </ChartCard>
      </div>
      <Card title="Facility summary">
        <ReportTable
          rows={m.by_facility}
          cols={[
            ['name', 'Facility'],
            ['students', 'Active students'],
            ['current', 'Current'],
            ['expired', 'Expired'],
            ['never', 'Not certified'],
            ['sessions', 'Classes'],
            ['trainees', 'Trainees'],
            ['incidents', 'Incidents'],
          ]}
          extra={(r) => fmtPct(pct(Number(r.current), Number(r.students)))}
          extraLabel="Compliance"
        />
      </Card>
    </>
  );
}

function StudentTypes({ m }: { m: Metrics }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard
        className="lg:col-span-2"
        title="Certification status by student type"
        rows={m.students_by_type}
        columns={[
          { key: 'name', label: 'Student type' },
          { key: 'students', label: 'Active students' },
          { key: 'current', label: 'Current' },
          { key: 'expiring', label: 'Expiring' },
          { key: 'expired', label: 'Expired' },
          { key: 'never', label: 'Not certified' },
        ]}
        filename="hwc-student-types"
        height={Math.max(220, m.students_by_type.length * 36)}
      >
        <Bars data={m.students_by_type} x="name" horizontal stacked series={COMPLIANCE_SERIES} />
      </ChartCard>
      <ChartCard
        title="Active students by department"
        rows={m.by_department}
        columns={[
          { key: 'name', label: 'Department' },
          { key: 'students', label: 'Students' },
        ]}
        filename="hwc-departments"
        height={Math.max(200, m.by_department.length * 34)}
      >
        <Bars data={m.by_department} x="name" horizontal series={[{ key: 'students', label: 'Students' }]} />
      </ChartCard>
      <ChartCard
        title="Student records by status"
        rows={m.student_status}
        columns={[
          { key: 'name', label: 'Status' },
          { key: 'value', label: 'Students' },
        ]}
        filename="hwc-student-status"
        height={200}
      >
        <Bars data={m.student_status} x="name" horizontal series={[{ key: 'value', label: 'Students', color: SERIES[6] }]} />
      </ChartCard>
    </div>
  );
}

function IncidentsTab({ m }: { m: Metrics }) {
  const d = derived(m);
  const nv = (title: string, rows: NameValue[], file: string, color = SERIES[1]) => (
    <ChartCard
      title={title}
      rows={rows}
      columns={[
        { key: 'name', label: 'Category' },
        { key: 'value', label: 'Incidents' },
      ]}
      filename={file}
      height={Math.max(180, rows.length * 34)}
    >
      <Bars data={rows} x="name" horizontal series={[{ key: 'value', label: 'Incidents', color }]} />
    </ChartCard>
  );
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<ShieldAlert className="h-5 w-5" />} tone="red" label="Incidents" value={fmtNum(k(m, 'incidents'))} sub={`${d.incidentRate ?? '—'} per 100 trainees`} />
        <Stat icon={<AlertTriangle className="h-5 w-5" />} tone="gold" label="Injuries" value={fmtNum(k(m, 'injuries'))} sub={`${d.injuryRate ?? '—'} per 100 trainees`} />
        <Stat icon={<Building2 className="h-5 w-5" />} tone="slate" label="Medical referrals / lost time" value={`${fmtNum(k(m, 'medical_referrals'))} / ${fmtNum(k(m, 'lost_time'))}`} sub={`${fmtNum(k(m, 'serious_incidents'))} moderate or severe`} />
        <Stat icon={<Clock className="h-5 w-5" />} tone="green" label="Days since last incident" value={d.daysSince ?? '—'} sub={`${fmtNum(k(m, 'open_followups'))} open · ${fmtNum(k(m, 'overdue_followups'))} overdue follow-ups`} />
      </div>
      <ChartCard
        title="Incidents and injuries by month"
        rows={m.by_month}
        columns={[
          { key: 'month', label: 'Month' },
          { key: 'incidents', label: 'Incidents' },
          { key: 'injuries', label: 'Injuries' },
        ]}
        filename="hwc-incidents-by-month"
      >
        <TrendLines
          data={m.by_month}
          x="month"
          xFormatter={monthLabel}
          series={[
            { key: 'incidents', label: 'Incidents', color: SERIES[1] },
            { key: 'injuries', label: 'Injuries', color: SERIES[7] },
          ]}
        />
      </ChartCard>
      <div className="grid gap-6 lg:grid-cols-2">
        {nv('By incident type', m.incidents_by_type, 'hwc-incidents-by-type')}
        {nv('By technique being practiced', m.incidents_by_technique, 'hwc-incidents-by-technique', SERIES[0])}
        {nv('By body part', m.incidents_by_body_part, 'hwc-incidents-by-body-part', SERIES[6])}
        {nv('Contributing factors', m.incidents_by_factor, 'hwc-incidents-by-factor', SERIES[2])}
        {nv('By severity', ['none', 'minor', 'moderate', 'severe'].map((s) => ({ name: s, value: m.incidents_by_severity.find((x) => x.name === s)?.value ?? 0 })), 'hwc-incidents-by-severity', SERIES[3])}
        {nv('By involved person', m.incidents_by_role, 'hwc-incidents-by-role', SERIES[4])}
      </div>
    </>
  );
}

function ReportTable<T extends object>({ rows, cols, extra, extraLabel }: { rows: T[]; cols: [string, string][]; extra?: (r: Record<string, unknown>) => ReactNode; extraLabel?: string }) {
  const sorted = useMemo(() => rows, [rows]);
  if (!rows.length) return <Empty title="No data for this period yet" />;
  return (
    <div className="-mx-5 -my-5 overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead className="bg-slate-50">
          <tr>
            {cols.map(([key, label], i) => (
              <th key={key} className={`th ${i > 0 ? 'text-right' : ''}`}>
                {label}
              </th>
            ))}
            {extra && <th className="th text-right">{extraLabel}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((r, idx) => {
            const rec = r as Record<string, unknown>;
            return (
              <tr key={idx}>
                {cols.map(([key], i) => (
                  <td key={key} className={`td ${i > 0 ? 'text-right tabular-nums' : 'font-medium text-slate-900'}`}>
                    {i === 0 ? String(rec[key] ?? '—') : fmtNum(rec[key] as number)}
                  </td>
                ))}
                {extra && <td className="td text-right tabular-nums">{extra(rec)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
