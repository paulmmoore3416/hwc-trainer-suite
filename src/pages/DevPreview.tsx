// Development-only certificate & badge preview: `npm run dev`, then open
//   #/__dev/certificate                 → the certificate (sample data; ?name=… to test long names)
//   #/__dev/certificate?badge=1&size=600 → the badge (transparent background)
//   #/__dev/certificate?og=1             → 1200×630 social preview card (public/og-badge.png)
// The route is only registered when import.meta.env.DEV is true, so it never ships in production.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Certificate } from '../components/Certificate';
import { Badge } from '../components/Badge';
import { BRAND, buildCertificateData, typedSignatureDataUrl } from '../lib/certificate';

export default function DevPreview() {
  const [p] = useSearchParams();
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
    certNumber: 'HWC-AVBH-2026-001001',
    verifyCode: '0123456789abcdef',
  });
  if (p.get('og')) {
    return (
      <div style={{ width: 1200, height: 630, background: 'linear-gradient(120deg, #121a28, #1a2436 60%, #202c42)', display: 'flex', alignItems: 'center', gap: 50, padding: '0 80px', boxSizing: 'border-box', color: '#fff' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 64, lineHeight: 1.05 }}>HANDLE WITH CARE</div>
          <div style={{ width: 70, height: 5, background: BRAND.red, margin: '22px 0 18px' }} />
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, letterSpacing: 4, fontSize: 18, color: '#ffffffcc' }}>BASIC TRAINING · VERIFIED CREDENTIAL</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 24, color: '#d5dbe4', marginTop: 30, lineHeight: 1.45, maxWidth: 560 }}>
            Completed Handle With Care Basic Training. Click to verify this credential.
          </div>
        </div>
        <Badge size={440} />
      </div>
    );
  }
  if (p.get('badge')) {
    return (
      <div style={{ padding: 20, background: p.get('bg') ?? 'transparent', display: 'inline-flex' }}>
        <Badge size={Number(p.get('size') ?? 300)} />
      </div>
    );
  }
  return (
    <div style={{ padding: 20, background: '#e5e7eb', minHeight: '100vh' }}>
      <Certificate data={data} />
    </div>
  );
}
