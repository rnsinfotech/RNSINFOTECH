import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getStoreProfileContent } from "../lib/contentApi";

const SiteSettingsContext = createContext(null);
const REFRESH_AFTER_MS = 30_000;

// Outage-only fallback, shown only until the first successful GET
// /store-profile response merges in. Previously imported from the mock
// `siteData.js`; inlined here since this is the only remaining reader
// (siteData's `support` export removed in the Phase 3 cleanup — see
// MOCK_DATA_CLEANUP_PROGRESS.md).
const defaultSupport = {
  email: "support@rnsinfotech.in",
  phone: "+91 98114 71499",
  // Digits-only, country code first — the format wa.me links require.
  whatsapp: "919811471499",
  hours: "Mon–Sat, 10:00 AM – 7:00 PM IST",
  address: "711, Eros Apartment, Building No. 56, Nehru Place, New Delhi, Delhi 110019",
  emailResponseTime: "Usually within 24 hours",
  chatResponseTime: "Usually within a few minutes during business hours",
};

export function SiteSettingsProvider({ children }) {
  const [support, setSupport] = useState(defaultSupport);
  const lastFetchedAtRef = useRef(0);
  const supportRef = useRef(defaultSupport);

  const refresh = useCallback(async ({ force = false } = {}) => {
    if (!force && Date.now() - lastFetchedAtRef.current < REFRESH_AFTER_MS) {
      return supportRef.current;
    }

    try {
      const profile = await getStoreProfileContent();
      if (profile) {
        // The backend is authoritative. Preserve the static values only as
        // an outage fallback; an explicitly empty backend field must replace
        // the old value rather than being hidden by a truthy merge.
        const nextSupport = { ...supportRef.current, ...profile };
        supportRef.current = nextSupport;
        setSupport(nextSupport);
      }
      lastFetchedAtRef.current = Date.now();
      return profile;
    } catch {
      // Keep the last known good values when the API is temporarily down.
      return null;
    }
  }, []);

  useEffect(() => {
    refresh({ force: true });
  }, [refresh]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  return <SiteSettingsContext.Provider value={{ support, refresh }}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used within a SiteSettingsProvider");
  return ctx;
}
