import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  getOrCreateGuestId,
  getOrCreateThread,
  sendMessage,
  markRead,
  subscribeToChatUpdates,
} from "../lib/chatService";

const LiveChatContext = createContext(null);

export function LiveChatProvider({ children }) {
  const { currentUser, hydrated } = useAuth();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState(null);

  const threadId = useMemo(
    () => (currentUser ? `user_${currentUser.id}` : `guest_${getOrCreateGuestId()}`),
    [currentUser]
  );

  // Chat is deliberately initialized only after the visitor opens it.
  // The widget button remains available, but the initial storefront load
  // does not create a chat thread, open a socket, or make chat requests.
  useEffect(() => {
    if (!open || !hydrated) return undefined;

    let active = true;
    setLoading(true);
    setChatError(null);

    getOrCreateThread(
      threadId,
      currentUser?.name || "Guest",
      currentUser?.email || ""
    )
      .then((nextThread) => {
        if (active) setThread(nextThread);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to initialize chat thread:", error);
        setChatError(error);
        setThread(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, hydrated, threadId, currentUser?.name, currentUser?.email]);

  useEffect(() => {
    if (!open || !thread) return undefined;
    return subscribeToChatUpdates(threadId, (update) => {
      setThread((current) => {
        if (!current) return update;
        // Socket payloads are single messages; reconnect payloads are full
        // threads. Merge them without duplicating an already persisted id.
        if (Array.isArray(update.messages)) return update;
        if (!update.id) return current;
        if (current.messages.some((message) => message.id === update.id)) return current;
        return {
          ...current,
          messages: [...current.messages, update],
          updatedAt: update.ts || current.updatedAt,
        };
      });
    });
  }, [open, threadId, Boolean(thread)]);

  useEffect(() => {
    if (!open || !thread) return;
    const hasUnread = thread.messages.some((m) => m.from === "admin" && !m.readByCustomer);
    if (hasUnread) {
      markRead(threadId)
        .then(setThread)
        .catch((error) => console.warn("Failed to mark chat read:", error));
    }
  }, [open, threadId, thread?.messages]);

  const unreadCount = useMemo(
    () => (thread?.messages || []).filter((m) => m.from === "admin" && !m.readByCustomer).length,
    [thread?.messages]
  );

  const api = useMemo(
    () => ({
      open,
      openChat: () => setOpen(true),
      closeChat: () => setOpen(false),
      toggleChat: () => setOpen((value) => !value),
      messages: thread?.messages || [],
      unreadCount,
      loading,
      chatError,
      sendMessage: async (text) => {
        if (!text.trim() || !thread) return;
        try {
          const updatedThread = await sendMessage(threadId, text);
          setThread(updatedThread);
        } catch (error) {
          console.error("Failed to send message:", error);
          setChatError(error);
        }
      },
    }),
    [open, thread, unreadCount, threadId, loading, chatError]
  );

  return <LiveChatContext.Provider value={api}>{children}</LiveChatContext.Provider>;
}

export function useLiveChat() {
  const ctx = useContext(LiveChatContext);
  if (!ctx) throw new Error("useLiveChat must be used within a LiveChatProvider");
  return ctx;
}
