import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock adminApi so we can count calls and control auth state without a
// real backend. Every named export App.jsx / Topbar.jsx / Sidebar.jsx /
// StaffPage.jsx touch must be present here.
vi.mock("../lib/adminApi", () => {
  let unauthorizedHandler = null;
  return {
    getCurrentAdmin: vi.fn(async () => ({ id: "admin1", name: "Test Admin", role: "Owner" })),
    onAdminUnauthorized: vi.fn((handler) => {
      unauthorizedHandler = handler;
      return () => {
        if (unauthorizedHandler === handler) unauthorizedHandler = null;
      };
    }),
    adminApiRequest: vi.fn(async () => ({ items: [] })),
    getStoredAdminAuth: vi.fn(() => ({ admin: { id: "admin1", name: "Test Admin", role: "Owner" } })),
    adminLogout: vi.fn(async () => {}),
  };
});

vi.mock("../services/settingsService", () => ({
  getAccountSync: vi.fn(() => ({ id: "admin1", name: "Test Admin", role: "Owner" })),
}));

import { getCurrentAdmin } from "../lib/adminApi";
import App from "../App";

describe("RequireAdmin session check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/staff");
  });

  it("checks the session once on mount, not again on in-app navigation", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Initial mount: loading state, then resolves to authenticated.
    await waitFor(() => expect(getCurrentAdmin).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(/checking admin session/i)).not.toBeInTheDocument());

    // Navigate to another in-app route via a real sidebar link (mimics a click-through).
    const auditLink = await screen.findByRole("link", { name: /audit log/i });
    await user.click(auditLink);

    // Let the lazily-loaded AuditLogPage finish mounting, and give any
    // (incorrect) re-check of the session a chance to fire too.
    await waitFor(() => expect(screen.queryByText(/loading page/i)).not.toBeInTheDocument());

    // The regression this test guards against: getCurrentAdmin used to be
    // re-invoked (and the whole outlet replaced with "Checking admin
    // session…") on every navigation. It must stay at 1 call.
    expect(getCurrentAdmin).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/checking admin session/i)).not.toBeInTheDocument();
  });
});
