import { useEffect, useRef, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Eraser, PenLine, Type, UserCheck } from 'lucide-react';
import { trimCanvasToDataUrl, typedSignatureDataUrl } from '../lib/certificate';
import { Button, Input, cx } from './ui';

export type SignatureChoice =
  | { kind: 'saved'; id: string; dataUrl: string }
  | { kind: 'new'; dataUrl: string; source: 'drawn' | 'typed' }
  | { kind: 'none' };

interface Props {
  value: SignatureChoice;
  onChange: (v: SignatureChoice) => void;
  saved?: { id: string; dataUrl: string } | null;
  defaultTypedName?: string;
  /** Pre-select the saved signature when nothing is chosen yet (off when editing an already-signed certificate). */
  autoSelectSaved?: boolean;
}

/** Draw, type, or reuse a saved digital signature. */
export function SignatureField({ value, onChange, saved, defaultTypedName = '', autoSelectSaved = true }: Props) {
  const [mode, setMode] = useState<'saved' | 'draw' | 'type'>(saved && autoSelectSaved ? 'saved' : 'draw');
  const [typed, setTyped] = useState(defaultTypedName);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  useEffect(() => {
    if (saved && autoSelectSaved && value.kind === 'none') {
      setMode('saved');
      onChange({ kind: 'saved', id: saved.id, dataUrl: saved.dataUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id]);

  useEffect(() => {
    if (mode !== 'draw' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')!.scale(ratio, ratio);
    const pad = new SignaturePadLib(canvas, { penColor: '#14213d', minWidth: 0.8, maxWidth: 2.6 });
    pad.addEventListener('endStroke', () => {
      const url = trimCanvasToDataUrl(canvas);
      if (url) onChange({ kind: 'new', dataUrl: url, source: 'drawn' });
    });
    padRef.current = pad;
    return () => {
      pad.off();
      padRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function applyTyped(name: string) {
    setTyped(name);
    const url = await typedSignatureDataUrl(name);
    onChange(url ? { kind: 'new', dataUrl: url, source: 'typed' } : { kind: 'none' });
  }

  const tab = (m: typeof mode, label: string, icon: React.ReactNode, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setMode(m);
        if (m === 'saved' && saved) onChange({ kind: 'saved', id: saved.id, dataUrl: saved.dataUrl });
        if (m === 'type') void applyTyped(typed || defaultTypedName);
        if (m === 'draw') onChange({ kind: 'none' });
      }}
      className={cx(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40',
        mode === m ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900',
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-2 inline-flex rounded-lg bg-slate-100 p-1">
        {tab('saved', 'My saved', <UserCheck className="h-3.5 w-3.5" />, !saved)}
        {tab('draw', 'Draw', <PenLine className="h-3.5 w-3.5" />)}
        {tab('type', 'Type', <Type className="h-3.5 w-3.5" />)}
      </div>
      {mode === 'saved' && saved && (
        <div className="flex h-28 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <img src={saved.dataUrl} alt="Saved signature" className="max-h-20 max-w-[90%] object-contain" />
        </div>
      )}
      {mode === 'draw' && (
        <div>
          <canvas ref={canvasRef} className="h-28 w-full touch-none rounded-lg border border-dashed border-slate-300 bg-white" aria-label="Signature drawing area" />
          <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
            <span>Sign with your mouse, finger or stylus.</span>
            <Button
              size="sm"
              variant="ghost"
              icon={<Eraser className="h-3.5 w-3.5" />}
              onClick={() => {
                padRef.current?.clear();
                onChange({ kind: 'none' });
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
      {mode === 'type' && (
        <div className="space-y-2">
          <Input value={typed} onChange={(e) => void applyTyped(e.target.value)} placeholder="Type your full name" />
          <div className="flex h-20 items-center justify-center rounded-lg border border-slate-200 bg-white">
            {value.kind === 'new' && value.source === 'typed' ? <img src={value.dataUrl} alt="Typed signature" className="max-h-16 object-contain" /> : <span className="text-xs text-slate-400">Preview</span>}
          </div>
        </div>
      )}
    </div>
  );
}
