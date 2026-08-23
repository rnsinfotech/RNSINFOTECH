import React from "react";
import Icon from "./Icon";
import { useDebounce } from "../hooks/useDebounce";

const STATUS_OPTIONS = [
  { id: "all", label: "All products" },
  { id: "featured", label: "Featured" },
  { id: "new", label: "New arrivals" },
  { id: "best-seller", label: "Best sellers" },
  { id: "discounted", label: "On sale" },
];

const SORT_OPTIONS = [
  { id: "relevance", label: "Relevance" },
  { id: "price-asc", label: "Price: Low to high" },
  { id: "price-desc", label: "Price: High to low" },
  { id: "name-asc", label: "Name: A to Z" },
];

const AVAILABILITY_OPTIONS = [
  { id: "in-stock", label: "In stock" },
  { id: "out-of-stock", label: "Out of stock" },
];

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

/**
 * PriceRangeFilter — min/max number inputs + a single-handle slider for
 * the upper bound. Keeps its own local state so typing feels instant,
 * then debounces before reporting up to the parent (which writes the
 * URL) — same pattern as the search box in ProductsPage.
 */
function PriceRangeFilter({ min, max, bounds, onChange }) {
  const [localMin, setLocalMin] = React.useState(min);
  const [localMax, setLocalMax] = React.useState(max);
  const debouncedMin = useDebounce(localMin, 450);
  const debouncedMax = useDebounce(localMax, 450);

  // Stay in sync if the parent changes the range externally (e.g. a
  // filter chip removal, browser back/forward, or "Clear all").
  React.useEffect(() => setLocalMin(min), [min]);
  React.useEffect(() => setLocalMax(max), [max]);

  React.useEffect(() => {
    if (debouncedMin !== min || debouncedMax !== max) {
      onChange(debouncedMin, debouncedMax);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedMin, debouncedMax]);

  function handleMinInput(e) {
    const raw = e.target.value;
    if (raw === "") return setLocalMin(bounds.min);
    setLocalMin(Math.min(Math.max(Number(raw), bounds.min), localMax));
  }

  function handleMaxInput(e) {
    const raw = e.target.value;
    if (raw === "") return setLocalMax(bounds.max);
    setLocalMax(Math.max(Math.min(Number(raw), bounds.max), localMin));
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Price range</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="number"
          inputMode="numeric"
          className="rns-filter-number"
          min={bounds.min}
          max={bounds.max}
          value={localMin}
          onChange={handleMinInput}
          aria-label="Minimum price"
        />
        <span style={{ color: "var(--rns-ink-faint)", fontSize: 12 }}>–</span>
        <input
          type="number"
          inputMode="numeric"
          className="rns-filter-number"
          min={bounds.min}
          max={bounds.max}
          value={localMax}
          onChange={handleMaxInput}
          aria-label="Maximum price"
        />
      </div>
      <input
        type="range"
        min={bounds.min}
        max={bounds.max}
        value={localMax}
        onChange={(e) => setLocalMax(Math.max(Number(e.target.value), localMin))}
        style={{ width: "100%", marginTop: 12, accentColor: "var(--rns-primary)" }}
        aria-label="Maximum price slider"
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--rns-font-mono)",
          fontSize: 11,
          color: "var(--rns-ink-faint)",
          marginTop: 4,
        }}
      >
        <span>{formatINR(bounds.min)}</span>
        <span>{formatINR(bounds.max)}</span>
      </div>
    </div>
  );
}

/**
 * ProductFilters — sidebar filter controls for ProductsPage.
 * Fully controlled: all state lives in the parent (synced to the URL),
 * this component only renders inputs and reports changes upward.
 *
 * On mobile it renders as a slide-in drawer (`mobileOpen` / `onClose`);
 * on desktop those props are simply unused and it sits inline as a
 * standard sidebar.
 */
