const ADMIN_KEY = "rns_admin_user_v1";

const configuredApiBaseUrl = import.meta.env.VITE_ADMIN_API_BASE_URL;
if (!configuredApiBaseUrl) throw new Error("VITE_ADMIN_API_BASE_URL is required.");
export const API_BASE_URL = configuredApiBaseUrl.replace(/\/$/, "");

// Zod validation errors (see admin-backend/src/middleware/validate.js) come
// back as { error: { message: "Validation failed.", details: { field: [msg, ...] } } }.
// Without this, every form on every page collapsed to the bare message with
// no indication of which field was wrong.
function detailedValidationMessage(payload, fallback) {
  const details = payload?.error?.details;
  const base = payload?.error?.message || fallback;
  if (!details || typeof details !== "object") return base;
  const fieldMessages = Object.entries(details)
    .filter(([, messages]) => Array.isArray(messages) && messages.length)
    .map(([field, messages]) => `${field}: ${messages.join(", ")}`);
  if (!fieldMessages.length) return base;
  return `${base} ${fieldMessages.join(" · ")}`;
}

function userFacingMessage(status, payload, fallback = "Request failed.") {
  if (status === 401) return "Your admin session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested resource was not found.";
  if (status === 409) return payload?.error?.message || "The data has changed. Refresh and try again.";
  if (status === 413) return "The request is too large.";
  if (status === 429) return "Too many requests. Please wait and try again.";
  if (status >= 500) return "The admin service is temporarily unavailable. Please try again.";
  if (status === 400) return detailedValidationMessage(payload, fallback);
  return payload?.error?.message || payload?.message || fallback;
}

let accessToken = null;
let admin = null;
let refreshPromise = null;
let unauthorizedHandler = null;

function readStoredAdmin() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.localStorage.getItem(ADMIN_KEY) || "null"); } catch { return null; }
}
function storeAdmin(value) {
  admin = value || null;
  if (typeof window === "undefined") return;
  if (admin) window.localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  else window.localStorage.removeItem(ADMIN_KEY);
}
export function getStoredAdminAuth() {
  return { accessToken, refreshToken: null, admin: admin || readStoredAdmin() };
}
export function setStoredAdminAuth({ accessToken: nextAccessToken, admin: nextAdmin }) {
  if (nextAccessToken !== undefined) accessToken = nextAccessToken || null;
  if (nextAdmin !== undefined) storeAdmin(nextAdmin);
}
export function clearStoredAdminAuth() {
  accessToken = null;
  admin = null;
  if (typeof window !== "undefined") window.localStorage.removeItem(ADMIN_KEY);
}
export function onAdminUnauthorized(handler) {
  unauthorizedHandler = handler;
  return () => { if (unauthorizedHandler === handler) unauthorizedHandler = null; };
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      clearStoredAdminAuth();
      return null;
    }
    const payload = await response.json().catch(() => null);
    if (!payload?.accessToken) {
      clearStoredAdminAuth();
      return null;
    }
    setStoredAdminAuth({ accessToken: payload.accessToken, admin: payload.admin });
    return payload.accessToken;
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function adminLogin(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.accessToken) {
    const error = new Error(payload?.error?.message || payload?.message || "Unable to sign in.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  setStoredAdminAuth({ accessToken: payload.accessToken, admin: payload.admin });
  return payload;
}

export async function getAdminAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && accessToken) return accessToken;
  return refreshAccessToken();
}

export async function refreshAdminAccessToken() {
  return refreshAccessToken();
}

export async function adminApiUpload(path, formData, { onProgress, method = "POST" } = {}) {
  const token = await getAdminAccessToken();
  if (!token) {
    const error = new Error("Admin authentication is required. Please sign in again.");
    error.status = 401;
    unauthorizedHandler?.();
    throw error;
  }

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = async () => {
      const contentType = xhr.getResponseHeader("content-type") || "";
      const payload = contentType.includes("application/json") ? JSON.parse(xhr.responseText || "null") : null;
      if (xhr.status === 401) {
        clearStoredAdminAuth();
        unauthorizedHandler?.();
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const error = new Error(userFacingMessage(xhr.status, payload, "Upload failed."));
        error.status = xhr.status;
        error.payload = payload;
        reject(error);
        return;
      }
      resolve(payload);
    };
    xhr.onerror = () => reject(new Error("Network error while uploading the image."));
    xhr.onabort = () => reject(new Error("Image upload was cancelled."));
    xhr.send(formData);
  });
}

export async function getCurrentAdmin() {
  // A page reload starts without the in-memory access token, but the
  // refresh endpoint already returns the authenticated admin. Avoid the
  // previous refresh -> /auth/me two-request startup sequence.
  if (!accessToken) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
    return admin || readStoredAdmin();
  }

  if (admin) return admin;

  try {
    const payload = await adminApiRequest("/auth/me");
    if (payload?.admin) setStoredAdminAuth({ admin: payload.admin });
    return payload?.admin || null;
  } catch {
    clearStoredAdminAuth();
    return null;
  }
}

export async function adminLogout() {
  try {
    if (accessToken) await adminApiRequest("/auth/logout", { method: "POST", retryOnUnauthorized: false });
  } finally {
    clearStoredAdminAuth();
  }
}

export async function adminApiRequest(path, { method = "GET", body, headers = {}, authRequired = true, retryOnUnauthorized = true } = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const config = { method, headers: { ...headers }, credentials: "include" };

  if (authRequired) {
    if (!accessToken) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        const error = new Error("Admin authentication is required. Please sign in again.");
        error.status = 401;
        unauthorizedHandler?.();
        throw error;
      }
    }
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    config.headers["Content-Type"] = config.headers["Content-Type"] || "application/json";
    config.body = JSON.stringify(body);
  } else if (body !== undefined && body !== null) config.body = body;

  let response = await fetch(url, config);
  if ([502, 503, 504].includes(response.status) && ["GET", "HEAD"].includes(method.toUpperCase())) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    response = await fetch(url, config);
  }

  if (response.status === 401 && authRequired && retryOnUnauthorized) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      config.headers.Authorization = `Bearer ${refreshedToken}`;
      response = await fetch(url, config);
    }
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (response.status === 401 && authRequired) {
      clearStoredAdminAuth();
      unauthorizedHandler?.();
    }
    const error = new Error(userFacingMessage(response.status, payload));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function changeAdminPassword(currentPassword, newPassword) {
  return adminApiRequest("/auth/change-password", { method: "POST", body: { currentPassword, newPassword }, retryOnUnauthorized: false });
}

export async function requestPasswordReset(email) {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "Unable to process password reset request.");
  return payload;
}

export async function resetAdminPassword(token, newPassword) {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "Unable to reset password.");
  return payload;
}
