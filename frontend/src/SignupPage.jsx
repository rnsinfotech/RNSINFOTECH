import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import Icon from "./components/Icon";
import PasswordStrength from "./components/PasswordStrength";
import AuthField from "./components/AuthField";
import { useAuth } from "./context/AuthContext";
import { isValidEmail, isPasswordValid } from "./lib/authValidation";

import { nav, footer } from "./data/siteData";

const EMPTY = { name: "", email: "", phone: "", password: "", confirm: "" };

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";
  const fromState = location.state?.fromState;

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
    if (formError) setFormError("");
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = "Required";
    if (!form.email.trim()) next.email = "Required";
    else if (!isValidEmail(form.email)) next.email = "Enter a valid email address";
    if (!form.phone.trim()) next.phone = "Required";
    else if (!/^\d{10}$/.test(form.phone.trim())) next.phone = "Enter a valid 10-digit phone number";
    if (!isPasswordValid(form.password)) next.password = "Password doesn't meet the requirements below";
    if (form.confirm !== form.password) next.confirm = "Passwords don't match";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await signup(form);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      navigate("/verify-email", { state: { from, fromState } });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SEO title="Sign up" noindex />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section">
        <div className="rns-container" style={{ maxWidth: 440, margin: "0 auto" }}>
          <span className="rns-eyebrow">Create account</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            Sign up
          </h1>

          <form onSubmit={handleSubmit} className="rns-card" style={{ padding: 24, marginTop: 20, display: "grid", gap: 14 }}>
            {formError && (
              <div style={{ fontSize: 12.5, color: "#d64545", background: "#fdeceb", borderRadius: 6, padding: "8px 12px" }}>
                {formError}
              </div>
            )}

            <AuthField label="Full name" value={form.name} onChange={(v) => updateField("name", v)} error={errors.name} autoComplete="name" />
            <AuthField
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => updateField("email", v)}
              error={errors.email}
              autoComplete="email"
            />
            <AuthField
              label="Phone number"
              value={form.phone}
              onChange={(v) => updateField("phone", v)}
              error={errors.phone}
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel"
            />
            <div>
              <AuthField
                label="Password"
                type="password"
                value={form.password}
                onChange={(v) => updateField("password", v)}
                error={errors.password}
                autoComplete="new-password"
              />
              <PasswordStrength password={form.password} />
            </div>
            <AuthField
              label="Confirm password"
              type="password"
              value={form.confirm}
              onChange={(v) => updateField("confirm", v)}
              error={errors.confirm}
              autoComplete="new-password"
            />

            <button type="submit" disabled={submitting} className="rns-btn rns-btn--primary" style={{ justifyContent: "center", marginTop: 6 }}>
              {submitting ? "Creating account..." : "Create account"}
            </button>

            <div style={{ textAlign: "center", fontSize: 13, color: "var(--rns-ink-soft)" }}>
              Already have an account?{" "}
              <Link to="/login" state={{ from, fromState }} style={{ color: "var(--rns-primary)" }}>
                Log in
              </Link>
            </div>
          </form>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
