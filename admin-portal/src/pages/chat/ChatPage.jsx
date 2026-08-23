import React, { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icon";
import StatCard from "../../components/StatCard";
import EmptyState from "../../components/EmptyState";
import PageLoader from "../../components/PageLoader";
import {
  getThreads,
  getThread,
  getChatStats,
  sendReply,
  markRead,
  subscribeToThreads,
} from "../../services/chatService";

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatWhen(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" });
}

/**
 * ChatPage — admin UI backed by the shared MongoDB chat API.
 * The service layer handles normalization, persistence and cross-device
 * refresh; this page intentionally keeps the existing UI unchanged.
 */
export default function ChatPage() {
  const [q, setQ] = useState("");
  const [threads, setThreads] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [draft, setDraft] = useState("");
  const messagesRef = useRef(null);
  const threadsRef = useRef(null);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  function refresh() {
    Promise.all([getThreads({ q }), getChatStats()]).then(([nextThreads, nextStats]) => {
      setThreads(nextThreads);
      setStats(nextStats);
    });
  }

  function applyRealtimeMessage(payload) {
    if (payload?.type === "reconnected") {
      refresh();
      return;
    }
    if (!payload?.threadId || !payload?.id) return;

    const message = {
      id: String(payload.id),
      from: payload.from,
      text: payload.text || "",
      ts: payload.ts ? new Date(payload.ts).getTime() : Date.now(),
      readByCustomer: payload.readByCustomer === true,
      readByAdmin: payload.readByAdmin === true,
    };

    const current = threadsRef.current;
    if (!current) return;

    const index = current.findIndex((thread) => thread.id === payload.threadId);
    if (index === -1) {
      getThreads({ q }).then(setThreads).catch(() => {});
      return;
    }

    const existing = current[index];
    if (existing.messages.some((item) => item.id === message.id)) return;

    const next = {
      ...existing,
      messages: [...existing.messages, message],
      last: message,
      unread: existing.unread + (message.from === "customer" && !message.readByAdmin ? 1 : 0),
      updatedAt: message.ts,
    };

    setSelectedThread((currentSelected) => {
      if (!currentSelected || currentSelected.id !== payload.threadId || currentSelected.messages.some((item) => item.id === message.id)) {
        return currentSelected;
      }
      return {
        ...currentSelected,
        messages: [...currentSelected.messages, message],
        last: message,
        unread: next.unread,
        updatedAt: message.ts,
      };
    });

    setThreads((latest) => {
      if (!latest) return latest;
      const latestIndex = latest.findIndex((thread) => thread.id === payload.threadId);
      if (latestIndex === -1 || latest[latestIndex].messages.some((item) => item.id === message.id)) return latest;
      const latestCopy = [...latest];
      latestCopy.splice(latestIndex, 1);
      latestCopy.unshift({ ...latest[latestIndex], ...next });
      return latestCopy;
    });    getChatStats().then(setStats).catch(() => {});
  }

  useEffect(() => {
    setThreads(null);
    refresh();
    const unsubscribe = subscribeToThreads(applyRealtimeMessage);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (!threads) return;
    if (!selectedId && threads.length > 0) {
      setSelectedId(threads[0].id);
      return;
    }
    if (selectedId && !threads.some((thread) => thread.id === selectedId)) {
      setSelectedId(threads[0]?.id || null);
    }
  }, [threads, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedThread(null);
      return undefined;
    }
    let active = true;
    getThread(selectedId)
      .then((thread) => {
        if (active) setSelectedThread(thread);
      })
      .catch(() => {
        if (active) setSelectedThread(null);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = selectedThread;

  useEffect(() => {
    if (!selected) return;
    if (selected.unread > 0) {
      markRead(selected.id).then((updated) => {
        if (!updated) return;
        setThreads((current) => (current || []).map((thread) => thread.id === updated.id ? {
          ...thread,
          unread: 0,
          messages: thread.messages,
          last: thread.last,
        } : thread));
        setSelectedThread(updated);
        getChatStats().then(setStats).catch(() => {});
      });
    }
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.messages?.length]);



  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || !selected) return;
    const updated = await sendReply(selected.id, draft);
    if (updated) {
      setThreads((current) => (current || []).map((thread) => thread.id === updated.id ? {
        ...thread,
        last: updated.last,
        updatedAt: updated.updatedAt,
      } : thread));
      setSelectedThread(updated);
      getChatStats().then(setStats).catch(() => {});
    }
    setDraft("");
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Chat</h1>
          <p>Live conversations from the storefront's support widget.</p>
        </div>
      </div>

      {stats && (
        <div className="admin-stat-grid" style={{ marginBottom: 20 }}>
          <StatCard label="Conversations" value={stats.total} icon="message" />
          <StatCard label="Unread" value={stats.unreadThreads} icon="inbox" />
          <StatCard label="Unread messages" value={stats.totalUnread} icon="alert" />
          <StatCard label="Resolved" value={stats.resolved} icon="user" />
        </div>
      )}

      {threads === null ? (
        <PageLoader />
      ) : threads.length === 0 && !q ? (
        <EmptyState
          icon="message"
          title="No conversations yet"
          description="Messages customers send from the storefront's support widget will show up here."
        />
      ) : (
        <div className="admin-chat-shell">
          <div className="admin-chat-list">
            <div className="admin-chat-list__search">
              <div className="admin-toolbar__search">
                <Icon name="search" size={15} />
                <input
                  className="admin-input"
                  placeholder="Search name, email, message…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="admin-chat-list__items">
              {threads.length === 0 ? (
                <div style={{ padding: 20, fontSize: 13, color: "var(--admin-ink-faint)" }}>
                  No conversations match "{q}".
                </div>
              ) : (
                threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`admin-chat-row${t.id === selectedId ? " is-active" : ""}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <div className="admin-chat-row__avatar" aria-hidden="true">
                      {(t.customerName || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="admin-chat-row__body">
                      <div className="admin-chat-row__top">
                        <span className="admin-chat-row__name">{t.customerName || "Guest"}</span>
                        <span className="admin-chat-row__time">{formatWhen(t.updatedAt)}</span>
                      </div>
                      <div className="admin-chat-row__email">{t.customerEmail || t.id}</div>
                      {t.last && (
                        <div className={`admin-chat-row__preview${t.unread > 0 ? " is-unread" : ""}`}>
                          {t.last.from === "admin" ? "You: " : ""}
                          {t.last.text}
                        </div>
                      )}
                    </div>
                    {t.unread > 0 && <span className="admin-chat-row__dot" aria-hidden="true" />}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="admin-chat-thread">
            {!selected ? (
              <div className="admin-chat-empty">Select a conversation to view it</div>
            ) : (
              <>
                <div className="admin-chat-thread__header">
                  <div>
                    <div className="admin-chat-thread__title">{selected.customerName || "Guest"}</div>
                    <div className="admin-chat-thread__subtitle">{selected.customerEmail || selected.id}</div>
                  </div>
                </div>

                <div ref={messagesRef} className="admin-chat-thread__messages">
                  {selected.messages.map((m) => {
                    const isAdmin = m.from === "admin";
                    return (
                      <div key={m.id} className={`admin-chat-bubble-row ${isAdmin ? "from-admin" : "from-customer"}`}>
                        <div className="admin-chat-bubble">{m.text}</div>
                        <div className="admin-chat-bubble-meta">
                          {isAdmin ? "You" : selected.customerName || "Customer"} · {formatTime(m.ts)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form className="admin-chat-composer" onSubmit={handleSend}>
                  <input
                    className="admin-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Reply as RNS INFOTECH support…"
                  />
                  <button type="submit" className="admin-chat-composer__send" disabled={!draft.trim()}>
                    <Icon name="send" size={16} />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
