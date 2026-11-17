import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Save, ShieldAlert, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { errMessage, must } from '../lib/errors';
import { displayName, useInstructors, useLookup } from '../lib/queries';
import { fmtDate, safeSearch, studentFullName } from '../lib/format';
import type { Incident, Student, TrainingSession } from '../lib/types';
import { Button, Card, Check, Combo, ErrorNote, Field, Input, PageHeader, Select, Spinner, Textarea, useToast } from '../components/ui';

type Draft = Omit<Incident, 'id' | 'created_at' | 'reported_by'>;

function localDateTime(d = new Date()) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export default function IncidentForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { facilities, scope, isAdmin } = useAuth();
  const types = useLookup('incident_type');
  const techniques = useLookup('technique');
  const bodyParts = useLookup('body_part');
  const locations = useLookup('location');
  const factors = useLookup('contributing_factor');
  const { data: instructors = [] } = useInstructors();

  const [f, setF] = useState<Draft>({
    facility_id: scope || facilities[0]?.id || '',
    session_id: params.get('session'),
    occurred_at: localDateTime(),
    location: '',
    involved_role: 'student',
    student_id: params.get('student'),
    involved_instructor_id: null,
    incident_type: '',
    technique: '',
    body_part: '',
    severity: 'minor',
    injury: false,
    first_aid: false,
    medical_referral: false,
    lost_time: false,
    description: '',
    contributing_factors: [],
    corrective_action: '',
    followup_owner: '',
    followup_due: null,
    followup_status: 'open',
  });
  const [studentQ, setStudentQ] = useState('');
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const i = must(await supabase.from('training_incidents').select('*').eq('id', id).single(), 'load incident') as Incident;
        const { id: _id, created_at: _c, reported_by: _r, ...rest } = i;
        setF({ ...rest, occurred_at: localDateTime(new Date(i.occurred_at)) });
      } catch (e) {
        setError(errMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // When opened from a class, inherit its facility and location.
  useEffect(() => {
    const sid = params.get('session');
    if (!sid || id) return;
    supabase
      .from('training_sessions')
      .select('facility_id, location')
      .eq('id', sid)
      .maybeSingle()
      .then(({ data }) => data && setF((x) => ({ ...x, facility_id: data.facility_id, location: x.location || data.location || '' })));
  }, [params, id]);

  const { data: sessions = [] } = useQuery({
    queryKey: ['incident-sessions', f.facility_id],
    enabled: !!f.facility_id,
    queryFn: async () =>
      must(await supabase.from('training_sessions').select('id, title, course_type, start_date').eq('facility_id', f.facility_id).order('start_date', { ascending: false }).limit(50), 'sessions') as Pick<
        TrainingSession,
        'id' | 'title' | 'course_type' | 'start_date'
      >[],
  });

  const { data: students = [] } = useQuery({
    queryKey: ['incident-students', f.facility_id, studentQ, f.student_id],
    enabled: !!f.facility_id && f.involved_role === 'student',
    queryFn: async () => {
      let q = supabase.from('students').select('id, first_name, middle_initial, last_name, employee_id').eq('facility_id', f.facility_id);
      const s = safeSearch(studentQ);
      if (s) q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,employee_id.ilike.%${s}%`);
      const list = must(await q.order('last_name').limit(30), 'students') as Pick<Student, 'id' | 'first_name' | 'middle_initial' | 'last_name' | 'employee_id'>[];
      if (f.student_id && !list.some((x) => x.id === f.student_id)) {
        const { data } = await supabase.from('students').select('id, first_name, middle_initial, last_name, employee_id').eq('id', f.student_id).maybeSingle();
        if (data) list.unshift(data);
      }
      return list;
    },
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.incident_type) return setError('Choose an incident type.');
    if (!f.description.trim()) return setError('Describe what happened.');
    setBusy(true);
    try {
      const payload = {
        ...f,
        occurred_at: new Date(f.occurred_at).toISOString(),
        location: f.location?.trim() || null,
        technique: f.technique || null,
        body_part: f.body_part || null,
        student_id: f.involved_role === 'student' ? f.student_id || null : null,
        involved_instructor_id: f.involved_role === 'instructor' ? f.involved_instructor_id || null : null,
        session_id: f.session_id || null,
        corrective_action: f.corrective_action?.trim() || null,
        followup_owner: f.followup_owner?.trim() || null,
        followup_due: f.followup_due || null,
        description: f.description.trim(),
      };
      if (id) must(await supabase.from('training_incidents').update(payload).eq('id', id), 'update incident');
      else must(await supabase.from('training_incidents').insert(payload), 'create incident');
      await qc.invalidateQueries();
      toast('success', id ? 'Incident updated' : 'Incident logged');
      nav('/incidents');
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id || !confirm('Delete this incident record permanently?')) return;
    try {
      must(await supabase.from('training_incidents').delete().eq('id', id), 'delete incident');
      await qc.invalidateQueries();
      nav('/incidents');
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  if (loading) return <Spinner />;

  return (
    <form onSubmit={submit}>
      <PageHeader
        icon={<ShieldAlert className="h-5 w-5" />}
        title={id ? 'Training incident' : 'Log a training incident'}
        actions={
          <>
            {id && isAdmin && (
              <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={remove}>
                Delete
              </Button>
            )}
            <Link to="/incidents">
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button type="submit" loading={busy} icon={<Save className="h-4 w-4" />}>
              Save
            </Button>
          </>
        }
      />
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        For accidents and near misses that happen <strong className="mx-1">during HWC training</strong> only. Do not enter patient names or protected health information.
      </div>
      <ErrorNote error={error} />
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card title="What happened">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Facility" required>
              <Select value={f.facility_id} onChange={(e) => set('facility_id', e.target.value)} options={facilities.map((x) => ({ value: x.id, label: x.name }))} required />
            </Field>
            <Field label="Date & time" required>
              <Input type="datetime-local" value={f.occurred_at} onChange={(e) => set('occurred_at', e.target.value)} required />
            </Field>
            <Field label="Class" className="sm:col-span-2">
              <Select
                value={f.session_id ?? ''}
                onChange={(e) => set('session_id', e.target.value || null)}
                options={sessions.map((s) => ({ value: s.id, label: `${fmtDate(s.start_date)} — ${s.title || s.course_type}` }))}
                placeholder="Not linked to a class"
              />
            </Field>
            <Field label="Location / room">
              <Combo id="incident-location" list={locations} value={f.location ?? ''} onChange={(e) => set('location', e.target.value)} maxLength={120} />
            </Field>
            <Field label="Incident type" required>
              <Select value={f.incident_type} onChange={(e) => set('incident_type', e.target.value)} options={types} placeholder="Choose…" required />
            </Field>
            <Field label="Technique being practiced">
              <Select value={f.technique ?? ''} onChange={(e) => set('technique', e.target.value)} options={techniques} placeholder="—" />
            </Field>
            <Field label="Body part">
              <Select value={f.body_part ?? ''} onChange={(e) => set('body_part', e.target.value)} options={bodyParts} placeholder="—" />
            </Field>
            <Field label="Description" required className="sm:col-span-2">
              <Textarea rows={5} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={4000} placeholder="Sequence of events, what was being practiced, equipment involved…" />
            </Field>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Who was involved">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Involved person">
                <Select
                  value={f.involved_role}
                  onChange={(e) => set('involved_role', e.target.value as Draft['involved_role'])}
                  options={[
                    { value: 'student', label: 'Student / trainee' },
                    { value: 'instructor', label: 'Instructor' },
                    { value: 'observer', label: 'Observer / other' },
                  ]}
                />
              </Field>
              {f.involved_role === 'student' && (
                <Field label="Student">
                  <Input placeholder="Search…" value={studentQ} onChange={(e) => setStudentQ(e.target.value)} className="mb-2" />
                  <Select value={f.student_id ?? ''} onChange={(e) => set('student_id', e.target.value || null)} options={students.map((s) => ({ value: s.id, label: studentFullName(s) + (s.employee_id ? ` (#${s.employee_id})` : '') }))} placeholder="—" />
                </Field>
              )}
              {f.involved_role === 'instructor' && (
                <Field label="Instructor">
                  <Select value={f.involved_instructor_id ?? ''} onChange={(e) => set('involved_instructor_id', e.target.value || null)} options={instructors.map((i) => ({ value: i.id, label: displayName(i) }))} placeholder="—" />
                </Field>
              )}
            </div>
          </Card>
          <Card title="Severity & outcome">
            <Field label="Severity">
              <Select
                value={f.severity}
                onChange={(e) => set('severity', e.target.value as Draft['severity'])}
                options={[
                  { value: 'none', label: 'None — near miss / no injury' },
                  { value: 'minor', label: 'Minor — no treatment beyond first aid' },
                  { value: 'moderate', label: 'Moderate — medical evaluation' },
                  { value: 'severe', label: 'Severe — significant injury or lost time' },
                ]}
              />
            </Field>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Check label="Injury occurred" checked={f.injury} onChange={(v) => set('injury', v)} />
              <Check label="First aid given" checked={f.first_aid} onChange={(v) => set('first_aid', v)} />
              <Check label="Medical referral" checked={f.medical_referral} onChange={(v) => set('medical_referral', v)} />
              <Check label="Lost work time" checked={f.lost_time} onChange={(v) => set('lost_time', v)} />
            </div>
            <div className="mt-5">
              <div className="label">Contributing factors</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {factors.map((x) => (
                  <Check key={x} label={x} checked={f.contributing_factors.includes(x)} onChange={(v) => set('contributing_factors', v ? [...f.contributing_factors, x] : f.contributing_factors.filter((y) => y !== x))} />
                ))}
              </div>
            </div>
          </Card>
          <Card title="Corrective action & follow-up">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Corrective action" className="sm:col-span-2">
                <Textarea value={f.corrective_action ?? ''} onChange={(e) => set('corrective_action', e.target.value)} maxLength={2000} placeholder="Coaching, curriculum change, equipment fix…" />
              </Field>
              <Field label="Follow-up owner">
                <Input value={f.followup_owner ?? ''} onChange={(e) => set('followup_owner', e.target.value)} maxLength={120} />
              </Field>
              <Field label="Due date">
                <Input type="date" value={f.followup_due ?? ''} onChange={(e) => set('followup_due', e.target.value || null)} />
              </Field>
              <Field label="Follow-up status">
                <Select
                  value={f.followup_status}
                  onChange={(e) => set('followup_status', e.target.value as Draft['followup_status'])}
                  options={[
                    { value: 'open', label: 'Open' },
                    { value: 'in_progress', label: 'In progress' },
                    { value: 'closed', label: 'Closed' },
                  ]}
                />
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
