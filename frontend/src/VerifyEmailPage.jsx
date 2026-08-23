import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import Icon from "./components/Icon";
import { useAuth } from "./context/AuthContext";

import { nav, footer } from "./data/siteData";

const RESEND_COOLDOWN_S = 30;

/**
 * VerifyEmailPage — OTP-gated email verification. The code preview
 * below only renders in local development (import.meta.env.DEV) so
 * it never appears in a production build; wire up a real email
 * provider on the backend and this component needs no changes.
 */
export default function VerifyEmailPage() {
  const { pendingVerification, verifyEmail, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";
  const fromState = location.state?.fromState;

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  // Codes that mean "this OTP is dead, don't bother retyping it" — the
  // field gets cleared and the person is nudged toward Resend instead of
  // being left staring at a code that can never succeed. OTP_INVALID
  // (a plain wrong digit) is deliberately excluded: that one's worth a
  // retry with the same still-live code.
  const deadCodeErrors = new Set(["OTP_NOT_FOUND", "OTP_LOCKED", "OTP_CONSUMED", "ACCOUNT_NOT_FOUND"]);
  // Codes that mean the resend button itself should stay disabled a while
  // longer, independent of the local cooldown timer.
  const resendBlockedErrors = new Set(["OTP_COOLDOWN", "OTP_DAILY_LIMIT", "RATE_LIMITED"]);

  useEffect(() => {
    if (!pendingVerification) return;
    const remaining = RESEND_COOLDOWN_S - Math.floor((Date.now() - pendingVerification.lastSentAt) / 1000);
    setCooldown(Math.max(0, remaining));
  }, [pendingVerification?.lastSentAt]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  if (!pendingVerification) {
    return (
      <>
        <SEO title="No verification in progress" noindex />
        <AnnouncementBar />
        <Navbar {...nav} />
        <section className="rns-section">
          <div className="rns-container" style={{ textAlign: "center", padding: "60px 0" }}>
            <h1 className="rns-section-title">No verification in progress</h1>
            <p style={{ marginTop: 10, color: "var(--rns-ink-soft)" }}>
              Start by creating an account, or log in and use "Verify now" if you already have one.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <Link to="/signup" className="rns-btn rns-btn--primary">
                Sign up
              </Link>
              <Link to="/login" className="rns-btn rns-btn--ghost">
                Log in
              </Link>
            </div>
          </div>
        </section>
        <Footer logo={nav.logo} {...footer} />
      </>
    );
  }

  async function handleVerify(e) {
    e.preventDefault();
    const result = await verifyEmail(code);
    if (!result.ok) {
      setError(result.error);
      setErrorCode(result.code || "");
      // A dead code (expired / locked out / already used) can never
      // succeed no matter how many times it's retyped — clear the field
      // so the person isn't tempted to keep hammering the same digits and
      // is pushed toward Resend instead. A plain wrong digit (OTP_INVALID)
      // leaves the field alone so they can just fix the typo.
      if (deadCodeErrors.has(result.code)) setCode("");
      return;
    }
    navigate(from, { replace: true, state: fromState });
  }

  async function handleResend() {
    const result = await resendOtp();
    if (result.ok) {
      setResent(true);
      setError("");
      setErrorCode("");
      setCooldown(RESEND_COOLDOWN_S);
      window.setTimeout(() => setResent(false), 2500);
    } else {
      setError(result.error);
      setErrorCode(result.code || "");
    }
  }

  const resendLocked = cooldown > 0 || resendBlockedErrors.has(errorCode);

  return (
    <>
      <SEO title="Verify email" noindex />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section">
        <div className="rns-container" style={{ maxWidth: 420, margin: "0 auto" }}>
          <span className="rns-eyebrow">Verify your email</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            Enter the 6-digit code
          </h1>
          <p style={{ marginTop: 8, fontSize: 13.5, color: "var(--rns-ink-soft)" }}>
            We've sent a verification code to <strong style={{ color: "var(--rns-ink)" }}>{pendingVerification.email}</strong>.
          </p>

          {import.meta.env.DEV && (
            <div
              style={{
                marginTop: 18,
                border: "1px dashed var(--rns-line-strong)",
                borderRadius: "var(--rns-r-sm)",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                background: "var(--rns-bg-alt)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="shield" size={16} style={{ color: "var(--rns-ink-soft)" }} />
                <div>
                  <div style={{ fontSize: 11, fontFamily: "var(--rns-font-mono)", color: "var(--rns-ink-faint)" }}>DEV PREVIEW</div>
                  <div style={{ fontSize: 12.5, color: "var(--rns-ink-soft)" }}>Local-only — visible because email isn't wired up yet</div>
                </div>
              </div>
              <div style={{ fontFamily: "var(--rns-font-mono)", fontSize: 20, fontWeight: 700, letterSpacing: "0.1em" }}>
                {pendingVerification.otp}
              </div>
            </div>
          )}

          <form onSubmit={handleVerify} className="rns-card" style={{ padding: 24, marginTop: 18, display: "grid", gap: 14 }}>
            {error && (
              <div style={{ fontSize: 12.5, color: "#d64545", background: "#fdeceb", borderRadius: 6, padding: "8px 12px" }}>
                {error}
                {errorCode === "ACCOUNT_NOT_FOUND" && (
                  <>
                    {" "}
                    <Link to="/signup" state={{ from, fromState }} style={{ color: "#d64545", fontWeight: 600, textDecoration: "underline" }}>
                      Create one
                    </Link>
                  </>
                )}
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>
                Verification code
              </label>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (error) setError("");
                  if (errorCode) setErrorCode("");
                }}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                style={{
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--rns-line-strong)",
                  fontSize: 20,
                  fontFamily: "var(--rns-font-mono)",
                  letterSpacing: "0.3em",
                  textAlign: "center",
                }}
              />
            </div>

            <button type="submit" className="rns-btn rns-btn--primary" style={{ justifyContent: "center" }}>
              Verify and continue
            </button>

            <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--rns-ink-soft)" }}>
              {resent ? (
                <span style={{ color: "#0a7a58" }}>A new code has been sent.</span>
              ) : resendLocked ? (
                <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend unavailable right now"}</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  style={{ background: "none", border: "none", color: "var(--rns-primary)", cursor: "pointer", fontSize: 12.5 }}
                >
                  Resend code
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
