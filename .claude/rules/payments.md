---
paths:
  - "backend/app/lib/paymongo.rb"
  - "backend/app/models/payment.rb"
  - "backend/app/services/payments.rb"
  - "backend/app/services/payments/**"
  - "backend/app/controllers/api/v1/payments_controller.rb"
  - "backend/app/controllers/api/v1/webhooks/paymongo_controller.rb"
  - "web/src/components/bookings/pay-sheet.tsx"
  - "web/src/components/bookings/payment-return.tsx"
---

# Guest payments on PayMongo

**Test mode only.** Until payments go live no real money may move: `Paymongo` refuses a secret key that isn't `sk_test_…`, the webhook accepts only the test signature (`te`) and ignores events with `livemode: true`, and `payments.livemode` has a `CHECK (NOT livemode)`. Going live is its own reviewed change that removes all three. The web app says so on the pay sheet and the return dialog (`TEST_MODE_NOTE`).

**Provider switch**: `Payments.paymongo?` is true when `PAYMONGO_SECRET_KEY` is set. Unset (the local stack, specs, `script/smoke`), `Payments::Stub` pays at once, one payment per checkout, as before. Specs turn PayMongo on with `enable_paymongo` and stub `Paymongo.*` with `paymongo_session` (`spec/support/paymongo_helpers.rb`) — no HTTP.

**Flow**: `POST /bookings/pay` → `Payments::Pay` checks and locks the bookings, confirms those paid already or priced at nothing through the stub, and hands the rest to `Payments::StartCheckout`: one pending `Payment` (provider `paymongo`, `covered_booking_ids`, `checkout_url`), even across checkouts, and a PayMongo checkout session (`provider_ref` `cs_…`) returning to `/cart?payment=<id>`. The same bookings asked again get the open checkout back; an open checkout covering some of them is let go first. PayMongo is never called inside a transaction that holds booking locks.

**`Payments::Sync` is the only place an outcome is written**: it reads the session back from PayMongo (never trusts a webhook body), and under the payment's lock moves a pending payment to `paid` (confirming each covered booking still held, through `Bookings::Transition`), `needs_refund` (none could be: let go meanwhile; reported to Sentry, refunded by the team) or `failed` (session expired). A payment no longer pending is left alone, so duplicate webhooks are harmless. The webhook, `GET /payments/:id` (the cart on return) and `Payments::Release` call it.

**Holds**: an open checkout keeps its bookings at least `Payment::CHECKOUT_WINDOW`; `Bookings::Expire` runs `Payments::Release` (expire the session; PayMongo's 400 means paid or paying, so it syncs instead and leaves the booking) before expiring a booking. While PayMongo can't be reached such a booking waits for the next run.

**`bookings.payment_id`** is set only once paid — `Payments::Stub` and `Bookings::Respond` read it as "paid already". Never point a booking at a pending payment. `has_many :bookings` owns `Payment#booking_ids`; the covered list is `covered_booking_ids`.

**Not here yet**: live mode, refunds through PayMongo (cancellations and `needs_refund` are only recorded), partner payouts (PayMongo can't split; the platform collects everything).
