import React, { useEffect, useRef } from "react";
import { getStoredAdminAuth } from "../lib/adminApi";
import { hasPermission } from "../lib/permissions";

export default function PermissionBoundary({ permission, children, mode = "disable" }) {
  const ref = useRef(null);
  const allowed = hasPermission(getStoredAdminAuth().admin, permission);
  useEffect(() => {
    if (allowed || !ref.current) return undefined;
    const root = ref.current;
    root.setAttribute("aria-readonly", "true");
    const controls = root.querySelectorAll("button, input, select, textarea");
    controls.forEach((el) => { if (mode === "disable") { el.disabled = true; el.setAttribute("title", "Your admin role cannot perform this action."); } });
    return () => controls.forEach((el) => { el.disabled = false; el.removeAttribute("title"); });
  }, [allowed, mode]);
  if (allowed) return <>{children}</>;
  return <div ref={ref} style={{ position: "relative" }}>{children}<div style={{ marginTop: 8, fontSize: 12, color: "var(--admin-ink-faint)" }}>Read-only for your admin role.</div></div>;
}
