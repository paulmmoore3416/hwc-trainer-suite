import { Monitor, Moon, Sun } from 'lucide-react';
import { useColorMode, type ColorMode } from '../lib/theme';
import { cx } from './ui';

const OPTIONS: { id: ColorMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

/** Light / Dark / System switch. */
export function ThemeToggle({ className, onDark }: { className?: string; onDark?: boolean }) {
  const { mode, setMode } = useColorMode();
  return (
    <div role="radiogroup" aria-label="Color theme" className={cx('inline-flex rounded-lg p-0.5', onDark ? 'bg-white/10' : 'bg-slate-100', className)}>
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="radio"
          aria-checked={mode === id}
          title={`${label} mode`}
          onClick={() => setMode(id)}
          className={cx(
            'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition',
            mode === id ? (onDark ? 'bg-white/20 text-white' : 'bg-white text-slate-900 shadow-sm') : onDark ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
