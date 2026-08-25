import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, clearStoredAuth, getStoredAccessToken, getStoredUser, setStoredAuth } from "../lib/api";

const AuthContext = createContext(null);

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user._id || user.id,
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    isVerified: Boolean(user.isVerified),
    createdAt: user.createdAt,
  };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [pendingVerification, setPendingVerification] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setCurrentUser(null);
      setHydrated(true);
      return;
    }

    apiRequest("/auth/me", { authRequired: true })
      .then((response) => {
        const normalized = normalizeUser(response.user || response);
        setCurrentUser(normalized);
        setStoredAuth({
          accessToken: getStoredAccessToken(),
          refreshToken: localStorage.getItem("rns_storefront_refresh_token_v1"),
          user: normalized,
        });
      })
      .catch(() => {
        clearStoredAuth();
        setCurrentUser(null);
      })
      .finally(() => setHydrated(true));
  }, []);

  const api = useMemo(() => ({
    currentUser,
    isAuthenticated: Boolean(currentUser),
    pendingVerification,
    hydrated,

    requestOtp: async (email, intent) => {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!normalizedEmail) return { ok: false, error: "Email is required." };
      const resolvedIntent = intent || pendingVerification?.intent || "login";

      try {
        const response = await apiRequest("/auth/request-otp", {
          method: "POST",
          body: { email: normalizedEmail, intent: resolvedIntent },
        });

        setPendingVerification({
          email: normalizedEmail,
          lastSentAt: Date.now(),
          expiresInSeconds: response.expiresInSeconds,
          devCode: response.devCode || null,
          name: pendingVerification?.name || "",
          phone: pendingVerification?.phone || "",
          // Which page this OTP request came from — gates whether
          // verify-otp is allowed to create a new account. Falls back to
          // "login" (the safer default) if unspecified.
          intent: resolvedIntent,
        });

        return { ok: true, devCode: response.devCode || null };
      } catch (error) {
        return { ok: false, error: error.message, code: error.code };
      }
    },

    signup: async ({ name, email, phone }) => {
      const result = await api.requestOtp(email, "signup");
      if (!result.ok) return result;
      setPendingVerification((prev) => ({
        email: String(email || "").trim().toLowerCase(),
        lastSentAt: Date.now(),
        expiresInSeconds: prev?.expiresInSeconds || 600,
        devCode: result.devCode || prev?.devCode || null,
        name: String(name || "").trim(),
        phone: String(phone || "").trim(),
        intent: "signup",
      }));
      return { ok: true };
    },

    restartVerification: async (email, name = "") => {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!normalizedEmail) return { ok: false, error: "Email is required." };
      const intent = name ? "signup" : "login";
      const result = await api.requestOtp(normalizedEmail, intent);
      if (!result.ok) return result;
      setPendingVerification((prev) => ({
        email: normalizedEmail,
        lastSentAt: Date.now(),
        expiresInSeconds: prev?.expiresInSeconds || 600,
        devCode: result.devCode || prev?.devCode || null,
        name: String(name || "").trim(),
        phone: String(prev?.phone || "").trim(),
        intent,
      }));
      return { ok: true };
    },

    resendOtp: async () => {
      if (!pendingVerification?.email) return { ok: false, error: "No verification in progress." };
      return api.requestOtp(pendingVerification.email, pendingVerification.intent);
    },

    verifyEmail: async (code, nameOverride) => {
      if (!pendingVerification?.email) return { ok: false, error: "No verification in progress." };

      // The backend's verify-otp schema treats `name` as optional but,
      // if present, requires a non-empty string. Login (as opposed to
      // signup) has no name to send, so pendingVerification.name is ""
      // — sending that empty string tripped the schema's min(1) check
      // and got rejected with a 400. Only include `name` when there's
      // an actual value.
      const name = String(nameOverride || pendingVerification.name || "").trim();
      const phone = String(pendingVerification.phone || "").trim();

      try {
        const response = await apiRequest("/auth/verify-otp", {
          method: "POST",
          body: {
            email: pendingVerification.email,
            code,
            ...(name ? { name } : {}),
            ...(phone ? { phone } : {}),
            intent: pendingVerification.intent || "login",
          },
        });

        const normalized = normalizeUser(response.user);
        setCurrentUser(normalized);
        setStoredAuth({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          user: normalized,
        });
        setPendingVerification(null);
        return { ok: true, user: normalized };
      } catch (error) {
        // Surface the machine-readable code alongside the message so the UI
        // can tell "wrong code, try again" (OTP_INVALID) apart from
        // "that code is dead, you need a new one" (OTP_NOT_FOUND,
        // OTP_LOCKED, OTP_CONSUMED) instead of treating every failure the
        // same way.
        return { ok: false, error: error.message, code: error.code };
      }
    },

    login: async ({ email }) => {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!normalizedEmail) return { ok: false, error: "Email is required." };

      const result = await api.requestOtp(normalizedEmail, "login");
      if (!result.ok) return result;
      return { ok: true, needsVerification: true };
    },

    logout: async () => {
      try {
        await apiRequest("/auth/logout", { method: "POST", authRequired: true });
      } catch {
        // ignore logout failures and still clear local auth state
      }
      clearStoredAuth();
      setCurrentUser(null);
      setPendingVerification(null);
      return { ok: true };
    },

    updateProfile: async (patch) => {
      try {
        const response = await apiRequest("/auth/me", {
          method: "PATCH",
          authRequired: true,
          body: patch,
        });
        const normalized = normalizeUser(response.user);
        setCurrentUser(normalized);
        setStoredAuth({
          accessToken: getStoredAccessToken(),
          refreshToken: localStorage.getItem("rns_storefront_refresh_token_v1"),
          user: normalized,
        });
        return { ok: true, user: normalized };
      } catch (error) {
        return { ok: false, error: error.message, code: error.code };
      }
    },
  }), [currentUser, pendingVerification, hydrated]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}