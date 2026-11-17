import { Plus, Trash2 } from 'lucide-react';
import { addMonths, today } from '../lib/format';
import { THEMES } from '../lib/certificate';
import { supabase } from '../lib/supabase';
import { must } from '../lib/errors';
import type { CertTheme, CertificateSettings, Personnel, Profile } from '../lib/types';
import { SignatureField, type SignatureChoice } from './SignaturePad';
import { Button, Check, Field, Input, cx } from './ui';

export interface CertFormState {
  programVerbal: boolean;
  programPhysical: boolean;
  programLabel: string;
  issueDate: string;
  expirationDate: string;
  expirationTouched: boolean;
  theme: CertTheme;
  signerName: string;
  signerTitle: string;
  instructorCertNumber: string;
  personnel: Personnel[];
  signature: SignatureChoice;
}

/** Defaults auto-filled from the signed-in instructor's profile and the suite's certificate settings. */
export function initialCertForm(profile: Profile | null, settings: CertificateSettings): CertFormState {
  const issue = today();
  return {
    programVerbal: true,
    programPhysical: true,
    programLabel: settings.program_label,
    issueDate: issue,
    expirationDate: addMonths(issue, settings.expiration_months),
    expirationTouched: false,
    theme: settings.default_theme,
    signerName: profile?.full_name ?? '',
    signerTitle: settings.signer_title,
    instructorCertNumber: profile?.hwc_cert_number ?? '',
    personnel: [],
    signature: { kind: 'none' },
  };
}

/** Persist a newly drawn/typed signature (or reuse the saved one). Returns the signature id. */
export async function resolveSignatureId(choice: SignatureChoice): Promise<string | null> {
  if (choice.kind === 'saved') return choice.id;
  if (choice.kind === 'new') {
    const row = must(await supabase.from('signatures').insert({ data_url: choice.dataUrl, kind: choice.source }).select('id').single(), 'save signature');
    return (row as { id: string }).id;
  }
  return null;
}

export function signatureDataUrl(choice: SignatureChoice): string | null {
  return choice.kind === 'none' ? null : choice.dataUrl;
}

interface Props {
  value: CertFormState;
  onChange: (v: CertFormState) => void;
  settings: CertificateSettings;
  savedSignature?: { id: string; dataUrl: string } | null;
  existingSignatureUrl?: string | null;
}

export function CertificateFields({ value, onChange, settings, savedSignature, existingSignatureUrl }: Props) {
  const set = <K extends keyof CertFormState>(k: K, v: CertFormState[K]) => onChange({ ...value, [k]: v });

  function setIssue(d: string) {
    onChange({ ...value, issueDate: d, expirationDate: value.expirationTouched ? value.expirationDate : addMonths(d, settings.expiration_months) });
  }

  function setPerson(i: number, patch: Partial<Personnel>) {
    const next = value.personnel.map((p, j) => (j === i ? { ...p, ...patch } : p));
    set('personnel', next);
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="label">Program completed</div>
        <div className="flex flex-wrap gap-5">
          <Check label="Verbal Program" checked={value.programVerbal} onChange={(v) => set('programVerbal', v)} />
          <Check label="Physical Program" checked={value.programPhysical} onChange={(v) => set('programPhysical', v)} />
        </div>
        {!value.programVerbal && !value.programPhysical && <p className="mt-1 text-xs text-red-600">Select at least one program.</p>}
      </div>
      <Field label="Program title on certificate">
        <Input value={value.programLabel} onChange={(e) => set('programLabel', e.target.value)} maxLength={80} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Training date" required>
          <Input type="date" value={value.issueDate} onChange={(e) => setIssue(e.target.value)} required />
        </Field>
        <Field label="Valid through" hint={value.expirationTouched ? 'Manually set' : `Auto: ${settings.expiration_months} months`}>
          <Input type="date" value={value.expirationDate} onChange={(e) => onChange({ ...value, expirationDate: e.target.value, expirationTouched: true })} />
        </Field>
      </div>

      <div>
        <div className="label">Certificate colors</div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(THEMES) as CertTheme[]).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => set('theme', k)}
              className={cx(
                'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition',
                value.theme === k ? 'border-brand-800 bg-brand-50 ring-1 ring-brand-800' : 'border-slate-200 hover:border-slate-300',
              )}
            >
              <span className="flex overflow-hidden rounded">
                <span className="h-5 w-3" style={{ background: THEMES[k].primary }} />
                <span className="h-5 w-3" style={{ background: THEMES[k].secondary }} />
                <span className="h-5 w-3" style={{ background: THEMES[k].accent }} />
              </span>
              {THEMES[k].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="label">Digital signature</div>
        {existingSignatureUrl && value.signature.kind === 'none' && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            <img src={existingSignatureUrl} alt="Current signature" className="h-10 bg-white object-contain" /> Current signature is kept unless you choose a new one.
          </div>
        )}
        <SignatureField value={value.signature} onChange={(s) => set('signature', s)} saved={savedSignature} defaultTypedName={value.signerName} autoSelectSaved={!existingSignatureUrl} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="mb-3 text-xs font-semibold tracking-wide text-slate-600 uppercase">Under the signature</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Instructor name">
            <Input value={value.signerName} onChange={(e) => set('signerName', e.target.value)} maxLength={80} />
          </Field>
          <Field label="Signature line title">
            <Input value={value.signerTitle} onChange={(e) => set('signerTitle', e.target.value)} maxLength={60} />
          </Field>
          <Field label="HWC instructor cert #" className="sm:col-span-2">
            <Input value={value.instructorCertNumber} onChange={(e) => set('instructorCertNumber', e.target.value)} maxLength={40} placeholder="Optional" />
          </Field>
        </div>
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-slate-600">Additional personnel (co-instructors, training coordinator, administrator…)</div>
          {value.personnel.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Name" value={p.name} onChange={(e) => setPerson(i, { name: e.target.value })} maxLength={60} />
              <Input placeholder="Title / role" value={p.title} onChange={(e) => setPerson(i, { title: e.target.value })} maxLength={60} />
              <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => set('personnel', value.personnel.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          ))}
          {value.personnel.length < 4 && (
            <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => set('personnel', [...value.personnel, { name: '', title: '' }])}>
              Add personnel line
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
