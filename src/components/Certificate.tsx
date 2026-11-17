import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { CERT_HEIGHT, CERT_WIDTH, themeOf, verifyUrl, type CertificateData, type Pattern, type ThemeSpec } from '../lib/certificate';
import { fmtDate } from '../lib/format';

/*
 * Student completion certificates — three original layouts (Classic Ribbon, Modern Panel, Heritage Formal),
 * each rendered at a fixed 1100×850 (11×8.5in) canvas in any of the 27 colour & style themes.
 * None of these reproduce HWC logo artwork.
 */

const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const SCRIPT = '"Great Vibes", "Brush Script MT", cursive';
const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const W = CERT_WIDTH;
const H = CERT_HEIGHT;
const abs = (s: CSSProperties): CSSProperties => ({ position: 'absolute', ...s });

export function starPoints(cx: number, cy: number, outer: number, inner: number, n: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Background texture — the "style" half of each colour & style theme. */
function PatternDefs({ id, pattern, color }: { id: string; pattern: Pattern; color: string }) {
  const o = 0.08;
  switch (pattern) {
    case 'dots':
      return (
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="1.1" fill={color} opacity={o + 0.04} />
        </pattern>
      );
    case 'linen':
      return (
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 3H6M3 0V6" stroke={color} strokeWidth="0.4" opacity={o} />
        </pattern>
      );
    case 'grid':
      return (
        <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M22 0H0V22" fill="none" stroke={color} strokeWidth="0.5" opacity={o} />
        </pattern>
      );
    case 'waves':
      return (
        <pattern id={id} width="40" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 7 Q10 0 20 7 T40 7" fill="none" stroke={color} strokeWidth="0.7" opacity={o} />
        </pattern>
      );
    case 'diamond':
      return (
        <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0H18M0 0V18" fill="none" stroke={color} strokeWidth="0.5" opacity={o} />
        </pattern>
      );
    case 'weave':
      return (
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="14" stroke={color} strokeWidth="0.6" opacity={o - 0.01} />
        </pattern>
      );
    default:
      return null;
  }
}

function Paper({ t, themeId }: { t: ThemeSpec; themeId: string }) {
  const pid = `hwc-pat-${themeId}`;
  return (
    <>
      <defs>
        <PatternDefs id={pid} pattern={t.pattern} color={t.secondary} />
        <radialGradient id={`hwc-glow-${themeId}`} cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor={t.paper} stopOpacity="0" />
        </radialGradient>
      </defs>
      {t.pattern !== 'none' && <rect width={W} height={H} fill={`url(#${pid})`} />}
      <rect width={W} height={H} fill={`url(#hwc-glow-${themeId})`} />
    </>
  );
}

/** Rosette seal with a shield-and-check emblem (original artwork). */
export function Seal({ t, x, y, scale = 1, ribbons = true }: { t: ThemeSpec; x: number; y: number; scale?: number; ribbons?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {ribbons && (
        <>
          <polygon points="-34,40 -58,128 -34,112 -18,136 -4,52" fill={t.secondary} />
          <polygon points="34,40 58,128 34,112 18,136 4,52" fill={t.primary} />
        </>
      )}
      <polygon points={starPoints(0, 0, 70, 61, 30)} fill={t.accent} />
      <circle r="54" fill={t.paper} />
      <circle r="49" fill="none" stroke={t.accent} strokeWidth="2" />
      <circle r="44" fill="none" stroke={t.accent} strokeWidth="0.8" strokeDasharray="2 3" />
      <path d="M0 -30 L24 -21 L24 -1 C24 16 12 25 0 30 C-12 25 -24 16 -24 -1 L-24 -21 Z" fill={t.primary} />
      <path d="M-11 0 L-3 8 L12 -9" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function CheckBox({ checked, color, size = 22 }: { checked: boolean; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" style={{ display: 'inline-block', verticalAlign: '-4px', marginRight: 8 }}>
      <rect x="1.5" y="1.5" width="19" height="19" rx="3" fill="none" stroke={color} strokeWidth="2" />
      {checked && <path d="M5.5 11.5l3.6 3.6 7.4-8.2" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function useQr(data: CertificateData, color: string) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (data.showQr && data.verifyCode) {
      QRCode.toDataURL(verifyUrl(data.verifyCode), { margin: 0, width: 220, errorCorrectionLevel: 'M', color: { dark: color, light: '#ffffff00' } })
        .then((url) => alive && setQr(url))
        .catch(() => alive && setQr(null));
    } else setQr(null);
    return () => {
      alive = false;
    };
  }, [data.showQr, data.verifyCode, color]);
  return qr;
}

function QrBox({ qr, t, size = 66, onDark = false }: { qr: string | null; t: ThemeSpec; size?: number; onDark?: boolean }) {
  return (
    <div style={{ width: size + 12, height: size + 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${onDark ? '#ffffff55' : t.accent}`, padding: 5, background: '#fff', boxSizing: 'border-box' }}>
      {qr ? <img src={qr} width={size} height={size} alt="" /> : <div style={{ fontFamily: SANS, fontSize: 9, color: '#9a9aa0', lineHeight: 1.2, textAlign: 'center' }}>QR code after saving</div>}
    </div>
  );
}

function certNo(data: CertificateData) {
  return data.certNumber ? `No. ${data.certNumber}` : 'No. assigned on save';
}

/** Signature image, line, title and the editable personnel block. */
function SignatureBlock({ data, t, width, align = 'center' }: { data: CertificateData; t: ThemeSpec; width: number; align?: 'center' | 'left' }) {
  return (
    <div style={{ width, textAlign: align }}>
      <div style={{ height: 80, display: 'flex', alignItems: 'flex-end', justifyContent: align === 'center' ? 'center' : 'flex-start', paddingBottom: 2 }}>
        {data.signatureDataUrl ? (
          <img src={data.signatureDataUrl} alt="Signature" style={{ maxHeight: 76, maxWidth: width - 10, objectFit: 'contain' }} />
        ) : (
          <span style={{ fontFamily: SANS, fontSize: 11, color: '#b9b9be' }}>Signature</span>
        )}
      </div>
      <div style={{ height: 1.5, background: t.primary }} />
      <div style={{ fontFamily: SANS, fontSize: 11.5, letterSpacing: 2, marginTop: 7, color: '#4a4b52', fontWeight: 600 }}>{data.signerTitle.toUpperCase()}</div>
      <div style={{ fontFamily: SANS, marginTop: 6, lineHeight: 1.35 }}>
        {data.signerName && <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{data.signerName}</div>}
        {data.instructorCertNumber && <div style={{ fontSize: 11.5, color: '#55565c' }}>HWC Instructor Cert. #{data.instructorCertNumber}</div>}
        {data.personnel.map((p, i) => (
          <div key={i} style={{ fontSize: 11.5, color: '#55565c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ color: t.ink, fontWeight: 600 }}>{p.name}</span>
            {p.name && p.title ? ' — ' : ''}
            {p.title}
          </div>
        ))}
      </div>
    </div>
  );
}

function DateBlock({ data, t, width, align = 'center', label = 'DATE OF TRAINING' }: { data: CertificateData; t: ThemeSpec; width: number; align?: 'center' | 'left'; label?: string }) {
  const none = !data.programVerbal && !data.programPhysical;
  return (
    <div style={{ width, textAlign: align }}>
      <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, height: 52, display: 'flex', alignItems: 'flex-end', justifyContent: align === 'center' ? 'center' : 'flex-start', paddingBottom: 4, color: t.ink }}>
        {fmtDate(data.issueDate, 'long')}
      </div>
      <div style={{ height: 1.5, background: t.primary }} />
      <div style={{ fontFamily: SANS, fontSize: 11.5, letterSpacing: 2, marginTop: 7, color: '#4a4b52', fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: SANS, fontSize: 12, marginTop: 6, color: '#55565c' }}>
        Certification valid through <strong style={{ color: t.ink }}>{fmtDate(data.expirationDate, 'long')}</strong>
      </div>
      {none && <div style={{ fontFamily: SANS, fontSize: 11, marginTop: 4, color: '#b3263a' }}>Select at least one program</div>}
    </div>
  );
}

/** Script-name sizing that always fits the available width (Great Vibes averages ~0.44em per character). */
function nameStyle(data: CertificateData, t: ThemeSpec, base = 66, maxWidth = 860): CSSProperties {
  const name = data.studentName || 'Student Name';
  const size = Math.max(34, Math.min(base, Math.floor(maxWidth / (name.length * 0.44))));
  return { fontFamily: SCRIPT, fontSize: size, lineHeight: '96px', height: 96, color: data.studentName ? t.ink : '#b9b9be', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
}

function Frame({ data, children, svg }: { data: CertificateData; children: ReactNode; svg: ReactNode }) {
  const t = themeOf(data.theme);
  return (
    <div
      className="hwc-certificate"
      style={{ position: 'relative', width: W, height: H, background: t.paper, color: t.ink, overflow: 'hidden', fontFamily: SERIF, boxSizing: 'border-box' }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={abs({ inset: 0 })} aria-hidden>
        <Paper t={t} themeId={data.theme} />
        {svg}
      </svg>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ Classic Ribbon
function ClassicLayout({ data }: { data: CertificateData }) {
  const t = themeOf(data.theme);
  const qr = useQr(data, t.primary);
  const facility = data.facilityName || 'Facility Name';
  return (
    <Frame
      data={data}
      svg={
        <>
          <g opacity="0.045" transform="translate(550 470)">
            <path d="M0 -190 L160 -130 L160 10 C160 120 80 180 0 210 C-80 180 -160 120 -160 10 L-160 -130 Z" fill={t.primary} />
          </g>
          <rect x="22" y="22" width={W - 44} height={H - 44} fill="none" stroke={t.primary} strokeWidth="3" />
          <rect x="32" y="32" width={W - 64} height={H - 64} fill="none" stroke={t.accent} strokeWidth="1.2" />
          <polygon points="0,0 228,0 0,228" fill={t.primary} />
          <polygon points="252,0 302,0 0,302 0,252" fill={t.secondary} />
          <polygon points="320,0 330,0 0,330 0,320" fill={t.accent} />
          <polygon points={`${W},${H} ${W - 150},${H} ${W},${H - 150}`} fill={t.primary} />
          <polygon points={`${W - 168},${H} ${W - 200},${H} ${W},${H - 200} ${W},${H - 168}`} fill={t.secondary} />
          <polygon points={`${W - 213},${H} ${W - 220},${H} ${W},${H - 220} ${W},${H - 213}`} fill={t.accent} />
          <Seal t={t} x={948} y={168} />
        </>
      }
    >
      <div style={abs({ left: 0, right: 0, top: 78, textAlign: 'center' })}>
        <div style={{ fontStyle: 'italic', fontWeight: 600, fontSize: 70, lineHeight: 1, color: t.primary, letterSpacing: 0.5 }}>Handle With Care</div>
        <div style={{ fontWeight: 600, fontSize: 22, letterSpacing: 7, marginTop: 12, color: t.secondary }}>BEHAVIOR MANAGEMENT SYSTEM</div>
      </div>
      <div style={abs({ left: 0, right: 0, top: 210, display: 'flex', justifyContent: 'center' })}>
        <svg width="620" height="50" viewBox="0 0 620 50" aria-hidden>
          <polygon points="0,6 26,25 0,44 60,44 60,6" fill={t.secondary} opacity="0.9" />
          <polygon points="620,6 594,25 620,44 560,44 560,6" fill={t.secondary} opacity="0.9" />
          <rect x="40" y="0" width="540" height="50" fill={t.primary} />
          <text x="310" y="32" textAnchor="middle" fill="#ffffff" style={{ fontFamily: SANS, fontWeight: 600, fontSize: 18, letterSpacing: 6 }}>
            CERTIFICATE OF COMPLETION
          </text>
        </svg>
      </div>
      <div style={abs({ left: 120, right: 120, top: 286, textAlign: 'center' })}>
        <div style={{ fontStyle: 'italic', fontSize: 22, color: '#55565c' }}>This certificate is proudly awarded to</div>
        <div style={{ ...nameStyle(data, t), marginTop: 6 }}>{data.studentName || 'Student Name'}</div>
        <div style={{ height: 1.5, background: t.accent, width: 600, margin: '0 auto' }} />
        <div style={{ fontSize: 22, marginTop: 16, color: '#3b3c42' }}>
          for successful completion of the Handle With Care <span style={{ fontWeight: 700 }}>{data.programLabel}</span>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 17, marginTop: 16, color: t.ink, display: 'flex', justifyContent: 'center', gap: 34, alignItems: 'center' }}>
          <span>
            <CheckBox checked={data.programVerbal} color={t.primary} />
            Verbal Program
          </span>
          <span>
            <CheckBox checked={data.programPhysical} color={t.primary} />
            Physical Program
          </span>
        </div>
        <div style={{ fontSize: 26, marginTop: 14, color: t.primary }}>
          <span style={{ fontStyle: 'italic', color: '#55565c', fontSize: 22 }}>at </span>
          <span style={{ fontWeight: 700, color: data.facilityName ? t.primary : '#b9b9be' }}>{facility}</span>
        </div>
      </div>
      <div style={abs({ left: 120, top: 616 })}>
        <DateBlock data={data} t={t} width={300} />
      </div>
      <div style={abs({ left: 445, top: 616, width: 190, textAlign: 'center', fontFamily: SANS })}>
        {data.showQr && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <QrBox qr={qr} t={t} />
          </div>
        )}
        <div style={{ fontSize: 10, marginTop: 7, color: '#4a4b52', fontWeight: 600, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>{certNo(data)}</div>
        {data.showQr && <div style={{ fontSize: 9, marginTop: 2, color: '#77787e' }}>Scan to verify</div>}
      </div>
      <div style={abs({ left: 650, top: 588 })}>
        <SignatureBlock data={data} t={t} width={280} />
      </div>
      <div style={abs({ left: 0, right: 0, bottom: 42, textAlign: 'center', fontFamily: SANS, fontSize: 10, letterSpacing: 1.5, color: '#77787e' })}>{data.footerText.toUpperCase()}</div>
    </Frame>
  );
}

// ------------------------------------------------------------------------------------------------ Modern Panel
function ProgramPill({ on, label, t }: { on: boolean; label: string; t: ThemeSpec }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 16px 7px 10px',
        borderRadius: 999,
        fontFamily: SANS,
        fontSize: 15,
        fontWeight: 600,
        background: on ? t.secondary : 'transparent',
        color: on ? '#ffffff' : '#9a9aa0',
        border: `1.5px solid ${on ? t.secondary : '#cfd0d4'}`,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="8" fill={on ? '#ffffff' : 'none'} stroke={on ? 'none' : '#cfd0d4'} strokeWidth="1.5" />
        {on && <path d="M5 9.4l2.6 2.6L13 6.4" fill="none" stroke={t.secondary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {label}
    </span>
  );
}

function ModernLayout({ data }: { data: CertificateData }) {
  const t = themeOf(data.theme);
  const qr = useQr(data, t.primary);
  const facility = data.facilityName || 'Facility Name';
  const panel = 300;
  return (
    <Frame
      data={data}
      svg={
        <>
          <rect x="0" y="0" width={panel} height={H} fill={t.primary} />
          <rect x={panel} y="0" width="12" height={H} fill={t.secondary} />
          <rect x={panel + 18} y="0" width="3" height={H} fill={t.accent} />
          {/* subtle diagonal sheen on the panel */}
          <polygon points={`0,${H} ${panel},${H - 260} ${panel},${H} `} fill="#ffffff" opacity="0.05" />
          <polygon points={`0,0 ${panel},0 0,260`} fill="#ffffff" opacity="0.04" />
          <rect x={panel + 40} y="26" width={W - panel - 66} height={H - 52} fill="none" stroke={t.primary} strokeWidth="1.2" opacity="0.5" />
          <g transform={`translate(${panel / 2} 165)`}>
            <circle r="78" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1" />
            <Seal t={{ ...t, paper: '#ffffff' }} x={0} y={0} scale={0.95} ribbons={false} />
          </g>
          <g opacity="0.06" transform="translate(720 470)">
            <path d="M0 -170 L140 -115 L140 10 C140 105 70 160 0 185 C-70 160 -140 105 -140 10 L-140 -115 Z" fill={t.primary} />
          </g>
        </>
      }
    >
      {/* Panel text */}
      <div style={abs({ left: 0, width: panel, top: 270, textAlign: 'center', color: '#ffffff', fontFamily: SANS })}>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 7, lineHeight: 1.25 }}>
          HANDLE
          <br />
          WITH
          <br />
          CARE
        </div>
        <div style={{ width: 60, height: 2, background: t.accent, margin: '18px auto' }} />
        <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.8, lineHeight: 1.6 }}>
          BEHAVIOR
          <br />
          MANAGEMENT SYSTEM
        </div>
      </div>
      <div style={abs({ left: 0, width: panel, bottom: 52, textAlign: 'center', fontFamily: SANS, color: '#ffffff' })}>
        {data.showQr && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <QrBox qr={qr} t={t} size={70} onDark />
          </div>
        )}
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{certNo(data)}</div>
        {data.showQr && <div style={{ fontSize: 9.5, opacity: 0.75, marginTop: 2 }}>Scan to verify</div>}
      </div>

      {/* Content */}
      <div style={abs({ left: 390, right: 70, top: 76 })}>
        <div style={{ fontFamily: SANS, fontSize: 19, fontWeight: 700, letterSpacing: 11, color: t.secondary }}>CERTIFICATE</div>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 64, lineHeight: 1.05, color: t.primary }}>of Completion</div>
        <div style={{ width: 130, height: 4, background: t.accent, marginTop: 16, borderRadius: 2 }} />
        <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: 4, color: '#77787e', marginTop: 30 }}>PROUDLY PRESENTED TO</div>
        <div style={{ ...nameStyle(data, t, 64, 630), marginTop: 2 }}>{data.studentName || 'Student Name'}</div>
        <div style={{ height: 1.5, background: t.accent, width: 560 }} />
        <div style={{ fontFamily: SERIF, fontSize: 20, marginTop: 16, color: '#3b3c42', maxWidth: 640 }}>
          for successfully completing the Handle With Care <span style={{ fontWeight: 700 }}>{data.programLabel}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <ProgramPill on={data.programVerbal} label="Verbal Program" t={t} />
          <ProgramPill on={data.programPhysical} label="Physical Program" t={t} />
        </div>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: 3, color: '#77787e', marginTop: 22 }}>TRAINING FACILITY</div>
        <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: data.facilityName ? t.primary : '#b9b9be', lineHeight: 1.2 }}>{facility}</div>
      </div>
      <div style={abs({ left: 390, top: 620 })}>
        <DateBlock data={data} t={t} width={270} align="left" />
      </div>
      <div style={abs({ left: 720, top: 592 })}>
        <SignatureBlock data={data} t={t} width={300} align="left" />
      </div>
      <div style={abs({ left: 390, right: 70, bottom: 40, fontFamily: SANS, fontSize: 10, letterSpacing: 1.5, color: '#77787e' })}>{data.footerText.toUpperCase()}</div>
    </Frame>
  );
}

// ------------------------------------------------------------------------------------------------ Heritage Formal
function CornerFlourish({ x, y, sx, sy, t }: { x: number; y: number; sx: 1 | -1; sy: 1 | -1; t: ThemeSpec }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${sx} ${sy})`} fill="none" stroke={t.accent} strokeLinecap="round">
      <path d="M0 70 L0 0 L70 0" strokeWidth="2.2" />
      <path d="M10 70 L10 10 L70 10" strokeWidth="0.9" />
      <path d="M18 46 C18 26 26 18 46 18" strokeWidth="1.4" />
      <path d="M18 34 C26 34 34 26 34 18" strokeWidth="1" />
      <rect x="22" y="22" width="9" height="9" transform="rotate(45 26.5 26.5)" fill={t.accent} stroke="none" />
      <circle cx="56" cy="18" r="2.2" fill={t.secondary} stroke="none" />
      <circle cx="18" cy="56" r="2.2" fill={t.secondary} stroke="none" />
    </g>
  );
}

function Divider({ t, width = 260 }: { t: ThemeSpec; width?: number }) {
  const h = width / 2;
  return (
    <svg width={width} height="18" viewBox={`0 0 ${width} 18`} aria-hidden style={{ display: 'block', margin: '0 auto' }}>
      <line x1="0" y1="9" x2={h - 22} y2="9" stroke={t.accent} strokeWidth="1.2" />
      <line x1={h + 22} y1="9" x2={width} y2="9" stroke={t.accent} strokeWidth="1.2" />
      <rect x={h - 6} y="3" width="12" height="12" transform={`rotate(45 ${h} 9)`} fill={t.accent} />
      <circle cx={h - 16} cy="9" r="2.5" fill={t.secondary} />
      <circle cx={h + 16} cy="9" r="2.5" fill={t.secondary} />
    </svg>
  );
}

function HeritageLayout({ data }: { data: CertificateData }) {
  const t = themeOf(data.theme);
  const qr = useQr(data, t.primary);
  const facility = data.facilityName || 'Facility Name';
  return (
    <Frame
      data={data}
      svg={
        <>
          <rect x="20" y="20" width={W - 40} height={H - 40} fill="none" stroke={t.primary} strokeWidth="7" />
          <rect x="33" y="33" width={W - 66} height={H - 66} fill="none" stroke={t.accent} strokeWidth="1.6" />
          <rect x="41" y="41" width={W - 82} height={H - 82} fill="none" stroke={t.primary} strokeWidth="0.8" />
          <CornerFlourish x={52} y={52} sx={1} sy={1} t={t} />
          <CornerFlourish x={W - 52} y={52} sx={-1} sy={1} t={t} />
          <CornerFlourish x={52} y={H - 52} sx={1} sy={-1} t={t} />
          <CornerFlourish x={W - 52} y={H - 52} sx={-1} sy={-1} t={t} />
          <g opacity="0.05">
            <circle cx={W / 2} cy={430} r="210" fill="none" stroke={t.primary} strokeWidth="26" />
          </g>
          <Seal t={t} x={W / 2} y={676} scale={0.92} ribbons={false} />
        </>
      }
    >
      <div style={abs({ left: 0, right: 0, top: 78, textAlign: 'center' })}>
        <div style={{ fontWeight: 600, fontSize: 21, letterSpacing: 9, color: t.secondary }}>HANDLE WITH CARE</div>
        <div style={{ fontStyle: 'italic', fontWeight: 600, fontSize: 62, lineHeight: 1.1, color: t.primary, marginTop: 4 }}>Certificate of Completion</div>
        <div style={{ marginTop: 10 }}>
          <Divider t={t} width={300} />
        </div>
        <div style={{ fontVariant: 'small-caps', fontSize: 19, letterSpacing: 4, color: '#55565c', marginTop: 8 }}>Behavior Management System</div>
      </div>
      <div style={abs({ left: 130, right: 130, top: 262, textAlign: 'center' })}>
        <div style={{ fontStyle: 'italic', fontSize: 22, color: '#55565c' }}>This is to certify that</div>
        <div style={{ ...nameStyle(data, t, 68, 820), marginTop: 2 }}>{data.studentName || 'Student Name'}</div>
        <Divider t={t} width={560} />
        <div style={{ fontSize: 22, marginTop: 12, color: '#3b3c42' }}>
          has fulfilled every requirement of the Handle With Care <span style={{ fontWeight: 700 }}>{data.programLabel}</span>
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 20, marginTop: 12, color: t.ink, display: 'flex', justifyContent: 'center', gap: 30, alignItems: 'center' }}>
          <span>
            <CheckBox checked={data.programVerbal} color={t.primary} size={20} />
            Verbal Program
          </span>
          <span style={{ color: t.accent }}>✦</span>
          <span>
            <CheckBox checked={data.programPhysical} color={t.primary} size={20} />
            Physical Program
          </span>
        </div>
        <div style={{ fontSize: 26, marginTop: 10 }}>
          <span style={{ fontStyle: 'italic', color: '#55565c', fontSize: 22 }}>at </span>
          <span style={{ fontWeight: 700, color: data.facilityName ? t.primary : '#b9b9be' }}>{facility}</span>
        </div>
      </div>
      <div style={abs({ left: 110, top: 586 })}>
        <DateBlock data={data} t={t} width={300} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontFamily: SANS }}>
          {data.showQr && <QrBox qr={qr} t={t} size={46} />}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#4a4b52', whiteSpace: 'nowrap' }}>{certNo(data)}</div>
            {data.showQr && <div style={{ fontSize: 9, color: '#77787e' }}>Scan to verify</div>}
          </div>
        </div>
      </div>
      <div style={abs({ left: 690, top: 562 })}>
        <SignatureBlock data={data} t={t} width={300} />
      </div>
      <div style={abs({ left: 0, right: 0, bottom: 58, textAlign: 'center', fontFamily: SANS, fontSize: 9.5, letterSpacing: 1.5, color: '#77787e' })}>{data.footerText.toUpperCase()}</div>
    </Frame>
  );
}

/** The student certificate in the chosen layout. Instructor certificates are intentionally not supported. */
export const Certificate = forwardRef<HTMLDivElement, { data: CertificateData }>(function Certificate({ data }, ref) {
  return (
    <div ref={ref} style={{ width: W, height: H }}>
      {data.layout === 'modern' ? <ModernLayout data={data} /> : data.layout === 'heritage' ? <HeritageLayout data={data} /> : <ClassicLayout data={data} />}
    </div>
  );
});

/** Scales the fixed-size certificate to fit its container width (for previews). */
export function CertificatePreview({ data, className }: { data: CertificateData; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el);
    setScale(el.clientWidth / W);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrap} className={className} style={{ width: '100%', height: H * scale, position: 'relative' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }} className="shadow-xl ring-1 ring-black/10">
        <Certificate data={data} />
      </div>
    </div>
  );
}

/** Off-screen full-size render used for PDF export. */
export const CertificateExportHost = forwardRef<HTMLDivElement, { data: CertificateData }>(function CertificateExportHost({ data }, ref) {
  return (
    <div aria-hidden style={{ position: 'fixed', left: -12000, top: 0, pointerEvents: 'none' }}>
      <Certificate ref={ref} data={data} />
    </div>
  );
});
