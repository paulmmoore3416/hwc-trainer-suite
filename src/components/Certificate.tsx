import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import QRCode from 'qrcode';
import logoUrl from '../assets/hwc-logo.png?inline';
import { BRAND, CERT_HEIGHT, CERT_WIDTH, HWC_SITE_LABEL, HWC_SITE_URL, completionText, type CertificateData } from '../lib/certificate';
import { fmtDate } from '../lib/format';

/*
 * The one and only certificate design: Handle With Care Basic Training — Certificate of Completion.
 * Matches the issued fillable PDF (public/downloads/HWC_Basic_Training_Certificate_Fillable.pdf):
 *   • navy side panel with the HWC logo seal top-left and a QR code to www.handlewithcare.com
 *   • title, red program rule, trainee name, completion sentence
 *   • completion date / valid until / instructor
 *   • trainee and instructor names, each with a signature line beneath
 * Rendered on a fixed 1100×850 canvas (11×8.5 in at 100 px/in). Coordinates below are the PDF's
 * point positions × (1100 / 792), so screen, print and PDF export line up with the fillable form.
 */

const HEAD = 'Montserrat, Inter, system-ui, sans-serif';
const BODY = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const W = CERT_WIDTH;
const H = CERT_HEIGHT;
const K = W / 792; // PDF point → canvas px

const SB = 222 * K; // side panel width
const X0 = 274 * K; // content left edge
const CW = 462 * K; // content width
const SIG_W = 207 * K; // signature column width
const SIG_X2 = 529 * K; // second signature column

/** pt-from-bottom (PDF) → px-from-top (canvas) */
const Y = (pt: number) => (612 - pt) * K;

/** QR code for the HWC website (fixed URL, navy modules on transparent). */
function useSiteQr() {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(HWC_SITE_URL, { margin: 0, width: 400, errorCorrectionLevel: 'M', color: { dark: BRAND.navy, light: '#ffffff00' } })
      .then((u) => alive && setQr(u))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, []);
  return qr;
}

/**
 * Single-line text that shrinks to fit its box, so long names are never clipped.
 * Re-measures after web fonts load because Montserrat metrics differ from the fallback.
 */
