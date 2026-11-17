import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Award, Eye, Save, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { errMessage, must } from '../lib/errors';
import { useCertSettings, useLookup, useSignature } from '../lib/queries';
import { studentFullName } from '../lib/format';
import { buildCertificateData } from '../lib/certificate';
import type { Certificate, Student } from '../lib/types';
import { CertificatePreview } from '../components/Certificate';
import { CertificateFields, initialCertForm, resolveSignatureId, signatureDataUrl, type CertFormState } from '../components/CertificateFields';
import { Button, Card, Check, Combo, ErrorNote, Field, Input, PageHeader, Select, Spinner, Textarea, useToast } from '../components/ui';

type StudentForm = Omit<Student, 'id' | 'created_by' | 'created_at' | 'updated_at'>;

const EMPTY: StudentForm = {
  facility_id: '',
  first_name: '',
  middle_initial: '',
  last_name: '',
  preferred_name: '',
  employee_id: '',
  email: '',
  phone: '',
  job_title: '',
  department: '',
  student_type: '',
  hire_date: '',
  status: 'active',
  notes: '',
};

const nullify = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v);

export default function StudentFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { profile, facilities, scope } = useAuth();
  const settings = useCertSettings();
  const { data: savedSigUrl } = useSignature(profile?.signature_id);
  const studentTypes = useLookup('student_type');
  const departments = useLookup('department');
  const jobTitles = useLookup('job_title');

  const [form, setForm] = useState<StudentForm>({ ...EMPTY, facility_id: scope || facilities[0]?.id || '' });
  const [cert, setCert] = useState<CertFormState>(() => initialCertForm(profile, settings));
  const [issue, setIssue] = useState(true);
  const [latestCert, setLatestCert] = useState<Certificate | null>(null);
  const [latestSig, setLatestSig] = useState<string | null>(null);
  const [syncCerts, setSyncCerts] = useState(true);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings load asynchronously: refresh defaults the instructor hasn't touched yet.
  useEffect(() => {
    if (!isEdit) setCert((c) => ({ ...initialCertForm(profile, settings), personnel: c.personnel, signature: c.signature }));
  }, [settings, profile, isEdit]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const s = must(await supabase.from('students').select('*').eq('id', id).single(), 'load student') as Student;
        const { id: _i, created_by: _c, created_at: _a, updated_at: _u, ...rest } = s;
        setForm(Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v ?? ''])) as unknown as StudentForm);
        const { data: c } = await supabase.from('certificates').select('*').eq('student_id', id).eq('status', 'active').order('issue_date', { ascending: false }).limit(1).maybeSingle();
        if (c) {
          setLatestCert(c as Certificate);
          if (c.signature_id) {
            const { data: sig } = await supabase.from('signatures').select('data_url').eq('id', c.signature_id).maybeSingle();
            setLatestSig(sig?.data_url ?? null);
          }
        }
      } catch (e) {
        setError(errMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const facilityName = facilities.find((f) => f.id === form.facility_id)?.name ?? '';
  const name = studentFullName(form);
  const set = <K extends keyof StudentForm>(k: K, v: StudentForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const preview = useMemo(() => {
    if (isEdit && latestCert) {
      return buildCertificateData({
        studentName: name,
        facilityName: syncCerts ? facilityName : latestCert.facility_name,
        programVerbal: latestCert.program_verbal,
        programPhysical: latestCert.program_physical,
        programLabel: latestCert.program_label,
        issueDate: latestCert.issue_date,
        expirationDate: latestCert.expiration_date,
        signatureDataUrl: latestSig,
        signerName: latestCert.signer_name,
        signerTitle: latestCert.signer_title,
        instructorCertNumber: latestCert.instructor_cert_number,
        personnel: latestCert.personnel,
        certNumber: latestCert.cert_number,
        verifyCode: latestCert.verify_code,
        theme: latestCert.theme,
        layout: latestCert.layout,
        settings,
      });
    }
    return buildCertificateData({
      studentName: name,
      facilityName,
      programVerbal: cert.programVerbal,
      programPhysical: cert.programPhysical,
      programLabel: cert.programLabel,
      issueDate: cert.issueDate,
      expirationDate: cert.expirationDate,
      signatureDataUrl: signatureDataUrl(cert.signature),
      signerName: cert.signerName,
      signerTitle: cert.signerTitle,
      instructorCertNumber: cert.instructorCertNumber,
      personnel: cert.personnel,
      theme: cert.theme,
      layout: cert.layout,
      settings,
    });
  }, [isEdit, latestCert, latestSig, name, facilityName, syncCerts, cert, settings]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('First and last name are required.');
    if (!form.facility_id) return setError('Choose a facility.');
    if (!isEdit && issue) {
      if (!cert.programVerbal && !cert.programPhysical) return setError('Select at least one program for the certificate.');
      if (cert.signature.kind === 'none') return setError('Add a digital signature for the certificate (or untick “Issue certificate”).');
      if (cert.expirationDate <= cert.issueDate) return setError('The “valid through” date must be after the training date.');
    }
    setBusy(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, nullify(v)])) as Record<string, unknown>;
      payload.status = form.status || 'active';
      payload.middle_initial = form.middle_initial ? form.middle_initial.replace(/\./g, '').slice(0, 3) : null;
      let studentId = id;
      if (isEdit) {
        must(await supabase.from('students').update(payload).eq('id', id!), 'update student');
        if (syncCerts) {
          must(
            await supabase.from('certificates').update({ student_name: name, facility_name: facilityName, facility_id: form.facility_id }).eq('student_id', id!).eq('status', 'active'),
            'sync certificate names',
          );
        }
      } else {
        const row = must(await supabase.from('students').insert(payload).select('id').single(), 'create student') as { id: string };
        studentId = row.id;
        if (issue) {
          const signatureId = await resolveSignatureId(cert.signature);
          must(
            await supabase.from('certificates').insert({
              student_id: studentId,
              facility_id: form.facility_id,
              student_name: name,
              facility_name: facilityName,
              program_verbal: cert.programVerbal,
              program_physical: cert.programPhysical,
              program_label: cert.programLabel.trim() || settings.program_label,
              issue_date: cert.issueDate,
              expiration_date: cert.expirationDate,
              signature_id: signatureId,
              signer_name: cert.signerName.trim() || null,
              signer_title: cert.signerTitle.trim() || settings.signer_title,
              instructor_cert_number: cert.instructorCertNumber.trim() || null,
              personnel: cert.personnel.filter((p) => p.name.trim() || p.title.trim()),
              theme: cert.theme,
              layout: cert.layout,
            }),
            'issue certificate',
          );
        }
      }
      await qc.invalidateQueries();
      toast('success', isEdit ? 'Student updated' : issue ? 'Student created and certificate issued' : 'Student created');
      nav(`/students/${studentId}`);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <form onSubmit={submit}>
      <PageHeader
        icon={<UserPlus className="h-5 w-5" />}
        title={isEdit ? `Edit ${name || 'student'}` : 'New student'}
        subtitle={isEdit ? 'Changes are tracked in the audit log.' : 'The certificate on the right fills in as you type.'}
        actions={
          <>
            <Link to={isEdit ? `/students/${id}` : '/students'}>
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button type="submit" loading={busy} icon={<Save className="h-4 w-4" />}>
              {isEdit ? 'Save changes' : issue ? 'Create & issue certificate' : 'Create student'}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-6">
          <ErrorNote error={error} />
          <Card title="Identity">
            <div className="grid gap-4 sm:grid-cols-[1fr_90px_1fr]">
              <Field label="First name" required>
                <Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} maxLength={80} required autoFocus />
              </Field>
              <Field label="M.I.">
                <Input value={form.middle_initial ?? ''} onChange={(e) => set('middle_initial', e.target.value)} maxLength={3} />
              </Field>
              <Field label="Last name" required>
                <Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} maxLength={80} required />
              </Field>
              <Field label="Preferred name" className="sm:col-span-3">
                <Input value={form.preferred_name ?? ''} onChange={(e) => set('preferred_name', e.target.value)} maxLength={80} />
              </Field>
            </div>
          </Card>
          <Card title="Employment & training category">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Facility" required>
                <Select value={form.facility_id} onChange={(e) => set('facility_id', e.target.value)} options={facilities.map((f) => ({ value: f.id, label: f.name }))} placeholder="Choose…" required />
              </Field>
              <Field label="Employee ID">
                <Input value={form.employee_id ?? ''} onChange={(e) => set('employee_id', e.target.value)} maxLength={40} />
              </Field>
              <Field label="Student type">
                <Select value={form.student_type ?? ''} onChange={(e) => set('student_type', e.target.value)} options={studentTypes} placeholder="Choose…" />
              </Field>
              <Field label="Department / unit">
                <Select value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} options={departments} placeholder="Choose…" />
              </Field>
              <Field label="Job title">
                <Combo id="job-title" list={jobTitles} value={form.job_title ?? ''} onChange={(e) => set('job_title', e.target.value)} maxLength={80} />
              </Field>
              <Field label="Hire date">
                <Input type="date" value={form.hire_date ?? ''} onChange={(e) => set('hire_date', e.target.value)} />
              </Field>
              <Field label="Status">
                <Select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as StudentForm['status'])}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'on_leave', label: 'On leave' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'separated', label: 'Separated' },
                  ]}
                />
              </Field>
            </div>
          </Card>
          <Card title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Work email">
                <Input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} maxLength={254} />
              </Field>
              <Field label="Phone">
                <Input type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} maxLength={30} />
              </Field>
              <Field label="Notes" className="sm:col-span-2" hint="Training notes only. Never enter patient information.">
                <Textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} maxLength={2000} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-slate-400" /> Live certificate preview
              </span>
            }
            subtitle={isEdit ? (latestCert ? `Latest certificate ${latestCert.cert_number}` : 'No certificate yet') : 'Updates on every keystroke'}
          >
            <div className="overflow-hidden rounded-lg bg-slate-100 p-3">
              <CertificatePreview data={preview} />
            </div>
            {isEdit && latestCert && (
              <div className="mt-4">
                <Check label="Also update the name and facility on this student's active certificates" checked={syncCerts} onChange={setSyncCerts} />
              </div>
            )}
            {isEdit && !latestCert && (
              <div className="mt-4 text-sm text-slate-600">
                Issue a certificate from the student's profile after saving.{' '}
                <Link className="text-brand-600 hover:underline" to={`/certificates/new?student=${id}`}>
                  Issue now
                </Link>
              </div>
            )}
          </Card>
          {!isEdit && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-gold" /> Completion certificate
                </span>
              }
              actions={<Check label="Issue certificate with this profile" checked={issue} onChange={setIssue} />}
            >
              {issue ? (
                <CertificateFields value={cert} onChange={setCert} settings={settings} savedSignature={profile?.signature_id && savedSigUrl ? { id: profile.signature_id, dataUrl: savedSigUrl } : null} />
              ) : (
                <p className="text-sm text-slate-500">The student will be created without a certificate. You can issue one later from a class or the student's profile.</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </form>
  );
}
