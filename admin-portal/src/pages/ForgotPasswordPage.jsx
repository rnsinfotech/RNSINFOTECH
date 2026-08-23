import React, { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../lib/adminApi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(""); setSubmitting(true);
    try { await requestPasswordReset(email.trim()); setSent(true); }
    catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }
  return <main className="admin-login"><section className="admin-login__card">
    <div className="admin-login__brand"><div className="admin-login__mark">R</div><div><strong>RNS INFOTECH</strong><span>Admin Portal</span></div></div>
    <div className="admin-login__heading"><p className="admin-login__eyebrow">Account recovery</p><h1>Forgot password?</h1><p>Enter your admin email and, if the account exists, we'll send a reset link.</p></div>
    {sent ? <div className="admin-login__success" role="status">If an active admin account exists for that email, a reset link has been sent. Check your inbox.</div> :
      <form onSubmit={submit} className="admin-login__form">
        <label className="admin-login__field"><span>Email address</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" autoFocus required /></label>
        {error ? <div className="admin-login__error" role="alert">{error}</div> : null}
        <button className="admin-btn admin-btn--primary admin-login__submit" disabled={submitting}>{submitting ? "Sending…" : "Send reset link"}</button>
      </form>}
    <p style={{ marginTop: 18 }}><Link to="/login" className="admin-link">Back to sign in</Link></p>
  </section></main>;
}
