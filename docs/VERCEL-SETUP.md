# Vercel preview and Supabase connection

## First deployment — no database needed

Import `AaronJames37/starkey-gms` into Vercel. Use the **Other** framework preset, Node.js 24, the root directory and the committed `vercel.json`. Installation is `npm ci`, validation is `npm run check`, and the static output is `public`. API requests route to `api/index.mjs`.

With no `DATABASE_URL`, Vercel runs a **read-only design preview**. It serves fictional records without opening a database or storing workshop changes. It needs no sign-in because it contains only generated sample data. The banner and sidebar identify this mode. The Docker preview continues to allow local saving.

Review the deployment's `.vercel.app` URL first. Then add `gms.gandjstarkey.co.uk` under Project Settings > Domains. Copy the exact project-specific CNAME target shown by Vercel into the authoritative DNS provider's `gms` CNAME record.

## Connect Supabase later

The server supports PostgreSQL, including a Supabase PostgreSQL connection. Configure these **server-only** variables in Vercel:

| Variable | Purpose |
|---|---|
| DATABASE_URL | Supabase's PostgreSQL connection string suitable for the hosting environment; use its pooler connection for serverless hosting |
| BETTER_AUTH_SECRET | A unique random secret of at least 32 characters |
| BETTER_AUTH_URL | The exact HTTPS origin of the hosted workshop |
| STAFF_EMAILS | Comma-separated staff email allowlist |
| SEED_DEMO | `false` for a new empty workshop, `true` only for an isolated demonstration database |

Use separate databases/projects for testing and production. Production credentials should not be available to untrusted preview deployments. Never put database passwords or service-role keys in the public JavaScript or repository.

Before switching a deployment to the connected mode, load the same server-only environment securely in a local terminal and run:

```powershell
npm run db:migrate
npm run staff:create
```

The account command asks for name, allowlisted email and a hidden password. Public sign-up is disabled; only the local provisioning script can create an allowlisted account. Sign-in uses Better Auth with database-backed sessions, password handling and rate limiting. Removing an email from the allowlist blocks its access even if it has an existing session. Password-reset delivery and full staff administration remain later milestones.

Set the Vercel variables and redeploy only after the account/schema checks succeed. When `DATABASE_URL` is present, the design-preview bypass switches off; missing sign-in configuration blocks access to workshop records. The hosted app never falls back to a disposable SQLite file.

The initial PostgreSQL adapter stores a single transactional workspace document under a row/advisory lock. This preserves the prototype's booking/payment consistency across concurrent server instances. It is a foundation for the preview, not the normalised final production schema described in the original plan. Local SQLite records are not uploaded or migrated automatically.

## Verification

Before real customer records are used, verify staff sign-in and sign-out, failed sign-in, unauthorised API requests, record persistence across deployments, concurrent booking attempts, invoice/payment totals and backup/restore. The current hosted preview uses sample data until those checks are complete.

