import React, { useEffect } from "react";
import Icon from "./Icon";

// A single toast, controlled by the page that owns it (see useToast
// below). Kept dependency-free rather than a global context, since only
// a handful of pages need it right now.
export default function Toast({ message, tone = "success", onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`admin-toast admin-toast--${tone}`} role="status">
      <Icon name={tone === "danger" ? "alert" : "check"} size={15} />
      <span>{message}</span>
    </div>
  );
}
