# G & J Starkey workshop preview

Open **http://127.0.0.1:3080** after starting the Docker service. The local preview uses the Starkey green (#AFF000), a black navigation sidebar and a light working area.

## Hosted design preview

The repository also includes a Vercel deployment configuration. Without a hosted database, it displays **read-only sample data** so the interface can be reviewed online. Changes cannot be saved in that mode. Supabase can be connected afterward using the PostgreSQL adapter and staff sign-in configuration in [Vercel setup](docs/VERCEL-SETUP.md).

## Run with Docker

Start Docker Desktop, then run these commands from this folder:

```powershell
docker compose up --build -d
```

To stop the app without removing its records:

```powershell
docker compose stop
```

To start it again:

```powershell
docker compose start
```

The named volume `starkeygms_starkey-data` keeps the SQLite database across container restarts and image rebuilds. Removing that volume deletes the preview records. The port is bound only to this computer, on 127.0.0.1:3080.

## Try the first workflow

1. Open **Overview** to review the example workshop.
2. Open **Workshop diary** to see the three technician columns and select a job. Change its date, start time or technician to reschedule it.
3. Open **Jobs & estimates**, create an estimate, then convert it to a booking. Add parts/labour lines, quantities, prices and VAT.
4. Start work, then mark it ready to collect. Create an invoice from the ready job.
5. Print the invoice or save it as PDF using the browser print dialog. Record a payment collected outside the app. Part payments retain the outstanding balance.
6. Use **Customers & vehicles** to add a customer and their vehicle before booking them in.
7. Use **Parts & stock** to add products and record explained stock adjustments.
8. Use **Reminders** to save MOT/service reminders and preview their text. Messages are not sent.
9. Use **Reports** and **Invoices** to see totals and download a general sales CSV.

Five sample customers, five sample vehicles, six jobs/estimates and stock records are created once when a new database is opened. Customer addresses ending in `.test` and 07700 900xxx numbers are fictional. Your changes are saved to the local database.

## What this version includes

- Overview, three-column day diary, jobs/estimates, customers/vehicles, invoices, parts/stock, reminders, reports, connections and business settings screens.
- Working creation and editing of quotes/jobs, customer and vehicle creation, rescheduling and conflict prevention.
- Exact-penny calculation of parts/labour totals, mixed 0%/20% line VAT, finalised invoice snapshots, manual part/final payments and invoice printing.
- Stock catalogue, minimum levels, adjustment reasons and workshop activity history.
- Saved reminders and message previews, all-invoice sales reports, CSV download and branded document settings.
- SQLite persistence, Docker health check and a restart-persistent Docker volume.

## Remaining Starter / Lite scope

This is an initial working design preview, not completed Starter/Lite parity. Next milestones are reusable labour operations, purchase orders/receipts/returns/credits, customer editing and richer vehicle history, estimate revisions/authorisations, day/week/month diary with drag-and-drop, automated reminders, provider-specific accounting formats/sync, staff access controls and the licensed external connections.

Supplier ordering (ECP/GSF/NAPA/Dingbro), HaynesPro E3, Autodata, DVSA lookup, email/SMS and accounting sync are **not connected**. The Connections screen makes this explicit. The sales CSV is a general export, not a verified import format for an accounting vendor. Payments only record money collected elsewhere; no card is charged.

No Pro modules, customer portal, EVHC, photo/video uploads or technician time tracking have been added. This preview prioritises the core reception workflow. Sign-in, access control, production configuration and deployment are required before using the intended live subdomain with customer data.

## Local development

Requires Node.js 24. Install the locked dependencies before running directly:

```powershell
npm ci
```

```powershell
npm start
```

This also uses port 3080, so stop Docker first if running directly. Direct Node execution uses `data/workshop.sqlite`; Docker uses its own named volume. They are independent databases.

```powershell
npm run check
npm test
```

The tests start an isolated server with a temporary database. They cover the booking-to-invoice workflow, mixed VAT, duplicate records, overlapping bookings, stale changes, invoice immutability, overpayment, part/final payments, stock limits, cross-site request rejection and persistence.

## Implementation notes

The application uses a small Node HTTP server and browser-native HTML/CSS/JavaScript. Local collections use built-in SQLite; hosted mode supports PostgreSQL and Better Auth. A normalised schema, structured stock ledgers and scalable reporting paths belong in the next engineering phase. All saved server changes are transactional, and final invoices copy their original customer, vehicle, business and line details.

Original research and the longer-term plan remain in `docs/`. The original full plan describes the target system, not features already built.

