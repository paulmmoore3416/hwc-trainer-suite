<div align="center">

<img src="public/brand/archvista-logo.png" alt="Arch Vista Behavioral Health" width="280" />

# 🛡️ Handle With Care Trainer Suite

**An invite-only training CRM for Handle With Care (HWC) instructors: student profiles, signed Basic Training completion certificates, a shareable digital badge, class rosters, training-incident tracking, and deep compliance reporting. Light and dark mode.**

[![Deploy to GitHub Pages](https://github.com/paulmmoore3416/hwc-trainer-suite/actions/workflows/deploy.yml/badge.svg)](https://github.com/paulmmoore3416/hwc-trainer-suite/actions/workflows/deploy.yml)
[![Live Suite](https://img.shields.io/badge/live-GitHub%20Pages-1f8a8a?logo=githubpages&logoColor=white)](https://paulmmoore3416.github.io/hwc-trainer-suite/)
[![License: MIT](https://img.shields.io/badge/license-MIT-c29a2c.svg)](LICENSE)
![Tests](https://img.shields.io/badge/tests-14%20passing-0ca30c?logo=vitest&logoColor=white)
![Certificate](https://img.shields.io/badge/certificate-HWC%20Basic%20Training-2E3F59)
![Digital badges](https://img.shields.io/badge/digital%20badges-LinkedIn%20ready-0a66c2?logo=linkedin&logoColor=white)
![Dark mode](https://img.shields.io/badge/dark%20mode-light%20%7C%20dark%20%7C%20system-111a2e)
![RLS](https://img.shields.io/badge/Row%20Level%20Security-enforced-1f2a44?logo=postgresql&logoColor=white)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%7C%20Postgres%20%7C%20Edge-3FCF8E?logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-3-22b5bf)

![Last commit](https://img.shields.io/github/last-commit/paulmmoore3416/hwc-trainer-suite?color=3f6fa6)
![Repo size](https://img.shields.io/github/repo-size/paulmmoore3416/hwc-trainer-suite?color=3f6fa6)
![Code size](https://img.shields.io/github/languages/code-size/paulmmoore3416/hwc-trainer-suite?color=3f6fa6)
![Top language](https://img.shields.io/github/languages/top/paulmmoore3416/hwc-trainer-suite?color=3f6fa6)

[**🚀 Open the suite**](https://paulmmoore3416.github.io/hwc-trainer-suite/) · [Setup guide](docs/SETUP.md) · [Security model](SECURITY.md) · [Design spec](docs/superpowers/specs/2026-11-17-hwc-trainer-suite-design.md)

</div>

---

## ✨ At a glance

| | Feature | What it does |
|---|---|---|
| 👩‍🏫 | **Invite-only instructors** | Only an approved instructor can invite another. One-time secure links, self-chosen passwords, every invitation logged. |
| 🧑‍🎓 | **Student profiles** | Staff records with facility, employee ID, student type, department, job title, status and full training history. |
| 🪪 | **Live certificate preview** | As you type a new student's details, the certificate fills in instantly: trainee name, completion date, valid-until date, programs, instructor and signature. |
| ✍️ | **Digital signatures** | Draw, type, or reuse your saved signature; it is placed on the instructor signature line. The trainee signature line is left blank for a wet signature. |
| 🖼️ | **One certificate** | The HWC Basic Training Certificate of Completion: navy side panel with the HWC logo, QR code to www.handlewithcare.com, and trainee/instructor signature lines. No theme or layout choices. Exported to PDF or printed at print resolution. A blank **fillable PDF** of the same certificate is in `public/downloads/` and linked from Administration. |
| 🏅 | **Digital badge** | Every certificate gets the same HWC Basic Training **COMPLETED** badge. The public credential page offers one-click **Add to LinkedIn profile** (pre-filled), LinkedIn, Facebook and X sharing, and a downloadable badge image. |
| 🌗 | **Dark mode** | Light, dark or follow-the-system, remembered per device. Charts switch to a dark-tuned palette, while certificates and signatures stay on white paper. |
| 🔎 | **Credential verification** | Every certificate has a public credential page (badge link) and verification record showing valid / expired / revoked. The printed QR code links to www.handlewithcare.com. |
| 📅 | **Classes & rosters** | Schedule classes, enroll students, record attendance, verbal/physical competency and written scores, then **bulk-issue certificates**. |
| 🩹 | **Training-incident tracking** | Injuries and near misses during training, with technique, body part, severity, contributing factors and corrective-action follow-up. |
| 📊 | **Reports & metrics** | 8 report sections, 36 KPIs, 30+ charts and tables, CSV export, print-ready layouts. |
| 🧾 | **System logs (owner only)** | Error console, full audit trail with field-level diffs, sign-in and access events, health summary. |
| 🛠️ | **Editable without code** | Facilities, nine lookup lists, and certificate defaults (validity period, instructor title, QR on/off) can all be changed from the Administration screen. |

> [!IMPORTANT]
> **Training records only.** "Incidents" means accidents and near misses that happen *during HWC training*. Never enter patient names or protected health information.

## 📸 Screenshots

<p align="center"><img src="docs/screenshots/certificate.jpg" alt="HWC Basic Training certificate of completion"/><br/><sub><b>The certificate</b>: HWC Basic Training · Certificate of Completion</sub></p>

<table>
<tr>
<td width="50%"><img src="docs/screenshots/login.jpg" alt="Login page"/><br/><sub><b>Login</b>, with the facility logo</sub></td>
<td width="50%"><img src="docs/screenshots/dashboard.jpg" alt="Dashboard"/><br/><sub><b>Dashboard</b>: KPIs, upcoming classes, expirations, follow-ups</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/reports-overview.jpg" alt="Reports overview"/><br/><sub><b>Reports</b>: overview & health check</sub></td>
<td width="50%"><img src="docs/screenshots/reports-incidents.jpg" alt="Training incident analytics"/><br/><sub><b>Training-incident analytics</b></sub></td>
</tr>
</table>

### 🌗 Dark mode

<table>
<tr>
<td width="50%"><img src="docs/screenshots/dark-login.jpg" alt="Dark login"/><br/><sub>Login in dark mode</sub></td>
<td width="50%"><img src="docs/screenshots/dark-dashboard.jpg" alt="Dark dashboard"/><br/><sub>Dashboard in dark mode</sub></td>
</tr>
</table>

### 🏅 Digital badge

<p align="center"><img src="docs/screenshots/badge.jpg" width="300" alt="HWC Basic Training completed badge"/></p>

The public credential page (`#/badge/<code>`) shows verified status and credential details, with **Add to LinkedIn profile**, social sharing and badge download.

```mermaid
flowchart LR
    A[Certificate issued] --> B[HWC Basic Training<br/>badge generated]
    B --> C["Badge link<br/>#/badge/&lt;code&gt;"]
    C -->|Email to student / copy link| D[Student opens credential page]
    D --> E[Add to LinkedIn profile<br/>pre-filled certification]
    D --> F[Share on LinkedIn · Facebook · X]
    D --> G[Download badge PNG]
    E & F --> H[Viewers click through<br/>and see live verified status]
```

### 🖼️ One certificate, one badge

The suite issues **one** certificate design and **one** badge. There are no theme or layout pickers. The certificate in the app is the same design as the blank fillable PDF in `public/downloads/HWC_Basic_Training_Certificate_Fillable.pdf`, so certificates issued in the suite and hand-filled certificates match. The `theme` / `layout` database columns are kept for existing rows, and new rows are written with fixed values. **Instructor certificates are intentionally not available in the suite.** Only student completion certificates can be generated.

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph Browser["🌐 GitHub Pages: static SPA"]
        UI["React 19 + TypeScript<br/>Tailwind · Recharts · TanStack Query"]
        CERT["Certificate renderer<br/>HWC Basic Training → PDF"]
        BADGE["Digital badge<br/>PNG export · share links"]
    end
    subgraph Supabase["🟢 Supabase"]
        AUTH["Auth<br/>(password + one-time links)"]
        PG[("PostgreSQL 17<br/>RLS on every table")]
        RPC["SQL RPCs<br/>report_metrics · my_context<br/>verify_certificate · loggers"]
        EDGE["Edge Function<br/>invite-user (service role)"]
    end
    UI -- "publishable key + user JWT" --> PG
    UI --> RPC --> PG
    UI --> AUTH
    UI -- "invite / reset link" --> EDGE --> AUTH
    EDGE --> PG
    AUTH -. "before-insert trigger:<br/>invite-only signup" .-> PG
    CERT --- UI
    BADGE --- UI
    LI["LinkedIn · Facebook · X"] -. "public #/badge link<br/>verify_certificate()" .-> RPC
```

```mermaid
sequenceDiagram
    autonumber
    actor I as Approved instructor
    participant S as Suite (Pages)
    participant F as Edge Function invite-user
    participant DB as Postgres
    actor N as New instructor
    I->>S: Invite (email, role, facilities)
    S->>F: POST with instructor's JWT
    F->>DB: verify caller is active, role ≥ requested, owns facilities
    F->>DB: insert invitation (pending)
    F->>F: generate one-time invite token
    F-->>S: secure link (valid 24 h)
    I->>N: send link (copy or email draft)
    N->>S: open link → verify token
    DB-->>DB: trigger allows signup only with pending invitation
    N->>S: choose password
    S->>DB: profile + facility access created, invite accepted, event logged
```

### 🗄️ Data model

```mermaid
erDiagram
    FACILITIES ||--o{ FACILITY_MEMBERS : has
    PROFILES ||--o{ FACILITY_MEMBERS : "belongs to"
    PROFILES ||--o| SIGNATURES : "saved signature"
    FACILITIES ||--o{ STUDENTS : employs
    FACILITIES ||--o{ TRAINING_SESSIONS : hosts
    TRAINING_SESSIONS ||--o{ ENROLLMENTS : roster
    STUDENTS ||--o{ ENROLLMENTS : attends
    STUDENTS ||--o{ CERTIFICATES : earns
    ENROLLMENTS |o--o| CERTIFICATES : "issued from"
    SIGNATURES ||--o{ CERTIFICATES : signs
    FACILITIES ||--o{ TRAINING_INCIDENTS : records
    TRAINING_SESSIONS |o--o{ TRAINING_INCIDENTS : "during"
    PROFILES ||--o{ INVITATIONS : sends
    CERTIFICATES {
        text cert_number "HWC-AVBH-2026-001001"
        text verify_code "QR"
        bool program_verbal
        bool program_physical
        date issue_date
        date expiration_date "default +12 months"
        jsonb personnel "under-signature block"
        text layout "legacy, fixed"
        text theme "legacy, fixed"
    }
```

## 🔐 Roles & permissions

| Capability | Instructor | Facility admin | Super admin |
|---|:---:|:---:|:---:|
| Students, classes, certificates, incidents (own facilities) | ✅ | ✅ | ✅ all facilities |
| Invite instructors to own facilities | ✅ | ✅ | ✅ |
| Invite facility admins | | ✅ | ✅ |
| Deactivate instructors / issue reset links | | ✅ | ✅ |
| Delete students, certificates, classes | | ✅ | ✅ |
| Change roles | | | ✅ |
| Facilities, editable lists, certificate settings | | | ✅ |
| **System logs** (errors, audit trail, sign-ins) | | | ✅ owner only |

Super-admin accounts are defined in a private database allow-list (`private.super_admin_emails`). They are **not** stored in this public repository.

## 📊 Reports & metrics catalog

```mermaid
pie showData title Charts & tables per report section
    "Overview" : 3
    "Training Activity" : 5
    "Compliance & Expirations" : 5
    "Outcomes" : 4
    "Instructors" : 2
    "Locations" : 3
    "Student Types" : 3
    "Training Incidents" : 7
```

| Section | Highlights |
|---|---|
| **Overview** | 12 KPI tiles, training volume trend, health-check meters (compliance, pass rate, first-attempt pass, attendance), days since last incident, compliance by facility |
| **Training Activity** | Classes, hours and trainees by month, passed vs not passed, day-of-week distribution, course-type table with pass rates |
| **Compliance & Expirations** | 12-month expiration forecast, status by department, live lists of expiring (90 d), expired and never-certified staff |
| **Outcomes** | Pass / first-attempt pass rates, results by course and student type, average written score, remediation counts, certificates by program |
| **Instructors** | Trainees per lead instructor, scorecard (classes, hours, pass rate, incidents, instructor-cert expiry) |
| **Locations** | Classes and incidents by facility and room, facility compliance summary |
| **Student Types** | Certification status by student type, students by department, record status |
| **Training Incidents** | Incidents and injuries per 100 trainees, monthly trend, by type / technique / body part / contributing factor / severity / involved person, follow-up status |

Every chart has a **table view** and **CSV export**. All aggregation runs in Postgres (`report_metrics`, `security invoker`), so it scales to large datasets and respects each user's facility access.

## 📦 Codebase at a glance

```mermaid
pie showData title Lines of code by area
    "Pages (19 screens)" : 5485
    "Components" : 1944
    "Lib (auth, theme, certificates, data)" : 1010
    "SQL migrations" : 1120
    "Edge Function" : 166
    "Tests" : 113
```

```
hwc-trainer-suite/
├── src/
│   ├── pages/            Dashboard, Students, StudentForm, Classes, Certificates, Incidents, Reports, Team, Admin, Logs …
│   ├── components/       Certificate, Badge & share panel, SignaturePad, charts, ThemeToggle, UI kit
│   └── lib/              Supabase client, auth context, certificate builder, error logging, formatting, CSV
├── supabase/
│   ├── migrations/       Schema · RLS & security · reporting · seed · views
│   └── functions/        invite-user Edge Function
├── tests/                Vitest unit tests
├── docs/                 Setup guide, design spec, screenshots
└── .github/workflows/    Build, test & deploy to GitHub Pages
```

## 🚀 Quick start (local development)

```bash
git clone https://github.com/paulmmoore3416/hwc-trainer-suite.git
cd hwc-trainer-suite
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # typecheck + production build
```

The app points at the production Supabase project by default. To use your own, copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, then apply `supabase/migrations/*` in order and deploy `supabase/functions/invite-user`. Full steps are in **[docs/SETUP.md](docs/SETUP.md)**.

## 🛡️ Security highlights

- **Row Level Security on every table.** Instructors only ever see their own facilities' data. Logs are visible to the owner only.
- **Invite-only at the database level.** A `before insert` trigger on `auth.users` rejects any signup without a pending invitation.
- **Privilege-escalation guard.** Users cannot change their own role, status or email, and the super-admin role is reserved.
- **Service-role key never leaves the server.** Privileged actions run in the `invite-user` Edge Function after verifying the caller.
- **Audit trail.** Field-level before/after diffs on all core tables. Errors and sign-in events are logged with rate limiting.
- **Strict Content-Security-Policy** in production, CSV formula-injection protection, and one-time, 24-hour invite and reset links.

See [SECURITY.md](SECURITY.md) for the full model.

## ⚖️ Notice

"Handle With Care" and the HWC Behavior Management System are trademarks of their respective owner. This suite is an independent record-keeping tool built for a certified HWC instructor. It is not affiliated with or endorsed by Handle With Care. The HWC logo appears on the certificate, badge and credential page for use by a certified HWC instructor. The Arch Vista Behavioral Health logo belongs to Arch Vista Behavioral Health and appears on the login page for the facility's own use.

<div align="center"><sub>Built for HWC instructors · © 2026</sub></div>
