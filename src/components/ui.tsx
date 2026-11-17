import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-800 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-sm',
  ghost: 'text-slate-700 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  success: 'bg-teal-brand text-white hover:brightness-110 shadow-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, className, required }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('input', props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx('input', props.className)} />;
}
export function Select({ options, placeholder, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options: (string | { value: string; label: string })[]; placeholder?: string }) {
  return (
    <select {...props} className={cx('input', props.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) =>
        typeof o === 'string' ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

/** Text input with suggestions from an editable list (free text still allowed). */
export function Combo({ list, id, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'list'> & { list: string[]; id: string }) {
  return (
    <>
      <input {...props} list={`${id}-list`} className={cx('input', props.className)} autoComplete="off" />
      <datalist id={`${id}-list`}>
        {list.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </>
  );
}

export function Check({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700', disabled && 'opacity-60')}>
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-brand-800" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Card({ title, actions, children, className, subtitle }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-800 text-white shadow">{icon}</div>}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'teal' | 'violet' | 'orange';
const TONES: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  green: 'bg-green-50 text-green-800 ring-green-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-blue-50 text-blue-800 ring-blue-200',
  teal: 'bg-teal-50 text-teal-800 ring-teal-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  orange: 'bg-orange-50 text-orange-800 ring-orange-200',
};
export function Badge({ tone = 'gray', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', TONES[tone])}>
      {icon}
      {children}
    </span>
  );
}

/** Certification status badge — status colour always paired with an icon and a label. */
export function CertBadge({ status }: { status: 'valid' | 'current' | 'expiring' | 'expired' | 'revoked' | 'none' }) {
  switch (status) {
    case 'valid':
    case 'current':
      return <Badge tone="green" icon={<CheckCircle2 className="h-3 w-3" />}>Current</Badge>;
    case 'expiring':
      return <Badge tone="amber" icon={<AlertTriangle className="h-3 w-3" />}>Expiring</Badge>;
    case 'expired':
      return <Badge tone="red" icon={<XCircle className="h-3 w-3" />}>Expired</Badge>;
    case 'revoked':
      return <Badge tone="gray" icon={<XCircle className="h-3 w-3" />}>Revoked</Badge>;
    default:
      return <Badge tone="gray">Not certified</Badge>;
  }
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">{icon}</div>}
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-[8vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal className={cx('w-full rounded-2xl bg-white shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2.5 text-sm text-slate-600">
      <span>
        {from}–{to} of {total.toLocaleString()}
      </span>
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-print mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition',
            value === t.id ? 'border-brand-800 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- toasts
type Toast = { id: number; kind: 'success' | 'error' | 'info'; text: string };
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg',
              t.kind === 'success' && 'border-green-200 bg-white text-green-900',
              t.kind === 'error' && 'border-red-200 bg-white text-red-900',
              t.kind === 'info' && 'border-slate-200 bg-white text-slate-800',
            )}
          >
            {t.kind === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : t.kind === 'error' ? <XCircle className="h-4 w-4 shrink-0 text-red-600" /> : <Info className="h-4 w-4 shrink-0 text-slate-500" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

export function Stat({ label, value, sub, icon, tone = 'brand' }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: 'brand' | 'teal' | 'gold' | 'red' | 'green' | 'slate' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    teal: 'bg-teal-50 text-teal-700',
    gold: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    green: 'bg-green-50 text-green-700',
    slate: 'bg-slate-100 text-slate-600',
  } as const;
  return (
    <div className="card flex items-start gap-3 p-4">
      {icon && <div className={cx('rounded-xl p-2.5', tones[tone])}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}
