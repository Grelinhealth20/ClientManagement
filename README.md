# Grelin Health — Client Onboarding & Tracking Platform

Enterprise-grade platform built with **Next.js 14 (App Router)**, **MySQL**, **JWT** authentication, and **AES-256-GCM** field encryption. Fully integrated frontend and backend in a single Node.js codebase, deployed to **Vercel**.

---

## Features

**Single login panel** routes automatically to the Super Admin Portal or Client Dashboard based on role.

### Super Admin Portal
- **Client management** — create, edit, delete organizations (with cascading user deletion)
- **User management** — create, edit, delete, reset passwords, restrict/restore login access
- **Dashboard access controls** — grant or revoke specific dashboard sections per user
- **Checklist Requests** — send structured requirement lists to clients with per-item upload/download permissions
- **Payer Enrollment Tracking** — facility and per-provider enrollment status with timestamped follow-up notes
- **Support Tickets** — threaded ticket inbox for client-submitted requests (unique codes like `GH-4F2A9C`)
- **Super Admin management** — master admin can create and delete other super admins
- **Overview dashboard** — live stats (total/active clients, users, restrictions) + audit trail

### Client Dashboard
- **Forced first-login password reset** — mandatory popup blocks all content until a new password is set
- **Multi-step Onboarding Wizard** — Facility → Providers → System/Payer Access → Review & Submit
  - NPI autofill via NPPES registry (facility Type-2 and provider Type-1)
  - Encrypted autosave so users can log out mid-flow and resume exactly where they left off
  - Direct-to-S3 document uploads (presigned PUT URLs, bypasses Vercel body size limit)
- **Provider self-service intake** — tokenized links let providers fill in their own section without a login
- **Checklist Requests** — view requirements from admin, mark items complete, upload/download files
- **Payer Enrollment** — view facility and provider enrollment status
- **Support Tickets** — submit tickets and respond in thread
- **Intra-client messaging** — users within the same organization can message each other
- Sections shown are driven by access granted in the admin panel

### Security
- Passwords hashed with **bcrypt** (cost 12)
- Sensitive fields (phone, onboarding drafts) encrypted with **AES-256-GCM**
- Stateless **JWT** sessions in `httpOnly`, `secure`, `sameSite` cookies
- Live restriction/deletion enforcement on every authenticated request
- Login brute-force protection — DB-backed rate limiting per account
- No user enumeration on login
- Full security header set: **HSTS**, **Content-Security-Policy**, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
- Fail-fast environment validation — misconfigured deployments error immediately with a clear message

### Operations
- `GET /api/health` — unauthenticated liveness + DB readiness probe

---

## Database

Tables are created by the **migration step**, not at request time:

```bash
npm run migrate
```

| Table | Purpose |
|---|---|
| `clients` | Onboarded organizations |
| `users` | Super admins + client users (role-based) |
| `audit_log` | Immutable trail of privileged actions |
| `onboarding_drafts` | Autosaved encrypted wizard state per client |
| `onboarding_documents` | Uploaded document metadata (facility + provider) |
| `onboarding_submissions` | Immutable approval snapshots with reference codes |
| `provider_access_links` | Tokenized links for provider self-service intake |
| `checklist_requests` | Admin-created requirement lists per client |
| `checklist_items` | Individual items within a checklist |
| `checklist_documents` | Admin and client file attachments on checklist items |
| `enrollment_payers` | Facility and provider payer enrollment records |
| `enrollment_followups` | Timestamped notes on enrollment rows |
| `client_tickets` | Support tickets raised by clients |
| `ticket_responses` | Threaded responses on tickets |
| `client_messages` | Intra-client message board |

A **bootstrap Super Admin** is seeded by the same command, using credentials from environment variables.

> `npm run migrate` is idempotent — safe to run on every deploy. The `vercel-build` script runs it automatically before `next build`.

---

## Local Development

```bash
npm install
cp .env.example .env
# Fill in real values in .env (see Environment Variables below)
npm run migrate   # creates tables + seeds the bootstrap Super Admin
npm run dev
```

Sign in with the bootstrap Super Admin credentials:

- **Email:** value of `SUPER_ADMIN_EMAIL`
- **Password:** value of `SUPER_ADMIN_PASSWORD`

> On first login you will be prompted to set a new password before the portal unlocks. This applies to every user — the seeded/admin-issued password is a one-time credential.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in real values, or set them in **Vercel → Project → Settings → Environment Variables**. All variables are validated at runtime by `src/lib/env.js` — a missing or malformed value fails fast with a clear error.

