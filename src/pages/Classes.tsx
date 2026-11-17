import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, useScopeIds } from '../lib/auth';
import { errMessage, must } from '../lib/errors';
import { displayName, useInstructors, useLookup } from '../lib/queries';
import { fmtDate, titleCase, today } from '../lib/format';
import { PAGE_SIZE } from '../lib/config';
import type { TrainingSession } from '../lib/types';
import { Badge, Button, Card, Check, Combo, Empty, ErrorNote, Field, Input, Modal, PageHeader, Pager, Select, Spinner, Textarea, useToast } from '../components/ui';

export const SESSION_STATUS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function statusTone(s: string) {
  return s === 'completed' ? 'green' : s === 'cancelled' ? 'gray' : s === 'in_progress' ? 'amber' : 'blue';
}

type SessionDraft = Omit<TrainingSession, 'id' | 'created_at'>;

export function SessionFormModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: TrainingSession | null }) {
  const { facilities, scope, profile } = useAuth();
  const courseTypes = useLookup('course_type');
  const locations = useLookup('location');
  const { data: instructors = [] } = useInstructors();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const blank = (): SessionDraft => ({
    facility_id: scope || facilities[0]?.id || '',
    title: '',
    course_type: '',
    program_verbal: true,
    program_physical: true,
    location: '',
    start_date: today(),
    end_date: null,
    hours: 8,
    capacity: null,
    lead_instructor_id: profile?.id ?? null,
    co_instructor_ids: [],
    status: 'scheduled',
    notes: '',
  });
  const [f, setF] = useState<SessionDraft>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (initial) {
        const { id: _id, created_at: _c, ...rest } = initial;
        setF(rest);
      } else setF(blank());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = <K extends keyof SessionDraft>(k: K, v: SessionDraft[K]) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.course_type) return setError('Choose a course type.');
    if (!f.program_verbal && !f.program_physical) return setError('Select at least one program.');
    setBusy(true);
    try {
      const payload = {
        ...f,
        title: f.title?.trim() || null,
        location: f.location?.trim() || null,
        notes: f.notes?.trim() || null,
        end_date: f.end_date || null,
        hours: f.hours === null || (f.hours as unknown) === '' ? null : Number(f.hours),
        capacity: f.capacity === null || (f.capacity as unknown) === '' ? null : Number(f.capacity),
      };
      if (initial) {
        must(await supabase.from('training_sessions').update(payload).eq('id', initial.id), 'update class');
        toast('success', 'Class updated');
      } else {
        const row = must(await supabase.from('training_sessions').insert(payload).select('id').single(), 'create class') as { id: string };
        toast('success', 'Class created — add students to the roster');
        nav(`/classes/${row.id}`);
      }
      await qc.invalidateQueries();
      onClose();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const instructorOpts = instructors.filter((i) => i.active).map((i) => ({ value: i.id, label: displayName(i) }));

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit class' : 'Schedule a class'} wide>
      <form onSubmit={submit} className="space-y-4">
        <ErrorNote error={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Facility" required>
            <Select value={f.facility_id} onChange={(e) => set('facility_id', e.target.value)} options={facilities.map((x) => ({ value: x.id, label: x.name }))} required />
          </Field>
          <Field label="Course type" required>
            <Select value={f.course_type} onChange={(e) => set('course_type', e.target.value)} options={courseTypes} placeholder="Choose…" required />
          </Field>
          <Field label="Class title" hint="Optional, e.g. “November New Hire Cohort”">
            <Input value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} maxLength={120} />
          </Field>
          <Field label="Location / room">
            <Combo id="session-location" list={locations} value={f.location ?? ''} onChange={(e) => set('location', e.target.value)} maxLength={120} />
          </Field>
          <Field label="Start date" required>
            <Input type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} required />
          </Field>
          <Field label="End date" hint="Leave blank for a one-day class">
            <Input type="date" value={f.end_date ?? ''} min={f.start_date} onChange={(e) => set('end_date', e.target.value || null)} />
          </Field>
          <Field label="Training hours">
            <Input type="number" min={0} max={200} step={0.25} value={f.hours ?? ''} onChange={(e) => set('hours', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
          <Field label="Capacity">
            <Input type="number" min={1} value={f.capacity ?? ''} onChange={(e) => set('capacity', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
          <Field label="Lead instructor">
            <Select value={f.lead_instructor_id ?? ''} onChange={(e) => set('lead_instructor_id', e.target.value || null)} options={instructorOpts} placeholder="—" />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set('status', e.target.value as SessionDraft['status'])} options={SESSION_STATUS} />
          </Field>
        </div>
        <div>
          <div className="label">Programs taught</div>
          <div className="flex gap-5">
            <Check label="Verbal Program" checked={f.program_verbal} onChange={(v) => set('program_verbal', v)} />
            <Check label="Physical Program" checked={f.program_physical} onChange={(v) => set('program_physical', v)} />
          </div>
        </div>
        <div>
          <div className="label">Co-instructors</div>
          <div className="flex max-h-32 flex-wrap gap-x-5 gap-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {instructorOpts.filter((o) => o.value !== f.lead_instructor_id).length === 0 && <span className="text-xs text-slate-500">No other instructors yet.</span>}
            {instructorOpts
              .filter((o) => o.value !== f.lead_instructor_id)
              .map((o) => (
                <Check
                  key={o.value}
                  label={o.label}
                  checked={f.co_instructor_ids.includes(o.value)}
                  onChange={(v) => set('co_instructor_ids', v ? [...f.co_instructor_ids, o.value] : f.co_instructor_ids.filter((x) => x !== o.value))}
                />
              ))}
          </div>
        </div>
        <Field label="Notes">
          <Textarea value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} maxLength={2000} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {initial ? 'Save class' : 'Create class'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Classes() {
  const nav = useNavigate();
  const ids = useScopeIds();
  const { data: instructors = [] } = useInstructors();
  const [status, setStatus] = useState('');
  const [when, setWhen] = useState<'upcoming' | 'past' | 'all'>('all');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['classes', ids, status, when, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from('training_sessions')
        .select('*, enrollments(count)', { count: 'exact' })
        .in('facility_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      if (status) q = q.eq('status', status);
      if (when === 'upcoming') q = q.gte('start_date', today());
      if (when === 'past') q = q.lt('start_date', today());
      const res = await q.order('start_date', { ascending: when === 'upcoming' }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      must(res, 'classes');
      return { rows: (res.data ?? []) as (TrainingSession & { enrollments: { count: number }[] })[], total: res.count ?? 0 };
    },
  });

  const name = (id: string | null) => displayName(instructors.find((i) => i.id === id));

  return (
    <>
      <PageHeader
        icon={<CalendarDays className="h-5 w-5" />}
        title="Classes"
        subtitle="Schedule HWC training, take attendance, record results and issue certificates in bulk."
        actions={
          <Button icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Schedule class
          </Button>
        }
      />
      <Card>
        <div className="-m-5 mb-0 flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <Select
            className="w-44"
            value={when}
            onChange={(e) => {
              setWhen(e.target.value as typeof when);
              setPage(0);
            }}
            options={[
              { value: 'all', label: 'All dates' },
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'past', label: 'Past' },
            ]}
          />
          <Select
            className="w-44"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            options={SESSION_STATUS}
            placeholder="Any status"
          />
        </div>
        <div className="-mx-5 -mb-5 overflow-x-auto">
          {isLoading ? (
            <Spinner />
          ) : !data?.rows.length ? (
            <Empty icon={<CalendarDays className="h-6 w-6" />} title="No classes yet">
              Schedule your first class to start building a roster.
            </Empty>
          ) : (
            <>
              <table className="w-full min-w-[820px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Class</th>
                    <th className="th">Location</th>
                    <th className="th">Lead instructor</th>
                    <th className="th text-right">Roster</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((s) => (
                    <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/classes/${s.id}`)}>
                      <td className="td tabular-nums">
                        {fmtDate(s.start_date)}
                        {s.end_date && s.end_date !== s.start_date ? ` – ${fmtDate(s.end_date)}` : ''}
                      </td>
                      <td className="td">
                        <div className="font-medium text-slate-900">{s.title || s.course_type}</div>
                        <div className="text-xs text-slate-500">
                          {s.title ? `${s.course_type} · ` : ''}
                          {[s.program_verbal && 'Verbal', s.program_physical && 'Physical'].filter(Boolean).join(' + ')}
                          {s.hours ? ` · ${s.hours} h` : ''}
                        </div>
                      </td>
                      <td className="td">{s.location ?? '—'}</td>
                      <td className="td">{name(s.lead_instructor_id)}</td>
                      <td className="td text-right tabular-nums">
                        {s.enrollments?.[0]?.count ?? 0}
                        {s.capacity ? ` / ${s.capacity}` : ''}
                      </td>
                      <td className="td">
                        <Badge tone={statusTone(s.status)}>{titleCase(s.status)}</Badge>
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
      <SessionFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
