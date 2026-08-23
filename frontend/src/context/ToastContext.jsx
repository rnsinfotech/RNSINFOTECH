import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import Icon from "../components/Icon";

const ToastContext = createContext(null);

let uid = 0;

/**
 * ToastProvider — lightweight, dependency-free toast/notification
 * system. Wrap the app once; call useToast() anywhere to push one.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback(
    (message, { type = "info", duration = 4000, title } = {}) => {
      const id = ++uid;
      setToasts((list) => [...list, { id, message, type, title }]);
      if (duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const api = {
    push,
    dismiss,
    success: (message, opts) => push(message, { ...opts, type: "success" }),
    error: (message, opts) => push(message, { ...opts, type: "error" }),
    info: (message, opts) => push(message, { ...opts, type: "info" }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="rns-toast-stack" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`rns-toast rns-toast--${t.type}`} role={t.type === "error" ? "alert" : "status"}>
            <Icon
              name={t.type === "success" ? "check" : t.type === "error" ? "alert" : "info"}
              size={17}
            />
            <div className="rns-toast__body">
              {t.title && <div className="rns-toast__title">{t.title}</div>}
              <div className="rns-toast__message">{t.message}</div>
            </div>
            <button
              type="button"
              className="rns-toast__close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
