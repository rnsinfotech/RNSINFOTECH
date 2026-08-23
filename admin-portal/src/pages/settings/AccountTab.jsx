import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import { getAccount, updateAccount } from "../../services/settingsService";
import { changeAdminPassword } from "../../lib/adminApi";
import PageLoader from "../../components/PageLoader";

export default function AccountTab() {
  const { toast, showToast, clearToast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    getAccount().then(setForm);
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await updateAccount(form);
    setSaving(false);
    showToast("Account updated");
  }

  if (!form) return <PageLoader />;

  return (
    <form onSubmit={handleSubmit} className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Your account</h3>
      <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginBottom: 14 }}>
        Your account details are loaded from the authenticated admin session.
      </p>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
        <FormField label="Display name" htmlFor="acc-name" required>
          <input id="acc-name" className="admin-input" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </FormField>
        <FormField label="Email" htmlFor="acc-email" required>
          <input id="acc-email" type="email" className="admin-input" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </FormField>
        <FormField label="Role" htmlFor="acc-role">
          <input id="acc-role" className="admin-input" value={form.role} readOnly disabled />
        </FormField>
      </div>
      <div className="admin-form-actions" style={{ marginTop: 14, paddingTop: 0, borderTop: "none" }}>
        <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
          <Icon name="check" size={14} />
          {saving ? "Saving…" : "Save account"}
        </button>
      </div>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 4 }}>Change password</h3>
        <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginBottom: 14 }}>
          Changing your password signs out all existing sessions.
        </p>
        <div style={{ display: "grid", gap: 14, maxWidth: 520 }}>
          <FormField label="Current password" htmlFor="current-password" required>
            <input id="current-password" type="password" className="admin-input" autoComplete="current-password" value={passwords.currentPassword} onChange={e => setPasswords(p => ({...p, currentPassword: e.target.value}))} />
          </FormField>
          <FormField label="New password" htmlFor="new-password" required>
            <input id="new-password" type="password" className="admin-input" autoComplete="new-password" minLength={12} value={passwords.newPassword} onChange={e => setPasswords(p => ({...p, newPassword: e.target.value}))} />
          </FormField>
          <FormField label="Confirm new password" htmlFor="confirm-password" required>
            <input id="confirm-password" type="password" className="admin-input" autoComplete="new-password" minLength={12} value={passwords.confirmPassword} onChange={e => setPasswords(p => ({...p, confirmPassword: e.target.value}))} />
          </FormField>
          {passwordError ? <div className="admin-login__error" role="alert">{passwordError}</div> : null}
          <div className="admin-form-actions" style={{ paddingTop: 0, borderTop: "none" }}>
            <button className="admin-btn admin-btn--primary" type="button" disabled={changingPassword} onClick={async () => {
              setPasswordError("");
              if (passwords.newPassword.length < 12) return setPasswordError("New password must be at least 12 characters.");
              if (passwords.newPassword !== passwords.confirmPassword) return setPasswordError("New passwords do not match.");
              setChangingPassword(true);
              try {
                await changeAdminPassword(passwords.currentPassword, passwords.newPassword);
                showToast("Password changed. Please sign in again.");
                setTimeout(() => { window.location.href = "/login"; }, 700);
              } catch (err) { setPasswordError(err.message || "Unable to change password."); }
              finally { setChangingPassword(false); }
            }}>{changingPassword ? "Changing…" : "Change password"}</button>
          </div>
        </div>
      </section>
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </form>
  );
}
