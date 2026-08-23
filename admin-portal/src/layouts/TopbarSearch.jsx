import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { useDebounce } from "../hooks/useDebounce";
import { getProducts } from "../services/productsService";
import { getOrders } from "../services/ordersService";
import { getCustomers } from "../services/customersService";

const RESULT_LIMIT = 5;
const MIN_QUERY_LENGTH = 2;

function formatINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

/**
 * TopbarSearch — the topbar's search icon toggles this open into an
 * input + results dropdown. Queries products, orders, and customers
 * in parallel through the existing admin services (all already hit
 * real admin-backend endpoints) and links each result to its detail
 * page.
 */
export default function TopbarSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ products: [], orders: [], customers: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (open) {
      // Focus on the tick after the input mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
      setResults({ products: [], orders: [], customers: [] });
      setError(false);
    }
  }, [open]);

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

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults({ products: [], orders: [], customers: [] });
      setLoading(false);
      setError(false);
      return;
    }

    let ignore = false;
    setLoading(true);
    setError(false);

    Promise.all([
      getProducts({ q: trimmed, limit: RESULT_LIMIT }).catch(() => null),
      getOrders({ q: trimmed }).catch(() => null),
      getCustomers({ q: trimmed }).catch(() => null),
    ])
      .then(([products, orders, customers]) => {
        if (ignore) return;
        const anyFailed = products === null && orders === null && customers === null;
        if (anyFailed) {
          setError(true);
          setResults({ products: [], orders: [], customers: [] });
          return;
        }
        setResults({
          products: (products || []).slice(0, RESULT_LIMIT),
          orders: (orders || []).slice(0, RESULT_LIMIT),
          customers: (customers || []).slice(0, RESULT_LIMIT),
        });
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [debouncedQuery]);

  const hasQuery = debouncedQuery.trim().length >= MIN_QUERY_LENGTH;
  const totalResults = results.products.length + results.orders.length + results.customers.length;

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div ref={containerRef} className="admin-topbar-search">
      <button
        className="admin-topbar__icon-btn"
        type="button"
        aria-label="Search"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="search" size={16} />
      </button>

      {open && (
        <div className="admin-topbar-search__panel">
          <div className="admin-topbar-search__input-row">
            <Icon name="search" size={15} />
            <input
              ref={inputRef}
              className="admin-topbar-search__input"
              placeholder="Search products, orders, customers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="admin-topbar-search__clear"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>

          <div className="admin-topbar-search__results">
            {!hasQuery && (
              <div className="admin-topbar-search__hint">Type at least {MIN_QUERY_LENGTH} characters to search.</div>
            )}
            {hasQuery && loading && <div className="admin-topbar-search__hint">Searching…</div>}
            {hasQuery && !loading && error && (
              <div className="admin-topbar-search__hint">Couldn't reach the server — try again.</div>
            )}
            {hasQuery && !loading && !error && totalResults === 0 && (
              <div className="admin-topbar-search__hint">No matches for "{debouncedQuery}".</div>
            )}

            {!loading && !error && results.products.length > 0 && (
              <div className="admin-topbar-search__group">
                <div className="admin-topbar-search__group-label">Products</div>
                {results.products.map((p) => (
                  <button key={p.id} type="button" className="admin-topbar-search__row" onClick={() => go(`/products/${p.id}`)}>
                    {p.image ? (
                      <img src={p.image} alt="" className="admin-topbar-search__thumb" />
                    ) : (
                      <div className="admin-topbar-search__thumb admin-topbar-search__thumb--placeholder">
                        <Icon name="package" size={14} />
                      </div>
                    )}
                    <div className="admin-topbar-search__row-text">
                      <div className="admin-topbar-search__row-title">{p.name}</div>
                      <div className="admin-topbar-search__row-sub">{p.sku ? `${p.sku} · ` : ""}{formatINR(p.price)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loading && !error && results.orders.length > 0 && (
              <div className="admin-topbar-search__group">
                <div className="admin-topbar-search__group-label">Orders</div>
                {results.orders.map((o) => (
                  <button key={o.id} type="button" className="admin-topbar-search__row" onClick={() => go(`/orders/${o.id}`)}>
                    <div className="admin-topbar-search__thumb admin-topbar-search__thumb--placeholder">
                      <Icon name="truck" size={14} />
                    </div>
                    <div className="admin-topbar-search__row-text">
                      <div className="admin-topbar-search__row-title">#{String(o.id).slice(-6).toUpperCase()}</div>
                      <div className="admin-topbar-search__row-sub">{o.customerEmail || "Customer"} · {formatINR(o.total)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loading && !error && results.customers.length > 0 && (
              <div className="admin-topbar-search__group">
                <div className="admin-topbar-search__group-label">Customers</div>
                {results.customers.map((c) => (
                  <button key={c.id} type="button" className="admin-topbar-search__row" onClick={() => go(`/customers/${encodeURIComponent(c.email)}`)}>
                    <div className="admin-topbar-search__thumb admin-topbar-search__thumb--placeholder">
                      <Icon name="user" size={14} />
                    </div>
                    <div className="admin-topbar-search__row-text">
                      <div className="admin-topbar-search__row-title">{c.name || c.email}</div>
                      <div className="admin-topbar-search__row-sub">{c.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
