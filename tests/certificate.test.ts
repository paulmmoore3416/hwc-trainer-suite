import { describe, expect, it, vi } from 'vitest';
import { buildCertificateData, certFileName, DEFAULT_CERT_SETTINGS, LAYOUTS, shareLinks, THEMES, THEME_GROUPS } from '../src/lib/certificate';
import { addMonths, certStatus, safeSearch, studentFullName } from '../src/lib/format';
import { toCsv } from '../src/lib/csv';

describe('buildCertificateData', () => {
  it('auto-fills defaults from settings', () => {
    const d = buildCertificateData({ studentName: '  Jane   Doe ', facilityName: 'Arch Vista Behavioral Health', issueDate: '2026-11-17' });
    expect(d.studentName).toBe('Jane Doe');
    expect(d.programLabel).toBe(DEFAULT_CERT_SETTINGS.program_label);
    expect(d.signerTitle).toBe(DEFAULT_CERT_SETTINGS.signer_title);
    expect(d.expirationDate).toBe('2027-11-17');
    expect(d.programVerbal && d.programPhysical).toBe(true);
    expect(d.theme).toBe('navy');
    expect(d.layout).toBe('classic');
  });

  it('falls back to the default theme for unknown theme ids', () => {
    expect(buildCertificateData({ studentName: 'A', theme: 'not-a-theme' }).theme).toBe('navy');
    expect(buildCertificateData({ studentName: 'A', theme: 'royal', layout: 'heritage' })).toMatchObject({ theme: 'royal', layout: 'heritage' });
  });

  it('respects custom expiration months and explicit expiration', () => {
    expect(buildCertificateData({ studentName: 'A', issueDate: '2026-01-31', settings: { expiration_months: 1 } }).expirationDate).toBe('2026-02-28');
    expect(buildCertificateData({ studentName: 'A', issueDate: '2026-01-01', expirationDate: '2026-06-30' }).expirationDate).toBe('2026-06-30');
  });

  it('cleans personnel lines and caps them at four', () => {
    const d = buildCertificateData({
      studentName: 'A',
      personnel: [
        { name: ' Pat ', title: ' Coordinator ' },
        { name: '', title: '' },
        { name: 'B', title: '' },
        { name: 'C', title: 'x' },
        { name: 'D', title: 'y' },
        { name: 'E', title: 'z' },
      ],
    });
    expect(d.personnel).toEqual([
      { name: 'Pat', title: 'Coordinator' },
      { name: 'B', title: '' },
      { name: 'C', title: 'x' },
      { name: 'D', title: 'y' },
    ]);
  });

  it('builds safe PDF file names', () => {
    expect(certFileName("Jane O'Neil-Smith", 'HWC-AVBH-2026-001001')).toBe('HWC-Certificate-Jane-O-Neil-Smith-HWC-AVBH-2026-001001.pdf');
  });
});

describe('format helpers', () => {
  it('formats student names with middle initial', () => {
    expect(studentFullName({ first_name: 'Jane', middle_initial: 'Q.', last_name: 'Doe' })).toBe('Jane Q. Doe');
    expect(studentFullName({ first_name: 'Jane', middle_initial: '', last_name: 'Doe' })).toBe('Jane Doe');
  });
  it('adds months without overflowing short months', () => {
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
  it('derives certificate status', () => {
    expect(certStatus({ status: 'revoked', expiration_date: '2999-01-01' })).toBe('revoked');
    expect(certStatus({ status: 'active', expiration_date: '2000-01-01' })).toBe('expired');
    expect(certStatus({ status: 'active', expiration_date: '2999-01-01' })).toBe('valid');
  });
  it('strips PostgREST filter metacharacters from search', () => {
    expect(safeSearch('a,b(c)%*d')).toBe('a b c   d');
  });
});

describe('csv', () => {
  it('escapes quotes and neutralises formula injection', () => {
    const csv = toCsv([{ a: '=1+1', b: 'say "hi"', c: null }]);
    expect(csv).toBe(`a,b,c\r\n'=1+1,"say ""hi""",`);
  });
});

describe('certificate catalogue', () => {
  it('offers 3 certificate types and 27 colour & style themes', () => {
    expect(LAYOUTS.map((l) => l.id)).toEqual(['classic', 'modern', 'heritage']);
    expect(Object.keys(THEMES)).toHaveLength(27);
    for (const [id, t] of Object.entries(THEMES)) {
      expect(id).toMatch(/^[a-z0-9_-]{2,30}$/); // matches the DB check constraint
      expect(THEME_GROUPS).toContain(t.group);
      for (const c of [t.primary, t.secondary, t.accent, t.paper, t.ink]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('badge sharing', () => {
  it('builds a pre-filled LinkedIn add-certification link', () => {
    vi.stubGlobal('window', { location: { origin: 'https://example.org', pathname: '/hwc-trainer-suite/' } });
    const l = shareLinks({
      code: '0123456789abcdef',
      certNumber: 'HWC-AVBH-2026-001001',
      facilityName: 'Arch Vista Behavioral Health',
      programVerbal: true,
      programPhysical: false,
      issueDate: '2026-11-17',
      expirationDate: '2027-11-17',
    });
    const u = new URL(l.linkedinAdd);
    expect(u.hostname).toBe('www.linkedin.com');
    expect(u.searchParams.get('startTask')).toBe('CERTIFICATION_NAME');
    expect(u.searchParams.get('name')).toBe('Handle With Care Certification — Verbal Program');
    expect(u.searchParams.get('issueMonth')).toBe('11');
    expect(u.searchParams.get('expirationYear')).toBe('2027');
    expect(u.searchParams.get('certId')).toBe('HWC-AVBH-2026-001001');
    expect(u.searchParams.get('certUrl')).toContain('#/badge/0123456789abcdef');
    expect(l.facebook).toContain(encodeURIComponent('#/badge/0123456789abcdef'));
  });
});
