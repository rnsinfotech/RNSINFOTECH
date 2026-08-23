import React from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";

export default function NotFoundPage() {
  return (
    <div>
      <EmptyState icon="alert" title="Page not found" description="That admin page doesn't exist." />
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <Link to="/" className="admin-btn admin-btn--primary" style={{ textDecoration: "none", display: "inline-flex" }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
