import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "./Button";
import Icon from "./Icon";
import Avatar from "./Avatar";
import SearchBar from "./SearchBar";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useLiveChat } from "../context/LiveChatContext";
import { useCompare } from "../context/CompareContext";

/** NavLink — internal (path-starting) hrefs render as a router Link so
 * navigation stays client-side; anything else (mailto:, external URLs)
 * falls back to a plain <a>. Same convention as SectionHeader/CTASection. */
function NavLink({ href, children, onClick, style, className }) {
  const isInternal = href?.startsWith("/");
  return isInternal ? (
    <Link to={href} onClick={onClick} style={style} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} onClick={onClick} style={style} className={className}>
      {children}
    </a>
  );
}

function CompareAffordance() {
  const { count } = useCompare();
  const navigate = useNavigate();

  if (count === 0) return null;

  function handleClick() {
    navigate("/compare");
  }

  return (
    <button
      onClick={handleClick}
      aria-label={`${count} product${count === 1 ? "" : "s"} selected to compare`}
      title="Compare list"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        color: "var(--rns-ink)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <Icon name="compare" size={20} />
      <span
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          background: "var(--rns-primary)",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 4px",
          fontFamily: "var(--rns-font-mono)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function CompareLiveRegion() {
  const { count } = useCompare();
  return (
    <div className="rns-visually-hidden" aria-live="polite" role="status">
      {count > 0 ? `${count} product${count === 1 ? "" : "s"} selected to compare.` : ""}
    </div>
  );
}

export default function Navbar({ logo, links, cta }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navRef = useRef(null);
  const { itemCount } = useCart();
  const { isAuthenticated, currentUser } = useAuth();
  const { toggleChat, unreadCount } = useLiveChat();
  const location = useLocation();

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  function closeMenus() {
    setOpen(false);
  }

  return (
    <header
      ref={navRef}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(6px)",
        borderBottom: "1px solid var(--rns-line)",
        boxShadow: scrolled ? "0 6px 20px rgba(16,19,26,0.08)" : "none",
        transition: "box-shadow 0.2s ease",
      }}
    >
      <div className="rns-visually-hidden" aria-live="polite" role="status">
        {itemCount > 0 ? `Cart has ${itemCount} item${itemCount === 1 ? "" : "s"}.` : ""}
      </div>
      <CompareLiveRegion />

      <div
        className="rns-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 68,
        }}
      >
        <Link
          to="/"
          className="rns-nav-logo"
          style={{
            fontFamily: "var(--rns-font-display)",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-0.01em",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <img src="/rns_logo.jpg"
          alt="RNS INFOTECH"
          style={{
            height:"60px",
            marginLeft:"8px"
          }}
          />
        </Link>

        <nav
          className="rns-nav-links"
          style={{ display: "flex", gap: 28, fontSize: 14 }}
        >
          {links.map((l) => (
            <NavLink key={l.label} href={l.href} style={{ color: "var(--rns-ink-soft)" }}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="rns-nav-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            to={isAuthenticated ? "/profile" : "/login"}
            aria-label={isAuthenticated ? "Your account" : "Log in"}
            className="rns-nav-hide-mobile"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              color: "var(--rns-ink)",
            }}
          >
            {isAuthenticated ? <Avatar name={currentUser.name} size={26} /> : <Icon name="user" size={20} />}
          </Link>
          <Link
            to="/orders"
            aria-label="Your orders"
            className="rns-nav-hide-mobile"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              color: "var(--rns-ink)",
            }}
          >
            <Icon name="package" size={20} />
          </Link>
          <CompareAffordance />
          <button
            onClick={() => setSearchOpen((v) => !v)}
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              color: "var(--rns-ink)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <Icon name={searchOpen ? "close" : "search"} size={20} />
          </button>
          <button
            onClick={toggleChat}
            aria-label={unreadCount > 0 ? `Support chat, ${unreadCount} new message` : "Support chat"}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              color: "var(--rns-ink)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <Icon name="message" size={20} />
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: "#e0392b",
                  border: "1.5px solid #fff",
                }}
              />
            )}
          </button>
          <Link
            to="/cart"
            aria-label="View cart"
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              color: "var(--rns-ink)",
            }}
          >
            <Icon name="cart" size={20} />
            {itemCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  background: "var(--rns-primary)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  fontFamily: "var(--rns-font-mono)",
                }}
              >
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </Link>
          <Button as="a" href={cta.href} variant="primary" className="rns-nav-hide-mobile">
            {cta.label}
          </Button>
          <button
            aria-label="Toggle menu"
            className="rns-nav-toggle"
            onClick={() => setOpen((v) => !v)}
            style={{
              display: "none",
              background: "none",
              border: "none",
              padding: 4,
            }}
          >
            <Icon name={open ? "close" : "menu"} size={20} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div
          style={{
            borderTop: "1px solid var(--rns-line)",
            background: "var(--rns-bg-alt)",
          }}
        >
          <div className="rns-container" style={{ padding: "10px var(--rns-gutter)" }}>
            <SearchBar autoFocus onClose={() => setSearchOpen(false)} />
          </div>
        </div>
      )}

      {open && (
        <div
          className="rns-container rns-nav-mobile-menu"
          style={{
            display: "flex",
            flexDirection: "column",
            borderTop: "1px solid var(--rns-line)",
            background: "var(--rns-bg)",
          }}
        >
          <nav style={{ display: "flex", flexDirection: "column", padding: "14px 0 8px" }}>
            {links.map((l) => (
              <NavLink
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{ fontSize: 14.5, padding: "10px 2px", borderBottom: "1px solid var(--rns-line)" }}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 2px 18px" }}>
            <Link
              to={isAuthenticated ? "/profile" : "/login"}
              onClick={() => setOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}
            >
              {isAuthenticated ? <Avatar name={currentUser.name} size={22} /> : <Icon name="user" size={18} />}
              {isAuthenticated ? "Your account" : "Log in"}
            </Link>
            <Link
              to="/orders"
              onClick={() => setOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}
            >
              <Icon name="package" size={18} />
              Your orders
            </Link>
            <Button as="a" href={cta.href} variant="primary" onClick={() => setOpen(false)} style={{ marginTop: 4, justifyContent: "center" }}>
              {cta.label}
            </Button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 800px) {
          .rns-nav-links { display: none !important; }
          .rns-nav-toggle { display: inline-flex !important; }
          .rns-nav-hide-mobile { display: none !important; }
          .rns-nav-actions { gap: 8px !important; }
        }
        @media (max-width: 420px) {
          .rns-nav-logo img { height: 40px !important; margin-left: 0 !important; }
        }
      `}</style>
    </header>
  );
}