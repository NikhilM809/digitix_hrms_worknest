# Digitix Flow

Project management, employee time tracking, sales reporting, and monthly billing for Digitix Labs.

## Run locally

Worknest uses its **own PostgreSQL database** (`digitix_flow`). Do not point `DATABASE_URL` at the HRMS database (`digitix_hrms`).

```bash
# once, as a Postgres superuser
psql -U postgres -d postgres -f scripts/create-worknest-db.sql
```

Copy `.env.example` to `.env`, then:

```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo logins

Worknest seed accounts (projects only; no HRMS menu):

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@digitix.local | Digitix@123 |
| Senior Manager | asha@digitix.local | Digitix@123 |
| Manager | arjun@digitix.local | Digitix@123 |
| Employee | john@digitix.local | Digitix@123 |

HRMS seed accounts (same email/password as the HRMS app; also unlocks the HRMS menu):

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@digitixlabs.com | Admin@123 |
| Admin | priya.sharma@digitixlabs.com | Admin@123 |
| Manager | manager@digitixlabs.com | Welcome@123 |
| Employee | nikhil@digitixlabs.com | Welcome@123 |
| Employee | amit.patel@digitixlabs.com | Welcome@123 |
| Employee | sneha.gupta@digitixlabs.com | Welcome@123 |

## What this version covers

- Roles: Admin, Senior Manager, Manager, Employee (UI + API)
- Admin and Senior Manager can create projects and manage people (including Excel import)
- Project lifecycle: Bid → Need to Start → Script WIP → Changes → Live → Close
- Tasks, assignments, self-assignment
- Hours by Initial Scripting / Changes / Live
- Overdue, ETA approaching, and hours-over-estimate alerts
- Admin-only financials, sales charts, and billing PDFs
- Light / dark mode

PostgreSQL is required. HRMS and Worknest stay on separate databases (`digitix_hrms` and `digitix_flow`). One Worknest login loads both: Project Management from `digitix_flow`, HRMS from `digitix_hrms`, matched by email.
