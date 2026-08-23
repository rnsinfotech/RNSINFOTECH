import React from "react";

export default function FormField({ label, htmlFor, hint, required, children, full }) {
  return (
    <div className={`admin-field${full ? " admin-field--full" : ""}`}>
      {label && (
        <label htmlFor={htmlFor}>
          {label}
          {required && <span className="admin-field__required">*</span>}
        </label>
      )}
      {children}
      {hint && <div className="admin-field__hint">{hint}</div>}
    </div>
  );
}
