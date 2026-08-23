import React from "react";

/**
 * AdminChatPage — placeholder for the support console. The real admin
 * chat interface has moved to the separate admin-portal project, which
 * connects to the storefront-backend API for real two-way conversations.
 *
 * This demo page is no longer used in Phase B and later, as chat now
 * connects to the real backend API (storefront-backend /api/chat/*).
 */
export default function AdminChatPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--rns-bg-alt)" }}>
      <div
        style={{
          padding: "14px 20px",
          background: "var(--rns-bg-ink)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontFamily: "var(--rns-font-display)", fontWeight: 700, fontSize: 15 }}>
          RNS INFOTECH — Support Console (Legacy Demo)
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--rns-ink-faint)" }}>
          <p style={{ fontSize: 14, marginBottom: 8 }}>This demo page has been replaced with the admin-portal project.</p>
          <p style={{ fontSize: 12, marginBottom: 12 }}>
            The storefront's chat now connects to the real backend API for customer support conversations.
          </p>
          <a href="/" style={{ color: "var(--rns-primary)", textDecoration: "none", fontWeight: 600 }}>
            Return to storefront
          </a>
        </div>
      </div>
    </div>
  );
}

