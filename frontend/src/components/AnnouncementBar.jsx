import React, { useEffect, useMemo, useState } from "react";
import { loadFlashMessages, subscribeFlashMessages, visibleFlashMessages } from "../lib/flashMessagesStore";
import { useAuth } from "../context/AuthContext";

const DEFAULT_DURATION_MS = 5000;

// type -> accent color + small emoji glyph. Kept intentionally simple
// (no icon font dependency) since this renders above the navbar on
// every page and needs to stay lightweight.
const TYPE_STYLES = {
  login: { accent: "#8ea2ff", glyph: "🔑" },
  sale: { accent: "#ff8a5c", glyph: "🔥" },
  newsletter: { accent: "#5ad1a5", glyph: "✉️" },
  custom: { accent: "#8ea2ff", glyph: "📣" },
};

/**
 * AnnouncementBar — the rotating flash-message strip shown above the
 * navbar on every page. Reads the active message list from the real
 * backend API (GET /api/flash-messages) and cycles through whichever
 * are marked active, each showing for its own `durationSeconds` before
 * the next takes over. "login"-type messages are automatically hidden
 * once the visitor is signed in (see visibleFlashMessages in
 * flashMessagesStore.js) — no point nudging someone to log in who
 * already has.
 */
export default function AnnouncementBar() {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState([]);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Load messages on mount
    loadFlashMessages().then(setMessages);
    // Subscribe to updates (polling every 30s)
    const unsubscribe = subscribeFlashMessages((nextMessages) => setMessages(nextMessages));
    return unsubscribe;
  }, []);

  const active = useMemo(() => visibleFlashMessages(messages, { isAuthenticated }), [messages, isAuthenticated]);

  // Keep the visible index in range whenever the active list changes
  // (e.g. admin deactivates the message currently on screen).
  useEffect(() => {
    setIndex((i) => (active.length === 0 ? 0 : i % active.length));
  }, [active.length]);

  const current = active[index] || null;

  useEffect(() => {
    if (active.length <= 1) return undefined;
    const ms = Math.max(1, Number(current?.durationSeconds) || 5) * 1000 || DEFAULT_DURATION_MS;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % active.length), ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, active.length]);

  if (dismissed || !current) return null;

  const style = TYPE_STYLES[current.type] || TYPE_STYLES.custom;

  return (
    <div
      role="status"
      style={{
        background: "var(--rns-bg-ink)",
        color: "var(--rns-on-ink)",
        borderBottom: `2px solid ${style.accent}`,
      }}
    >
      <div
        className="rns-container"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "9px 44px",
          fontSize: 13,
          fontFamily: "var(--rns-font-mono)",
          flexWrap: "wrap",
          textAlign: "center",
        }}
      >
        <span aria-hidden="true">{style.glyph}</span>
        <span>{current.message}</span>
        {current.ctaHref && current.ctaLabel && (
          <a href={current.ctaHref} style={{ color: style.accent, fontWeight: 600 }}>
            {current.ctaLabel} →
          </a>
        )}

        {active.length > 1 && (
          <span style={{ display: "inline-flex", gap: 5, marginLeft: 6 }} aria-hidden="true">
            {active.map((m, i) => (
              <span
                key={m.id || i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: i === index ? style.accent : "rgba(255,255,255,0.28)",
                  transition: "background 0.2s ease",
                }}
              />
            ))}
          </span>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss message"
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "inherit",
            opacity: 0.6,
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: 6,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
