import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

import Icon from "./components/Icon";
import { useAuth } from "./context/AuthContext";
import { useOrders } from "./context/OrdersContext";
import { createPaymentOrder, loadCashfreeCheckout, verifyPayment } from "./lib/cashfree";

function formatINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

/**
 * PaymentPage — starts a real Cashfree payment attempt against an
 * already-placed Order (see CheckoutPage: the order is created first,
 * this page never creates one). Flow: POST /payments/create-order for a
 * payment session id, open Cashfree Checkout with it, then POST
 * /payments/verify to have the SERVER go and confirm what happened.
 * The order itself was already created — a cancelled or failed
 * Checkout attempt just leaves it unpaid, retryable from here or from
 * the order's own page ("Pay now").
 *
 * Nothing on this page decides whether a payment succeeded. Cashfree hands
 * the browser no signed success payload, so the client's only job is to
 * say "checkout closed, go look" — and even if it never does (tab closed,
 * connection dropped mid-redirect), the Cashfree webhook settles the order
 * server-side anyway.
 */
export default function PaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { getOrder, refreshOrders } = useOrders();

  const orderId = location.state?.orderId;
  const order = orderId ? getOrder(orderId) : null;

  const [stage, setStage] = useState("form"); // form | processing | success | pending | error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Preload the Checkout SDK as soon as this page mounts so clicking "Pay"
    // doesn't have to wait on the script fetch too. The real mode comes from
    // the server on create-order; this preload only warms the script cache.
    loadCashfreeCheckout("sandbox").catch(() => {
      // Swallow here — handlePay surfaces a clear error if it's still
      // unavailable by the time the person actually clicks Pay.
    });
  }, []);

  if (!orderId || !order) {
    return (
      <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center", padding: "0 20px" }}>
        <h1 style={{ fontFamily: "var(--rns-font-display)", fontSize: 20 }}>Nothing to pay for</h1>
        <p style={{ marginTop: 10, color: "var(--rns-ink-soft)", fontSize: 13.5 }}>
          This payment page needs an order to be started from checkout first.
        </p>
        <Link to="/cart" className="rns-btn rns-btn--primary" style={{ marginTop: 20, display: "inline-flex" }}>
          Go to cart
        </Link>
      </div>
    );
  }

  if (order.paymentStatus === "paid") {
    return (
      <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center", padding: "0 20px" }}>
        <h1 style={{ fontFamily: "var(--rns-font-display)", fontSize: 20 }}>Already paid</h1>
        <p style={{ marginTop: 10, color: "var(--rns-ink-soft)", fontSize: 13.5 }}>
          This order has already been paid for.
        </p>
        <Link to={`/orders/${order.id}`} className="rns-btn rns-btn--primary" style={{ marginTop: 20, display: "inline-flex" }}>
          View order
        </Link>
      </div>
    );
  }

  async function handlePay() {
    setErrorMessage("");
    setStage("processing");

    try {
      // The server decides the amount, the currency and the environment.
      // Everything below is display or transport.
      const { paymentSessionId, gatewayOrderId, amount, currency, mode } = await createPaymentOrder(order.id);
      if (!paymentSessionId) {
        throw new Error("Could not start the payment. Please try again.");
      }
      // Sanity check only — a mismatch here means the local order view is
      // stale, so send the person back to reload rather than charging them
      // an amount the page never showed. The server has already validated
      // this against stored order state; this is not the security boundary.
      if (Number(amount) !== Number(order.total) || currency !== "INR") {
        throw new Error("The payment amount does not match your order total. Please refresh and try again.");
      }

      const cashfree = await loadCashfreeCheckout(mode || "sandbox");

      const result = await cashfree.checkout({
        paymentSessionId,
        redirectTarget: "_modal",
      });

      // The SDK reports how the modal closed. None of these outcomes is
      // trusted as a verdict on the payment — each one just decides whether
      // it is worth asking the server to look.
      if (result?.error) {
        setErrorMessage(result.error.message || "Payment failed. You can try again.");
        setStage("error");
        return;
      }

      // Modal dismissed without completing: the order stays pending and
      // unpaid exactly as it was, so let the person retry.
      if (!result?.paymentDetails) {
        setStage("form");
        return;
      }

      try {
        const outcome = await verifyPayment({ gatewayOrderId });
        // The server answers 202 with status "pending" when Cashfree has not
        // resolved the payment yet (a bank page still open, a UPI mandate not
        // yet approved). That is a 2xx, so it would otherwise sail through as
        // success and tell the customer their order is placed when no money
        // has moved. Surface it honestly and let the webhook settle it.
        if (outcome?.status === "pending") {
          await refreshOrders();
          setStage("pending");
          return;
        }
        await refreshOrders();
        setStage("success");
        window.setTimeout(() => {
          navigate(`/orders/${order.id}`, { state: { justPlaced: true } });
        }, 1100);
      } catch (err) {
        // Verification failing is not the same as payment failing — the
        // webhook may still settle this. Say so rather than implying the
        // money is gone.
        setErrorMessage(
          err.message
          || "We couldn't confirm that payment yet. If money was deducted it will be reconciled automatically — check your order history in a few minutes."
        );
        setStage("error");
      }
    } catch (err) {
      setErrorMessage(err.message || "Could not start the payment. Please try again.");
      setStage("error");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d1017",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "var(--rns-font-body)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#fff",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--rns-line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--rns-font-display)", fontWeight: 700, fontSize: 15 }}>
              RNS INFOTECH
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10.5,
                fontFamily: "var(--rns-font-mono)",
                background: "var(--rns-signal-tint)",
                color: "#0a7a58",
                padding: "3px 8px",
                borderRadius: 20,
              }}
            >
              <Icon name="shield" size={11} /> SECURED
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
            <span style={{ fontSize: 12, color: "var(--rns-ink-faint)" }}>Amount payable</span>
          </div>
          <div style={{ fontFamily: "var(--rns-font-display)", fontWeight: 700, fontSize: 26, marginTop: 2 }}>
            {formatINR(order.total)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--rns-ink-faint)", marginTop: 4 }}>
            Order {order.id} · Powered by Cashfree
          </div>
        </div>

        {(stage === "form" || stage === "error") && (
          <div style={{ padding: "22px 22px 26px", textAlign: "center" }}>
            {stage === "error" && (
              <div
                style={{
                  textAlign: "left",
                  background: "#fdecec",
                  color: "#c0392b",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12.5,
                  marginBottom: 16,
                }}
              >
                {errorMessage}
              </div>
            )}

            <p style={{ fontSize: 13, color: "var(--rns-ink-soft)", marginBottom: 18 }}>
              You'll pick UPI, card, or netbanking on the next screen — Cashfree's own checkout
              handles collecting payment details securely.
            </p>

            <button
              onClick={handlePay}
              className="rns-btn rns-btn--primary"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Icon name="shield" size={15} />
              Pay {formatINR(order.total)}
            </button>
          </div>
        )}

        {stage === "processing" && (
          <div style={{ padding: "48px 22px", textAlign: "center" }}>
            <div className="rns-pay-spinner" />
            <div style={{ marginTop: 18, fontSize: 13.5, color: "var(--rns-ink-soft)" }}>
              Opening secure checkout…
            </div>
          </div>
        )}

        {stage === "pending" && (
          <div style={{ padding: "40px 22px", textAlign: "center" }}>
            <div className="rns-pay-spinner" />
            <div style={{ marginTop: 18, fontSize: 14.5, fontWeight: 600 }}>Confirming your payment</div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--rns-ink-soft)", lineHeight: 1.5 }}>
              Your bank hasn't finished confirming this yet. You don't need to pay again — we'll
              update your order automatically as soon as it clears.
            </div>
            <Link
              to={`/orders/${order.id}`}
              className="rns-btn rns-btn--ghost"
              style={{ marginTop: 18, display: "inline-flex" }}
            >
              View order status
            </Link>
          </div>
        )}

        {stage === "success" && (
          <div style={{ padding: "48px 22px", textAlign: "center" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--rns-signal-tint)",
                color: "#0a7a58",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto",
              }}
            >
              <Icon name="check" size={24} />
            </div>
            <div style={{ marginTop: 16, fontSize: 14.5, fontWeight: 600 }}>Payment successful</div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--rns-ink-soft)" }}>
              Confirming your order…
            </div>
          </div>
        )}
      </div>

      <style>{`
        .rns-pay-spinner {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 3px solid var(--rns-line);
          border-top-color: var(--rns-primary);
          margin: 0 auto;
          animation: rns-spin 0.8s linear infinite;
        }
        @keyframes rns-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
