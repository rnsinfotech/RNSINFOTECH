import React from "react";
import { NavLink } from "react-router-dom";
import Icon from "../components/Icon";
import { navConfig } from "../config/navConfig";
import { getStoredAdminAuth } from "../lib/adminApi";

export default function Sidebar({ collapsed, onToggle }) {
  const role = getStoredAdminAuth().admin?.role || "Staff";
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <div className="admin-sidebar__brand-mark">
          <img src="/rns_logo.jpg" alt="" className="admin-sidebar__brand-logo" />
        </div>
        <div>
          <div className="admin-sidebar__brand-text">RNS INFOTECH</div>
          <div className="admin-sidebar__brand-sub">Admin Portal</div>
        </div>
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
              >
                <Icon name={item.icon} size={17} />
                <span className="admin-nav__label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <button className="admin-sidebar__collapse-btn" onClick={onToggle} type="button">
        <Icon name={collapsed ? "chevron" : "chevronLeft"} size={15} />
        <span>Collapse</span>
      </button>
    </aside>
  );
}
