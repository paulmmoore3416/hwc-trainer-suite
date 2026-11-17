# HWC Trainer Suite — Design

**Date:** 2026-11-17 · **Owner:** HWC instructor, Arch Vista Behavioral Health

## Intent

The owner is a newly certified Handle With Care (HWC) instructor at Arch Vista Behavioral Health. He needs one secure,
web-based place where HWC instructors manage students, training classes, certificates, training-accident
incidents, and reporting. It will be used by many instructors, so it must be robust, scalable, secure and editable
without code changes. Access is invite-only.

## Goals

- Invite-only instructor access. Only the owner or another approved instructor can invite.
- Two owner (super-admin) accounts with full access. Their emails live only in a private database allow-list, never in this public repo.
- Student profiles stored in a database. A colored completion certificate is linked to each student and fills in live
  as the profile is typed.
- The certificate carries the student name, facility name, date and a digital signature, with an editable
  instructor/personnel block under the signature.
- A detailed metrics and reporting section covering training, training incidents, locations, student types and more.
- An error and logging section visible only to the super admins (both accounts belong to the owner).
- A public GitHub repo with a rich README (badges, icons, metrics, diagrams), plus a GitHub Pages site that hosts
  the suite. The login page uses the Arch Vista logo.

## Non-goals

- Students do not log in. They are records managed by instructors. *(my call)*
- No patient or clinical data. "Incidents" means **training accidents and injuries during HWC classes** only.
- The **instructor certificate is not a template in the suite**. Only the student certificate can be generated.

## Anti-goals (failure even if it "works")

- Anyone can self-register, or a user from facility A can see facility B's data.
- Secrets (service-role key) ship to the browser or the repo.
- Certificates copy the HWC trademark logo or look identical to the official paper certificates.
- Metrics computed by downloading every row to the browser, which won't scale.

## Constraints

- GitHub Pages is static hosting only, so all data, auth and privileged actions live in Supabase.
- Free GitHub Pages requires a **public** repo. The code is public and all data stays protected by Postgres RLS.
  The Supabase anon key is public by design.
- Supabase's built-in email sender is heavily rate-limited (a few emails per hour). Invites therefore **also return a
  copyable invite link**. For volume, the owner can add custom SMTP in the Supabase dashboard (documented).
