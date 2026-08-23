import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import AuthField from "./components/AuthField";
import { useAuth } from "./context/AuthContext";

import { nav, footer } from "./data/siteData";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";
  const fromState = location.state?.fromState;

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await login({ email });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      navigate("/verify-email", { state: { from, fromState } });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SEO title="Log in" noindex />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section">
        <div className="rns-container" style={{ maxWidth: 420, margin: "0 auto" }}>
          <span className="rns-eyebrow">Welcome back</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            Log in
          </h1>

          <form onSubmit={handleSubmit} className="rns-card" style={{ padding: 24, marginTop: 20, display: "grid", gap: 14 }}>
            {error && (
              <div style={{ fontSize: 12.5, color: "#d64545", background: "#fdeceb", borderRadius: 6, padding: "8px 12px" }}>
                {error}
              </div>
            )}

            <AuthField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />

            <button type="submit" disabled={submitting} className="rns-btn rns-btn--primary" style={{ justifyContent: "center", marginTop: 6 }}>
              {submitting ? "Sending code..." : "Send verification code"}
            </button>

            <div style={{ textAlign: "center", fontSize: 13, color: "var(--rns-ink-soft)" }}>
              New here?{" "}
              <Link to="/signup" state={{ from, fromState }} style={{ color: "var(--rns-primary)" }}>
                Create an account
              </Link>
            </div>
          </form>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
