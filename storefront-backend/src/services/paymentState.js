const ApiError = require("../utils/ApiError");

/**
 * Payment state machine.
 *
 * The statuses themselves are unchanged from the pre-migration model, because
 * the admin portal's filters, the list validator's enum and the customer
 * order-history mapping all key off them. What is new is that the legal
 * transitions are written down and enforced in one place instead of being
 * implied by whatever conditions each individual findOneAndUpdate happened to
 * carry.
 *
 *      created ──> paid ──> refunded
 *         │         ^
 *         ├──> failed
 *         └──> expired
 *
 * Two properties this is here to guarantee:
 *
 *   - A customer-reachable endpoint can never talk a payment back out of a
 *     settled state. "paid -> created" and "refunded -> paid" are not edges
 *     in this graph at all, so no request body, replayed webhook or retried
 *     verification can produce them.
 *   - "failed -> paid" IS a legal edge, but only ever as the result of
 *     authoritative gateway state. A payment can genuinely fail on one
 *     attempt and succeed on a retry against the same order, and a late
 *     webhook can arrive after a timeout already marked the attempt failed.
 *     Refusing that edge would strand real money. It is reachable only from
 *     settlement, which by construction runs after the gateway itself has
 *     confirmed success.
 *
 * Partial refunds keep the existing representation — status stays "paid"
 * with refundedAmount > 0, and only a full refund moves to "refunded" — so
 * the admin UI and refund-eligibility maths carry over untouched.
 */
const ALLOWED_TRANSITIONS = {
  created: ["created", "paid", "failed", "expired"],
  failed: ["failed", "paid", "expired"],
  expired: ["expired", "paid", "refunded"],
  paid: ["paid", "refunded"],
  refunded: ["refunded"],
};

// Statuses from which settlement may still run. Anything else is either
// already settled (idempotent no-op) or terminal.
const SETTLEABLE_FROM = ["created", "failed", "expired"];

function canTransition(from, to) {
  if (!from) return true;
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

function assertTransition(from, to, { context = "payment" } = {}) {
  if (!canTransition(from, to)) {
    throw ApiError.conflict(`Invalid ${context} transition: "${from}" cannot become "${to}".`);
  }
  return true;
}

function isSettled(status) {
  return status === "paid" || status === "refunded";
}

module.exports = { ALLOWED_TRANSITIONS, SETTLEABLE_FROM, canTransition, assertTransition, isSettled };
