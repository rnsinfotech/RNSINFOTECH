import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { searchSite, useSearchIndex, TYPE_LABELS } from "../lib/search";

const SUGGESTION_LIMIT = 7;

export default function SearchBar({ autoFocus = false, onClose } = {}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const index = useSearchIndex();
  const results = useMemo(() => searchSite(query, index, { limit: SUGGESTION_LIMIT }), [query, index]);
  const showDropdown = focused && query.trim().length > 0;

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function goToResults(e) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setFocused(false);
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function goToItem(item) {
    setFocused(false);
    setQuery("");
    navigate(item.href);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      setFocused(false);
      e.currentTarget.blur();
      onClose?.();
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      <form onSubmit={goToResults} role="search">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            border: "1px solid var(--rns-line-strong)",
            borderRadius: 20,
            padding: "8px 14px",
          }}
        >
          <span style={{ color: "var(--rns-ink-faint)", display: "flex", flexShrink: 0 }}>
            <Icon name="search" size={16} />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={onKeyDown}
            placeholder="Search products, brands, services, help..."
            aria-label="Search the site"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 13.5,
              fontFamily: "var(--rns-font-body)",
              background: "transparent",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              style={{ background: "none", border: "none", color: "var(--rns-ink-faint)", cursor: "pointer", display: "flex" }}
            >
              <Icon name="close" size={14} />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              style={{ background: "none", border: "none", color: "var(--rns-ink-faint)", cursor: "pointer", display: "flex" }}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </form>

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid var(--rns-line)",
            borderRadius: 12,
            boxShadow: "0 16px 40px rgba(16,19,26,0.14)",
            maxHeight: 420,
            overflowY: "auto",
            zIndex: 70,
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: "18px 16px", fontSize: 13, color: "var(--rns-ink-soft)" }}>
              No results for "{query}" — try a different word.
            </div>
          ) : (
            <>
              {results.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => goToItem(item)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid var(--rns-line)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0, background: "var(--rns-bg-alt)" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 6,
                        background: "var(--rns-bg-alt)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="search" size={14} />
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--rns-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--rns-ink-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.subtitle}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--rns-ink-faint)",
                      fontFamily: "var(--rns-font-mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      flexShrink: 0,
                    }}
                  >
                    {TYPE_LABELS[item.type]}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={goToResults}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "var(--rns-bg-alt)",
                  border: "none",
                  textAlign: "center",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--rns-primary)",
                  cursor: "pointer",
                }}
              >
                See all results for "{query}"
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}