# ⚙️ Setup & operations guide

## 1. First-time owner setup (one time, about 5 minutes)

### a. Point Supabase Auth at the live site
Supabase dashboard → **Authentication → URL Configuration**

| Setting | Value |
|---|---|
| Site URL | `https://paulmmoore3416.github.io/hwc-trainer-suite/` |
| Redirect URLs | `https://paulmmoore3416.github.io/hwc-trainer-suite/**` and `http://localhost:5173/**` |

This makes password-reset and email-confirmation links open the suite.

### b. Recommended Auth hardening
Supabase dashboard → **Authentication**
- **Sign In / Providers → Email**: keep *Confirm email* on.
- **Attack Protection**: turn on *Leaked password protection*. Set *Minimum password length* to 10.
- **Emails → SMTP Settings** (optional, recommended for many users): add your organization's SMTP server. The built-in sender is limited to a few emails per hour. Invitations do **not** depend on email, because the suite gives you a one-time link to send yourself.

### c. Create the owner (super admin) accounts
1. Open the suite → **Suite owner? Set up your account**.
2. Enter your owner email, full name and a password of 10+ characters.
3. Confirm your email from the message Supabase sends, then sign in.

Only emails in the private allow-list `private.super_admin_emails` can do this. Everyone else needs an invitation.
To add or change an owner email, run this in the Supabase SQL editor:
```sql
insert into private.super_admin_emails (email) values ('new.owner@example.org');
```

### d. Finish your profile
**My profile** → add your HWC instructor cert # and expiry, then **draw or type your signature and save it**. It will auto-fill every certificate you issue.

## 2. Inviting instructors
**Instructors & Invites → Invite instructor** → email, role, facilities → **Create invitation**.
You get a **one-time link valid for 24 hours**. Click **Open email draft** (or copy the link) and send it. The new instructor opens it, chooses a password, and lands in the suite with access to only the facilities you picked.
If a link expires, use **Resend link** on their row.

## 3. Day-to-day workflow
1. **Students → New student**. The certificate preview fills in as you type. Leave *Issue certificate with this profile* ticked to issue it immediately.
2. **Classes → Schedule class** → add students → record attendance and results → **Save roster** → **Issue certificates to passed students** → **Download all certificates (PDF)**.
3. **Training Incidents → Log incident** for any injury or near miss during training. Track the corrective action until it's closed.
4. **Reports & Metrics**: choose a date range and facility (top bar) and export CSV or print.
5. **Digital badges**: open any certificate. The *Digital badge* card has **Email to student** (sends the student their badge link), **Copy badge link** and **Download badge (PNG)**. From their credential page the student can click **Add to LinkedIn profile** (LinkedIn's *Add licence or certification* form opens pre-filled), share on LinkedIn, Facebook or X, or download the badge image.
6. **Certificate look**: pick a **certificate type** (Classic Ribbon, Modern Panel, Heritage Formal) and one of **27 color & style themes** on any certificate. Set the suite-wide defaults under *Administration → Certificate settings*.
7. **Dark mode**: use the Light / Dark / System switch in the top bar or on the login page. The choice is remembered on that device.

## 4. Administration (super admin)
- **Facilities**: add sites. The short code appears in certificate numbers (e.g. `HWC-AVBH-2026-001001`).
- **Editable lists**: student types, departments, job titles, course types, locations, techniques, incident types, body parts, contributing factors.
- **Certificate settings**: validity period (default 12 months), program title, signature-line title, footer, default colors, QR code on/off.
- **System logs**: errors (resolve or purge), audit trail with field diffs, sign-in and access history, health summary.

## 5. Deploying changes
Every push to `main` runs tests, builds, and publishes to GitHub Pages (`.github/workflows/deploy.yml`).
Optional repository variables (**Settings → Secrets and variables → Actions → Variables**): `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to point the build at another Supabase project.

### Database changes
Apply new SQL files in `supabase/migrations/` in order (Supabase SQL editor or `supabase db push`).
Edge Function: `supabase functions deploy invite-user`. Optional secret `APP_ORIGINS` (comma-separated) if the site moves to a custom domain.

## 6. Backups & data retention
- Supabase takes daily backups on paid plans. On the free plan, export regularly (**Database → Backups**, or `pg_dump`).
- Free-plan projects pause after a week without activity. Regular use keeps the project awake. Upgrade to Pro for production reliability.
- Resolved errors older than 30 days can be purged from **System logs → Errors → Purge old**.
