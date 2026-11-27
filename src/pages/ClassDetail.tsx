import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, CalendarDays, CheckCheck, Download, Pencil, Save, ShieldAlert, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { errMessage, must } from '../lib/errors';
import { displayName, useCertSettings, useInstructors, useSignature } from '../lib/queries';
import { addMonths, fmtDate, safeSearch, studentFullName, titleCase } from '../lib/format';
import { CERT_LAYOUT, CERT_THEME, buildCertificateData, exportCertificatesPdf, type CertificateData } from '../lib/certificate';
import type { Certificate, Enrollment, Student, TrainingSession } from '../lib/types';
import { Certificate as CertificateView } from '../components/Certificate';
import { CertificateFields, initialCertForm, resolveSignatureId, type CertFormState } from '../components/CertificateFields';
import { Badge, Button, Card, Check, Empty, ErrorNote, Input, Modal, PageHeader, Select, Spinner, useToast } from '../components/ui';
import { SessionFormModal, statusTone } from './Classes';

type StudentLite = Pick<Student, 'id' | 'first_name' | 'middle_initial' | 'last_name' | 'employee_id' | 'student_type' | 'department' | 'facility_id'>;
type Row = Enrollment & { students: StudentLite };

export default function ClassDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { facilities, isAdmin, profile } = useAuth();
  const { data: instructors = [] } = useInstructors();
  const settings = useCertSettings();
  const { data: savedSigUrl } = useSignature(profile?.signature_id);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['class', id],
    queryFn: async () => {
      const session = must(await supabase.from('training_sessions').select('*').eq('id', id).single(), 'class') as TrainingSession;
      const rows = must(
        await supabase.from('enrollments').select('*, students(id, first_name, middle_initial, last_name, employee_id, student_type, department, facility_id)').eq('session_id', id),
        'roster',
      ) as Row[];
      rows.sort((a, b) => a.students.last_name.localeCompare(b.students.last_name));
      const certs = rows.length
        ? (must(await supabase.from('certificates').select('*').in('enrollment_id', rows.map((r) => r.id)), 'class certs') as Certificate[])
        : [];
      return { session, rows, certs };
    },
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [exportData, setExportData] = useState<CertificateData[] | null>(null);
  const exportWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data) {
      setRows(data.rows);
      setDirty(new Set());
    }
  }, [data]);

  const certByEnrollment = useMemo(() => new Map((data?.certs ?? []).map((c) => [c.enrollment_id, c])), [data]);
  const passedWithoutCert = rows.filter((r) => r.result === 'pass' && !certByEnrollment.has(r.id));

  // Render the hidden certificates, then capture them into one PDF.
  useEffect(() => {
    if (!exportData || !exportWrap.current) return;
    const nodes = Array.from(exportWrap.current.querySelectorAll<HTMLElement>('.hwc-certificate'));
    const t = setTimeout(async () => {
      try {
        await exportCertificatesPdf(nodes, `HWC-Certificates-${data?.session.start_date ?? 'class'}.pdf`);
      } catch (e) {
        toast('error', 'Could not create the PDF: ' + errMessage(e));
      } finally {
        setExportData(null);
        setBusy(null);
      }
    }, 400); // allow QR codes to render
    return () => clearTimeout(t);
  }, [exportData, data, toast]);

  if (isLoading) return <Spinner />;
  if (error || !data) return <Empty title="Class not found">{errMessage(error)}</Empty>;
  const s = data.session;

  function patch(rowId: string, p: Partial<Enrollment>) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== rowId) return r;
        const next = { ...r, ...p };
        // Derive the overall result from the program results when they're both recorded.
        if (('verbal_passed' in p || 'physical_passed' in p) && !('result' in p)) {
          const needed = [s.program_verbal ? next.verbal_passed : true, s.program_physical ? next.physical_passed : true];
          if (needed.every((v) => v === true)) next.result = 'pass';
          else if (needed.some((v) => v === false)) next.result = 'fail';
        }
        if (p.attendance === 'absent') next.result = 'incomplete';
        return next;
      }),
    );
    setDirty((d) => new Set(d).add(rowId));
  }

  function markAllPassed() {
    rows.forEach((r) => patch(r.id, { attendance: 'present', verbal_passed: s.program_verbal ? true : null, physical_passed: s.program_physical ? true : null, result: 'pass' }));
  }

  async function saveRoster() {
    setBusy('save');
    try {
      const changed = rows
        .filter((r) => dirty.has(r.id))
        .map(({ students: _s, ...r }) => ({ ...r, written_score: r.written_score === null || (r.written_score as unknown) === '' ? null : Number(r.written_score) }));
      if (changed.length) must(await supabase.from('enrollments').upsert(changed), 'save roster');
      toast('success', `Saved ${changed.length} roster ${changed.length === 1 ? 'entry' : 'entries'}`);
      await qc.invalidateQueries();
      await refetch();
    } catch (e) {
      toast('error', errMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function removeRow(r: Row) {
    if (!confirm(`Remove ${studentFullName(r.students)} from this class?`)) return;
    try {
      must(await supabase.from('enrollments').delete().eq('id', r.id), 'remove enrollment');
      await refetch();
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  async function deleteClass() {
    if (!confirm('Delete this class and its roster? Certificates already issued are kept.')) return;
    try {
      must(await supabase.from('training_sessions').delete().eq('id', s.id), 'delete class');
      await qc.invalidateQueries();
      nav('/classes');
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  async function downloadAll() {
    const certs = data!.certs.filter((c) => c.status === 'active');
    if (!certs.length) return toast('info', 'No certificates have been issued for this class yet.');
    setBusy('pdf');
    try {
      const sigIds = [...new Set(certs.map((c) => c.signature_id).filter(Boolean))] as string[];
      const sigs = sigIds.length ? ((must(await supabase.from('signatures').select('id, data_url').in('id', sigIds), 'signatures') as { id: string; data_url: string }[]) ?? []) : [];
      const sigMap = new Map(sigs.map((x) => [x.id, x.data_url]));
      setExportData(
        certs.map((c) =>
          buildCertificateData({
            studentName: c.student_name,
            facilityName: c.facility_name,
            programVerbal: c.program_verbal,
            programPhysical: c.program_physical,
            programLabel: c.program_label,
            issueDate: c.issue_date,
            expirationDate: c.expiration_date,
            signatureDataUrl: c.signature_id ? sigMap.get(c.signature_id) ?? null : null,
            signerName: c.signer_name,
            signerTitle: c.signer_title,
            instructorCertNumber: c.instructor_cert_number,
            personnel: c.personnel,
            certNumber: c.cert_number,
            verifyCode: c.verify_code,
            settings,
          }),
        ),
      );
    } catch (e) {
      toast('error', errMessage(e));
      setBusy(null);
    }
  }

  const facility = facilities.find((f) => f.id === s.facility_id);
  const lead = instructors.find((i) => i.id === s.lead_instructor_id);
  const co = s.co_instructor_ids.map((cid) => displayName(instructors.find((i) => i.id === cid))).filter((n) => n !== '—');
  const counts = {
    total: rows.length,
    present: rows.filter((r) => r.attendance !== 'absent').length,
    pass: rows.filter((r) => r.result === 'pass').length,
    fail: rows.filter((r) => r.result === 'fail').length,
  };

  return (
    <>
      <PageHeader
        icon={<CalendarDays className="h-5 w-5" />}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {s.title || s.course_type}
            <Badge tone={statusTone(s.status)}>{titleCase(s.status)}</Badge>
          </span>
        }
        subtitle={`${fmtDate(s.start_date, 'long')}${s.end_date && s.end_date !== s.start_date ? ` – ${fmtDate(s.end_date, 'long')}` : ''} · ${facility?.name ?? ''}${s.location ? ` · ${s.location}` : ''}`}
        actions={
          <>
            {isAdmin && (
              <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={deleteClass}>
                Delete
              </Button>
            )}
            <Link to={`/incidents/new?session=${s.id}`}>
              <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />}>
                Log incident
              </Button>
            </Link>
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
              Edit class
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-xs text-slate-500">Course</div>
          <div className="font-semibold text-slate-900">{s.course_type}</div>
          <div className="text-xs text-slate-500">
            {[s.program_verbal && 'Verbal', s.program_physical && 'Physical'].filter(Boolean).join(' + ')}
            {s.hours ? ` · ${s.hours} hours` : ''}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Instructors</div>
          <div className="font-semibold text-slate-900">{displayName(lead)}</div>
          <div className="truncate text-xs text-slate-500">{co.length ? `with ${co.join(', ')}` : 'No co-instructors'}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Roster</div>
          <div className="font-semibold text-slate-900 tabular-nums">
            {counts.present} present / {counts.total} enrolled
          </div>
          <div className="text-xs text-slate-500">{s.capacity ? `Capacity ${s.capacity}` : 'No capacity limit'}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Results</div>
          <div className="font-semibold text-slate-900 tabular-nums">
            {counts.pass} passed · {counts.fail} not passed
          </div>
          <div className="text-xs text-slate-500">{data.certs.length} certificates issued</div>
        </Card>
      </div>

      <Card
        title="Roster & results"
        subtitle={dirty.size ? `${dirty.size} unsaved change${dirty.size === 1 ? '' : 's'}` : 'Record attendance and competency results, then save.'}
        actions={
          <>
            <Button size="sm" variant="secondary" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setAddOpen(true)}>
              Add students
            </Button>
            <Button size="sm" variant="secondary" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={markAllPassed} disabled={!rows.length}>
              Mark all passed
            </Button>
            <Button size="sm" icon={<Save className="h-3.5 w-3.5" />} onClick={saveRoster} loading={busy === 'save'} disabled={!dirty.size}>
              Save roster
            </Button>
          </>
        }
      >
        {rows.length === 0 ? (
          <Empty icon={<UserPlus className="h-6 w-6" />} title="No students enrolled">
            Add students from your facility to start this class.
          </Empty>
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Student</th>
                  <th className="th">Attendance</th>
                  {s.program_verbal && <th className="th">Verbal</th>}
                  {s.program_physical && <th className="th">Physical</th>}
                  <th className="th">Written %</th>
                  <th className="th">Attempt</th>
                  <th className="th">Result</th>
                  <th className="th">Certificate</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const c = certByEnrollment.get(r.id);
                  const pf = (v: boolean | null) => (v === null ? '' : v ? 'yes' : 'no');
                  const fp = (v: string) => (v === '' ? null : v === 'yes');
                  return (
                    <tr key={r.id} className={dirty.has(r.id) ? 'bg-amber-50/40' : ''}>
                      <td className="td">
                        <Link to={`/students/${r.student_id}`} className="font-medium text-brand-700 hover:underline">
                          {studentFullName(r.students)}
                        </Link>
                        <div className="text-xs text-slate-500">{r.students.student_type ?? ''}</div>
                      </td>
                      <td className="td">
                        <Select className="!py-1" value={r.attendance} onChange={(e) => patch(r.id, { attendance: e.target.value as Enrollment['attendance'] })} options={['present', 'partial', 'absent'].map((v) => ({ value: v, label: titleCase(v) }))} />
                      </td>
                      {s.program_verbal && (
                        <td className="td">
                          <Select className="!py-1" value={pf(r.verbal_passed)} onChange={(e) => patch(r.id, { verbal_passed: fp(e.target.value) })} options={[{ value: 'yes', label: 'Pass' }, { value: 'no', label: 'Not yet' }]} placeholder="—" />
                        </td>
                      )}
                      {s.program_physical && (
                        <td className="td">
                          <Select className="!py-1" value={pf(r.physical_passed)} onChange={(e) => patch(r.id, { physical_passed: fp(e.target.value) })} options={[{ value: 'yes', label: 'Pass' }, { value: 'no', label: 'Not yet' }]} placeholder="—" />
                        </td>
                      )}
                      <td className="td">
                        <Input className="!w-20 !py-1" type="number" min={0} max={100} value={r.written_score ?? ''} onChange={(e) => patch(r.id, { written_score: e.target.value === '' ? null : Number(e.target.value) })} />
                      </td>
                      <td className="td">
                        <Input className="!w-16 !py-1" type="number" min={1} max={20} value={r.attempt} onChange={(e) => patch(r.id, { attempt: Math.max(1, Number(e.target.value) || 1) })} />
                      </td>
                      <td className="td">
                        <Select className="!py-1" value={r.result} onChange={(e) => patch(r.id, { result: e.target.value as Enrollment['result'] })} options={['pending', 'pass', 'fail', 'incomplete'].map((v) => ({ value: v, label: titleCase(v) }))} />
                      </td>
                      <td className="td">
                        {c ? (
                          <Link to={`/certificates/${c.id}`} className="font-mono text-xs text-brand-700 hover:underline">
                            {c.cert_number}
                          </Link>
                        ) : r.result === 'pass' ? (
                          <Link to={`/certificates/new?student=${r.student_id}&enrollment=${r.id}`} className="text-xs text-brand-600 hover:underline">
                            Issue
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="td text-right">
                        <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600" onClick={() => removeRow(r)} aria-label="Remove from class">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button icon={<Award className="h-4 w-4" />} disabled={!passedWithoutCert.length || dirty.size > 0} onClick={() => setIssueOpen(true)}>
          Issue certificates to {passedWithoutCert.length} passed student{passedWithoutCert.length === 1 ? '' : 's'}
        </Button>
        <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={busy === 'pdf'} onClick={downloadAll} disabled={!data.certs.length}>
          Download all certificates (PDF)
        </Button>
        {dirty.size > 0 && <span className="text-xs text-amber-700">Save the roster before issuing certificates.</span>}
      </div>

      <SessionFormModal open={editOpen} onClose={() => setEditOpen(false)} initial={s} />
      <AddStudentsModal open={addOpen} onClose={() => setAddOpen(false)} session={s} enrolled={new Set(rows.map((r) => r.student_id))} onAdded={() => void refetch()} />
      <BulkIssueModal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        session={s}
        rows={passedWithoutCert}
        facilityName={facility?.name ?? ''}
        savedSignature={profile?.signature_id && savedSigUrl ? { id: profile.signature_id, dataUrl: savedSigUrl } : null}
        onDone={async () => {
          await qc.invalidateQueries();
          await refetch();
        }}
      />
      {exportData && (
        <div ref={exportWrap} aria-hidden style={{ position: 'fixed', left: -12000, top: 0 }}>
          {exportData.map((d, i) => (
            <CertificateView key={i} data={d} />
          ))}
        </div>
      )}
    </>
  );
}

function AddStudentsModal({ open, onClose, session, enrolled, onAdded }: { open: boolean; onClose: () => void; session: TrainingSession; enrolled: Set<string>; onAdded: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ['add-students', session.facility_id, q],
    enabled: open,
    queryFn: async () => {
      let query = supabase.from('students').select('id, first_name, middle_initial, last_name, employee_id, student_type, department, facility_id').eq('facility_id', session.facility_id).eq('status', 'active');
      const s = safeSearch(q);
      if (s) query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,employee_id.ilike.%${s}%`);
      return must(await query.order('last_name').limit(100), 'search students') as StudentLite[];
    },
  });
  const available = data.filter((s) => !enrolled.has(s.id));

  async function add() {
    setBusy(true);
    try {
      must(await supabase.from('enrollments').insert([...picked].map((student_id) => ({ session_id: session.id, student_id }))), 'enroll');
      toast('success', `Enrolled ${picked.size} student${picked.size === 1 ? '' : 's'}`);
      setPicked(new Set());
      onAdded();
      onClose();
    } catch (e) {
      toast('error', errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add students to class">
      <Input placeholder="Search active students at this facility…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-slate-200">
        {isLoading ? (
          <Spinner />
        ) : available.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">
            No matching students. <Link to="/students/new" className="text-brand-600 hover:underline">Create a student</Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {available.map((s) => (
              <li key={s.id} className="px-3 py-2">
                <Check
                  label={
                    <span>
                      <span className="font-medium text-slate-900">{studentFullName(s)}</span>
                      <span className="ml-2 text-xs text-slate-500">{[s.employee_id && `#${s.employee_id}`, s.student_type].filter(Boolean).join(' · ')}</span>
                    </span>
                  }
                  checked={picked.has(s.id)}
                  onChange={(v) =>
                    setPicked((p) => {
                      const n = new Set(p);
                      if (v) n.add(s.id);
                      else n.delete(s.id);
                      return n;
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-slate-500">{picked.size} selected</span>
        <Button onClick={add} loading={busy} disabled={!picked.size}>
          Enroll selected
        </Button>
      </div>
    </Modal>
  );
}

function BulkIssueModal({
  open,
  onClose,
  session,
  rows,
  facilityName,
  savedSignature,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  session: TrainingSession;
  rows: Row[];
  facilityName: string;
  savedSignature: { id: string; dataUrl: string } | null;
  onDone: () => Promise<void>;
}) {
  const { profile } = useAuth();
  const settings = useCertSettings();
  const toast = useToast();
  const [form, setForm] = useState<CertFormState>(() => initialCertForm(profile, settings));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const issue = session.end_date ?? session.start_date;
    setForm({
      ...initialCertForm(profile, settings),
      programVerbal: session.program_verbal,
      programPhysical: session.program_physical,
      issueDate: issue,
      expirationDate: addMonths(issue, settings.expiration_months),
    });
    setError(null);
  }, [open, session, profile, settings]);

  async function issue() {
    setError(null);
    if (form.signature.kind === 'none') return setError('Add a digital signature.');
    if (!form.programVerbal && !form.programPhysical) return setError('Select at least one program.');
    setBusy(true);
    try {
      const signatureId = await resolveSignatureId(form.signature);
      const payload = rows.map((r) => ({
        student_id: r.student_id,
        enrollment_id: r.id,
        facility_id: session.facility_id,
        student_name: studentFullName(r.students),
        facility_name: facilityName,
        program_verbal: form.programVerbal,
        program_physical: form.programPhysical,
        program_label: form.programLabel.trim() || settings.program_label,
        issue_date: form.issueDate,
        expiration_date: form.expirationDate,
        signature_id: signatureId,
        signer_name: form.signerName.trim() || null,
        signer_title: form.signerTitle.trim() || settings.signer_title,
        instructor_cert_number: form.instructorCertNumber.trim() || null,
        personnel: form.personnel.filter((p) => p.name.trim() || p.title.trim()),
        theme: CERT_THEME,
        layout: CERT_LAYOUT,
      }));
      must(await supabase.from('certificates').insert(payload), 'bulk issue');
      toast('success', `Issued ${payload.length} certificate${payload.length === 1 ? '' : 's'}`);
      await onDone();
      onClose();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Issue ${rows.length} certificate${rows.length === 1 ? '' : 's'}`} wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          One certificate will be issued to each student who passed: <span className="font-medium text-slate-800">{rows.map((r) => studentFullName(r.students)).join(', ')}</span>.
        </p>
        <ErrorNote error={error} />
        <CertificateFields value={form} onChange={setForm} settings={settings} savedSignature={savedSignature} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<Award className="h-4 w-4" />} onClick={issue} loading={busy}>
            Issue certificates
          </Button>
        </div>
      </div>
    </Modal>
  );
}
