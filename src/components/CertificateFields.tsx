import { Plus, Trash2 } from 'lucide-react';
import { addMonths, today } from '../lib/format';
import { LAYOUTS, THEMES, THEME_GROUPS } from '../lib/certificate';
import { supabase } from '../lib/supabase';
import { must } from '../lib/errors';
import type { CertLayout, CertTheme, CertificateSettings, Personnel, Profile } from '../lib/types';
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
  layout: CertLayout;
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
    layout: settings.default_layout ?? 'classic',
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
        <div className="label">Certificate type</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {LAYOUTS.map((l) => (
            <button
              type="button"
              key={l.id}
              onClick={() => set('layout', l.id)}
              className={cx(
                'rounded-lg border p-2 text-left transition',
                value.layout === l.id ? 'border-brand-800 bg-brand-50 ring-1 ring-brand-800' : 'border-slate-200 hover:border-slate-300',
              )}
            >
              <LayoutThumb layout={l.id} theme={value.theme} />
              <div className="mt-1.5 text-xs font-semibold text-slate-800">{l.label}</div>
              <div className="text-[11px] leading-tight text-slate-500">{l.description}</div>
            </button>
          ))}
        </div>
      </div>

      <ThemePicker value={value.theme} onChange={(v) => set('theme', v)} />

      <div>
        <div className="label">Digital signature</div>
        {existingSignatureUrl && value.signature.kind === 'none' && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            <img src={existingSignatureUrl} alt="Current signature" className="paper h-10 rounded bg-white object-contain px-1" /> Current signature is kept unless you choose a new one.
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

/** Tiny schematic of each layout, tinted with the chosen theme. */
export function LayoutThumb({ layout, theme }: { layout: CertLayout; theme: string }) {
  const t = THEMES[theme] ?? THEMES.navy;
  return (
    <svg viewBox="0 0 110 85" className="w-full rounded border border-slate-200" style={{ background: t.paper }} aria-hidden>
      {layout === 'modern' ? (
        <>
          <rect width="30" height="85" fill={t.primary} />
          <rect x="30" width="2" height="85" fill={t.secondary} />
          <circle cx="15" cy="18" r="7" fill={t.accent} />
          <rect x="40" y="14" width="40" height="5" fill={t.secondary} />
          <rect x="40" y="22" width="52" height="7" fill={t.primary} />
          <rect x="40" y="38" width="58" height="3" fill={t.accent} />
          <rect x="40" y="48" width="18" height="5" rx="2.5" fill={t.secondary} />
          <rect x="61" y="48" width="18" height="5" rx="2.5" fill={t.secondary} />
          <rect x="40" y="68" width="22" height="1.5" fill={t.primary} />
          <rect x="72" y="68" width="26" height="1.5" fill={t.primary} />
        </>
      ) : layout === 'heritage' ? (
        <>
          <rect x="3" y="3" width="104" height="79" fill="none" stroke={t.primary} strokeWidth="2.5" />
          <rect x="7" y="7" width="96" height="71" fill="none" stroke={t.accent} strokeWidth="0.8" />
          <path d="M10 18V10H18M100 18V10H92M10 67V75H18M100 67V75H92" fill="none" stroke={t.accent} strokeWidth="1.4" />
          <rect x="35" y="14" width="40" height="3" fill={t.secondary} />
          <rect x="25" y="20" width="60" height="6" fill={t.primary} />
          <rect x="30" y="38" width="50" height="5" fill={t.ink} opacity="0.7" />
          <circle cx="55" cy="64" r="7" fill={t.accent} />
          <rect x="16" y="66" width="22" height="1.5" fill={t.primary} />
          <rect x="72" y="66" width="22" height="1.5" fill={t.primary} />
        </>
      ) : (
        <>
          <polygon points="0,0 22,0 0,22" fill={t.primary} />
          <polygon points="25,0 30,0 0,30 0,25" fill={t.secondary} />
          <polygon points="110,85 95,85 110,70" fill={t.primary} />
          <rect x="30" y="12" width="50" height="6" fill={t.primary} />
          <rect x="33" y="22" width="44" height="5" fill={t.primary} />
          <circle cx="94" cy="18" r="7" fill={t.accent} />
          <rect x="30" y="38" width="50" height="5" fill={t.ink} opacity="0.7" />
          <rect x="16" y="66" width="24" height="1.5" fill={t.primary} />
          <rect x="70" y="66" width="24" height="1.5" fill={t.primary} />
        </>
      )}
    </svg>
  );
}

/** 27 colour & style themes, grouped. */
export function ThemePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = THEMES[value] ?? THEMES.navy;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="label mb-0">Colors & style (27)</span>
        <span className="text-xs text-slate-500">
          {current.label} · {current.pattern === 'none' ? 'plain paper' : `${current.pattern} texture`}
        </span>
      </div>
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
        {THEME_GROUPS.map((g) => (
          <div key={g}>
            <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{g}</div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {Object.entries(THEMES)
                .filter(([, th]) => th.group === g)
                .map(([k, th]) => (
                  <button
                    type="button"
                    key={k}
                    title={th.label}
                    onClick={() => onChange(k)}
                    className={cx(
                      'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition',
                      value === k ? 'border-brand-800 bg-brand-50 ring-1 ring-brand-800' : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <span className="flex shrink-0 overflow-hidden rounded ring-1 ring-black/10">
                      <span className="h-5 w-2.5" style={{ background: th.primary }} />
                      <span className="h-5 w-2.5" style={{ background: th.secondary }} />
                      <span className="h-5 w-2.5" style={{ background: th.accent }} />
                    </span>
                    <span className="truncate text-slate-700">{th.label}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
