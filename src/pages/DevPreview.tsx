// Development-only certificate design preview: `npm run dev`, then open #/__dev/certificate?theme=navy|archvista|crimson|forest
// The route is only registered when import.meta.env.DEV is true, so it never ships in production.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Certificate } from '../components/Certificate';
import { buildCertificateData, typedSignatureDataUrl } from '../lib/certificate';
import type { CertTheme } from '../lib/types';

export default function DevPreview() {
  const [p] = useSearchParams();
  const theme = (p.get('theme') ?? 'navy') as CertTheme;
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
  });
  return (
    <div style={{ padding: 20, background: '#e5e7eb', minHeight: '100vh' }}>
      <Certificate data={data} />
    </div>
  );
}
