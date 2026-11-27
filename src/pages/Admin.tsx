import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Building2, ListChecks, Plus, Save, Settings, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { errMessage, must } from '../lib/errors';
import { useCertSettings, useLookups } from '../lib/queries';
import { BADGE_PNG_PATH, FILLABLE_CERT_PATH, buildCertificateData } from '../lib/certificate';
import type { CertificateSettings, Facility, LookupCategory, LookupValue } from '../lib/types';
import { CertificatePreview } from '../components/Certificate';
import { Badge, Button, Card, Check, ErrorNote, Field, Input, Modal, PageHeader, Spinner, Tabs, useToast } from '../components/ui';

const CATEGORIES: { id: LookupCategory; label: string; help: string }[] = [
  { id: 'student_type', label: 'Student types', help: 'Used for reporting by staff category.' },
  { id: 'department', label: 'Departments / units', help: '' },
  { id: 'job_title', label: 'Job titles', help: 'Suggestions only — free text is still allowed.' },
  { id: 'course_type', label: 'Course types', help: '' },
  { id: 'location', label: 'Training locations', help: 'Suggestions for class and incident locations.' },
  { id: 'technique', label: 'Techniques', help: 'Technique being practiced when an incident happened.' },
  { id: 'incident_type', label: 'Incident types', help: '' },
  { id: 'body_part', label: 'Body parts', help: '' },
  { id: 'contributing_factor', label: 'Contributing factors', help: '' },
];

export default function Admin() {
  const [tab, setTab] = useState<'facilities' | 'lists' | 'settings'>('facilities');
  return (
    <>
      <PageHeader icon={<Settings className="h-5 w-5" />} title="Administration" subtitle="Super admin only. Every change is recorded in the audit trail." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'facilities', label: 'Facilities', icon: <Building2 className="h-4 w-4" /> },
          { id: 'lists', label: 'Editable lists', icon: <ListChecks className="h-4 w-4" /> },
          { id: 'settings', label: 'Certificate settings', icon: <SlidersHorizontal className="h-4 w-4" /> },
        ]}
      />
      {tab === 'facilities' && <Facilities />}
      {tab === 'lists' && <Lists />}
      {tab === 'settings' && <CertSettings />}
    </>
  );
}

