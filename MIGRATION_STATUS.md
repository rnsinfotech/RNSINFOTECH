# Razorpay → Cashfree Migration Status

## Final repository audit — 26 August 2026

### Phase 1 — Remove Razorpay Completely
**STATUS: COMPLETE**

Removed all dead Razorpay runtime/test implementation files and confirmed they
are absent from the final repository:
- `frontend/src/lib/razorpay.js`
- `storefront-backend/src/services/razorpay.service.js`
- `storefront-backend/tests/razorpay.service.test.js`
- `admin-backend/src/services/razorpay.service.js`
- `admin-backend/tests/phase8_9_refund.test.js`

No Razorpay dependencies, routes, runtime imports, or environment variables
remain in the active application code.

A repository-wide case-insensitive Razorpay search was executed after cleanup.
The only remaining Razorpay references are intentionally confined to:
`storefront-backend/scripts/migrateLegacyGatewayPayments.js`.

That script is retained because it is required only for historical-data
migration. It maps legacy Razorpay-era field names to gateway-neutral fields,
archives the legacy provider metadata, and is not imported by active payment
runtime code.

### Phase 2 — Cashfree Correctness & Security Hardening
**STATUS: COMPLETE**

Implemented and source-audited:
- Cashfree Payment Gateway API version set to `2025-01-01`.
- Server-side Cashfree credentials only.
- Cashfree `x-request-id` generated for API requests.
- `x-idempotency-key` added to order creation.
- `x-idempotency-key` added to refund creation.
- Webhook signature verified over `timestamp + rawBody` using HMAC-SHA256/Base64.
- Cashfree webhook timestamp handled as Unix epoch milliseconds.
- Five-minute webhook freshness/replay window enforced.
- `x-webhook-version` required and pinned to `2025-01-01`.
- Raw webhook bytes preserved before JSON parsing.
- Constant-time signature comparison retained.
- Durable webhook idempotency retained with a unique database key.
- Failed webhook processing remains reclaimable so Cashfree retries can recover.
- Payment amount/currency checks remain server-side before settlement.
- Refund amount/state/concurrency checks remain server-side.
- Historical gateway records cannot be routed into the active Cashfree refund flow.
- Gateway error objects are sanitized so credentials/request headers are not
  attached to thrown errors.
- Production boot validation prevents production from using sandbox Cashfree
  configuration.
- Cashfree payment status handling includes the current `FLAGGED` and
  `CANCELLED` states used by this application.

The API version was independently verified against Cashfree's official current
Payment Gateway API documentation. Cashfree identifies `2025-01-01` (v5) as
the latest Payment Gateway API version and lists `2023-08-01` as a previous
version:
https://www.cashfree.com/docs/api-reference/payments/latest/overview

Cashfree's official authentication documentation also shows
`x-api-version: 2025-01-01` for the current API:
https://www.cashfree.com/docs/api-reference/authentication

Cashfree's official webhook documentation confirms the `2025-01-01` webhook
version and the raw-body signature requirement:
https://www.cashfree.com/docs/api-reference/payments/latest/payments/webhooks

### Phase 3 — Full Test & Sandbox Validation
**STATUS: NOT COMPLETE — AUTOMATED TESTS NOT EXECUTED; LIVE SANDBOX NOT EXECUTED**

Test coverage exists in the repository for:
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

Actual validation performed for this final ZIP:
- `node --check` was executed against every JavaScript source file in the
  repository: **PASSED** (`node-check-exit=0`).
- Repository-wide Razorpay search: **PASSED** — only the intentional
  historical migration script contains Razorpay references.
- Cashfree configuration audit: **PASSED** — active configuration defaults and
  sanitized examples use `2025-01-01`; no `2023-08-01` active configuration
  remains.
- Jest suites: **NOT EXECUTED**. Dependency installation was attempted but the
  environment timed out, and the Jest binary was therefore unavailable.
- Vitest frontend suite: **NOT EXECUTED**.
- Real Cashfree sandbox checkout/refund cycle: **NOT EXECUTED**.

No automated test or live sandbox result is claimed as passed unless it was
actually executed in this environment.

### Phase 4 — Production Readiness Audit
**STATUS: NOT COMPLETE — FINAL LIVE VALIDATION GATE REMAINS**

Repository-level checks completed:
- No Razorpay runtime implementation remains.
- Cashfree secrets are server-side only.
- Sanitized `.env.example` files are provided.
- No `.env` files are present in the distributable.
- No `.git` history is present in the distributable.
- No production/private credentials are included in the distributable.
- Frontend receives only the Cashfree payment-session capability and never the
  Cashfree client secret.
- Payment creation/verification/refund endpoints remain authenticated and
  ownership/role constrained.
- Webhook endpoint is intentionally unauthenticated but cryptographically
  authenticated by Cashfree signature/version/timestamp checks.
- Production environment cannot boot with sandbox Cashfree configuration.
- Historical provider data remains isolated from the active Cashfree flow.

The production-readiness phase cannot honestly be marked complete until the
application is exercised from a networked deployment/test environment using
valid Cashfree sandbox credentials and the complete payment lifecycle is
observed end-to-end.

## Final go-live gate

**Phase 1 — COMPLETE**

**Phase 2 — COMPLETE**

**Phase 3 — NOT COMPLETE**

**Phase 4 — NOT COMPLETE**

**Code migration:** READY FOR TESTING

**Security hardening:** READY FOR TESTING

**Syntax validation:** PASSED

**Repository Razorpay audit:** PASSED

**Cashfree configuration audit:** PASSED

**Automated Jest/Vitest execution:** STILL REQUIRED

**Real Cashfree sandbox checkout:** STILL REQUIRED

**Sandbox webhook → server verification → settlement → refund cycle:** STILL
REQUIRED

**Production launch:** Do not switch `CASHFREE_ENVIRONMENT=production` until
the automated test suites and the complete Cashfree sandbox payment/refund
cycle have been successfully executed and observed from a networked runtime.
