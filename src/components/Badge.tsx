import { forwardRef, useId, useRef, useState } from 'react';
import { Copy, Download, Mail, Share2 } from 'lucide-react';
import logoUrl from '../assets/hwc-logo.png?inline';
import { BRAND, downloadBadgePng, shareLinks, type ShareInput } from '../lib/certificate';
import { errMessage } from '../lib/errors';
import { Button, useToast } from './ui';

const HEAD = 'Montserrat, Inter, system-ui, sans-serif';

export interface BadgeProps {
  size?: number;
}

/** Five-point star centred on (x, y). */
function star(x: number, y: number, r: number): string {
  return Array.from({ length: 10 }, (_, k) => {
    const rad = k % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    return `${(x + rad * Math.cos(a)).toFixed(2)},${(y + rad * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

/** Ribbon tail (folded end) for side = -1 (left) or 1 (right). */
function tail(side: -1 | 1): string {
  const xin = side * 205;
  const xout = side * 261;
  return `${xin},114 ${xout},114 ${xout - side * 16},90 ${xout},66 ${xin},66`;
}

/**
 * The one and only digital badge: Handle With Care Basic Training — COMPLETED.
 * Identical to public/downloads/HWC_Basic_Training_Badge.png (navy ring, arc lettering,
 * HWC logo medallion, red ribbon). Drawn on a 600×600 viewBox centred at 0,0.
 */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge({ size = 300 }, ref) {
  const uid = useId().replace(/:/g, '');
  const top = `top-${uid}`;
  const bottom = `bot-${uid}`;
  return (
    <div ref={ref} style={{ width: size, height: size, display: 'inline-block' }} className="hwc-badge no-invert">
      <svg width={size} height={size} viewBox="-300 -300 600 600" role="img" aria-label="Handle With Care Basic Training completed badge">
        <defs>
          {/* top arc runs clockwise over the top; bottom arc runs left→right under the bottom so letters stay upright */}
          <path id={top} d="M -228 0 A 228 228 0 0 1 228 0" />
          <path id={bottom} d="M -252 0 A 252 252 0 0 0 252 0" />
        </defs>
        <circle r={285} fill={BRAND.navy} />
        <circle r={272} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.5} />
        <text fill="#ffffff" style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 34, letterSpacing: 3.5 }}>
          <textPath href={`#${top}`} startOffset="50%" textAnchor="middle">
            HANDLE WITH CARE
          </textPath>
        </text>
        <text fill="#ffffff" style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 28, letterSpacing: 4 }}>
          <textPath href={`#${bottom}`} startOffset="50%" textAnchor="middle">
            BASIC TRAINING
          </textPath>
        </text>
        <circle cx={-240} r={7} fill={BRAND.red} />
        <circle cx={240} r={7} fill={BRAND.red} />

        <circle r={196} fill="#ffffff" />
        <circle r={190} fill="none" stroke={BRAND.red} strokeWidth={6} />
        <image href={logoUrl} x={-75} y={-48 - 75} width={150} height={150} preserveAspectRatio="xMidYMid meet" />

        <polygon points={tail(-1)} fill={BRAND.redDark} />
        <polygon points={tail(1)} fill={BRAND.redDark} />
        <rect x={-215} y={52} width={430} height={56} fill={BRAND.red} />
        <text y={91} textAnchor="middle" fill="#ffffff" style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 31, letterSpacing: 6 }}>
          COMPLETED
        </text>

        <g fill={BRAND.navy}>
          <polygon points={star(-34, 152, 8)} />
          <polygon points={star(0, 152, 11)} />
          <polygon points={star(34, 152, 8)} />
        </g>
      </svg>
    </div>
  );
});

/** Badge preview + LinkedIn / social share actions. Used on the certificate page and the public badge page. */
export function BadgeShare({
  share,
  studentName,
  studentEmail,
  disabled,
  compact,
}: {
  share: ShareInput;
  studentName: string;
  studentEmail?: string | null;
  disabled?: boolean;
  compact?: boolean;
}) {
  const toast = useToast();
  const exportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const links = shareLinks(share);
  const year = share.issueDate.slice(0, 4);

  async function download() {
    if (!exportRef.current) return;
    setBusy(true);
    try {
      await downloadBadgePng(exportRef.current, `HWC-Badge-${studentName.replace(/[^a-z0-9]+/gi, '-')}-${year}.png`);
    } catch (e) {
      toast('error', 'Could not create the badge image: ' + errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const social = [
    { href: links.linkedinShare, label: 'LinkedIn post', bg: '#0a66c2' },
    { href: links.facebook, label: 'Facebook', bg: '#1877f2' },
    { href: links.x, label: 'X', bg: '#111111' },
  ];

  return (
    <div className={compact ? 'grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center' : 'space-y-5'}>
      <div className="flex justify-center">
        <Badge size={compact ? 180 : 260} />
      </div>
      <div className="space-y-3">
        <a href={disabled ? undefined : links.linkedinAdd} target="_blank" rel="noopener noreferrer" aria-disabled={disabled}>
          <button
            type="button"
            disabled={disabled}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            style={{ background: '#0a66c2' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
            </svg>
            Add to LinkedIn profile
          </button>
        </a>
        <div className="grid grid-cols-3 gap-2">
          {social.map((s) => (
            <a key={s.label} href={disabled ? undefined : s.href} target="_blank" rel="noopener noreferrer">
              <button type="button" disabled={disabled} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50" style={{ background: s.bg }}>
                <Share2 className="h-3.5 w-3.5" />
                {s.label}
              </button>
            </a>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} loading={busy} onClick={download}>
            Download badge (PNG)
          </Button>
          <Button size="sm" variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => navigator.clipboard.writeText(links.url).then(() => toast('success', 'Badge link copied'))}>
            Copy badge link
          </Button>
          {studentEmail !== undefined && (
            <a href={links.email(studentEmail ?? '')}>
              <Button size="sm" variant="secondary" icon={<Mail className="h-3.5 w-3.5" />}>
                Email to student
              </Button>
            </a>
          )}
        </div>
        <p className="text-xs text-slate-500">
          “Add to LinkedIn profile” opens LinkedIn's <em>Add licence or certification</em> form pre-filled with the credential name, issuer, dates, certificate ID and this verified badge link. For Instagram or other apps, download the badge image and attach it to a post.
        </p>
      </div>
      {/* Full-resolution copy for PNG export */}
      <div aria-hidden style={{ position: 'fixed', left: -12000, top: 0 }}>
        <Badge ref={exportRef} size={600} />
      </div>
    </div>
  );
}
