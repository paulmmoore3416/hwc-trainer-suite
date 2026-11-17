# 🔐 Security model

## Principles
1. **Least privilege, enforced in the database.** The browser is untrusted. Every rule is a Postgres Row Level Security policy or a checked server function, never just a hidden button.
2. **Invite-only.** Nobody can self-register except the owner emails in a private allow-list.
3. **No secrets in the client or the repo.** Only the Supabase *publishable* key ships to browsers. The service-role key exists only inside the `invite-user` Edge Function.
4. **No patient data.** The suite stores staff training records only. Incident forms carry an explicit warning.

## Controls

| Area | Control |
|---|---|
| Signup | `before insert` trigger on `auth.users` rejects emails without a pending, unexpired invitation (or owner allow-list membership) |
| Roles | `super_admin` (allow-listed emails only), `admin` (facility admin), `instructor`. Users cannot change their own role, status or email (`profiles_guard` trigger) |
| Data isolation | Students, classes, enrollments, certificates and incidents are visible only to members of the record's facility (`can_access_facility`) |
| Deactivation | Deactivated users fail every RLS check immediately, even with a still-valid session |
| Invitations | Created only by the Edge Function after verifying the caller is active, the role is ≤ their own, and the facilities are their own. One-time links, 24-hour validity |
| Logs | `audit_log`, `app_errors` and `auth_events` are readable only by super admins. Inserts go through rate-limited `SECURITY DEFINER` functions |
| Public surface | `verify_certificate(code)` returns only what is printed on the certificate, for a 16-character unguessable code |
| Web | Strict CSP (`script-src 'self'`), no third-party scripts or fonts, referrer policy, HTTPS via GitHub Pages |
| Exports | CSV cells are protected against spreadsheet formula injection |

## Reporting a vulnerability
Please do **not** open a public issue. Contact the repository owner privately through GitHub.
