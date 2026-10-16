import React from "react";
import { NavLink } from "react-router-dom";
import Icon from "../components/Icon";
import { navConfig } from "../config/navConfig";
import { getStoredAdminAuth } from "../lib/adminApi";

function initials(name, role) {
  if (name === "Store Owner") return "SO";
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return role === "Owner" ? "SO" : "AD";
  return (parts[0][0] + (parts[1]?.[0] || parts[0][1] || "")).toUpperCase();
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }) {
  const admin = getStoredAdminAuth().admin || {};
  const role = admin.role || "Owner";
  const isEmailName = admin.name && (admin.name.includes("@") || admin.name === admin.email);
  const displayName =
    admin.name && !isEmailName
      ? admin.name
      : role === "Owner"
      ? "Store Owner"
      : "Admin";

  return (
    <aside className={`admin-sidebar${mobileOpen ? " is-mobile-open" : ""}`}>
      <div className="admin-sidebar__brand">
        <div className="admin-sidebar__brand-mark">
          <img src="/rns_logo.jpg" alt="" className="admin-sidebar__brand-logo" />
        </div>
        <div className="admin-sidebar__brand-info">
          <div className="admin-sidebar__brand-text">RNS INFOTECH</div>
          <div className="admin-sidebar__brand-sub">Admin Portal</div>
        </div>
        {mobileOpen && onCloseMobile && (
          <button
            className="admin-sidebar__close-btn"
            onClick={onCloseMobile}
            type="button"
            aria-label="Close navigation"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      <nav className="admin-nav" aria-label="Admin navigation">
        {navConfig.map((group) => (
          <div key={group.group}>
            <div className="admin-nav__group-label">{group.group}</div>
            {group.items.filter((item) => !item.roles || item.roles.includes(role)).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) => `admin-nav__link${isActive ? " is-active" : ""}`}
                title={collapsed ? item.label : undefined}
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth <= 768 && onCloseMobile) {
                    onCloseMobile();
                  }
                }}
              >
                <Icon name={item.icon} size={17} />
                <span className="admin-nav__label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar__profile" title={`${displayName} (${role})`}>
        <div className="admin-sidebar__profile-avatar">{initials(displayName, role)}</div>
        <div className="admin-sidebar__profile-info">
          <div className="admin-sidebar__profile-name">{displayName}</div>
          <div className="admin-sidebar__profile-role">{role}</div>
        </div>
      </div>

      <button className="admin-sidebar__collapse-btn" onClick={onToggle} type="button">
        <Icon name={collapsed ? "chevron" : "chevronLeft"} size={15} />
        <span>Collapse</span>
      </button>
    </aside>
  );
}
