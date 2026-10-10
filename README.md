# OKIO — Pick Your Calm

An extension of the existing OKIO site, preserving transparent-can artwork, solid colours and the independently animated vending machine. The machine is larger on desktop/tablet and common mobile widths.

## Current status

The storefront, guest cart, checkout interface and order backend are implemented. **This is not a live, production-approved shop.** Actual products have no configured price/pack/inventory. Payment credentials, delivery rules, approved policies and verified product data are absent. Live Razorpay keys are rejected in code. No customer transaction or email is simulated.

| Area | Implemented | External setup / remaining work |
| --- | --- | --- |
| Home | Larger machine; PICK YOUR CALM; preserved selection, switching and return | Browser/device visual QA |
| Catalogue | Three existing flavours; shared presentation data; D1 variants, prices and stock | Verified prices, sizes, pack options, ingredients, nutrition and stock |
| Product pages | Variant and quantity selection; add-to-bag; buy-now; explicit missing-data state | Actual valid configurations |
| Cart | Add/group/change/remove; count; mini-cart; local storage; cross-tab sync; invalid-product handling | Browser persistence and cross-tab E2E |
| Checkout | Customer validation; approved PIN allowlist and exact configured charges; server totals | Fulfilment rules, tax advice/configuration; no carrier integration yet |
| Payment | Razorpay test-mode orders; HMAC callback and webhook validation; captured payment fetched server-side | Merchant test credentials, reachable webhook, actual sandbox E2E |
| Orders | D1 snapshots, atomic reservations, idempotency, secure guest cookie, true status | Reconciliation workflow, retention, order administration and recovery |
| Receipt | Paper extrusion, progressive content, revisit protection, reduced motion, print/save | Real sandbox purchase and browser QA |
| Contact | Validation, honeypot, timing check, D1 rate limiting and stored enquiries | Enable only after support monitoring/retention is approved |
| Email | Durable deduplicated notification outbox | Sender/provider and dispatch worker are NOT integrated; no emails are sent |
| Policies | Clearly labelled pending-content notices | Official business, privacy, shipping, return/refund terms and contact/social links |
| SEO | Titles, canonical URLs, Open Graph, sitemap, robots, product identity schema | Add Offer schema only when real offers are configured |

## Local run, tests and build

