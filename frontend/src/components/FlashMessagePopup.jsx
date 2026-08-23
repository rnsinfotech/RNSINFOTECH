import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { loadFlashMessages, subscribeFlashMessages, visibleFlashMessages } from "../lib/flashMessagesStore";

// Pages where an attention-grabbing popup would just get in the way —
// login/signup already center-stage the login message itself, and
// checkout/payment shouldn't be interrupted mid-flow.
const SUPPRESSED_PATHS = ["/login", "/signup", "/checkout", "/checkout/payment", "/verify-email"];

const FIRST_DELAY_MS = 7000; // first popup, shortly after landing
const REPEAT_MS = 40000; // then again roughly every 40s while the visitor stays

const TYPE_STYLES = {
  login: { accent: "#3d5afe", glyph: "🔑" },
  sale: { accent: "#e0392b", glyph: "🔥" },
  newsletter: { accent: "#1f9d55", glyph: "✉️" },
  custom: { accent: "#6a5acd", glyph: "📣" },
};

/**
 * FlashMessagePopup — an occasional, attention-grabbing center-screen
 * card (dulled backdrop behind it) surfacing one random active flash
 * message at a time — a login nudge, a sale, a newsletter prompt,
 * whatever's active — as a change of pace from the quieter rotating
 * strip in AnnouncementBar.jsx. Both read from the real backend API
 * (GET /api/flash-messages).
 *
 * Mounted once, globally, in App.jsx — not per-page — so its timer
 * keeps running across navigation instead of resetting on every route
 * change.
 */
export default function FlashMessagePopup() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [current, setCurrent] = useState(null);
  const [closing, setClosing] = useState(false);
  const lastIdRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Load messages on mount
    loadFlashMessages().then(setMessages);
    // Subscribe to updates (polling every 30s)
    const unsubscribe = subscribeFlashMessages((nextMessages) => setMessages(nextMessages));
    return unsubscribe;
  }, []);

  const active = useMemo(() => visibleFlashMessages(messages, { isAuthenticated }), [messages, isAuthenticated]);
  const suppressed = SUPPRESSED_PATHS.includes(location.pathname);

  // Timer loop reads from refs (kept in sync via the effect below) so
  // each fire picks up the latest messages/route/auth state instead of
  // whatever was current when the timeout was first scheduled.
  const activeRef = useRef(active);
  const suppressedRef = useRef(suppressed);
  useEffect(() => {
    activeRef.current = active;
    suppressedRef.current = suppressed;
  }, [active, suppressed]);

  function scheduleNext(delay) {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(showRandom, delay);
  }

  function showRandom() {
    const pool0 = activeRef.current;
    if (suppressedRef.current || pool0.length === 0) {
      scheduleNext(REPEAT_MS);
      return;
    }
    // Avoid immediately repeating the same message twice in a row when
    // more than one is available.
    const pool = pool0.length > 1 ? pool0.filter((m) => m.id !== lastIdRef.current) : pool0;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    lastIdRef.current = pick.id;
    setCurrent(pick);
    setClosing(false);
    scheduleNext(REPEAT_MS);
  }

  useEffect(() => {
    timerRef.current = setTimeout(showRandom, FIRST_DELAY_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close immediately if navigation lands on a suppressed page while a
  // popup happens to be open.
  useEffect(() => {
    if (suppressed && current) setCurrent(null);
  }, [suppressed, current]);

  function close() {
    setClosing(true);
    setTimeout(() => setCurrent(null), 180);
  }

  if (!current || suppressed) return null;

  const style = TYPE_STYLES[current.type] || TYPE_STYLES.custom;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(10, 10, 14, 0.55)",
        backdropFilter: "blur(2px)",
        animation: `rns-flash-backdrop-${closing ? "out" : "in"} 0.2s ease forwards`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 380,
          background: "var(--rns-bg)",
          borderRadius: "var(--rns-r-md, 14px)",
          padding: "28px 26px 24px",
          textAlign: "center",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          animation: `rns-flash-card-${closing ? "out" : "in"} 0.22s ease forwards`,
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "none",
            border: "none",
            color: "var(--rns-ink-faint)",
            cursor: "pointer",
            padding: 8,
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <div
          style={{
            width: 46,
            height: 46,
            margin: "0 auto 14px",
            borderRadius: "50%",
            background: `${style.accent}1a`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
          }}
          aria-hidden="true"
        >
          {style.glyph}
        </div>

        <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: "var(--rns-ink)" }}>{current.message}</p>

        {current.ctaHref && current.ctaLabel ? (
          <a
            href={current.ctaHref}
            className="rns-btn rns-btn--primary"
            style={{ marginTop: 18, display: "inline-flex" }}
            onClick={close}
          >
            {current.ctaLabel}
          </a>
        ) : (
          <button type="button" onClick={close} className="rns-btn rns-btn--ghost" style={{ marginTop: 18 }}>
            Dismiss
          </button>
        )}
      </div>

      <style>{`
        @keyframes rns-flash-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rns-flash-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes rns-flash-card-in { from { opacity: 0; transform: scale(0.94) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes rns-flash-card-out { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.96) translateY(4px); } }
      `}</style>
    </div>
  );
}
