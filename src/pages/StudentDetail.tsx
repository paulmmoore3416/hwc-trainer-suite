import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, CalendarDays, Pencil, Plus, ShieldAlert, Trash2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { errMessage, must } from '../lib/errors';
import { certStatus, fmtDate, fmtDateTime, studentFullName, titleCase } from '../lib/format';
import type { Certificate, Enrollment, Incident, Student, TrainingSession } from '../lib/types';
import { Badge, Button, Card, CertBadge, Empty, PageHeader, Spinner, useToast } from '../components/ui';

export default function StudentDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { facilities, isAdmin } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const [s, certs, enr, inc] = await Promise.all([
        supabase.from('students').select('*').eq('id', id).single(),
        supabase.from('certificates').select('*').eq('student_id', id).order('issue_date', { ascending: false }),
        supabase.from('enrollments').select('*, training_sessions(*)').eq('student_id', id),
        supabase.from('training_incidents').select('*').eq('student_id', id).order('occurred_at', { ascending: false }),
      ]);
      return {
        student: must(s, 'student') as Student,
        certs: must(certs, 'student certs') as Certificate[],
        enrollments: (must(enr, 'student enrollments') as (Enrollment & { training_sessions: TrainingSession })[]).sort((a, b) =>
          b.training_sessions.start_date.localeCompare(a.training_sessions.start_date),
        ),
        incidents: must(inc, 'student incidents') as Incident[],
      };
    },
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <Empty title="Student not found">{errMessage(error)}</Empty>;
  const { student: s, certs, enrollments, incidents } = data;
  const active = certs.find((c) => c.status === 'active');
  const facility = facilities.find((f) => f.id === s.facility_id)?.name ?? '—';

  async function remove() {
    if (!confirm(`Delete ${studentFullName(s)} and all of their certificates and class records? This cannot be undone.`)) return;
    try {
      must(await supabase.from('students').delete().eq('id', s.id), 'delete student');
      await qc.invalidateQueries();
      toast('success', 'Student deleted');
      nav('/students');
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  const info: [string, React.ReactNode][] = [
    ['Facility', facility],
    ['Employee ID', s.employee_id ?? '—'],
    ['Student type', s.student_type ?? '—'],
    ['Department', s.department ?? '—'],
    ['Job title', s.job_title ?? '—'],
    ['Hire date', fmtDate(s.hire_date)],
    ['Email', s.email ?? '—'],
    ['Phone', s.phone ?? '—'],
    ['Status', titleCase(s.status)],
    ['Added', fmtDateTime(s.created_at)],
  ];

  return (
    <>
      <PageHeader
        icon={<User className="h-5 w-5" />}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {studentFullName(s)}
            <CertBadge status={active ? certStatus(active) : 'none'} />
          </span>
        }
        subtitle={s.preferred_name ? `Goes by ${s.preferred_name}` : facility}
        actions={
          <>
            {isAdmin && (
              <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={remove}>
                Delete
              </Button>
            )}
            <Link to={`/students/${s.id}/edit`}>
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>
                Edit
              </Button>
            </Link>
            <Link to={`/certificates/new?student=${s.id}`}>
              <Button icon={<Award className="h-4 w-4" />}>Issue certificate</Button>
            </Link>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card title="Profile">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          {s.notes && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">{s.notes}</p>}
        </Card>
        <div className="space-y-6">
          <Card title={`Certificates (${certs.length})`}>
            {certs.length === 0 ? (
              <Empty icon={<Award className="h-6 w-6" />} title="No certificates yet">
                <Link to={`/certificates/new?student=${s.id}`} className="text-brand-600 hover:underline">
                  Issue the first certificate
                </Link>
              </Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {certs.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <Link to={`/certificates/${c.id}`} className="font-medium text-brand-700 hover:underline">
                        {c.cert_number}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {[c.program_verbal && 'Verbal', c.program_physical && 'Physical'].filter(Boolean).join(' + ')} · Trained {fmtDate(c.issue_date)} · Valid through {fmtDate(c.expiration_date)}
                      </div>
                    </div>
                    <CertBadge status={certStatus(c)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={`Training history (${enrollments.length})`}>
            {enrollments.length === 0 ? (
              <Empty icon={<CalendarDays className="h-6 w-6" />} title="Not enrolled in any classes yet" />
            ) : (
              <div className="-mx-5 -my-5 overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th">Class</th>
                      <th className="th">Date</th>
                      <th className="th">Attendance</th>
                      <th className="th">Score</th>
                      <th className="th">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enrollments.map((e) => (
                      <tr key={e.id}>
                        <td className="td">
                          <Link to={`/classes/${e.session_id}`} className="font-medium text-brand-700 hover:underline">
                            {e.training_sessions.title || e.training_sessions.course_type}
                          </Link>
                          {e.attempt > 1 && <span className="ml-2 text-xs text-slate-500">Attempt {e.attempt}</span>}
                        </td>
                        <td className="td">{fmtDate(e.training_sessions.start_date)}</td>
                        <td className="td">{titleCase(e.attendance)}</td>
                        <td className="td tabular-nums">{e.written_score ?? '—'}</td>
                        <td className="td">
                          <Badge tone={e.result === 'pass' ? 'green' : e.result === 'fail' ? 'red' : 'gray'}>{titleCase(e.result)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card
            title={`Training incidents (${incidents.length})`}
            actions={
              <Link to={`/incidents/new?student=${s.id}`}>
                <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />}>
                  Log incident
                </Button>
              </Link>
            }
          >
            {incidents.length === 0 ? (
              <Empty icon={<ShieldAlert className="h-6 w-6" />} title="No training incidents" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {incidents.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2.5">
                    <Link to={`/incidents/${i.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                      {i.incident_type} {i.technique ? `· ${i.technique}` : ''}
                    </Link>
                    <span className="text-xs text-slate-500">{fmtDateTime(i.occurred_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
