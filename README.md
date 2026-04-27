# FFC TMS — Phase 1 + Driver PWA

> **Fresh Fruits Company · Transport Management System**
> Phase 1: Vehicles · Drivers · Trips · Dispatch Board · Dashboard + Driver PWA

---

## 🗂️ What's Included

| Module | Page | Phase |
|---|---|---|
| M05 — Operations Dashboard | `/dashboard` | ✅ P1 |
| M01 — Vehicle Master | `/fleet/vehicles` | ✅ P1 |
| M02 — Driver Master | `/fleet/drivers` | ✅ P1 |
| M03 — Trip & Delivery | `/operations/trips` | ✅ P1 |
| M04 — Dispatch Board | `/operations/dispatch` | ✅ P1 |
| M08 — Document Expiry | `/compliance/documents` | ✅ P1 |
| M11 — Driver PWA | `/driver` | ✅ Included |

---

## 🚀 Deploy in 4 Steps (No Code)

### Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name it `ffc-tms`, choose a strong DB password, select **Middle East** region
3. Wait for project to provision (~2 min)
4. Go to **SQL Editor** → paste the contents of `supabase/migrations/001_phase1_schema.sql` → **Run**
5. Then paste `supabase/seed/001_seed.sql` → **Run** (adds branches + vendors)
6. Go to **Settings → API** → copy:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
7. Go to **Authentication → Settings**:
   - Set **Site URL** to your Cloudflare Pages URL (you'll get this in Step 3)
   - Disable email confirmation for testing (enable in production)
8. Go to **Authentication → Users** → **Invite User** → create your first admin account
9. Go to **SQL Editor** and run:
   ```sql
   INSERT INTO users (id, email, full_name, role_id, status)
   VALUES (
     '<paste user UUID from Auth>',
     '<your email>',
     'Admin User',
     (SELECT id FROM roles WHERE code = 'super_admin'),
     'active'
   );
   ```

---

### Step 2 — GitHub Setup

1. Go to [github.com](https://github.com) → **New repository**
2. Name it `ffc-tms` → **Private** → **Create**
3. Upload all these project files (drag & drop in GitHub web UI, or use GitHub Desktop)
4. Go to **Settings → Secrets and variables → Actions** → add these secrets:
   - `NEXT_PUBLIC_SUPABASE_URL` — from Step 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Step 1
   - `NEXT_PUBLIC_APP_URL` — your Cloudflare URL (fill in after Step 3)
   - `CLOUDFLARE_ACCOUNT_ID` — from Step 3
   - `CLOUDFLARE_API_TOKEN` — from Step 3

---

### Step 3 — Cloudflare Pages Setup

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Pages**
2. Click **Create a project** → **Connect to Git** → select your GitHub repo
3. Configure build:
   - **Framework**: `Next.js (Static HTML Export)`
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
4. Add environment variables (same as GitHub secrets above)
5. Click **Save and Deploy**
6. Copy your Pages URL (e.g. `https://ffc-tms.pages.dev`) → go back and update `NEXT_PUBLIC_APP_URL` in both GitHub and Cloudflare
7. Go to Cloudflare **Account Settings → API Tokens** → create token with `Cloudflare Pages: Edit` permission → copy as `CLOUDFLARE_API_TOKEN`
8. Copy your **Account ID** from Cloudflare dashboard right sidebar → save as `CLOUDFLARE_ACCOUNT_ID`

---

### Step 4 — First Login

1. Go to your Cloudflare Pages URL
2. Log in with the admin email you created in Step 1
3. Go to `/admin` to add branches, then start adding vehicles and drivers
4. Driver PWA is at `/driver/login`

---

## 🔧 Local Development

```bash
# Clone your repo
git clone https://github.com/your-org/ffc-tms.git
cd ffc-tms

# Install dependencies
npm install

# Create .env.local from template
cp .env.example .env.local
# Fill in your Supabase URL and keys

# Run dev server
npm run dev
# Open http://localhost:3000
```

---

## 👤 Adding a Driver to the PWA

1. In the office portal, go to **Drivers** → **Add Driver** → fill all fields including **Employee ID**
2. Go to Supabase → **Authentication → Users** → **Invite User**
   - Email: `emp-1021@driver.ffc.internal` (lowercase employee ID + @driver.ffc.internal)
   - Set password = 6-digit PIN
3. Copy the new user's UUID → in SQL Editor run:
   ```sql
   UPDATE drivers
   SET auth_user_id = '<paste UUID>'
   WHERE employee_id = 'EMP-1021';
   ```
4. Driver can now log in at `/driver/login` with their Employee ID + PIN

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS with FFC brand tokens |
| Database | Supabase (PostgreSQL 15 + RLS) |
| Auth | Supabase Auth (office) + PIN auth (drivers) |
| Hosting | Cloudflare Pages (CDN, global edge) |
| CI/CD | GitHub Actions → Cloudflare Pages |
| PWA | next-pwa (offline-capable driver portal) |

---

## 📁 File Structure

```
src/
├── app/
│   ├── login/              # Office login
│   ├── dashboard/          # Operations dashboard
│   ├── fleet/
│   │   ├── vehicles/       # Vehicle master list + detail
│   │   └── drivers/        # Driver master list + detail
│   ├── operations/
│   │   ├── trips/          # Trip management
│   │   └── dispatch/       # Dispatch board
│   ├── compliance/
│   │   └── documents/      # Doc expiry tracker
│   └── driver/             # Driver PWA
│       ├── login/          # Driver PIN login
│       ├── trips/[id]/     # Active trip management
│       └── fuel/           # Fuel entry
├── components/
│   └── layout/
│       └── AppShell.tsx    # Sidebar + topbar
├── lib/
│   ├── supabase/           # Supabase clients
│   └── utils.ts            # Helpers + formatters
└── types/
    └── index.ts            # All TypeScript types

supabase/
├── migrations/
│   └── 001_phase1_schema.sql   # Complete DB schema
└── seed/
    └── 001_seed.sql            # Branches + vendors seed

.github/
└── workflows/
    └── deploy.yml          # GitHub Actions → Cloudflare
```

---

## 🔐 Security Notes

- Row Level Security (RLS) is enabled on all tables
- Drivers can only see their own trips; managers see all
- Vehicle overlap constraint prevents double-booking at DB level
- All secrets stored in GitHub Secrets / Cloudflare env vars — never in code
- `.gitignore` excludes all `.env` files

---

## 📞 Phase 2 Preview

When ready for Phase 2, add:
- `supabase/migrations/002_phase2_fuel_maintenance.sql`
- `/src/app/cost/fuel/` and `/src/app/cost/maintenance/`
- Update sidebar nav in `AppShell.tsx`

The database schema is already Phase 2-ready (`fuel_entries`, `maintenance_requests` tables referenced in schema).