Requires Node 24 (Node's SQLite module is used in tests) and the project's pnpm lockfile.

```sh
npm run install:ci
npm run typecheck
npm test
npm run build
npm run dev
```

Standalone development can run the Vite/Vinext app normally. In the managed Sites environment, use the Sites preview supervisor only when the supported browser skill is available.

The existing hosting target is Cloudflare Workers through Sites, not Vercel. The source is synchronized with the existing Site Git repository. `vite.config.ts` and the Sites build integration are retained. Google Antigravity can open this same source checkout; no Antigravity session was available during this implementation.

## Database

`.openai/hosting.json` enables the logical `DB` D1 binding. Publishing applies the schema migration before the Worker. No business data is seeded. For local D1, build first and apply the migration once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_material_albert_cleary.sql
```

Then apply `drizzle/0001_unique_zzzax.sql` using the same local command. Never replay an applied migration. Future schema changes require new Drizzle migrations. CHECK-constrained transaction guards in the reservation batch enforce stock and price revalidation. Do not remove them when evolving the schema.

## Configuration

See `.env.example`. All listed keys are actually consumed by the backend. Secrets belong in hosted runtime settings or ignored local `.dev.vars`, never in source or browser configuration. Keep development/test databases and test keys separate from production. `DB` is a platform binding, not a URL/password environment variable.

1. Enter approved rows into D1 `variants`: `id`, `product_id` (`lemon`, `coconut`, `mango`), `label`, `size`, `pack`, integer `price_paise`, integer `stock`, and `active` (0 or 1). Prices represent one sellable pack. Draft rows should stay inactive. The database is the only commercial price/stock source.
2. Approved descriptions, images and nullable product disclosures live in `lib/products.ts`. Do not infer ingredient or health information from artwork. Enter verified text there when approved.
3. Set `DELIVERY_RULES_JSON` to an approved map of exact PIN codes to delivery charges in paise and `taxBps` to an approved exclusive item-tax rate in basis points. There is no default charge, rate or coverage. This implementation supports one exclusive item-tax rate and untaxed shipping; inclusive GST, mixed rates, shipping taxes, promotions and dynamic carrier quotes need a business-specific extension before use.
4. For a sandbox only, set `COMMERCE_MODE=test` with Razorpay `rzp_test_` key ID, key secret and a separate webhook secret. Configure auto-capture in the merchant sandbox. Register `/api/payment/webhook` for `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`.
5. A private Sites audience blocks unauthenticated provider callbacks. Use an explicitly approved, reachable test webhook ingress/environment before testing callbacks; do not silently change Site access. The signed browser verification endpoint also fetches captured payment status server-side.
6. `CONTACT_ENABLED=true` accepts and stores enquiries in D1. The response says the enquiry was recorded; it never claims email delivery. Establish a support review and retention process first.
7. Notification outbox rows are recorded once for payment confirmation and verified refunds. A sender and retry/dispatch worker still need implementation after choosing an email provider. No email credentials are currently required because no sender exists.

## Reliability and access

- The browser sends variant IDs and quantities, never authoritative prices. Server quotes are revalidated before order creation. A changed total must be reviewed again.
- A secure random HTTP-only SameSite=Lax cookie identifies the guest; only its SHA-256 digest is stored with orders. Knowing an order UUID does not grant access. This version supports same-browser access for 30 days, not cross-device recovery.
- Checkout attempts are unique per guest + UUID. Request hashes prevent reusing an attempt with altered details. D1 batches and transaction guards roll back all reservations if any stock or price check fails.
- A definitive provider 4xx rejection releases reserved stock once. Network timeouts and ambiguous results do not retry provider order creation; they remain in `creating` for reconciliation by receipt UUID. Do not start a new payment or release inventory until the provider state is known.
- Closing the payment modal does not cancel an order. A failed payment can be retried on its existing provider order. Reservations are deliberately retained for unpaid/ambiguous orders because late capture remains possible. An automated expiry/cancellation/reconciliation job is still required before live launch. Never blindly restock an unpaid order.
- Captured payments must match provider order ID, amount and INR currency. Client callbacks and redirects alone cannot set paid status. Repeated webhooks do not create orders or duplicate notification rows. Verified refunds update payment state; stock is not automatically restocked on refund.
- Receipt rendering never creates orders. Successful receipts require a backend-confirmed paid order. A revisit does not clear an unrelated bag or unexpectedly replay the animation. Print uses the same retrieved record.
- Customer PII is kept out of client order-detail responses and application logs. Owner access to D1 is operationally sensitive. Define approved retention/deletion and recovery workflows before launch.
- No customer authentication is introduced. If accounts are added later, merge guest variants by identity within the 24-item cap, revalidate availability server-side, then clear the guest cart only after persistence succeeds.

## Security and test coverage

`tests/commerce.test.mjs` tests quantities, cart normalization, integer-paise totals, trusted prices, eligibility, HMAC and captured-payment guards. `tests/backend.test.mjs` uses SQLite and the real migration/route logic with a **test-only mocked provider** to test stock rollback, idempotency, guest isolation, timeout safety, rejection release, refunds, origin validation and rate limits. `tests/render.test.mjs` checks homepage identity/buttons, assets and unsuccessful receipt suppression.

These tests do not demonstrate real provider operation or browser E2E. Browser QA and merchant sandbox tests are required before enabling real purchases. See `docs/QA.md`. Live keys remain blocked until that work, policy approval, reservation reconciliation, transactional notifications and operational access are completed and the guard is deliberately reviewed.

## Deployment

Use the existing Sites workflow: open the source with its credential, run typecheck/tests/build, package the exact pushed commit, and publish while preserving owner-private access. No additional Library copy of the Git-backed source is needed. Hosted secrets are configured separately from the source manifest.

Native deployment success verifies publication, not payment, email, logistics or browser behaviour.
