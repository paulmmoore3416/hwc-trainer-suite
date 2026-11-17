import type { CertLayout, CertTheme, CertificateSettings, Personnel } from './types';
import { addMonths, today } from './format';
import { appBaseUrl } from './config';

export const CERT_WIDTH = 1100; // 11in @ 100px/in
export const CERT_HEIGHT = 850; // 8.5in

export type Pattern = 'weave' | 'dots' | 'linen' | 'grid' | 'waves' | 'diamond' | 'none';

export interface ThemeSpec {
  label: string;
  group: 'Signature' | 'Jewel' | 'Earth' | 'Modern' | 'Classic';
  primary: string; // ribbons, title, banner
  secondary: string; // second band, subtitle
  accent: string; // seal, fine rules
  paper: string;
  ink: string;
  pattern: Pattern; // background texture ("style")
}

const t = (label: string, group: ThemeSpec['group'], primary: string, secondary: string, accent: string, pattern: Pattern, paper = '#fffdf7', ink = '#1d1d22'): ThemeSpec => ({
  label,
  group,
  primary,
  secondary,
  accent,
  paper,
  ink,
  pattern,
});

/** 27 colour & style options. Keys are stored on each certificate, so never rename an existing key. */
export const THEMES: Record<string, ThemeSpec> = {
  navy: t('Navy & Teal', 'Signature', '#1f2a44', '#1f8a8a', '#c29a2c', 'weave'),
  archvista: t('Arch Vista Blue & Green', 'Signature', '#3f6fa6', '#8ab85a', '#6f7a86', 'weave', '#fcfdfb', '#1f2933'),
  crimson: t('Crimson & Charcoal', 'Classic', '#2c2c31', '#b3263a', '#c29a2c', 'weave', '#fffcf8'),
  forest: t('Forest & Gold', 'Earth', '#1e3d2f', '#5f8f45', '#c29a2c', 'weave', '#fdfcf6', '#1b241f'),
  royal: t('Royal Purple & Gold', 'Jewel', '#3b1f5c', '#7a4fb0', '#c29a2c', 'diamond', '#fdfbff'),
  midnight: t('Midnight & Silver', 'Modern', '#0f172a', '#475569', '#9aa3ae', 'grid', '#fbfcfd', '#0f172a'),
  ocean: t('Ocean & Coral', 'Modern', '#0b4f6c', '#1b98c4', '#f2735a', 'waves', '#fbfdfe'),
  sunset: t('Sunset Plum & Orange', 'Modern', '#5b2a4a', '#e2703a', '#e8a838', 'waves', '#fffaf5'),
  emerald: t('Emerald & Onyx', 'Jewel', '#0b3d2e', '#12916b', '#c29a2c', 'diamond', '#fbfefc'),
  burgundy: t('Burgundy & Rose Gold', 'Classic', '#5a1426', '#a85b67', '#c9967a', 'linen', '#fffaf8'),
  copper: t('Slate & Copper', 'Earth', '#2f3e46', '#52796f', '#b87333', 'linen', '#fbfbf8'),
  sky: t('Sky & Sand', 'Modern', '#1d4e89', '#4a97c9', '#c9a46a', 'dots', '#fdfcf8'),
  teal: t('Deep Teal & Amber', 'Signature', '#0d4d4d', '#2a9d8f', '#e09a2c', 'weave', '#fbfdfc'),
  charcoal: t('Charcoal & Lime', 'Modern', '#262626', '#6a9c16', '#9a9a9a', 'grid', '#fcfcfa'),
  cobalt: t('Cobalt & Tangerine', 'Modern', '#1c3f94', '#e67e22', '#c29a2c', 'dots', '#fdfcfa'),
  plum: t('Plum & Sage', 'Earth', '#4a2545', '#7f9a6f', '#c2a77f', 'linen', '#fdfbf7'),
  ruby: t('Ruby & Black', 'Jewel', '#1f1f1f', '#9b111e', '#c29a2c', 'diamond', '#fffcfa'),
  sapphire: t('Sapphire & Platinum', 'Jewel', '#0f3b7a', '#2f6fd0', '#a9b0ba', 'diamond', '#fbfcff'),
  olive: t('Olive & Brass', 'Earth', '#3d4a1f', '#7d8b3a', '#b09a3e', 'linen', '#fdfcf5'),
  mocha: t('Mocha & Cream', 'Earth', '#4b3621', '#8b5e3c', '#c9a46a', 'linen', '#fdf8ef', '#2b2118'),
  lavender: t('Lavender & Graphite', 'Modern', '#3c3a52', '#8e7cc3', '#b3a3d9', 'dots', '#fdfcff'),
  indigo: t('Indigo & Turquoise', 'Jewel', '#2e1a6b', '#16a3a0', '#e8b73f', 'diamond', '#fcfcff'),
  maroon: t('Maroon & Gold', 'Classic', '#5c0f1b', '#8f2d3a', '#c29a2c', 'weave', '#fffbf5'),
  steel: t('Steel Blue & Orange', 'Modern', '#274060', '#5b84b1', '#f0a020', 'grid', '#fbfcfd'),
  pine: t('Pine & Birch', 'Earth', '#1f3b2c', '#4f7a5a', '#bfae8c', 'waves', '#fcfbf6'),
  harbor: t('Harbor Gray & Signal Red', 'Classic', '#2b3a42', '#566f7c', '#bf3b3b', 'grid', '#fbfbfb'),
  mono: t('Classic Black & White', 'Classic', '#111111', '#4b4b4b', '#8c8c8c', 'none', '#ffffff', '#111111'),
};

export const THEME_GROUPS: ThemeSpec['group'][] = ['Signature', 'Classic', 'Jewel', 'Earth', 'Modern'];

export function themeOf(id: string | null | undefined): ThemeSpec {
  return (id && THEMES[id]) || THEMES.navy;
}

export const LAYOUTS: { id: CertLayout; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic Ribbon', description: 'Angled corner ribbons, banner and rosette seal' },
  { id: 'modern', label: 'Modern Panel', description: 'Bold side panel, left-aligned and clean' },
  { id: 'heritage', label: 'Heritage Formal', description: 'Ornate double frame, corner flourishes, centered seal' },
];

export const DEFAULT_CERT_SETTINGS: CertificateSettings = {
  expiration_months: 12,
  default_theme: 'navy',
  default_layout: 'classic',
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
  layout: CertLayout;
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
  layout?: CertLayout | null;
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
    theme: input.theme && THEMES[input.theme] ? input.theme : s.default_theme,
    layout: input.layout ?? s.default_layout,
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

/** Public credential (badge) page for a certificate. */
export function badgeUrl(code: string): string {
  return `${appBaseUrl()}#/badge/${code}`;
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
