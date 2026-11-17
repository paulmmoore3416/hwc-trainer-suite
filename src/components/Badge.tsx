import { forwardRef, useId, useRef, useState } from 'react';
import { Copy, Download, Mail, Share2 } from 'lucide-react';
import { downloadBadgePng, shareLinks, themeOf, type ShareInput, type ThemeSpec } from '../lib/certificate';
import type { CertLayout } from '../lib/types';
import { errMessage } from '../lib/errors';
import { Button, useToast } from './ui';
import { starPoints } from './Certificate';

const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS = 'Inter, system-ui, sans-serif';

export interface BadgeProps {
  theme: string;
  layout: CertLayout;
  verbal: boolean;
  physical: boolean;
  year: string;
  size?: number;
}

function ShieldCheck({ t, y, s = 1, fill }: { t: ThemeSpec; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(0 ${y}) scale(${s})`}>
      <path d="M0 -30 L24 -21 L24 -1 C24 16 12 25 0 30 C-12 25 -24 16 -24 -1 L-24 -21 Z" fill={fill ?? t.primary} />
      <path d="M-11 0 L-3 8 L12 -9" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function programLine(v: boolean, p: boolean) {
  return v && p ? 'VERBAL • PHYSICAL' : v ? 'VERBAL PROGRAM' : p ? 'PHYSICAL PROGRAM' : 'PROGRAM';
}

function hex(r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/** Digital badge artwork (square). Shape follows the certificate layout; colours follow its theme. */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge({ theme, layout, verbal, physical, year, size = 300 }, ref) {
  const t = themeOf(theme);
  const uid = useId().replace(/:/g, '');
  const ringId = `ring-${uid}`;
  const prog = programLine(verbal, physical);

  let art: React.ReactNode;
  if (layout === 'modern') {
    art = (
      <>
        <polygon points={hex(282)} fill={t.primary} />
        <polygon points={hex(262)} fill="none" stroke={t.accent} strokeWidth="5" />
        <polygon points={hex(244)} fill={t.paper} />
        <ShieldCheck t={t} y={-150} s={1.35} />
        <text y={-82} textAnchor="middle" fill={t.primary} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: 6 }}>
          HANDLE WITH CARE
        </text>
        <polygon points="-300,-42 300,-42 276,0 300,42 -300,42 -276,0" fill={t.secondary} />
        <polygon points="-300,-42 -255,-42 -255,42 -300,42 -276,0" fill={t.primary} opacity="0.35" />
        <polygon points="300,-42 255,-42 255,42 300,42 276,0" fill={t.primary} opacity="0.35" />
        <text y={17} textAnchor="middle" fill="#ffffff" style={{ fontFamily: SANS, fontWeight: 800, fontSize: 52, letterSpacing: 9 }}>
          CERTIFIED
        </text>
        <text y={90} textAnchor="middle" fill={t.ink} style={{ fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: 4 }}>
          {prog}
        </text>
        <rect x={-46} y={112} width={92} height={3} fill={t.accent} />
        <text y={170} textAnchor="middle" fill={t.primary} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 46 }}>
          {year}
        </text>
      </>
    );
  } else if (layout === 'heritage') {
    const shield = 'M0 -278 L232 -196 L232 18 C232 172 116 250 0 284 C-116 250 -232 172 -232 18 L-232 -196 Z';
    art = (
      <>
        <path d={shield} fill={t.primary} />
        <path d={shield} transform="scale(0.9)" fill="none" stroke={t.accent} strokeWidth="5" />
        <path d={shield} transform="scale(0.82)" fill={t.paper} />
        {[-1, 1].map((d) => (
          <g key={d} transform={`scale(${d} 1)`}>
            {Array.from({ length: 7 }, (_, i) => {
              const deg = i * 14;
              const a = deg * (Math.PI / 180);
              const x = 118 * Math.cos(a);
              const y = 128 + 82 * Math.sin(a);
              return <ellipse key={i} cx={x} cy={y} rx="15" ry="6.5" transform={`rotate(${deg - 70} ${x} ${y})`} fill={t.accent} opacity="0.9" />;
            })}
          </g>
        ))}
        <text y={-150} textAnchor="middle" fill={t.secondary} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 28, letterSpacing: 5 }}>
          HANDLE WITH CARE
        </text>
        <text y={-112} textAnchor="middle" fill={t.accent} style={{ fontSize: 22 }}>
          ✦ ✦ ✦
        </text>
        <polygon points="-280,-48 280,-48 252,-4 280,40 -280,40 -252,-4" fill={t.secondary} />
        <text y={10} textAnchor="middle" fill="#ffffff" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 56, letterSpacing: 8 }}>
          CERTIFIED
        </text>
        <text y={82} textAnchor="middle" fill={t.ink} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, letterSpacing: 4 }}>
          {prog}
        </text>
        <text y={150} textAnchor="middle" fill={t.primary} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 46 }}>
          {year}
        </text>
      </>
    );
  } else {
    art = (
      <>
        <polygon points="-120,170 -190,292 -140,272 -112,300 -60,190" fill={t.secondary} />
        <polygon points="120,170 190,292 140,272 112,300 60,190" fill={t.primary} />
        <polygon points={starPoints(0, -20, 262, 240, 40)} fill={t.accent} />
        <circle cy={-20} r="226" fill={t.primary} />
        <circle cy={-20} r="212" fill="none" stroke={t.accent} strokeWidth="3" />
        <defs>
          <path id={ringId} d="M -176 -20 A 176 176 0 1 1 176 -20 A 176 176 0 1 1 -176 -20" />
        </defs>
        <text fill="#ffffff" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 24 }}>
          <textPath href={`#${ringId}`} startOffset="0" textLength={1080} lengthAdjust="spacing">
            HANDLE WITH CARE • BEHAVIOR MANAGEMENT SYSTEM • CERTIFIED •
          </textPath>
        </text>
        <circle cy={-20} r="145" fill={t.paper} />
        <circle cy={-20} r="136" fill="none" stroke={t.accent} strokeWidth="1.5" strokeDasharray="3 4" />
        <ShieldCheck t={t} y={-92} s={1.15} />
        <text y={-12} textAnchor="middle" fill={t.primary} style={{ fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: 4 }}>
          CERTIFIED
        </text>
        <text y={24} textAnchor="middle" fill={t.secondary} style={{ fontFamily: SANS, fontWeight: 600, fontSize: 17, letterSpacing: 3 }}>
          {prog}
        </text>
        <text y={68} textAnchor="middle" fill={t.ink} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 34 }}>
          {year}
        </text>
      </>
    );
  }

  return (
    <div ref={ref} style={{ width: size, height: size, display: 'inline-block' }} className="hwc-badge">
      <svg width={size} height={size} viewBox="-300 -300 600 600" role="img" aria-label={`Handle With Care certified badge ${year}`}>
        {art}
      </svg>
    </div>
  );
});

/** Badge preview + LinkedIn / social share actions. Used on the certificate page and the public badge page. */
export function BadgeShare({
  share,
  theme,
  layout,
  studentName,
  studentEmail,
  disabled,
  compact,
}: {
  share: ShareInput;
  theme: string;
  layout: CertLayout;
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
        <Badge theme={theme} layout={layout} verbal={share.programVerbal} physical={share.programPhysical} year={year} size={compact ? 180 : 260} />
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
        <Badge ref={exportRef} theme={theme} layout={layout} verbal={share.programVerbal} physical={share.programPhysical} year={year} size={600} />
      </div>
    </div>
  );
}
