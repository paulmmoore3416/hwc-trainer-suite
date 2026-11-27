import type { CertLayout, CertTheme, CertificateSettings, Personnel } from './types';
import { addMonths, today } from './format';
import { appBaseUrl } from './config';

export const CERT_WIDTH = 1100; // 11in @ 100px/in
export const CERT_HEIGHT = 850; // 8.5in

/**
 * The suite issues exactly ONE certificate design and ONE badge design: the Handle With Care
 * Basic Training certificate of completion (navy side panel, HWC logo top-left, QR code to
 * handlewithcare.com) and its matching circular "COMPLETED" badge. There are no theme or
 * layout choices. The `theme`/`layout` database columns are still written with these fixed
 * values so existing rows and the DB check constraints stay valid.
 */
export const CERT_THEME: CertTheme = 'hwc';
export const CERT_LAYOUT: CertLayout = 'classic';

/** Brand colours sampled from the Handle With Care logo. */
export const BRAND = {
  navy: '#2E3F59',
  red: '#EC2127',
  redDark: '#B5161B',
  ink: '#2B2F36',
  muted: '#6B7280',
  rule: '#C9CED6',
  paper: '#FBFBFA',
} as const;

/** Where the certificate QR code points (per program owner's direction). */
export const HWC_SITE_URL = 'https://www.handlewithcare.com';
export const HWC_SITE_LABEL = 'www.handlewithcare.com';
export const CERT_FOOTER = 'Verify program information at www.handlewithcare.com';

/** Blank fillable PDF of the same certificate, for hand-issued certificates outside the suite. */
export const FILLABLE_CERT_PATH = 'downloads/HWC_Basic_Training_Certificate_Fillable.pdf';
export const BADGE_PNG_PATH = 'downloads/HWC_Basic_Training_Badge.png';

export const DEFAULT_CERT_SETTINGS: CertificateSettings = {
  expiration_months: 12,
  program_label: 'Basic Training Program',
  signer_title: 'Certified Instructor',
  footer_text: 'Verify program information at www.handlewithcare.com',
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
    footerText: CERT_FOOTER, // fixed: part of the single certificate design
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

/** Public credential (badge) page for a certificate. */
export function badgeUrl(code: string): string {
  return `${appBaseUrl()}#/badge/${code}`;
}

/** Completion sentence printed under the trainee name; follows the programs completed. */
export function completionText(verbal: boolean, physical: boolean): string {
  const skills =
    verbal && physical
      ? 'crisis prevention, verbal de\u2011escalation, and safe physical intervention'
      : physical
        ? 'crisis prevention and safe physical intervention'
        : 'crisis prevention and verbal de\u2011escalation';
  // \u2011 = non-breaking hyphen, so "de-escalation" never splits across lines
  return `has successfully completed Handle With Care Basic Training in ${skills}, and has demonstrated the competencies required for program certification.`;
}

export function programText(verbal: boolean, physical: boolean): string {
  return verbal && physical ? 'Verbal & Physical Programs' : verbal ? 'Verbal Program' : physical ? 'Physical Program' : '';
}

export interface ShareInput {
  code: string;
  certNumber: string;
  facilityName: string;
  programVerbal: boolean;
  programPhysical: boolean;
  issueDate: string;
  expirationDate: string;
}

/** LinkedIn "Add licence or certification" deep link and social share links. */
export function shareLinks(c: ShareInput) {
  const url = badgeUrl(c.code);
  const [iy, im] = c.issueDate.split('-').map(Number);
  const [ey, em] = c.expirationDate.split('-').map(Number);
  const name = `Handle With Care Certification — ${programText(c.programVerbal, c.programPhysical)}`;
  const li = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name,
    organizationName: c.facilityName || 'Handle With Care Behavior Management System',
    issueYear: String(iy),
    issueMonth: String(im),
    expirationYear: String(ey),
    expirationMonth: String(em),
    certUrl: url,
    certId: c.certNumber,
  });
  const text = `I earned my ${name}${c.facilityName ? ` at ${c.facilityName}` : ''}. Verify it here:`;
  return {
    url,
    name,
    linkedinAdd: `https://www.linkedin.com/profile/add?${li.toString()}`,
    linkedinShare: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    email: (to = '') =>
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('Your Handle With Care digital badge')}&body=${encodeURIComponent(
        `Congratulations on completing your Handle With Care training!\n\nYour digital badge and verified credential:\n${url}\n\nFrom that page you can download your badge image, add the certification to your LinkedIn profile, or share it on social media.`,
      )}`,
  };
}

/** Render a badge DOM node (square) to a transparent PNG and download it. */
export async function downloadBadgePng(node: HTMLElement, filename: string, size = 1200) {
  const { toPng, getFontEmbedCSS } = await import('html-to-image');
  if (document.fonts?.ready) await document.fonts.ready;
  const w = node.offsetWidth || 600;
  const png = await toPng(node, { pixelRatio: size / w, cacheBust: false, fontEmbedCSS: await getFontEmbedCSS(node), style: { transform: 'none', margin: '0' } });
  const a = document.createElement('a');
  a.href = png;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
