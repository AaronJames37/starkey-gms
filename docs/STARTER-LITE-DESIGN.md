# Starter and Lite — first design build

## Visual decisions

- Familiar black/dark-green navigation, exact Starkey #AFF000 action green and a warm light working surface.
- The staff homepage answers: what is booked, what is underway, what is ready, and what needs attention?
- Three technician columns establish the Starter diary layout. Team names are illustrative sample data.
- Workshop records use registration, customer and job title as their main visual anchors.
- Jobs and estimates share one editable record, then finalised invoices keep an immutable copy of the agreed figures.
- Colour is paired with a written status. Forms use native keyboard-accessible controls and modal dialogs.
- Narrow screens collapse navigation, stack cards and allow tables/diary to scroll within their own area.
- Printed estimates and invoices use the business details saved at the relevant point, with a simple ink-friendly layout.

## Review priorities

Review the overall palette and spacing, sidebar labels, dashboard usefulness, diary density, booking form, parts/labour editor and invoice layout before deeper integrations are implemented. The current design deliberately keeps Pro navigation out of the first build.

## Current scope by Starter/Lite category

| Category | Built in this preview | Still to deliver |
|---|---|---|
| Diary | Three-column day view, booking form, date navigation, rescheduling and overlap checks | Drag/drop, week/month views, hours/shift configuration and richer capacity management |
| Estimates | Itemised labour/parts, quantities, VAT, printed estimate and conversion to booking | Reusable labour catalogue, version history, customer delivery/authorisation and expiry rules |
| Invoicing | Generate from ready job, printed invoice, exact totals, manual payments and balances | Credits, deposits, account rules, payment chasing and controlled reversals |
| Customer/vehicle records | Create records, duplicate registration checks, contact preference, manual MOT date, job list | Editing/merge, detailed billing addresses, ownership history and communication consent history |
| Supplier connections | Clearly labelled connection plans and supplier records | Live supplier stock/prices/catalogues/orders and approved API access |
| Stock | Products, supplier association, purchase/sale prices, stock quantities/minimums and adjustment activity | Purchase orders, delivery matching, returns/credits, stock allocation and movement ledger |
| Reminders | Saved MOT/service/custom records, message previews that can be selected/copied, manually handled status | Provider connections, scheduling/delivery worker, templates and delivery reports |
| Reports | Sales, VAT, line-type breakdown, estimated contribution, invoice CSV and balances | Date/cohort filters, full daily/financial/customer reports and accounting reconciliation |
| Accounting exports | General sales CSV | Verified vendor-specific formats and live sync |
| HaynesPro E3 | Connection plan | Licensed technical data access |
| Lite Autodata | Connection plan | Licensed technical data access |
| Administration | Business details and local activity records | Individual logins, permissions, auditing, backups and production rollout |

The Docker preview is intentionally local and contains no external integrations. It is ready for design feedback and exercising the initial core workflows.