function Facilities() {
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<Facility> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ['facilities-admin'],
    queryFn: async () => must(await supabase.from('facilities').select('*').order('name'), 'facilities') as Facility[],
  });

  async function save() {
    if (!edit) return;
    setError(null);
    setBusy(true);
    try {
      const payload = {
        name: edit.name?.trim(),
        short_code: edit.short_code?.trim().toUpperCase(),
        address: edit.address || null,
        city: edit.city || null,
        state: edit.state || null,
        zip: edit.zip || null,
        phone: edit.phone || null,
        active: edit.active ?? true,
      };
      if (edit.id) must(await supabase.from('facilities').update(payload).eq('id', edit.id), 'update facility');
      else must(await supabase.from('facilities').insert(payload), 'create facility');
      await qc.invalidateQueries({ queryKey: ['facilities-admin'] });
      await refresh();
      toast('success', 'Facility saved');
      setEdit(null);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Facilities"
      subtitle="Students, classes, certificates and incidents belong to a facility. Instructors only see facilities they are assigned to."
      actions={
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEdit({ active: true })}>
          Add facility
        </Button>
      }
    >
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="-mx-5 -my-5 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Name</th>
                <th className="th">Code</th>
                <th className="th">Location</th>
                <th className="th">Phone</th>
                <th className="th">Status</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((f) => (
                <tr key={f.id}>
                  <td className="td font-medium text-slate-900">{f.name}</td>
                  <td className="td font-mono text-xs">{f.short_code}</td>
                  <td className="td">{[f.city, f.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="td">{f.phone ?? '—'}</td>
                  <td className="td">{f.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  <td className="td text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEdit(f)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit facility' : 'Add facility'}>
        {edit && (
          <div className="space-y-4">
            <ErrorNote error={error} />
            <Field label="Facility name" required>
              <Input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Short code" hint="2–8 letters/numbers, used in certificate numbers (e.g. AVBH)" required>
              <Input value={edit.short_code ?? ''} onChange={(e) => setEdit({ ...edit, short_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) })} />
            </Field>
            <Field label="Street address">
              <Input value={edit.address ?? ''} onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
            </Field>
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
              <Field label="City">
                <Input value={edit.city ?? ''} onChange={(e) => setEdit({ ...edit, city: e.target.value })} />
              </Field>
              <Field label="State">
                <Input value={edit.state ?? ''} onChange={(e) => setEdit({ ...edit, state: e.target.value })} maxLength={2} />
              </Field>
              <Field label="ZIP">
                <Input value={edit.zip ?? ''} onChange={(e) => setEdit({ ...edit, zip: e.target.value })} maxLength={10} />
              </Field>
            </div>
            <Field label="Phone">
              <Input value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </Field>
            <Check label="Active" checked={edit.active ?? true} onChange={(v) => setEdit({ ...edit, active: v })} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button loading={busy} onClick={save} icon={<Save className="h-4 w-4" />}>
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function Lists() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data = [], isLoading } = useLookups();
  const [cat, setCat] = useState<LookupCategory>('student_type');
  const [value, setValue] = useState('');
  const items = data.filter((d) => d.category === cat);

  async function run(fn: () => PromiseLike<{ error: unknown; data: unknown }>, msg?: string) {
    try {
      must(await fn(), 'lookup edit');
      await qc.invalidateQueries({ queryKey: ['lookups'] });
      if (msg) toast('success', msg);
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  function add() {
    const v = value.trim();
    if (!v) return;
    const max = Math.max(0, ...items.map((i) => i.sort_order));
    void run(() => supabase.from('lookup_values').insert({ category: cat, value: v, sort_order: max + 10 }), 'Added');
    setValue('');
  }

  function move(item: LookupValue, dir: -1 | 1) {
    const idx = items.findIndex((i) => i.id === item.id);
    const other = items[idx + dir];
    if (!other) return;
    void run(async () => {
      const a = await supabase.from('lookup_values').update({ sort_order: other.sort_order }).eq('id', item.id);
      if (a.error) return a;
      return supabase.from('lookup_values').update({ sort_order: item.sort_order === other.sort_order ? item.sort_order + dir : item.sort_order }).eq('id', other.id);
    });
  }

  function rename(item: LookupValue) {
    const v = prompt('Rename value (existing records keep the old text):', item.value)?.trim();
    if (v && v !== item.value) void run(() => supabase.from('lookup_values').update({ value: v }).eq('id', item.id), 'Renamed');
  }

  const meta = CATEGORIES.find((c) => c.id === cat)!;
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card>
        <nav className="-m-3 space-y-0.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${cat === c.id ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              {c.label}
              <span className="text-xs text-slate-400">{data.filter((d) => d.category === c.id && d.active).length}</span>
            </button>
          ))}
        </nav>
      </Card>
      <Card title={meta.label} subtitle={meta.help || 'Inactive values are hidden from forms but kept on existing records.'}>
        <div className="mb-4 flex gap-2">
          <Input placeholder={`Add to ${meta.label.toLowerCase()}…`} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} maxLength={120} />
          <Button icon={<Plus className="h-4 w-4" />} onClick={add}>
            Add
          </Button>
        </div>
        {isLoading ? (
          <Spinner />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {items.map((i, idx) => (
              <li key={i.id} className="flex items-center gap-2 px-3 py-2">
                <div className="flex flex-col">
                  <button className="text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={idx === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button className="text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={idx === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className={`flex-1 text-sm ${i.active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{i.value}</span>
                <Button size="sm" variant="ghost" onClick={() => rename(i)}>
                  Rename
                </Button>
                <Check label="Active" checked={i.active} onChange={(v) => void run(() => supabase.from('lookup_values').update({ active: v }).eq('id', i.id))} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CertSettings() {
  const current = useCertSettings();
  const qc = useQueryClient();
  const toast = useToast();
  const [s, setS] = useState<CertificateSettings>(current);
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(current), [current]);

  async function save() {
    setBusy(true);
    try {
      must(await supabase.from('app_settings').upsert({ key: 'certificate', value: { ...s, expiration_months: Math.min(60, Math.max(1, Number(s.expiration_months) || 12)) } }), 'save settings');
      await qc.invalidateQueries({ queryKey: ['settings'] });
      toast('success', 'Certificate settings saved');
    } catch (e) {
      toast('error', errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const sample = buildCertificateData({
    studentName: 'Jordan A. Example',
    facilityName: 'Arch Vista Behavioral Health',
    signerName: 'Instructor Name',
    certNumber: 'HWC-AVBH-2026-001234',
    settings: s,
    verifyCode: '0123456789abcdef',
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <Card title="Defaults for new certificates" actions={<Button size="sm" loading={busy} icon={<Save className="h-3.5 w-3.5" />} onClick={save}>Save</Button>}>
        <div className="space-y-4">
          <Field label="Certification valid for (months)" hint="HWC certifications expire one year from the training date by default.">
            <Input type="number" min={1} max={60} value={s.expiration_months} onChange={(e) => setS({ ...s, expiration_months: Number(e.target.value) })} />
          </Field>
          <Field label="Title under instructor name">
            <Input value={s.signer_title} onChange={(e) => setS({ ...s, signer_title: e.target.value })} />
          </Field>
          <Check label="Print the www.handlewithcare.com QR code on certificates" checked={s.show_qr} onChange={(v) => setS({ ...s, show_qr: v })} />
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            The suite issues one certificate design (HWC Basic Training) and one badge. Blank copies for hand-issued certificates:{' '}
            <a className="font-semibold text-brand-600 hover:underline" href={FILLABLE_CERT_PATH} download>
              fillable certificate (PDF)
            </a>{' '}
            ·{' '}
            <a className="font-semibold text-brand-600 hover:underline" href={BADGE_PNG_PATH} download>
              badge (PNG)
            </a>
          </div>
        </div>
      </Card>
      <Card title="Certificate (the only design)">
        <div className="rounded-lg bg-slate-100 p-3">
          <CertificatePreview data={sample} />
        </div>
      </Card>
    </div>
  );
}
