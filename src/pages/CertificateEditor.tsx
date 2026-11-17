import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Award, Ban, BadgeCheck, Copy, Download, Printer, RotateCcw, Save, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { errMessage, must } from '../lib/errors';
import { useCertSettings, useSignature } from '../lib/queries';
import { certStatus, fmtDateTime, studentFullName } from '../lib/format';
import { buildCertificateData, certFileName, exportCertificatesPdf, verifyUrl } from '../lib/certificate';
import type { Certificate, Student, TrainingSession } from '../lib/types';
import { CertificateExportHost, CertificatePreview } from '../components/Certificate';
import { BadgeShare } from '../components/Badge';
import { CertificateFields, initialCertForm, resolveSignatureId, signatureDataUrl, type CertFormState } from '../components/CertificateFields';
import { Button, Card, CertBadge, ErrorNote, Field, Input, PageHeader, Spinner, useToast } from '../components/ui';

export default function CertificateEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const studentParam = params.get('student');
  const enrollmentParam = params.get('enrollment');
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { profile, isAdmin } = useAuth();
  const settings = useCertSettings();
  const { data: savedSigUrl } = useSignature(profile?.signature_id);
  const exportRef = useRef<HTMLDivElement>(null);

  const [cert, setCert] = useState<Certificate | null>(null);
  const [studentId, setStudentId] = useState<string | null>(studentParam);
  const [facilityId, setFacilityId] = useState<string>('');
  const [studentName, setStudentName] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [existingSig, setExistingSig] = useState<string | null>(null);
  const [studentEmail, setStudentEmail] = useState<string | null>(null);
  const [form, setForm] = useState<CertFormState>(() => initialCertForm(profile, settings));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (id) {
          const c = must(await supabase.from('certificates').select('*').eq('id', id).single(), 'load certificate') as Certificate;
          setCert(c);
          setStudentId(c.student_id);
          const { data: st } = await supabase.from('students').select('email').eq('id', c.student_id).maybeSingle();
          setStudentEmail(st?.email ?? null);
          setFacilityId(c.facility_id);
          setStudentName(c.student_name);
          setFacilityName(c.facility_name);
          setForm({
            programVerbal: c.program_verbal,
            programPhysical: c.program_physical,
            programLabel: c.program_label,
            issueDate: c.issue_date,
            expirationDate: c.expiration_date,
            expirationTouched: true,
            theme: c.theme,
            layout: c.layout ?? 'classic',
            signerName: c.signer_name ?? '',
            signerTitle: c.signer_title,
            instructorCertNumber: c.instructor_cert_number ?? '',
            personnel: c.personnel ?? [],
            signature: { kind: 'none' },
          });
          if (c.signature_id) {
            const { data } = await supabase.from('signatures').select('data_url').eq('id', c.signature_id).maybeSingle();
            setExistingSig(data?.data_url ?? null);
          }
        } else if (studentParam) {
          const s = must(await supabase.from('students').select('*, facilities(name)').eq('id', studentParam).single(), 'load student') as Student & {
            facilities: { name: string };
          };
          setStudentName(studentFullName(s));
          setFacilityId(s.facility_id);
          setFacilityName(s.facilities?.name ?? '');
          if (enrollmentParam) {
            const { data: e } = await supabase.from('enrollments').select('training_sessions(*)').eq('id', enrollmentParam).maybeSingle();
            const sess = (e as { training_sessions?: TrainingSession } | null)?.training_sessions;
            if (sess) {
              const base = initialCertForm(profile, settings);
              const issue = sess.end_date ?? sess.start_date;
              setForm({ ...base, programVerbal: sess.program_verbal, programPhysical: sess.program_physical, issueDate: issue, expirationDate: buildCertificateData({ studentName: '', issueDate: issue, settings }).expirationDate });
            }
          }
        }
      } catch (e) {
        setError(errMessage(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, studentParam, enrollmentParam]);

  const data = useMemo(
    () =>
      buildCertificateData({
        studentName,
        facilityName,
        programVerbal: form.programVerbal,
        programPhysical: form.programPhysical,
        programLabel: form.programLabel,
        issueDate: form.issueDate,
        expirationDate: form.expirationDate,
        signatureDataUrl: signatureDataUrl(form.signature) ?? existingSig,
        signerName: form.signerName,
        signerTitle: form.signerTitle,
        instructorCertNumber: form.instructorCertNumber,
        personnel: form.personnel,
        certNumber: cert?.cert_number,
        verifyCode: cert?.verify_code,
        theme: form.theme,
        layout: form.layout,
        settings,
      }),
    [studentName, facilityName, form, existingSig, cert, settings],
  );

  async function save() {
    setError(null);
    if (!studentName.trim()) return setError('Student name is required.');
    if (!form.programVerbal && !form.programPhysical) return setError('Select at least one program.');
    if (form.expirationDate <= form.issueDate) return setError('The “valid through” date must be after the training date.');
    if (!cert && form.signature.kind === 'none') return setError('Add a digital signature.');
    setBusy('save');
    try {
      const newSigId = form.signature.kind === 'none' ? undefined : await resolveSignatureId(form.signature);
      const payload: Record<string, unknown> = {
        student_name: studentName.trim(),
        facility_name: facilityName.trim(),
        program_verbal: form.programVerbal,
        program_physical: form.programPhysical,
        program_label: form.programLabel.trim() || settings.program_label,
        issue_date: form.issueDate,
        expiration_date: form.expirationDate,
        signer_name: form.signerName.trim() || null,
        signer_title: form.signerTitle.trim() || settings.signer_title,
        instructor_cert_number: form.instructorCertNumber.trim() || null,
        personnel: form.personnel.filter((p) => p.name.trim() || p.title.trim()),
        theme: form.theme,
        layout: form.layout,
      };
      if (newSigId !== undefined) payload.signature_id = newSigId;
      if (cert) {
        const updated = must(await supabase.from('certificates').update(payload).eq('id', cert.id).select('*').single(), 'update certificate') as Certificate;
        setCert(updated);
        if (form.signature.kind !== 'none') {
          setExistingSig(form.signature.dataUrl);
          setForm((f) => ({ ...f, signature: { kind: 'none' } }));
        }
        toast('success', 'Certificate saved');
      } else {
        const created = must(
          await supabase
            .from('certificates')
            .insert({ ...payload, student_id: studentId, facility_id: facilityId, enrollment_id: enrollmentParam })
            .select('id')
            .single(),
          'issue certificate',
        ) as { id: string };
        toast('success', 'Certificate issued');
        nav(`/certificates/${created.id}`, { replace: true });
      }
      await qc.invalidateQueries();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf(print = false) {
    if (!exportRef.current) return;
    setBusy(print ? 'print' : 'pdf');
    try {
      await exportCertificatesPdf([exportRef.current], certFileName(studentName, cert?.cert_number), { print });
    } catch (e) {
      toast('error', 'Could not create the PDF: ' + errMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function setRevoked(revoke: boolean) {
    if (!cert) return;
    const reason = revoke ? prompt('Reason for revoking this certificate?') : null;
    if (revoke && reason === null) return;
    setBusy('revoke');
    try {
      const updated = must(
        await supabase.from('certificates').update({ status: revoke ? 'revoked' : 'active', revoked_reason: revoke ? reason : null }).eq('id', cert.id).select('*').single(),
        'revoke certificate',
      ) as Certificate;
      setCert(updated);
      await qc.invalidateQueries();
      toast('success', revoke ? 'Certificate revoked' : 'Certificate reinstated');
    } catch (e) {
      toast('error', errMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!cert || !confirm('Permanently delete this certificate? Revoking is usually better because it keeps the record.')) return;
    try {
      must(await supabase.from('certificates').delete().eq('id', cert.id), 'delete certificate');
      await qc.invalidateQueries();
      toast('success', 'Certificate deleted');
      nav(`/students/${cert.student_id}`);
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  if (loading) return <Spinner />;
  if (!id && !studentParam) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          Choose a student first. Open a <Link to="/students" className="text-brand-600 hover:underline">student profile</Link> and click “Issue certificate”.
        </p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        icon={<Award className="h-5 w-5" />}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {cert ? cert.cert_number : 'Issue certificate'}
            {cert && <CertBadge status={certStatus(cert)} />}
          </span>
        }
        subtitle={
          cert ? (
            <>
              <Link to={`/students/${cert.student_id}`} className="text-brand-600 hover:underline">
                {cert.student_name}
              </Link>{' '}
              · issued {fmtDateTime(cert.created_at)}
              {cert.status === 'revoked' && cert.revoked_reason ? ` · Revoked: ${cert.revoked_reason}` : ''}
            </>
          ) : (
            'Fields are pre-filled from the student and your instructor profile.'
          )
        }
        actions={
          <>
            {cert && (
              <>
                <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={busy === 'pdf'} onClick={() => exportPdf(false)}>
                  PDF
                </Button>
                <Button variant="secondary" icon={<Printer className="h-4 w-4" />} loading={busy === 'print'} onClick={() => exportPdf(true)}>
                  Print
                </Button>
                <Button
                  variant="secondary"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() => navigator.clipboard.writeText(verifyUrl(cert.verify_code)).then(() => toast('success', 'Verification link copied'))}
                >
                  Verify link
                </Button>
                {cert.status === 'active' ? (
                  <Button variant="secondary" icon={<Ban className="h-4 w-4" />} loading={busy === 'revoke'} onClick={() => setRevoked(true)}>
                    Revoke
                  </Button>
                ) : (
                  <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} loading={busy === 'revoke'} onClick={() => setRevoked(false)}>
                    Reinstate
                  </Button>
                )}
                {isAdmin && (
                  <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={remove}>
                    Delete
                  </Button>
                )}
              </>
            )}
            <Button icon={<Save className="h-4 w-4" />} loading={busy === 'save'} onClick={save}>
              {cert ? 'Save changes' : 'Issue certificate'}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <div className="space-y-6">
          <ErrorNote error={error} />
          <Card title="Recipient">
            <div className="grid gap-4">
              <Field label="Student name as printed" required>
                <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} maxLength={90} />
              </Field>
              <Field label="Facility name as printed" required>
                <Input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} maxLength={160} />
              </Field>
            </div>
          </Card>
          <Card title="Certificate details">
            <CertificateFields
              value={form}
              onChange={setForm}
              settings={settings}
              savedSignature={profile?.signature_id && savedSigUrl ? { id: profile.signature_id, dataUrl: savedSigUrl } : null}
              existingSignatureUrl={existingSig}
            />
          </Card>
        </div>
        <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <Card title="Preview" subtitle="Landscape US Letter · prints in full color">
            <div className="rounded-lg bg-slate-100 p-3">
              <CertificatePreview data={data} />
            </div>
          </Card>
          <Card
            title={
              <span className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-teal-brand" /> Digital badge
              </span>
            }
            subtitle={cert ? 'Share-ready badge linked to this certificate — for LinkedIn and social media' : 'Available once the certificate is issued'}
          >
            {cert ? (
              <BadgeShare
                compact
                theme={form.theme}
                layout={form.layout}
                studentName={cert.student_name}
                studentEmail={studentEmail}
                disabled={cert.status === 'revoked'}
                share={{
                  code: cert.verify_code,
                  certNumber: cert.cert_number,
                  facilityName: cert.facility_name,
                  programVerbal: cert.program_verbal,
                  programPhysical: cert.program_physical,
                  issueDate: cert.issue_date,
                  expirationDate: cert.expiration_date,
                }}
              />
            ) : (
              <p className="text-sm text-slate-500">Issue the certificate to generate the student's digital badge and share links.</p>
            )}
          </Card>
        </div>
      </div>
      <CertificateExportHost ref={exportRef} data={data} />
    </>
  );
}
