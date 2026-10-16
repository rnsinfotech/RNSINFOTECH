import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Icon from "../components/Icon";
import { navItemsFlat } from "../config/navConfig";
import { getAccount, getAccountSync } from "../services/settingsService";
import { adminLogout } from "../lib/adminApi";
import TopbarSearch from "./TopbarSearch";
import TopbarNotifications from "./TopbarNotifications";

function initials(name, role) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return role === "Owner" ? "OW" : "AD";
  return (parts[0][0] + (parts[1]?.[0] || parts[0][1] || "")).toUpperCase();
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

  useEffect(() => {
    let alive = true;
    const syncAccount = getAccountSync();
    if (syncAccount) setAccount(syncAccount);

    getAccount()
      .then((acc) => {
        if (alive && acc) {
          setAccount(acc);
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [location.pathname]);

  const displayName =
    account.name ||
    (account.role === "Owner" ? "Store Owner" : account.role ? `${account.role} Admin` : "Admin");
  const displayRole = account.role || "Owner";

  return (
    <header className="admin-topbar">
      <div className="admin-topbar__left">
        <button
          className="admin-topbar__icon-btn admin-topbar__menu-btn"
          onClick={onMenuClick}
          type="button"
          aria-label="Toggle navigation"
          id="admin-mobile-menu-btn"
        >
          <Icon name="menu" size={18} />
        </button>
        <h1 className="admin-topbar__title">{currentTitle(location.pathname)}</h1>
      </div>

      <div className="admin-topbar__right">
        <TopbarSearch />
        <TopbarNotifications />
        <div className="admin-topbar__profile" title={`${displayName} (${displayRole})`}>
          <div className="admin-topbar__avatar">{initials(displayName, displayRole)}</div>
          <div className="admin-topbar__profile-text">
            <div className="admin-topbar__profile-name">{displayName}</div>
            <div className="admin-topbar__profile-role">{displayRole}</div>
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
