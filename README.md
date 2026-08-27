 # F EMMANUEL 85 VENTURES

F EMMANUEL 85 VENTURES is a susu contribution and payout manager for keeping customer records, cash movements, balances, and daily summaries in one place.

## Run it

Install dependencies with `npm install`, then run `npm start`. The app loads its public Supabase settings from `/api/config`; opening `index.html` directly is supported only as an offline local-data fallback.

When Supabase is configured, accounts, customers, transactions, staff changes, imports, and resets are persisted in the database. Local storage is used only when running without the server configuration.

## Cloud database setup

The cloud database schema is in `supabase/schema.sql`.

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in `supabase/schema.sql`, and run it.
3. Open **Project Settings > API** and copy the Project URL and anon key.
4. Copy `.env.example` to `.env` for local development and fill in the three Supabase values. Do not put keys in `js/`.

The anon key may be used by the frontend only because Row Level Security is enabled. Never put a Supabase service-role key in `js/` or any browser-visible file.

The repository includes a server-side API in `server.js` and Vercel routing in `vercel.json`. In Vercel Project Settings > Environment Variables, add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `CORS_ORIGIN` for Production, Preview, and Development as needed. Redeploy after saving. Never commit the service-role key or put it in `js/`.

The login and role controls use Supabase Auth and the database policies enforce access server-side. Keep RLS enabled and never expose the service-role key.

### Administrator access

The database supports three roles: `administrator`, `manager`, and `staff`. Administrators have manager-level monitoring and management access, while staff can record transactions. Create the administrator's user through Supabase Auth, then assign the role to that user's profile from the SQL Editor:

```sql
update public.profiles
set role = 'administrator'
where id = 'AUTH_USER_UUID';
```

Replace `AUTH_USER_UUID` with the administrator's Auth user ID. Do not add administrator self-signup to the public login screen.

## Current capabilities

- Customer CRUD with next-of-kin and phone details
- Cash In and Cash Out records with payment book numbers
- Per-customer balance calculations and insufficient-balance protection
- Daily and monthly reports
- Search, date filters, responsive navigation, and JSON import/export
- Clickable PB numbers open a customer's complete transaction history without deleting records
- Manager CSV export that prepares a file for attachment in an email client

The transaction email button downloads a CSV and opens a draft email on the current device. Automatic delivery to a fixed manager address requires a backend email provider and a configured manager email; no email password or API key belongs in the frontend.

## Recommended next features

1. **User accounts and permissions:** separate admins, tellers, and auditors with sign-in and an activity trail.
2. **Cloud sync:** move data from local storage to a hosted database with automatic backups and multi-device access.
3. **Receipt printing:** generate branded receipts with a transaction number, customer signature, and printable layout.
4. **Contribution schedules:** define weekly or monthly targets, due dates, missed-payment alerts, and member standing.
5. **SMS or WhatsApp notifications:** send payment confirmations, balance updates, and payout reminders.
6. **Reconciliation:** compare physical cash with recorded cash and record opening and closing cash counts.
7. **Audit controls:** prevent deletion after approval, add reversal transactions, and keep immutable change history.
8. **Analytics:** add collection trends, payout forecasts, top active members, and exportable spreadsheet reports.