| Variable | Required | Notes |
|---|:---:|---|
| `DB_HOST` | ✅ | MySQL host |
| `DB_USER` | ✅ | MySQL username |
| `DB_PASSWORD` | ✅ | MySQL password |
| `DB_NAME` | ✅ | MySQL database name |
| `DB_PORT` | ⬜ | Default `3306` |
| `DB_CONNECTION_LIMIT` | ⬜ | Pool size per serverless instance (default `5`) |
| `JWT_SECRET` | ✅ | Min 32 chars — `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | ✅ | Exactly 64 hex chars (32 bytes) — `openssl rand -hex 32` |
| `AWS_ACCESS_KEY_ID` | ✅ | AWS credentials for S3 document storage |
| `AWS_SECRET_ACCESS_KEY` | ✅ | AWS credentials for S3 |
| `S3_REGION` | ✅ | S3 bucket region (also accepts `AWS_REGION`) |
| `S3_BUCKET` | ✅ | S3 bucket name |
| `SUPER_ADMIN_EMAIL` | ⬜ | Bootstrap admin email — seeded when both email + password are set |
| `SUPER_ADMIN_PASSWORD` | ⬜ | Bootstrap admin password (min 8 chars) |
| `SUPER_ADMIN_NAME` | ⬜ | Bootstrap admin display name (default `"Super Admin"`) |
| `MASTER_ADMIN_EMAIL` | ⬜ | Override master admin email (defaults to `SUPER_ADMIN_EMAIL`) |
| `SESSION_TTL_HOURS` | ⬜ | Session lifetime in hours (default `12`) |

> ⚠️ **Never commit `.env` to source control.** It is in `.gitignore`.  
> ⚠️ **Do not rotate `ENCRYPTION_KEY` after data has been written** — existing encrypted fields will become undecryptable.

---

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project in Vercel (Next.js is auto-detected).
3. Add all variables from `.env` under **Project → Settings → Environment Variables** (Production + Preview).
4. Ensure your MySQL host accepts connections from Vercel's egress IPs (allowlist / security group). Keep `DB_CONNECTION_LIMIT` small (5 is reasonable) since each serverless function instance holds its own pool.
5. The `vercel-build` script (`npm run migrate && next build`) runs automatically — migrations apply before every build, keeping the schema current.
6. Deploy.

> **Latency note:** the app's floor is one MySQL round trip per request. Deploying Vercel functions in the same AWS region as your database eliminates most of that cost.

---

## Project Structure

```
src/
  app/
    login/                         # Single login panel (admin + client)
    admin/                         # Super Admin Portal (guarded)
      page.js                      #   Overview + live stats + audit
      clients/page.js              #   Client organization CRUD
      users/page.js                #   User CRUD + reset/restrict
      access/page.js               #   Dashboard access controls
      requests/page.js             #   Checklists, enrollment, tickets
      super-admins/page.js         #   Super admin management (master only)
    dashboard/                     # Client Dashboard (top-nav only)
      page.js                      #   Client overview
      onboarding/page.js           #   Multi-step onboarding wizard
    provider-intake/[token]/       # External provider self-service intake
    api/
      health/                      #   Liveness + DB readiness probe
      auth/{login,logout,me,       #   Authentication
            change-password}/
      admin/clients/…              #   Client + onboarding admin endpoints
      admin/users/…                #   User + access + reset + restrict
      admin/checklists/…           #   Checklist request management
      admin/enrollment/…           #   Payer enrollment management
      admin/tickets/…              #   Ticket management
      admin/notifications/         #   Audit log feed
      admin/super-admins/          #   Super admin CRUD (master admin only)
      client/checklists/…          #   Client checklist view + upload
      client/enrollment/           #   Client enrollment view
      client/tickets/…             #   Client ticket submission + responses
      client/messages/             #   Intra-client messaging
      onboarding/…                 #   Wizard draft, documents, NPPES, submit
      provider-intake/[token]/     #   Token-gated provider intake
  lib/
    env.js           # Validated, fail-fast config (single source of truth)
    db.js            # MySQL pool + migrations + audit writer
    crypto.js        # bcrypt + AES-256-GCM
    jwt.js           # jose sign/verify + cookie helpers
    auth.js          # Session guards (API + client + master)
    rateLimit.js     # DB-backed login brute-force protection
    permissions.js   # Dashboard section registry
    clientAccess.js  # Client dashboard section gate
    s3.js            # S3 client + presigned URLs + document key builders
  components/        # UI system (Button, Modal, Toast, shells, wizard steps, …)
  middleware.js      # Edge route protection
