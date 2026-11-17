// Public, browser-safe configuration. The publishable key is designed to be shipped to browsers;
// every row of data is protected by Postgres Row Level Security.
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL || 'https://qenuszfbkiedvloytrlc.supabase.co';
export const SUPABASE_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_kkkATJwEOiTspItJQbWTBw_H6L4ewWY';
export const APP_NAME = 'Handle With Care Trainer Suite';
export const APP_SHORT = 'HWC Trainer Suite';
export const APP_VERSION = '1.0.0';
export const PAGE_SIZE = 25;

/** Base URL of the app without the hash route, e.g. https://host/hwc-trainer-suite/ */
export function appBaseUrl(): string {
  return window.location.origin + window.location.pathname;
}
