import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { must } from './errors';
import { DEFAULT_CERT_SETTINGS } from './certificate';
import type { CertificateSettings, LookupCategory, LookupValue, Profile } from './types';

export function useLookups() {
  return useQuery({
    queryKey: ['lookups'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows = must(
        await supabase.from('lookup_values').select('id, category, value, sort_order, active').order('sort_order').order('value'),
        'lookups',
      ) as LookupValue[];
      return rows;
    },
  });
}

/** Active values for one lookup category. */
export function useLookup(category: LookupCategory): string[] {
  const { data } = useLookups();
  return (data ?? []).filter((r) => r.category === category && r.active).map((r) => r.value);
}

export function useCertSettings(): CertificateSettings {
  const { data } = useQuery({
    queryKey: ['settings', 'certificate'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const row = must(await supabase.from('app_settings').select('value').eq('key', 'certificate').maybeSingle(), 'settings');
      return { ...DEFAULT_CERT_SETTINGS, ...((row as { value?: Partial<CertificateSettings> } | null)?.value ?? {}) };
    },
  });
  return data ?? DEFAULT_CERT_SETTINGS;
}

/** Instructors visible to me (shared facilities, or everyone for super admins). */
export function useInstructors() {
  return useQuery({
    queryKey: ['instructors'],
    staleTime: 60_000,
    queryFn: async () =>
      must(
        await supabase
          .from('profiles')
          .select('id, email, full_name, title, role, active, hwc_cert_number, hwc_cert_expires, signature_id, last_sign_in_at, created_at, invited_by, phone')
          .order('full_name'),
        'instructors',
      ) as Profile[],
  });
}

export function useSignature(id: string | null | undefined) {
  return useQuery({
    queryKey: ['signature', id],
    enabled: !!id,
    staleTime: Infinity,
    queryFn: async () => {
      const row = must(await supabase.from('signatures').select('data_url').eq('id', id!).maybeSingle(), 'signature');
      return (row as { data_url: string } | null)?.data_url ?? null;
    },
  });
}

export function displayName(p: Pick<Profile, 'full_name' | 'email'> | null | undefined): string {
  if (!p) return '—';
  return p.full_name?.trim() || p.email;
}
