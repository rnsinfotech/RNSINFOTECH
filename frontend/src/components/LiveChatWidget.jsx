import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { useLiveChat } from "../context/LiveChatContext";
import { useSiteSettings } from "../context/SiteSettingsContext";

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(ts) {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Today";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

/**
 * LiveChatWidget — a real (if backend-less) chat between the customer
 * and RNS INFOTECH support, styled after familiar messaging apps:
 * timestamped bubbles grouped by day, and single/double check marks
 * on the customer's own messages to show sent vs. read. There is no
 * bot here — messages sit as "sent" until a person on the support
 * side (see /admin/chat) actually replies.
 */
export default function LiveChatWidget() {
  const { open, closeChat, messages, sendMessage } = useLiveChat();
  const { support } = useSiteSettings();
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  function handleSend(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft("");
  }

  if (!open) return null;

  let lastDay = null;

  return (
    <div
      role="dialog"
      aria-label="Chat with RNS INFOTECH support"
      className="rns-chat-panel"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: 376,
        maxWidth: "calc(100vw - 32px)",
        height: 500,
        maxHeight: "calc(100vh - 100px)",
        background: "#fff",
        borderRadius: 20,
        boxShadow: "0 24px 64px rgba(16,19,26,0.22), 0 8px 24px rgba(16,19,26,0.10)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 60,
        border: "1px solid rgba(16,19,26,0.06)",
      }}
    >
      <div
        style={{
          padding: "16px 18px",
          background: "linear-gradient(135deg, #171b26 0%, var(--rns-bg-ink) 100%)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              aria-hidden="true"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--rns-primary), var(--rns-primary-dark))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "var(--rns-font-display)",
                boxShadow: "0 2px 8px rgba(47,62,240,0.4)",
              }}
            >
              RNS
            </div>
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                bottom: -1,
                right: -1,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--rns-signal)",
                border: "2px solid #171b26",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>RNS INFOTECH support</div>
            <div style={{ fontSize: 11.5, color: "#9ba3b5", marginTop: 2 }}>{support.chatResponseTime}</div>
          </div>
        </div>
        <button
          onClick={closeChat}
          aria-label="Close chat"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "none",
            color: "#e4e6ec",
            cursor: "pointer",
            padding: 6,
            borderRadius: "50%",
            display: "inline-flex",
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div
        ref={listRef}
        className="rns-chat-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          background: "var(--rns-bg-alt)",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              alignSelf: "center",
              textAlign: "center",
              fontSize: 12,
              color: "var(--rns-ink-faint)",
              background: "#fff",
              border: "1px solid var(--rns-line)",
              borderRadius: 10,
              padding: "10px 14px",
              margin: "8px 0",
              maxWidth: "90%",
            }}
          >
            Send us a message and someone from the RNS INFOTECH team will reply here — {support.chatResponseTime.toLowerCase()}.
          </div>
        )}

        {messages.map((m) => {
          const day = formatDay(m.ts);
          const showDay = day !== lastDay;
          lastDay = day;
          const isCustomer = m.from === "customer";
          return (
            <React.Fragment key={m.id}>
              {showDay && (
                <div
                  style={{
                    alignSelf: "center",
                    fontSize: 11,
                    color: "var(--rns-ink-faint)",
                    background: "#fff",
                    border: "1px solid var(--rns-line)",
                    borderRadius: 20,
                    padding: "3px 10px",
                    margin: "8px 0 4px",
                  }}
                >
                  {day}
                </div>
              )}
              <div
                style={{
                  alignSelf: isCustomer ? "flex-end" : "flex-start",
                  maxWidth: "82%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <div
                  style={{
                    background: isCustomer
                      ? "linear-gradient(135deg, var(--rns-primary), var(--rns-primary-dark))"
                      : "#fff",
                    color: isCustomer ? "#fff" : "var(--rns-ink)",
                    border: isCustomer ? "none" : "1px solid var(--rns-line)",
                    boxShadow: isCustomer ? "0 2px 8px rgba(47,62,240,0.18)" : "0 1px 2px rgba(16,19,26,0.04)",
                    borderRadius: 14,
                    borderBottomRightRadius: isCustomer ? 3 : 14,
                    borderBottomLeftRadius: isCustomer ? 14 : 3,
                    padding: "9px 13px",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.text}
                </div>
                <div
                  style={{
                    alignSelf: isCustomer ? "flex-end" : "flex-start",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 10.5,
                    color: "var(--rns-ink-faint)",
                    padding: "0 3px",
                  }}
                >
                  <span>{formatTime(m.ts)}</span>
                  {isCustomer && (
                    <span
                      aria-label={m.readByAdmin ? "Read" : "Sent"}
                      style={{
                        display: "inline-flex",
                        marginLeft: 1,
                        color: m.readByAdmin ? "var(--rns-primary)" : "var(--rns-ink-faint)",
                      }}
                    >
                      <Icon name="check" size={11} strokeWidth={2.2} />
                      <Icon name="check" size={11} strokeWidth={2.2} style={{ marginLeft: -6 }} />
                    </span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <form
        onSubmit={handleSend}
        style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--rns-line)", background: "#fff", flexShrink: 0 }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="rns-chat-input"
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 22,
            border: "1px solid var(--rns-line-strong)",
            background: "var(--rns-bg-alt)",
            fontSize: 13.5,
            outline: "none",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
          }}
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!draft.trim()}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: draft.trim() ? "var(--rns-primary)" : "var(--rns-line)",
            color: "#fff",
            border: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            cursor: draft.trim() ? "pointer" : "default",
            transition: "background 0.15s ease, transform 0.1s ease",
          }}
        >
          <Icon name="send" size={15} />
        </button>
      </form>

      <style>{`
        .rns-chat-panel {
          animation: rns-chat-in 0.18s ease;
          transform-origin: bottom right;
        }
        @keyframes rns-chat-in {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .rns-chat-input:focus {
          background: #fff;
          border-color: var(--rns-primary);
          box-shadow: 0 0 0 3px var(--rns-primary-tint);
        }
        .rns-chat-scroll::-webkit-scrollbar { width: 6px; }
        .rns-chat-scroll::-webkit-scrollbar-thumb {
          background: var(--rns-line-strong);
          border-radius: 3px;
        }
        .rns-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        @media (prefers-reduced-motion: reduce) {
          .rns-chat-panel { animation: none; }
        }
        /* On mobile, 'vh' is pinned to the largest possible viewport, so
           the panel's max-height doesn't shrink when the browser's address
           bar is showing — it only "snaps" once the bar hides, which reads
           as a jump. 'dvh' tracks the real, current viewport instead, so
           the panel resizes smoothly with the address bar rather than
           jumping. Feature-queried so unsupported browsers keep the vh
           fallback already set inline above. */
        @supports (height: 100dvh) {
          .rns-chat-panel { max-height: calc(100dvh - 100px) !important; }
        }
        @media (max-width: 480px) {
          .rns-chat-panel {
            bottom: 12px !important;
            right: 12px !important;
            left: 12px !important;
            width: auto !important;
            max-width: none !important;
          }
        }
      `}</style>
    </div>
  );
}
