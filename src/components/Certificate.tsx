import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import QRCode from 'qrcode';
import { CERT_HEIGHT, CERT_WIDTH, THEMES, verifyUrl, type CertificateData } from '../lib/certificate';
import { fmtDate } from '../lib/format';

const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const SCRIPT = '"Great Vibes", "Brush Script MT", cursive';
const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

function starPoints(cx: number, cy: number, outer: number, inner: number, n: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function CheckBox({ checked, color }: { checked: boolean; color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" style={{ display: 'inline-block', verticalAlign: '-4px', marginRight: 8 }}>
      <rect x="1.5" y="1.5" width="19" height="19" rx="3" fill="none" stroke={color} strokeWidth="2" />
      {checked && <path d="M5.5 11.5l3.6 3.6 7.4-8.2" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** The student certificate, drawn at a fixed 1100×850 (11×8.5in) canvas. Original design — not a copy of HWC artwork. */
export const Certificate = forwardRef<HTMLDivElement, { data: CertificateData }>(function Certificate({ data }, ref) {
  const t = THEMES[data.theme] ?? THEMES.navy;
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (data.showQr && data.verifyCode) {
      QRCode.toDataURL(verifyUrl(data.verifyCode), { margin: 0, width: 220, errorCorrectionLevel: 'M', color: { dark: t.primary, light: '#ffffff00' } })
        .then((url) => alive && setQr(url))
        .catch(() => alive && setQr(null));
    } else setQr(null);
    return () => {
      alive = false;
    };
  }, [data.showQr, data.verifyCode, t.primary]);

  const programs = [data.programVerbal && 'Verbal', data.programPhysical && 'Physical'].filter(Boolean);
  const name = data.studentName || 'Student Name';
  const nameSize = name.length > 34 ? 46 : name.length > 26 ? 56 : 66;
  const facility = data.facilityName || 'Facility Name';

  const abs = (s: CSSProperties): CSSProperties => ({ position: 'absolute', ...s });

  return (
    <div
      ref={ref}
      className="hwc-certificate"
      style={{
        position: 'relative',
        width: CERT_WIDTH,
        height: CERT_HEIGHT,
        background: t.paper,
        color: t.ink,
        overflow: 'hidden',
        fontFamily: SERIF,
        boxSizing: 'border-box',
      }}
    >
      {/* Background art: borders, corner ribbons, watermark, seal */}
      <svg width={CERT_WIDTH} height={CERT_HEIGHT} viewBox={`0 0 ${CERT_WIDTH} ${CERT_HEIGHT}`} style={abs({ inset: 0 })} aria-hidden>
        <defs>
          <pattern id="hwc-weave" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="14" stroke={t.secondary} strokeWidth="0.6" opacity="0.07" />
          </pattern>
          <radialGradient id="hwc-glow" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor={t.paper} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={CERT_WIDTH} height={CERT_HEIGHT} fill="url(#hwc-weave)" />
        <rect width={CERT_WIDTH} height={CERT_HEIGHT} fill="url(#hwc-glow)" />

        {/* Watermark shield */}
        <g opacity="0.045" transform="translate(550 470)">
          <path d="M0 -190 L160 -130 L160 10 C160 120 80 180 0 210 C-80 180 -160 120 -160 10 L-160 -130 Z" fill={t.primary} />
        </g>

        {/* Frames */}
        <rect x="22" y="22" width={CERT_WIDTH - 44} height={CERT_HEIGHT - 44} fill="none" stroke={t.primary} strokeWidth="3" />
        <rect x="32" y="32" width={CERT_WIDTH - 64} height={CERT_HEIGHT - 64} fill="none" stroke={t.accent} strokeWidth="1.2" />

        {/* Corner ribbons — top-left */}
        <polygon points="0,0 228,0 0,228" fill={t.primary} />
        <polygon points="252,0 302,0 0,302 0,252" fill={t.secondary} />
        <polygon points="320,0 330,0 0,330 0,320" fill={t.accent} />
        {/* Corner ribbons — bottom-right (smaller so the personnel block stays clear) */}
        <polygon points={`${CERT_WIDTH},${CERT_HEIGHT} ${CERT_WIDTH - 150},${CERT_HEIGHT} ${CERT_WIDTH},${CERT_HEIGHT - 150}`} fill={t.primary} />
        <polygon
          points={`${CERT_WIDTH - 168},${CERT_HEIGHT} ${CERT_WIDTH - 200},${CERT_HEIGHT} ${CERT_WIDTH},${CERT_HEIGHT - 200} ${CERT_WIDTH},${CERT_HEIGHT - 168}`}
          fill={t.secondary}
        />
        <polygon
          points={`${CERT_WIDTH - 213},${CERT_HEIGHT} ${CERT_WIDTH - 220},${CERT_HEIGHT} ${CERT_WIDTH},${CERT_HEIGHT - 220} ${CERT_WIDTH},${CERT_HEIGHT - 213}`}
          fill={t.accent}
        />

        {/* Seal — top right */}
        <g transform="translate(948 168)">
          <polygon points="-34,40 -58,128 -34,112 -18,136 -4,52" fill={t.secondary} />
          <polygon points="34,40 58,128 34,112 18,136 4,52" fill={t.primary} />
          <polygon points={starPoints(0, 0, 70, 61, 30)} fill={t.accent} />
          <circle r="54" fill={t.paper} />
          <circle r="49" fill="none" stroke={t.accent} strokeWidth="2" />
          <circle r="44" fill="none" stroke={t.accent} strokeWidth="0.8" strokeDasharray="2 3" />
          <path d="M0 -30 L24 -21 L24 -1 C24 16 12 25 0 30 C-12 25 -24 16 -24 -1 L-24 -21 Z" fill={t.primary} />
          <path d="M-11 0 L-3 8 L12 -9" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>

      {/* Title block */}
      <div style={abs({ left: 0, right: 0, top: 78, textAlign: 'center' })}>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 70, lineHeight: 1, color: t.primary, letterSpacing: 0.5 }}>
          Handle With Care
        </div>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 22, letterSpacing: 7, marginTop: 12, color: t.secondary }}>
          BEHAVIOR MANAGEMENT SYSTEM
        </div>
      </div>

      {/* Banner */}
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

      {/* Recipient */}
      <div style={abs({ left: 120, right: 120, top: 286, textAlign: 'center' })}>
        <div style={{ fontStyle: 'italic', fontSize: 22, color: '#55565c' }}>This certificate is proudly awarded to</div>
        <div
          style={{
            fontFamily: SCRIPT,
            fontSize: nameSize,
            lineHeight: '96px',
            height: 96,
            marginTop: 6,
            color: data.studentName ? t.ink : '#b9b9be',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
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

      {/* Date block */}
      <div style={abs({ left: 120, top: 616, width: 300, textAlign: 'center' })}>
        <div style={{ fontSize: 26, fontWeight: 600, height: 52, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>
          {fmtDate(data.issueDate, 'long')}
        </div>
        <div style={{ height: 1.5, background: t.primary }} />
        <div style={{ fontFamily: SANS, fontSize: 11.5, letterSpacing: 2, marginTop: 7, color: '#4a4b52', fontWeight: 600 }}>DATE OF TRAINING</div>
        <div style={{ fontFamily: SANS, fontSize: 12, marginTop: 6, color: '#55565c' }}>
          Certification valid through <strong style={{ color: t.ink }}>{fmtDate(data.expirationDate, 'long')}</strong>
        </div>
        {programs.length === 0 && (
          <div style={{ fontFamily: SANS, fontSize: 11, marginTop: 4, color: '#b3263a' }}>Select at least one program</div>
        )}
      </div>

      {/* QR + number */}
      <div style={abs({ left: 445, top: 616, width: 190, textAlign: 'center', fontFamily: SANS })}>
        {data.showQr && (
          <div style={{ width: 78, height: 78, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.accent}`, padding: 5, background: '#fff' }}>
            {qr ? (
              <img src={qr} width={66} height={66} alt="" />
            ) : (
              <div style={{ fontSize: 9, color: '#9a9aa0', lineHeight: 1.2 }}>QR code after saving</div>
            )}
          </div>
        )}
        <div style={{ fontSize: 10, marginTop: 7, color: '#4a4b52', fontWeight: 600, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
          {data.certNumber ? `No. ${data.certNumber}` : 'No. assigned on save'}
        </div>
        {data.showQr && <div style={{ fontSize: 9, marginTop: 2, color: '#77787e' }}>Scan to verify</div>}
      </div>

      {/* Signature + personnel block */}
      <div style={abs({ left: 650, top: 588, width: 280, textAlign: 'center' })}>
        <div style={{ height: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2 }}>
          {data.signatureDataUrl ? (
            <img src={data.signatureDataUrl} alt="Signature" style={{ maxHeight: 76, maxWidth: 270, objectFit: 'contain' }} />
          ) : (
            <span style={{ fontFamily: SANS, fontSize: 11, color: '#b9b9be' }}>Signature</span>
          )}
        </div>
        <div style={{ height: 1.5, background: t.primary }} />
        <div style={{ fontFamily: SANS, fontSize: 11.5, letterSpacing: 2, marginTop: 7, color: '#4a4b52', fontWeight: 600 }}>
          {data.signerTitle.toUpperCase()}
        </div>
        <div style={{ fontFamily: SANS, marginTop: 6, lineHeight: 1.35 }}>
          {data.signerName && <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{data.signerName}</div>}
          {data.instructorCertNumber && (
            <div style={{ fontSize: 11.5, color: '#55565c' }}>HWC Instructor Cert. #{data.instructorCertNumber}</div>
          )}
          {data.personnel.map((p, i) => (
            <div key={i} style={{ fontSize: 11.5, color: '#55565c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ color: t.ink, fontWeight: 600 }}>{p.name}</span>
              {p.name && p.title ? ' — ' : ''}
              {p.title}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={abs({ left: 0, right: 0, bottom: 42, textAlign: 'center', fontFamily: SANS, fontSize: 10, letterSpacing: 1.5, color: '#77787e' })}>
        {data.footerText.toUpperCase()}
      </div>
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
    const ro = new ResizeObserver(() => setScale(el.clientWidth / CERT_WIDTH));
    ro.observe(el);
    setScale(el.clientWidth / CERT_WIDTH);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrap} className={className} style={{ width: '100%', height: CERT_HEIGHT * scale, position: 'relative' }}>
      <div
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}
        className="shadow-xl ring-1 ring-black/10"
      >
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
