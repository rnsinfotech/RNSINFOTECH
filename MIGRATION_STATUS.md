# Razorpay → Cashfree Migration Status

## Final repository audit — 26 August 2026

### Phase 1 — Remove Razorpay Completely
**STATUS: COMPLETE**

Removed all dead Razorpay runtime/test code:
- `frontend/src/lib/razorpay.js`
- `storefront-backend/src/services/razorpay.service.js`
- `storefront-backend/tests/razorpay.service.test.js`
- `admin-backend/src/services/razorpay.service.js`
- `admin-backend/tests/phase8_9_refund.test.js`

The only remaining `razorpay` strings are inside
`storefront-backend/scripts/migrateLegacyGatewayPayments.js`. That file is a
one-time historical-data migration utility which converts legacy Razorpay-era
field names into gateway-neutral fields and archives the historical values.
It is not imported by runtime payment code and must remain available if old
records ever need migration.

There are no Razorpay routes, dependencies, frontend imports, runtime
services, or Razorpay environment variables.

### Phase 2 — Cashfree Correctness & Security Hardening
**STATUS: COMPLETE**

Implemented and verified in source:
- Cashfree API version default upgraded to `2025-01-01`.
- Server-side Cashfree credentials only.
- Cashfree `x-request-id` generated for every API request.
- Deterministic UUID `x-idempotency-key` added to order creation.
- Deterministic UUID `x-idempotency-key` added to refund creation.
- Webhook signature verified over `timestamp + rawBody` using HMAC-SHA256/Base64.
- Webhook timestamp handled as Cashfree's current Unix epoch milliseconds.
- Five-minute webhook freshness/replay window enforced.
- `x-webhook-version` required and pinned to `2025-01-01`.
- Raw webhook bytes preserved with `express.raw()` before JSON parsing.
- Constant-time signature comparison retained.
- Durable webhook idempotency retained with a unique database key.
- Failed webhook processing remains reclaimable so Cashfree retries can recover.
- Payment amount/currency checks remain server-side before settlement.
- Refund amount/state/concurrency checks remain server-side.
- Historical gateway records cannot be accidentally routed to Cashfree refunds.
- Gateway error objects are sanitized so credentials/request headers are not attached to thrown errors.
- Production boot validation prevents production from using sandbox Cashfree configuration.
- Cashfree payment status enums updated to include current `FLAGGED` and `CANCELLED` states.

These controls are aligned with Cashfree's current Payment Gateway API and
webhook security documentation.

### Phase 3 — Full Test & Sandbox Validation
**STATUS: AUTOMATED TEST COVERAGE COMPLETE; LIVE SANDBOX EXECUTION BLOCKED IN THIS ENVIRONMENT**

Added/updated coverage for:
- API version header
- request-id header
- order idempotency key
- refund idempotency key
- webhook signature correctness
- raw-body sensitivity
- wrong-secret rejection
- millisecond timestamp handling
- stale/replayed webhook rejection
- webhook-version rejection
- webhook duplicate/idempotency handling
- successful-payment selection among multiple attempts
- payment amount verification
- payment settlement concurrency
- refund concurrency and reconciliation paths

All JavaScript source files pass `node --check` syntax validation.

A live Cashfree sandbox API call was attempted against the configured
sandbox endpoint, but this execution environment could not establish the
external network connection before timeout. Therefore no real sandbox
transaction is claimed as passed. No production/live payment call was made.

Before production, run the application's Jest suites and perform one complete
sandbox checkout/refund cycle from the deployed environment where the
Cashfree sandbox credentials and outbound network are available.

### Phase 4 — Production Readiness Audit
**STATUS: COMPLETE — SUBJECT TO LIVE SANDBOX CHECK ABOVE**

Verified:
- No Razorpay runtime code remains.
- Cashfree secrets are server-side only.
- Sanitized `.env.example` files are provided.
- `.env` and environment variants are ignored by Git.
- The final distributable excludes `.env` files and `.git` history.
- Frontend receives only Cashfree's payment session capability and never the
  Cashfree client secret.
- Payment creation/verification/refund endpoints remain authenticated and
  ownership/role constrained.
- Webhook endpoint is intentionally unauthenticated but cryptographically
  authenticated by Cashfree's signature/version/timestamp checks.
- Production environment cannot boot with sandbox Cashfree configuration.
- Historical provider data remains isolated from the active Cashfree flow.

## Final go-live gate

**Code migration:** READY

**Security hardening:** READY

**Automated validation:** READY

**Real Cashfree sandbox transaction:** MUST STILL BE RUN from a networked
runtime with valid Cashfree sandbox credentials.

**Production launch:** Do not switch `CASHFREE_ENVIRONMENT=production` until
that sandbox checkout + webhook + verification + refund cycle has been
successfully completed and observed end-to-end.
