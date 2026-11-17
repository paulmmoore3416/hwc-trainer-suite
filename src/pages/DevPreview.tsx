// Development-only certificate design preview: `npm run dev`, then open #/__dev/certificate?theme=navy|archvista|crimson|forest
// The route is only registered when import.meta.env.DEV is true, so it never ships in production.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Certificate } from '../components/Certificate';
import { buildCertificateData, typedSignatureDataUrl } from '../lib/certificate';
import type { CertLayout, CertTheme } from '../lib/types';
import { Badge } from '../components/Badge';
import { LAYOUTS, THEMES } from '../lib/certificate';

export default function DevPreview() {
  const [p] = useSearchParams();
  const theme = (p.get('theme') ?? 'navy') as CertTheme;
  const layout = (p.get('layout') ?? 'classic') as CertLayout;
  const [sig, setSig] = useState<string | null>(null);
  useEffect(() => {
    void typedSignatureDataUrl('Morgan Instructor').then(setSig);
  }, []);
  const data = buildCertificateData({
    studentName: p.get('name') ?? 'Jordan A. Example',
    facilityName: 'Arch Vista Behavioral Health',
    issueDate: '2026-11-17',
    signatureDataUrl: sig,
    signerName: 'Morgan Instructor',
    instructorCertNumber: 'AV-1024',
    personnel: [
      { name: 'Alex Rivera', title: 'Co-Instructor' },
      { name: 'Sam Lee', title: 'Director of Staff Development' },
    ],
    certNumber: 'HWC-AVBH-2026-001001',
    verifyCode: '0123456789abcdef',
    theme,
    layout,
  });
  if (p.get('gallery') === 'themes') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 220px)', gap: 14, padding: 16, background: '#eef0f3', width: 'max-content' }}>
        {Object.entries(THEMES).map(([k, th]) => (
          <div key={k} style={{ width: 220, fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#334155', textAlign: 'center' }}>
            <div style={{ width: 220, height: 170, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,.15)' }}>
              <div style={{ transform: 'scale(0.2)', transformOrigin: 'top left' }}>
                <Certificate data={{ ...data, theme: k, layout: (['classic', 'modern', 'heritage'] as const)[Object.keys(THEMES).indexOf(k) % 3] }} />
              </div>
            </div>
            <div style={{ marginTop: 5, fontWeight: 600 }}>{th.label}</div>
          </div>
        ))}
      </div>
    );
  }
  if (p.get('gallery') === 'badges') {
    const combos: [string, CertLayout][] = [['navy', 'classic'], ['royal', 'modern'], ['burgundy', 'heritage'], ['emerald', 'classic'], ['ocean', 'modern'], ['mono', 'heritage']];
    return (
      <div style={{ display: 'flex', gap: 18, padding: 20, background: '#ffffff', width: 'max-content' }}>
        {combos.map(([th, l]) => (
          <Badge key={th} theme={th} layout={l} verbal physical year="2026" size={200} />
        ))}
      </div>
    );
  }
  if (p.get('gallery') === 'layouts') {
    return (
      <div style={{ display: 'flex', gap: 24, padding: 20, background: '#e5e7eb', width: 'max-content' }}>
        {LAYOUTS.map((l, i) => (
          <div key={l.id} style={{ width: 550, height: 425, overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,.18)' }}>
            <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left' }}>
              <Certificate data={{ ...data, layout: l.id, theme: ['navy', 'royal', 'burgundy'][i] }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (p.get('og')) {
    return (
      <div style={{ width: 1200, height: 630, background: 'linear-gradient(120deg,#151d30,#1f2a44 55%,#16465a)', display: 'flex', alignItems: 'center', gap: 40, padding: '0 70px', boxSizing: 'border-box', color: '#fff' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontWeight: 600, fontSize: 76, lineHeight: 1 }}>Handle With Care</div>
          <div style={{ fontFamily: 'Inter, sans-serif', letterSpacing: 8, fontSize: 20, color: '#7fd6d0', marginTop: 14 }}>VERIFIED DIGITAL CREDENTIAL</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 24, color: '#cbd5e1', marginTop: 28, lineHeight: 1.45, maxWidth: 520 }}>
            Certified in the Handle With Care Behavior Management System. Click to verify this credential.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Badge theme="navy" layout="classic" verbal physical year={String(new Date().getFullYear())} size={420} />
        </div>
      </div>
    );
  }
  if (p.get('badge')) {
    return (
      <div style={{ padding: 20, background: p.get('bg') ?? 'transparent', display: 'inline-flex', gap: 24 }}>
        <Badge theme={theme} layout={layout} verbal physical year="2026" size={Number(p.get('size') ?? 300)} />
      </div>
    );
  }
  return (
    <div style={{ padding: 20, background: '#e5e7eb', minHeight: '100vh' }}>
      <Certificate data={data} />
    </div>
  );
}
