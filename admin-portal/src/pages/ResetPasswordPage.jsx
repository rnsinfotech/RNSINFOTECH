import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetAdminPassword } from "../lib/adminApi";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    if (password.length < 12) return setError("Password must be at least 12 characters.");
    setSubmitting(true);
    try { await resetAdminPassword(token, password); setDone(true); }
    catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }
  return <main className="admin-login"><section className="admin-login__card">
    <div className="admin-login__brand"><div className="admin-login__mark">R</div><div><strong>RNS INFOTECH</strong><span>Admin Portal</span></div></div>
    <div className="admin-login__heading"><p className="admin-login__eyebrow">Account recovery</p><h1>Set a new password</h1><p>Choose a strong password of at least 12 characters.</p></div>
    {done ? <div className="admin-login__success" role="status">Password reset successfully. Your previous sessions have been invalidated.</div> :
      !token ? <div className="admin-login__error" role="alert">This password reset link is missing its token.</div> :
      <form onSubmit={submit} className="admin-login__form">
        <label className="admin-login__field"><span>New password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" autoFocus required minLength={12} /></label>
        <label className="admin-login__field"><span>Confirm password</span><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" required minLength={12} /></label>
        {error ? <div className="admin-login__error" role="alert">{error}</div> : null}
        <button className="admin-btn admin-btn--primary admin-login__submit" disabled={submitting}>{submitting ? "Resetting…" : "Reset password"}</button>
      </form>}
    <p style={{ marginTop: 18 }}><Link to="/login" className="admin-link">Back to sign in</Link></p>
  </section></main>;
}