scripts/
  migrate.mjs        # Standalone migration runner (npm run migrate)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | JavaScript |
| Styling | Tailwind CSS 3 + PostCSS |
| Animations | Framer Motion 11 |
| Database | MySQL via `mysql2` |
| Auth | Stateless JWT via `jose` |
| Password hashing | bcryptjs (cost 12) |
| Field encryption | AES-256-GCM (Node `crypto`) |
| Object storage | AWS S3 (`@aws-sdk/client-s3`) |
| NPI lookup | CMS NPPES public API (no key required) |
| Deployment | Vercel |
| Runtime | Node.js ≥ 18.17 |

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login (rate-limited, no user enumeration) |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/auth/me` | Current session |
| `POST` | `/api/auth/change-password` | Change own password |

### Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | App + DB liveness probe |

### Admin — Clients
| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/admin/clients` | List / create clients |
| `GET/PATCH/DELETE` | `/api/admin/clients/[id]` | Get / update / delete client |
| `GET` | `/api/admin/clients/[id]/users` | List client's users |
| `GET` | `/api/admin/clients/[id]/onboarding` | Client onboarding state |
| `GET` | `/api/admin/clients/[id]/documents` | Client onboarding documents |
| `GET` | `/api/admin/clients/[id]/enrollment` | Client payer enrollment |
| `GET` | `/api/admin/clients/[id]/checklists` | Client checklist requests |
| `GET` | `/api/admin/clients/[id]/tickets` | Client support tickets |

### Admin — Users
| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/admin/users` | List / create users |
| `GET/PATCH/DELETE` | `/api/admin/users/[id]` | Get / update / delete user |
| `POST` | `/api/admin/users/[id]/reset-password` | Reset user password |
| `POST` | `/api/admin/users/[id]/restrict` | Restrict / restore login |
| `GET/PUT` | `/api/admin/users/[id]/access` | Get / update section permissions |

### Admin — Requests & Engagement
| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/admin/checklists/[id]` | Checklist request CRUD |
| `GET/PATCH/DELETE` | `/api/admin/checklist-items/[id]` | Checklist item CRUD |
| `GET/POST` | `/api/admin/checklist-docs/[id]` | Admin document attachments |
| `GET/POST` | `/api/admin/enrollment/[id]` | Enrollment payer CRUD |
| `POST` | `/api/admin/enrollment/[id]/followups` | Add follow-up note |
| `GET/PATCH` | `/api/admin/tickets/[id]` | View / update ticket status |
| `GET` | `/api/admin/notifications` | Audit log / notification feed |

### Admin — Super Admins (master admin only)
| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/admin/super-admins` | List / create super admins |
| `DELETE` | `/api/admin/super-admins/[id]` | Delete super admin |

### Client
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/client/checklists` | Own checklist requests |
| `PATCH` | `/api/client/checklist-items/[id]` | Mark item complete |
| `GET/POST` | `/api/client/checklist-items/[id]/documents` | Upload / list item documents |
| `GET/DELETE` | `/api/client/checklist-docs/[id]` | View / delete own document |
| `GET` | `/api/client/enrollment` | Own payer enrollment |
| `GET/POST` | `/api/client/tickets` | View / submit tickets |
| `POST` | `/api/client/tickets/[id]/responses` | Add ticket response |
| `GET/POST` | `/api/client/messages` | Intra-client messaging |

### Onboarding
| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/onboarding` | Get / save onboarding draft |
| `GET/POST` | `/api/onboarding/documents` | List / initiate document upload |
| `GET/DELETE` | `/api/onboarding/documents/[id]` | Document detail / delete |
| `POST` | `/api/onboarding/documents/presign` | Get S3 presigned PUT URL |
| `POST` | `/api/onboarding/documents/confirm` | Confirm upload completed |
| `GET/POST` | `/api/onboarding/folders` | S3 folder management |
| `GET` | `/api/onboarding/nppes` | NPPES NPI registry proxy |
| `GET/POST` | `/api/onboarding/provider-links` | Create / list provider invite tokens |
| `POST` | `/api/onboarding/submit` | Submit onboarding for review |

### Provider Intake (token-gated, no login required)
| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/provider-intake/[token]` | External provider self-service intake |

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run migrate` | Run DB migrations + seed bootstrap admin (idempotent) |
| `npm run lint` | Run ESLint |
| `npm run clean` | Remove `.next`, `.next-dev`, and `out` build artifacts |
| `npm run vercel-build` | `migrate` then `build` (used by Vercel on deploy) |