function FitText({ text, max, min, width, style }: { text: string; max: number; min: number; width: number; style: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(max);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let s = max;
      el.style.fontSize = `${s}px`;
      // compare against clientWidth (both are rounded integers) — comparing to the fractional
      // `width` prop would always report overflow by a sub-pixel and shrink to `min`
      while (el.scrollWidth > el.clientWidth && s > min) {
        s -= 0.5;
        el.style.fontSize = `${s}px`;
      }
      setSize(s);
    };
    fit();
    let alive = true;
    document.fonts?.ready.then(() => alive && fit());
    return () => {
      alive = false;
    };
  }, [text, max, min, width]);
  return (
    <div ref={ref} style={{ ...style, width, fontSize: size, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {text}
    </div>
  );
}

const abs = (s: CSSProperties): CSSProperties => ({ position: 'absolute', ...s });

/** The student certificate. Instructor certificates are intentionally not supported. */
export const Certificate = forwardRef<HTMLDivElement, { data: CertificateData }>(function Certificate({ data }, ref) {
  const qr = useSiteQr();
  const name = data.studentName || 'Trainee Name';
  const noProgram = !data.programVerbal && !data.programPhysical;
  const sideCx = SB / 2;
  const qs = 96 * K; // QR size
  const qTop = Y(162);

  const sentence = completionText(data.programVerbal, data.programPhysical);

  return (
    <div
      ref={ref}
      className="hwc-certificate"
      style={{ position: 'relative', width: W, height: H, background: BRAND.paper, color: BRAND.ink, overflow: 'hidden', fontFamily: BODY, boxSizing: 'border-box' }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={abs({ inset: 0 })} aria-hidden>
        {/* faint logo watermark behind the content */}
        <image href={logoUrl} x={757 - 270} y={436 - 298} width={540} height={597} opacity={0.045} preserveAspectRatio="xMidYMid meet" />

        {/* side panel + red edge */}
        <rect x={0} y={0} width={SB} height={H} fill={BRAND.navy} />
        <rect x={SB} y={0} width={4 * K} height={H} fill={BRAND.red} />

        {/* logo seal, top-left */}
        <circle cx={sideCx} cy={Y(484)} r={82 * K} fill="none" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={7 * K} />
        <circle cx={sideCx} cy={Y(484)} r={72 * K} fill="#ffffff" />
        <image href={logoUrl} x={sideCx - 60} y={Y(484) - 66.5} width={120} height={133} preserveAspectRatio="xMidYMid meet" />

        <text x={sideCx} y={Y(368)} textAnchor="middle" fill="#ffffff" style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 10.5 * K, letterSpacing: 1.6 * K }}>
          HANDLE WITH CARE
        </text>
        <text x={sideCx} y={Y(353)} textAnchor="middle" fill="#ffffff" fillOpacity={0.65} style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 8 * K, letterSpacing: 2.2 * K }}>
          BASIC TRAINING
        </text>
        <line x1={sideCx - 18 * K} x2={sideCx + 18 * K} y1={Y(338)} y2={Y(338)} stroke={BRAND.red} strokeWidth={1.5 * K} />

        {/* QR code → www.handlewithcare.com */}
        {data.showQr && (
          <>
            <rect x={sideCx - qs / 2 - 8 * K} y={qTop - 8 * K} width={qs + 16 * K} height={qs + 16 * K} rx={6 * K} fill="#ffffff" />
            {qr && <image href={qr} x={sideCx - qs / 2} y={qTop} width={qs} height={qs} />}
            <text x={sideCx} y={Y(42)} textAnchor="middle" fill="#ffffff" fillOpacity={0.6} style={{ fontFamily: BODY, fontSize: 7.5 * K }}>
              {HWC_SITE_LABEL}
            </text>
          </>
        )}

        {/* title block */}
        <text x={X0} y={Y(500)} fill={BRAND.navy} style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 30 * K }}>
          CERTIFICATE OF COMPLETION
        </text>
        <rect x={X0} y={Y(483)} width={46 * K} height={3 * K} fill={BRAND.red} />
        <text x={X0 + 58 * K} y={Y(478)} fill={BRAND.red} style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 10 * K, letterSpacing: 2 * K }}>
          HANDLE WITH CARE {' · '} BASIC TRAINING
        </text>

        <text x={X0} y={Y(402)} fill={BRAND.ink} style={{ fontFamily: BODY, fontSize: 11 * K }}>
          This certificate confirms that
        </text>
        <line x1={X0} x2={X0 + CW} y1={Y(346)} y2={Y(346)} stroke={BRAND.rule} strokeWidth={0.8 * K} />

        {/* signature lines */}
        {[
          [X0, 'Trainee Signature'],
          [SIG_X2, 'Certified Instructor Signature'],
        ].map(([x, label]) => (
          <g key={label as string}>
            <line x1={x as number} x2={(x as number) + SIG_W} y1={Y(92)} y2={Y(92)} stroke={BRAND.navy} strokeWidth={0.8 * K} />
            <text x={x as number} y={Y(81)} fill={BRAND.muted} style={{ fontFamily: BODY, fontSize: 7.5 * K }}>
              {label}
            </text>
          </g>
        ))}
        <text x={X0} y={Y(135)} fill={BRAND.muted} style={{ fontFamily: BODY, fontSize: 8.5 * K }}>
          Trainee
        </text>
        <text x={SIG_X2} y={Y(135)} fill={BRAND.muted} style={{ fontFamily: BODY, fontSize: 8.5 * K }}>
          {data.signerTitle}
        </text>

        {/* instructor's digital signature sits on the instructor line; trainee signs by hand */}
        {data.signatureDataUrl && (
          <image href={data.signatureDataUrl} x={SIG_X2 + 4} y={Y(92) - 54} width={SIG_W - 8} height={50} preserveAspectRatio="xMinYMax meet" />
        )}

        <text x={X0 + CW} y={Y(30)} textAnchor="end" fill="#6b727f" fillOpacity={0.85} style={{ fontFamily: BODY, fontSize: 7 * K }}>
          {data.footerText}
        </text>
      </svg>

      {/* trainee name (auto-fits so it is always fully visible) */}
      <FitText
        text={name}
        max={36}
        min={18}
        width={CW}
        style={abs({ left: X0, top: Y(390), height: Y(348) - Y(390), display: 'flex', alignItems: 'flex-end', fontFamily: HEAD, fontWeight: 700, lineHeight: 1.15, color: data.studentName ? BRAND.navy : '#b9b9be' })}
      />

      {/* completion sentence */}
      <div style={abs({ left: X0, top: Y(322) - 11.5 * K, width: CW, fontSize: 10.5 * K, lineHeight: `${15.5 * K}px`, color: BRAND.ink })}>
        {sentence}
        {noProgram && <div style={{ fontSize: 11, color: BRAND.red, marginTop: 2 }}>Select at least one program</div>}
      </div>

      {/* detail grid: label + value on a hairline */}
      {(
        [
          [X0, 253.5, CW / 2 - 14 * K, 'Completion date:', fmtDate(data.issueDate, 'long')],
          [X0 + CW / 2 + 10 * K, 253.5, CW / 2 - 10 * K, 'Valid until:', fmtDate(data.expirationDate, 'long')],
          [X0, 225.5, CW / 2 - 14 * K, 'Instructor:', data.signerName],
        ] as const
      ).map(([x, pt, w, label, value]) => (
        <div key={label} style={abs({ left: x, top: Y(pt) - 15, width: w, height: 19, display: 'flex', alignItems: 'flex-end', gap: 6 })}>
          <span style={{ fontSize: 10 * K, color: BRAND.muted, whiteSpace: 'nowrap', lineHeight: 1 }}>{label}</span>
          <span style={{ flex: 1, minWidth: 0, borderBottom: `${0.6 * K}px solid ${BRAND.rule}`, paddingBottom: 3, paddingLeft: 3, fontSize: 10.5 * K, fontWeight: 700, color: BRAND.navy, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value || '\u00A0'}
          </span>
        </div>
      ))}

      {/* printed names above each signature line */}
      <FitText text={name} max={16} min={10} width={SIG_W} style={abs({ left: X0, top: Y(166), fontFamily: HEAD, fontWeight: 700, color: data.studentName ? BRAND.navy : '#b9b9be' })} />
      <FitText text={data.signerName || 'Instructor Name'} max={16} min={10} width={SIG_W} style={abs({ left: SIG_X2, top: Y(166), fontFamily: HEAD, fontWeight: 700, color: data.signerName ? BRAND.navy : '#b9b9be' })} />
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
