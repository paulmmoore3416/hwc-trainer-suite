import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, PenLine, Save, UserCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { errMessage, logAuth, must } from '../lib/errors';
import { useSignature } from '../lib/queries';
import { titleCase } from '../lib/format';
import { SignatureField, type SignatureChoice } from '../components/SignaturePad';
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, useToast } from '../components/ui';

export default function Profile() {
  const { profile, refresh, isSuper, facilities } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: sigUrl } = useSignature(profile?.signature_id);
  const [f, setF] = useState({ full_name: '', title: '', phone: '', hwc_cert_number: '', hwc_cert_expires: '' });
  const [sig, setSig] = useState<SignatureChoice>({ kind: 'none' });
  const [busy, setBusy] = useState<string | null>(null);
  const [pw, setPw] = useState({ a: '', b: '' });
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (profile)
      setF({
        full_name: profile.full_name ?? '',
        title: profile.title ?? '',
        phone: profile.phone ?? '',
        hwc_cert_number: profile.hwc_cert_number ?? '',
        hwc_cert_expires: profile.hwc_cert_expires ?? '',
      });
  }, [profile]);

  if (!profile) return null;

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy('profile');
    try {
      must(
        await supabase
          .from('profiles')
          .update({
            full_name: f.full_name.trim(),
            title: f.title.trim() || null,
            phone: f.phone.trim() || null,
            hwc_cert_number: f.hwc_cert_number.trim() || null,
            hwc_cert_expires: f.hwc_cert_expires || null,
          })
          .eq('id', profile!.id),
        'update profile',
      );
      await refresh();
      await qc.invalidateQueries({ queryKey: ['instructors'] });
      toast('success', 'Profile saved');
    } catch (err) {
      toast('error', errMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveSignature() {
    if (sig.kind !== 'new') return;
    setBusy('sig');
    try {
      const row = must(await supabase.from('signatures').insert({ data_url: sig.dataUrl, kind: sig.source }).select('id').single(), 'save signature') as { id: string };
      must(await supabase.from('profiles').update({ signature_id: row.id }).eq('id', profile!.id), 'link signature');
      await refresh();
      await qc.invalidateQueries({ queryKey: ['signature'] });
      setSig({ kind: 'none' });
      toast('success', 'Signature saved — it will be offered automatically on new certificates');
    } catch (err) {
      toast('error', errMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (pw.a.length < 10) return setPwError('Use at least 10 characters.');
    if (pw.a !== pw.b) return setPwError('Passwords do not match.');
    setBusy('pw');
    try {
      const { error } = await supabase.auth.updateUser({ password: pw.a });
      if (error) throw error;
      logAuth('password_set');
      setPw({ a: '', b: '' });
      toast('success', 'Password changed');
    } catch (err) {
      setPwError(errMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        icon={<UserCircle className="h-5 w-5" />}
        title="My profile"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {profile.email}
            <Badge tone={isSuper ? 'amber' : 'teal'}>{isSuper ? 'Super admin' : titleCase(profile.role)}</Badge>
            {facilities.map((x) => (
              <Badge key={x.id}>{x.short_code}</Badge>
            ))}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Instructor details" subtitle="These auto-fill the instructor name on certificates you issue.">
          <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" className="sm:col-span-2" required>
              <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required maxLength={120} />
            </Field>
            <Field label="Job title">
              <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} />
            </Field>
            <Field label="Phone">
              <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={30} />
            </Field>
            <Field label="HWC instructor cert #">
              <Input value={f.hwc_cert_number} onChange={(e) => setF({ ...f, hwc_cert_number: e.target.value })} maxLength={40} />
            </Field>
            <Field label="Instructor cert. expires" hint="Used for instructor renewal reminders in Reports.">
              <Input type="date" value={f.hwc_cert_expires} onChange={(e) => setF({ ...f, hwc_cert_expires: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" loading={busy === 'profile'} icon={<Save className="h-4 w-4" />}>
                Save details
              </Button>
            </div>
          </form>
        </Card>
        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2"><PenLine className="h-4 w-4 text-slate-400" /> Saved digital signature</span>} subtitle="Draw or type once, then reuse it on every certificate.">
            {sigUrl && sig.kind === 'none' && (
              <div className="paper mb-4 flex h-24 items-center justify-center rounded-lg border border-slate-200 bg-white">
                <img src={sigUrl} alt="Your saved signature" className="max-h-20 object-contain" />
              </div>
            )}
            <SignatureField value={sig} onChange={setSig} saved={null} defaultTypedName={f.full_name} />
            <Button className="mt-3" loading={busy === 'sig'} disabled={sig.kind !== 'new'} onClick={saveSignature} icon={<Save className="h-4 w-4" />}>
              {sigUrl ? 'Replace saved signature' : 'Save signature'}
            </Button>
          </Card>
          <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-slate-400" /> Change password</span>}>
            <form onSubmit={changePassword} className="space-y-3">
              <Field label="New password" hint="At least 10 characters.">
                <Input type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
              </Field>
              <Field label="Confirm new password">
                <Input type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
              </Field>
              <ErrorNote error={pwError} />
              <Button type="submit" variant="secondary" loading={busy === 'pw'}>
                Update password
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