- The Supabase Auth Site URL and redirect allow-list must be set in the dashboard once (documented step, because the
  tooling can't set it).

## Approaches considered

| Approach | Trade-offs | Decision |
|---|---|---|
| **GitHub Pages + Supabase** (Postgres, Auth, Storage, Edge Functions) | Real multi-user database, RLS security, SQL-side metrics, invite emails, free tier. the owner already uses Supabase. | **Chosen** |
| GitHub Pages + Firebase | Comparable auth/hosting, but weaker for relational reporting, and a second platform to manage. | Rejected |
| GitHub Pages only, browser localStorage | No shared data, no security, no invites. | Rejected |

## Architecture

```
Browser (GitHub Pages SPA: React + TS + Vite)
  ├── supabase-js (anon key) ── Postgres (RLS on every table) + RPC metric functions
  ├── Storage (private buckets: signatures, branding)
  └── Edge Function `invite-user` (service role, server-side only)
GitHub Actions: typecheck → build → deploy to Pages
```

- **Frontend:** React 18, TypeScript, Vite, React Router (HashRouter for Pages), Tailwind CSS, TanStack Query,
  react-hook-form + zod, Recharts, signature_pad, html-to-image + jsPDF (PDF export), qrcode.
- **Backend:** a new, dedicated Supabase project `hwc-trainer-suite` (kept separate from `avbh-workorders`).

## Roles and access

| Role | Can do |
|---|---|
| `super_admin` | Everything, all facilities, error/logging console, role changes, lookup lists, settings. Determined by the private allow-list `private.super_admin_emails`, enforced in `private.is_super_admin()`. |
| `admin` (lead instructor) | Everything within their facilities, plus deactivating instructors in those facilities. |
| `instructor` | Students, classes, certificates and incidents within their assigned facilities; invite other instructors. |

- **Invite flow:** an active instructor submits an email, role (≤ their own) and facilities. The Edge Function verifies
  the caller, writes an `invitations` row and returns a one-time, 24-hour invite link that the inviter sends (copy or email draft). No dependency on Supabase email limits. The invitee sets
  a password and lands in the suite.
- **Signup lock:** a `before insert` trigger on `auth.users` rejects any email that isn't a super admin or doesn't have
  a pending invitation. This holds even if public signup is left on in the dashboard.
- Deactivated users are blocked by RLS (`is_active_user()`), not just hidden in the UI.

## Data model (Postgres, all tables RLS-protected, facility-scoped)

- `facilities`: name, address, phone, active. Seeded with Arch Vista Behavioral Health.
- `profiles`: 1:1 with `auth.users`. Name, title, phone, role, HWC instructor cert #/expiry, saved signature, active,
  invited_by.
- `facility_members`: instructor ↔ facility (many-to-many).
- `invitations`: email, role, facilities, invited_by, status, expires_at.
- `lookup_values`: **editable lists** (student types, departments/units, course types, techniques, incident types,
  body parts, severities, locations/rooms). Super admins edit them in the UI.
- `students`: name, preferred name, employee ID, email, phone, job title, department, student type, facility, hire
  date, status, notes.
- `training_sessions`: facility, location/room, course type (Verbal, Physical, Verbal+Physical, Recertification),
  dates, hours, lead + co-instructors, status.
- `enrollments`: session ↔ student. Attendance, verbal/physical competency pass, written score, result, attempt #,
  remediation notes.
- `certificates`: linked to student (+ enrollment). Snapshots of student/facility name, program(s), issue and
  expiration dates (default issue + 12 months, configurable), signature image, signer name/title, **personnel block**
  (instructor name, title, cert #, plus additional personnel rows as JSON), color theme, unique certificate number
  (`HWC-<FAC>-YYYY-000123`), verification code, status (active/revoked).
- `training_incidents`: facility, session, date/time, location, involved role (student/instructor/observer), optional
  student link, incident type, technique being practiced, body part, severity, first aid / medical referral / lost
  time, description, contributing factors, corrective action, follow-up owner/status/date.
- `app_settings`: certificate defaults (expiry months, footer contact text, default theme), branding.
- `audit_log`: trigger-written insert/update/delete history (who, when, old → new) on all core tables.
- `app_errors`: client and server errors (level, message, stack, route, user, user agent, context, resolved flag).
- `auth_events`: sign-ins and sign-outs, failed sign-ins (via RPC), invite sent/accepted.

Indexes on all foreign keys and date columns. Lists are paginated server-side.

## Key screens

1. **Login:** Arch Vista logo, "Handle With Care Trainer Suite", email/password, forgot password, accept invite.
2. **Dashboard:** KPIs, upcoming classes, expiring certifications, open incident follow-ups.
3. **Students:** searchable/filterable table and profile page (history, certificates, incidents).
   **New/Edit Student:** form on the left, **live certificate preview on the right** that updates on every keystroke
   (name, facility, program, date, instructor block auto-filled from the logged-in instructor's profile and saved
   signature).
4. **Classes:** create a session, enroll students, record results, **bulk-issue certificates** for everyone who passed.
5. **Certificates:** list, view, edit personnel block, draw/type/reuse signature, download PDF, print, revoke,
   re-issue.
6. **Incidents:** log a training incident, track corrective action and follow-up.
7. **Reports & Metrics** (tabs, global date-range + facility filters, CSV export, print):
   - *Overview:* certified staff, compliance %, classes/trainees/hours YTD, pass rate, incident rate per 100 trainees,
     days since last incident.
   - *Training Activity:* classes, trainees and hours by month and course type.
   - *Compliance & Expirations:* current/expiring/expired by facility and department, 12-month expiration forecast,
     overdue list.
   - *Outcomes:* pass/fail and first-attempt pass rate by course, student type and department, average written
     score, remediation counts.
   - *Instructors:* classes taught, students trained, hours, pass rates, instructor-cert expirations.
   - *Locations:* by facility and room, day-of-week × month heatmap.
   - *Student Types & Departments:* distribution and trend.
   - *Training Incidents:* trend, by type/severity/technique/body part, rate per 100 participants, per instructor,
     open corrective actions.
   All aggregates come from SQL RPC functions (security-invoker, so RLS still applies).
8. **Admin:** users and invitations, facilities, editable lookup lists, certificate settings.
9. **System Logs** (super admin only, hidden from the nav for everyone else and RLS-enforced): errors (filter,
   resolve), audit trail, auth events, invitation log.
10. **Verify** (public): `#/verify/<code>` shows only the certificate number, student name, program, facility, dates
    and valid/expired/revoked status. Reached via the QR code on the certificate. *(my call)*

## Certificate design (original, colored)

Landscape US Letter. It is similar in spirit to the HWC student certificate but not a copy:

- Angled ribbon bands in the top-left and bottom-right corners, in color (default theme: deep navy + teal + gold;
  alternate themes: Arch Vista blue/green, crimson/charcoal). Selectable per certificate.
- Thin double border, serif title "Handle With Care", subtitle "Behavior Management System — Certificate of
  Completion", "awarded to" + student name in a script font.
- Program line ("Verbal Program", "Physical Program", or both) and "at <Facility Name>".
- A gold rosette seal with a shield/check icon (not the trophy and not the HWC logo).
- Bottom: date (left), signature image (right) with the **personnel block** beneath it (instructor name, title,
  HWC cert #, plus any additional personnel lines), expiration note, certificate # and QR code.
- PDF export at print resolution, plus a print stylesheet.

## Error handling and logging

- A React error boundary, `window.onerror` and `unhandledrejection` handlers, and a Supabase call wrapper all report to
  `app_errors` through an insert-only RPC, with a throttle to avoid floods.
- The Edge Function logs its own failures to `app_errors`.
- User-facing errors are friendly toasts, and details go to the log.

## Repo and deployment

- Repo `paulmmoore3416/hwc-trainer-suite` (public) with `supabase/migrations`, `supabase/functions`, `src/` and
  `docs/`.
- README: shields.io badges (deploy status, license, React, TS, Vite, Supabase, Tailwind, last commit, repo size),
  feature grid with icons, Mermaid architecture diagram + ERD + invite flow, Mermaid pie/xychart metrics visuals,
  roles matrix, setup guide (Supabase Site URL, SMTP, env), security notes.
- A GitHub Actions workflow builds and deploys to Pages. The Supabase URL and anon key are injected at build time
  from repo variables.

## Left to the builder

Exact component structure, chart styling, migration file split, test layout (unit tests for certificate field
mapping, metric helpers and RLS policy SQL checks).

## Addendum: v1.1 (2026-11-17)

- **Digital badges:** each certificate has a badge (shape follows the certificate type, colors follow the theme) and a public credential page `#/badge/<verify_code>`. It offers a LinkedIn *Add licence or certification* deep link (pre-filled name, issuer, issue and expiry month/year, credential ID and URL), LinkedIn/Facebook/X share links, PNG download, and an email-to-student draft. Static Open Graph tags plus `og-badge.png` give shared links a rich preview. (A hash-routed static site can't serve per-certificate OG tags.)
- **Certificate types:** `certificates.layout` is one of `classic`, `modern` or `heritage`, with a default in `app_settings.certificate.default_layout`.
- **Themes:** 27 color & style themes, each a palette plus a paper texture. The theme id format is enforced by a DB check (`^[a-z0-9_-]{2,30}$`). Unknown ids fall back to `navy`.
- **Dark mode:** Light, Dark or System, stored in localStorage and applied before first paint. The slate scale and status tints are remapped under `html.dark`. Brand panels opt out with `.no-invert`, and signature pads stay on white `.paper`. Charts use the validated dark-step palette.
