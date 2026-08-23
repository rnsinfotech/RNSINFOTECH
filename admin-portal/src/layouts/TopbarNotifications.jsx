import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { dismissAllNotifications, dismissNotification, getNotifications } from "../services/notificationsService";

/**
 * TopbarNotifications — the topbar's bell icon toggles this open.
 * There's no notifications model on admin-backend, so the list is
 * computed on open from data the existing services already expose
 * (see notificationsService.getNotifications). "Read" state is
 * tracked locally since there's nothing server-side to persist it
 * against.
 */
export default function TopbarNotifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const unreadCount = items.filter((i) => !i.read).length;

  function load() {
    setLoading(true);
    setError(false);
    getNotifications()
      .then((next) => {
        setItems(next);
        setLoaded(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  // Load once, on first mount, so the unread dot is accurate without
  // needing the panel opened first.
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (next && loaded) load(); // refresh on every open
      return next;
    });
  }

  function goTo(item) {
    dismissNotification(item.id);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    setOpen(false);
    navigate(item.href);
  }

  function markAllRead() {
    dismissAllNotifications(items.map((i) => i.id));
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  }

  return (
    <div ref={containerRef} className="admin-topbar-notifications">
      <button className="admin-topbar__icon-btn" type="button" aria-label="Notifications" onClick={toggle}>
        <Icon name="bell" size={16} />
        {unreadCount > 0 && <span className="admin-topbar__dot" />}
      </button>

      {open && (
        <div className="admin-topbar-notifications__panel">
          <div className="admin-topbar-notifications__header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="admin-topbar-notifications__mark-read" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="admin-topbar-notifications__list">
            {loading && <div className="admin-topbar-search__hint">Loading…</div>}
            {!loading && error && <div className="admin-topbar-search__hint">Couldn't load notifications — try again.</div>}
            {!loading && !error && items.length === 0 && (
              <div className="admin-topbar-search__hint">You're all caught up.</div>
            )}
            {!loading &&
              !error &&
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-topbar-notifications__row admin-topbar-notifications__row--${item.severity}${item.read ? " is-read" : ""}`}
                  onClick={() => goTo(item)}
                >
                  <span className={`admin-topbar-notifications__icon admin-topbar-notifications__icon--${item.severity}`}>
                    <Icon name={item.icon} size={14} />
                  </span>
                  <span className="admin-topbar-notifications__row-text">
                    <span className="admin-topbar-notifications__row-title">{item.title}</span>
                    <span className="admin-topbar-notifications__row-sub">{item.detail}</span>
                  </span>
                  {item.timeLabel && <span className="admin-topbar-notifications__row-time">{item.timeLabel}</span>}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
