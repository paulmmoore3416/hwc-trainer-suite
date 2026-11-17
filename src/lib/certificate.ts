import type { CertTheme, CertificateSettings, Personnel } from './types';
import { addMonths, today } from './format';
import { appBaseUrl } from './config';

export const CERT_WIDTH = 1100; // 11in @ 100px/in
export const CERT_HEIGHT = 850; // 8.5in

export interface ThemeSpec {
  label: string;
  primary: string; // ribbons, title, banner
  secondary: string; // second ribbon band, subtitle
  accent: string; // seal, fine rules
  paper: string;
  ink: string;
}

export const THEMES: Record<CertTheme, ThemeSpec> = {
  navy: { label: 'Navy & Teal', primary: '#1f2a44', secondary: '#1f8a8a', accent: '#c29a2c', paper: '#fffdf7', ink: '#1d1d22' },
  archvista: { label: 'Arch Vista Blue & Green', primary: '#3f6fa6', secondary: '#8ab85a', accent: '#6f7a86', paper: '#fcfdfb', ink: '#1f2933' },
  crimson: { label: 'Crimson & Charcoal', primary: '#2c2c31', secondary: '#b3263a', accent: '#c29a2c', paper: '#fffcf8', ink: '#1d1d22' },
  forest: { label: 'Forest & Gold', primary: '#1e3d2f', secondary: '#5f8f45', accent: '#c29a2c', paper: '#fdfcf6', ink: '#1b241f' },
};

export const DEFAULT_CERT_SETTINGS: CertificateSettings = {
  expiration_months: 12,
  default_theme: 'navy',
  program_label: 'Basic Training Program',
  signer_title: 'Certified HWC Instructor',
  footer_text: 'Handle With Care Behavior Management System',
  show_qr: true,
};

/** Everything that is printed on a certificate. */
export interface CertificateData {
  studentName: string;
  facilityName: string;
  programVerbal: boolean;
  programPhysical: boolean;
  programLabel: string;
  issueDate: string;
  expirationDate: string;
  signatureDataUrl: string | null;
  signerName: string;
  signerTitle: string;
  instructorCertNumber: string;
  personnel: Personnel[];
  certNumber: string | null;
  verifyCode: string | null;
  theme: CertTheme;
  footerText: string;
  showQr: boolean;
}

export interface BuildInput {
  studentName: string;
  facilityName?: string | null;
  programVerbal?: boolean;
  programPhysical?: boolean;
  programLabel?: string | null;
  issueDate?: string | null;
  expirationDate?: string | null;
  signatureDataUrl?: string | null;
  signerName?: string | null;
  signerTitle?: string | null;
  instructorCertNumber?: string | null;
  personnel?: Personnel[];
  certNumber?: string | null;
  verifyCode?: string | null;
  theme?: CertTheme | null;
  settings?: Partial<CertificateSettings> | null;
}

/** Pure mapping from form/profile/settings values to what the certificate prints. Unit tested. */
export function buildCertificateData(input: BuildInput): CertificateData {
  const s = { ...DEFAULT_CERT_SETTINGS, ...(input.settings ?? {}) };
  const issue = input.issueDate || today();
  const verbal = input.programVerbal ?? true;
  const physical = input.programPhysical ?? true;
  return {
    studentName: input.studentName.trim().replace(/\s+/g, ' '),
    facilityName: (input.facilityName ?? '').trim(),
    programVerbal: verbal,
    programPhysical: physical,
    programLabel: (input.programLabel || s.program_label).trim(),
    issueDate: issue,
    expirationDate: input.expirationDate || addMonths(issue, s.expiration_months),
    signatureDataUrl: input.signatureDataUrl ?? null,
    signerName: (input.signerName ?? '').trim(),
    signerTitle: (input.signerTitle || s.signer_title).trim(),
    instructorCertNumber: (input.instructorCertNumber ?? '').trim(),
    personnel: (input.personnel ?? [])
      .map((p) => ({ name: p.name.trim(), title: p.title.trim() }))
      .filter((p) => p.name || p.title)
      .slice(0, 4),
    certNumber: input.certNumber ?? null,
    verifyCode: input.verifyCode ?? null,
    theme: input.theme ?? s.default_theme,
    footerText: s.footer_text,
    showQr: s.show_qr,
  };
}

export function verifyUrl(code: string): string {
  return `${appBaseUrl()}#/verify/${code}`;
}

export function certFileName(studentName: string, certNumber?: string | null): string {
  const base = studentName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'certificate';
  return `HWC-Certificate-${base}${certNumber ? `-${certNumber}` : ''}.pdf`;
}

/** Render one or more certificate DOM nodes (each 1100×850) into a landscape-letter PDF. */
export async function exportCertificatesPdf(nodes: HTMLElement[], filename: string, opts: { print?: boolean } = {}) {
  const [{ toJpeg, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  if (document.fonts?.ready) await document.fonts.ready;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter', compress: true });
  const fontEmbedCSS = nodes.length ? await getFontEmbedCSS(nodes[0]) : undefined;
  for (let i = 0; i < nodes.length; i++) {
    const img = await toJpeg(nodes[i], {
      quality: 0.95,
      pixelRatio: 2.5,
      width: CERT_WIDTH,
      height: CERT_HEIGHT,
      cacheBust: false,
      fontEmbedCSS,
      style: { transform: 'none', margin: '0' },
    });
    if (i > 0) pdf.addPage('letter', 'landscape');
    pdf.addImage(img, 'JPEG', 0, 0, 11, 8.5, undefined, 'FAST');
  }
  pdf.setProperties({ title: filename.replace(/\.pdf$/, ''), creator: 'HWC Trainer Suite' });
  if (opts.print) {
    pdf.autoPrint();
    const url = pdf.output('bloburl');
    window.open(url, '_blank', 'noopener');
  } else {
    pdf.save(filename);
  }
}

/** Remove transparent margins from a signature canvas and return a PNG data URL. */
export function trimCanvasToDataUrl(canvas: HTMLCanvasElement, pad = 8): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  const w = right - left + 1 + pad * 2;
  const h = bottom - top + 1 + pad * 2;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(canvas, left - pad, top - pad, w, h, 0, 0, w, h);
  return out.toDataURL('image/png');
}

/** Render a typed name in a script font to a transparent PNG. */
export async function typedSignatureDataUrl(name: string, color = '#14213d'): Promise<string | null> {
  if (!name.trim()) return null;
  try {
    await document.fonts.load('72px "Great Vibes"');
  } catch {
    /* fall back to whatever font is available */
  }
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 200;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.font = '96px "Great Vibes", cursive';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.trim(), 20, 105, 860);
  return trimCanvasToDataUrl(canvas, 6);
}
