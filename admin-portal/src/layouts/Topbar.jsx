import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Icon from "../components/Icon";
import { navItemsFlat } from "../config/navConfig";
import { getAccountSync } from "../services/settingsService";
import { adminLogout } from "../lib/adminApi";
import TopbarSearch from "./TopbarSearch";
import TopbarNotifications from "./TopbarNotifications";

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function currentTitle(pathname) {
  const match = navItemsFlat.find((item) =>
    item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)
  );
  return match?.label || "Admin Portal";
}

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const [account, setAccount] = useState(() => getAccountSync() || {});

  // Re-read on every route change (a plain sync localStorage read, no
  // fetch) so navigating away from Settings after a save picks up the
  // new name/role immediately, without needing a page reload.
  useEffect(() => {
    setAccount(getAccountSync() || {});
  }, [location.pathname]);

  return (
    <header className="admin-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          className="admin-topbar__icon-btn"
          onClick={onMenuClick}
          type="button"
          aria-label="Toggle sidebar"
          style={{ display: "none" }}
          id="admin-mobile-menu-btn"
        >
          <Icon name="menu" size={18} />
        </button>
        <h1 className="admin-topbar__title">{currentTitle(location.pathname)}</h1>
      </div>

      <div className="admin-topbar__right">
        <TopbarSearch />
        <TopbarNotifications />
        <div className="admin-topbar__profile">
          <div className="admin-topbar__avatar">{initials(account.name)}</div>
          <div>
            <div className="admin-topbar__profile-name">{account.name || "Admin"}</div>
            <div className="admin-topbar__profile-role">{account.role || "Staff"}</div>
          </div>
        </div>
        <button
          className="admin-topbar__icon-btn"
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => adminLogout().finally(() => { window.location.href = "/login"; })}
        >
          <Icon name="logout" size={16} />
        </button>
      </div>
    </header>
  );
}
