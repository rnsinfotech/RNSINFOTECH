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
  const { currentUser, hydrated, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState(null);

  const threadId = useMemo(
    () => (currentUser ? `user_${currentUser.id}` : null),
    [currentUser]
  );

  // Chat is initialized only after the customer opens it and is logged in.
  // Visitors who have not logged in cannot initialize or send chat messages.
  useEffect(() => {
    if (!open || !hydrated || !currentUser || !threadId) {
      if (!currentUser) setThread(null);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setChatError(null);

    getOrCreateThread(
      threadId,
      currentUser?.name || "Customer",
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
  }, [open, hydrated, threadId, currentUser]);

  useEffect(() => {
    if (!open || !thread || !threadId) return undefined;
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
    if (!open || !thread || !threadId) return;
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
      isAuthenticated: Boolean(currentUser),
      sendMessage: async (text) => {
        if (!currentUser) {
          throw new Error("You must be logged in to send a message.");
        }
        if (!text.trim() || !thread || !threadId) return;
        try {
          const updatedThread = await sendMessage(threadId, text);
          setThread(updatedThread);
        } catch (error) {
          console.error("Failed to send message:", error);
          setChatError(error);
        }
      },
    }),
    [open, thread, unreadCount, threadId, loading, chatError, currentUser]
  );

  return <LiveChatContext.Provider value={api}>{children}</LiveChatContext.Provider>;
}

export function useLiveChat() {
  const ctx = useContext(LiveChatContext);
  if (!ctx) throw new Error("useLiveChat must be used within a LiveChatProvider");
  return ctx;
}
