import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminLogin, getCurrentAdmin } from "../lib/adminApi";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentAdmin().then((admin) => {
      if (active && admin) {
        navigate(location.state?.from || "/", { replace: true });
      }
    });
    return () => { active = false; };
  }, [location.state, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await adminLogin(email.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in. Please check your credentials and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login__card" aria-labelledby="admin-login-title">
        <div className="admin-login__brand">
          <div className="admin-login__mark">R</div>
          <div>
            <strong>RNS INFOTECH</strong>
            <span>Admin Portal</span>
          </div>
        </div>

        <div className="admin-login__heading">
          <p className="admin-login__eyebrow">Secure staff access</p>
          <h1 id="admin-login-title">Sign in to continue</h1>
          <p>Enter your admin account credentials to access the portal.</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login__form">
          <label className="admin-login__field">
            <span>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              autoFocus
              required
              placeholder="you@company.com"
            />
          </label>

          <label className="admin-login__field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
            />
          </label>

          {error ? <div className="admin-login__error" role="alert">{error}</div> : null}

          <div style={{ textAlign: "right", marginTop: -6, marginBottom: 4 }}><a href="/forgot-password" className="admin-link">Forgot password?</a></div>
          <button className="admin-btn admin-btn--primary admin-login__submit" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="admin-login__security">Your credentials are verified by the admin backend. Never share your password.</p>
      </section>
    </main>
  );
}
