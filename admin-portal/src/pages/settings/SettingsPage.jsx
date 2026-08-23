import React, { useState } from "react";
import PermissionBoundary from "../../components/PermissionBoundary";
import StoreProfileTab from "./StoreProfileTab";
import CommerceTab from "./CommerceTab";
import AccountTab from "./AccountTab";

const TABS = [
  { value: "profile", label: "Store profile" },
  { value: "commerce", label: "Commerce" },
  { value: "account", label: "Account" },
];

/**
 * SettingsPage — Phase 9, the last section of the frontend-only build.
 * Store profile (business identity/contact), Commerce (shipping rule +
 * low-stock threshold — the numbers that used to be hardcoded in
 * source files), and Account (the logged-in admin's own display
 * identity, stubbed ahead of Phase 10's real auth).
 */
export default function SettingsPage() {
  const [tab, setTab] = useState("profile");

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Settings</h1>
          <p>Store identity, commerce rules, and your admin account.</p>
        </div>
      </div>

      <div className="admin-segmented" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`admin-segmented__btn${tab === t.value ? " is-active" : ""}`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <PermissionBoundary permission="settings.write"><StoreProfileTab /></PermissionBoundary>}
      {tab === "commerce" && <PermissionBoundary permission="settings.write"><CommerceTab /></PermissionBoundary>}
      {tab === "account" && <AccountTab />}
    </div>
  );}