export default function ProductFilters({
  categories,
  selectedCategories,
  onToggleCategory,
  status,
  onStatusChange,
  priceMin,
  priceMax,
  priceBounds,
  onPriceChange,
  selectedAvailability = [],
  onToggleAvailability,
  sort,
  onSortChange,
  onClearAll,
  resultCount,
  mobileOpen = false,
  onClose,
}) {
  const priceIsFiltered = priceMin > priceBounds.min || priceMax < priceBounds.max;
  const hasActiveFilters =
    selectedCategories.length > 0 ||
    status !== "all" ||
    selectedAvailability.length > 0 ||
    priceIsFiltered;

  // Lock background scroll while the mobile drawer is open. Without this,
  // the page underneath stays scrollable even though the drawer is
  // `position: fixed` — on touch devices that means the page can scroll/
  // rubber-band behind it while the drawer itself stays put, which is
  // exactly what reads as "laggy" / "not fixed in place". Locking the
  // body makes the drawer the only thing that scrolls.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const { overflow, touchAction, paddingRight } = document.body.style;
    // Compensate for the vertical scrollbar disappearing when we lock
    // scroll below — otherwise the page (and anything sticky/fixed full-
    // width, like the navbar) gains a few pixels of width and visibly
    // shifts/"slides" sideways the instant the drawer opens.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    if (scrollbarWidth > 0) {
      const currentPadding = parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.touchAction = touchAction;
      document.body.style.paddingRight = paddingRight;
    };
  }, [mobileOpen]);

  return (
    <>
      {mobileOpen && (
        <div
          className="rns-filters-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`rns-filters-panel${mobileOpen ? " rns-filters-panel--open" : ""}`}>
        <div className="rns-filters-panel__header">
          <span className="rns-eyebrow" style={{ paddingBottom: 0, border: "none" }}>Filters</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {hasActiveFilters && (
              <button
                onClick={onClearAll}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 12.5,
                  color: "var(--rns-primary)",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="rns-filters-panel__close"
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
        </div>

        <div className="rns-filters-panel__body">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Category</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {categories.map((c) => (
                <label
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    fontSize: 13.5,
                    color: "var(--rns-ink-soft)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(c.id)}
                    onChange={() => onToggleCategory(c.id)}
                    style={{ accentColor: "var(--rns-primary)" }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Status</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {STATUS_OPTIONS.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    fontSize: 13.5,
                    color: "var(--rns-ink-soft)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="status"
                    checked={status === s.id}
                    onChange={() => onStatusChange(s.id)}
                    style={{ accentColor: "var(--rns-primary)" }}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <PriceRangeFilter min={priceMin} max={priceMax} bounds={priceBounds} onChange={onPriceChange} />

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Availability</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {AVAILABILITY_OPTIONS.map((a) => (
                <label
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    fontSize: 13.5,
                    color: "var(--rns-ink-soft)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedAvailability.includes(a.id)}
                    onChange={() => onToggleAvailability(a.id)}
                    style={{ accentColor: "var(--rns-primary)" }}
                  />
                  {a.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Sort by</div>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 10px",
                borderRadius: 6,
                border: "1px solid var(--rns-line-strong)",
                fontSize: 13.5,
                fontFamily: "var(--rns-font-body)",
                background: "var(--rns-bg)",
              }}
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div
            style={{
              fontFamily: "var(--rns-font-mono)",
              fontSize: 12,
              color: "var(--rns-ink-faint)",
            }}
          >
            {resultCount} {resultCount === 1 ? "result" : "results"}
          </div>
        </div>

        <div className="rns-filters-panel__footer">
          <button type="button" className="rns-btn rns-btn--primary" style={{ width: "100%", justifyContent: "center" }} onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? "result" : "results"}
          </button>
        </div>
      </aside>

      <style>{`
        .rns-filters-backdrop {
          display: none;
        }
        .rns-filters-panel {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .rns-filters-panel__body {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        /* On the inline desktop sidebar, plain flex "gap" alone made the
           spacing between filter groups look uneven once each group's
           own content (a short radio list vs. the price slider vs. the
           sort dropdown) had different heights — nothing visually tied
           the gap to a new filter group starting vs. just leftover
           whitespace. A thin rule + consistent padding above every group
           (after the first) reads as one deliberate structure instead,
           and stays identical between the desktop sidebar and the
           mobile drawer. */
        .rns-filters-panel__body > div:not(:first-child) {
          padding-top: 20px;
          border-top: 1px solid var(--rns-line);
        }
        .rns-filters-panel__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .rns-filters-panel__close { display: none; }
        .rns-filters-panel__footer { display: none; }

        .rns-filter-number {
          width: 50%;
          min-width: 0;
          padding: 8px 9px;
          border-radius: 6px;
          border: 1px solid var(--rns-line-strong);
          font-size: 13px;
          font-family: var(--rns-font-mono);
          background: var(--rns-bg);
        }
        .rns-filter-number::-webkit-inner-spin-button,
        .rns-filter-number::-webkit-outer-spin-button {
          opacity: 0.5;
        }

        @media (max-width: 760px) {
          .rns-filters-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(13, 16, 23, 0.45);
            z-index: 60;
          }
          .rns-filters-panel {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            width: min(340px, 88vw);
            background: var(--rns-bg);
            z-index: 61;
            padding: 20px;
            transform: translateX(-100%);
            transition: transform 0.22s ease;
            box-shadow: var(--rns-shadow-lg);
            gap: 0;
          }
          .rns-filters-panel--open { transform: translateX(0); }
          .rns-filters-panel__header {
            padding-bottom: 16px;
            margin-bottom: 16px;
            border-bottom: 1px solid var(--rns-line);
          }
          .rns-filters-panel__close {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: 1px solid var(--rns-line-strong);
            background: none;
            transform: rotate(45deg);
            cursor: pointer;
          }
          .rns-filters-panel__body {
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            display: flex;
            flex-direction: column;
            gap: 24px;
            padding-bottom: 16px;
          }
          .rns-filters-panel__footer {
            display: block;
            padding-top: 16px;
            border-top: 1px solid var(--rns-line);
          }
        }
      `}</style>
    </>
  );
}

export { STATUS_OPTIONS, SORT_OPTIONS, AVAILABILITY_OPTIONS };
