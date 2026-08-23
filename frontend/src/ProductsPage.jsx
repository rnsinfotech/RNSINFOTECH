import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProductCard from "./components/ProductCard";
import ProductFilters, { STATUS_OPTIONS, AVAILABILITY_OPTIONS } from "./components/ProductFilters";
import Icon from "./components/Icon";
import SEO from "./components/SEO";
import Pagination from "./components/ui/Pagination";
import FilterChips from "./components/ui/FilterChips";
import { SkeletonProductGrid } from "./components/ui/Skeleton";
import { EmptyState, ErrorState } from "./components/ui/Stateviews";
import { useDebounce } from "./hooks/useDebounce";
import { apiRequest, normalizeProduct } from "./lib/api";

import { nav, footer } from "./data/siteData";

const PAGE_SIZE = 9;

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

/**
 * ProductsPage — the single catalogue page every "view products" link
 * on the homepage points into. Filters are read from and written back
 * to the URL (?category=&tag=&sort=&q=&priceMin=&priceMax=&
 * availability=&page=), so every filtered view is a shareable link and
 * back/forward navigation works as expected.
 *
 * Example entry points:
 *   /products                          -> everything
 *   /products?category=pen-tablets     -> one category
 *   /products?tag=best-seller          -> a status/collection filter
 *   /products?q=stylus                 -> search
 */
export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        setLoadError(null);
        const [categoriesRes, productsRes] = await Promise.all([
          apiRequest("/categories"),
          apiRequest("/products?page=1&limit=200"),
        ]);

        if (ignore) return;

        setCategories(
          (categoriesRes?.items || []).map((category) => ({
            id: category.slug || category._id,
            name: category.name,
            image: category.image?.url || category.image || "",
          }))
        );
        setAllProducts((productsRes?.items || []).map(normalizeProduct));
      } catch (error) {
        if (!ignore) {
          setLoadError(error);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  const selectedCategories = searchParams.getAll("category");
  const selectedAvailability = searchParams.getAll("availability");
  const status = searchParams.get("tag") || "all";
  const sort = searchParams.get("sort") || "relevance";
  const q = searchParams.get("q") || "";

  const priceBounds = useMemo(() => {
    const prices = allProducts.map((p) => Number(p.price) || 0);
    return {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    };
  }, [allProducts]);

  const priceMinParam = searchParams.get("priceMin");
  const priceMaxParam = searchParams.get("priceMax");
  const priceMin = priceMinParam ? Math.max(Number(priceMinParam), priceBounds.min) : priceBounds.min;
  const priceMax = priceMaxParam ? Math.min(Number(priceMaxParam), priceBounds.max) : priceBounds.max;

  const rawPage = Number(searchParams.get("page")) || 1;

  // Debounced search: the input feels instant, but we only write to the
  // URL (and re-filter) 350ms after the person stops typing.
  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebounce(searchInput, 350);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    if (debouncedSearch !== q) {
      setQuery(debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  function updateParams(mutator) {
    const next = new URLSearchParams(searchParams);
    mutator(next);
    setSearchParams(next);
  }

  // Any change to a filter (as opposed to just paging) resets to page 1.
  function updateFilterParams(mutator) {
    updateParams((next) => {
      next.delete("page");
      mutator(next);
    });
  }

  function toggleCategory(id) {
    updateFilterParams((next) => {
      const current = next.getAll("category");
      next.delete("category");
      if (current.includes(id)) {
        current.filter((c) => c !== id).forEach((c) => next.append("category", c));
      } else {
        [...current, id].forEach((c) => next.append("category", c));
      }
    });
  }

  function toggleAvailability(id) {
    updateFilterParams((next) => {
      const current = next.getAll("availability");
      next.delete("availability");
      if (current.includes(id)) {
        current.filter((a) => a !== id).forEach((a) => next.append("availability", a));
      } else {
        [...current, id].forEach((a) => next.append("availability", a));
      }
    });
  }

  function setStatus(id) {
    updateFilterParams((next) => {
      if (id === "all") next.delete("tag");
      else next.set("tag", id);
    });
  }

  function setSort(id) {
    updateFilterParams((next) => {
      if (id === "relevance") next.delete("sort");
      else next.set("sort", id);
    });
  }

  function setQuery(value) {
    updateFilterParams((next) => {
      if (!value) next.delete("q");
      else next.set("q", value);
    });
  }

  function setPriceRange(min, max) {
    updateFilterParams((next) => {
      if (min <= priceBounds.min) next.delete("priceMin");
      else next.set("priceMin", String(Math.round(min)));
      if (max >= priceBounds.max) next.delete("priceMax");
      else next.set("priceMax", String(Math.round(max)));
    });
  }

  function setPage(p) {
    updateParams((next) => {
      if (p <= 1) next.delete("page");
      else next.set("page", String(p));
    });
  }

  function clearAll() {
    setSearchParams(new URLSearchParams(q ? { q } : {}));
  }

  function clearSearch() {
    setSearchInput("");
    setQuery("");
  }

  const filtered = useMemo(() => {
    let list = [...allProducts];

    if (selectedCategories.length > 0) {
      list = list.filter((p) => selectedCategories.includes(p.categoryId));
    }

    if (status !== "all") {
      // "featured"/"best-seller" are curated booleans (Phase 4), not
      // tags — matching them against `tags[]` would silently show
      // nothing once admin stopped setting a "featured"/"best-seller"
      // tag value. "new" has no persisted flag (New Arrivals is
      // automatic, sorted by createdAt — see homepage-products), so it
      // stays a freeform tags[] match same as any other filter chip.
      list =
        status === "discounted"
          ? list.filter((p) => p.mrp && p.mrp > p.price)
          : status === "featured"
            ? list.filter((p) => p.isFeatured)
            : status === "best-seller"
              ? list.filter((p) => p.isBestSeller)
              : list.filter((p) => Array.isArray(p.tags) && p.tags.includes(status));
    }

    if (selectedAvailability.length > 0) {
      list = list.filter((p) => selectedAvailability.includes(p.stock));
    }

    list = list.filter((p) => p.price >= priceMin && p.price <= priceMax);

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.category.toLowerCase().includes(needle)
      );
    }

    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    else if (sort === "name-asc") list.sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [
    selectedCategories.join(","),
    selectedAvailability.join(","),
    status,
    sort,
    q,
    priceMin,
    priceMax,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(rawPage, 1), totalPages);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (!allProducts.length) return;
    const hasRange = priceMin < priceBounds.min || priceMax > priceBounds.max;
    if (hasRange) return;
    setLoading(false);
  }, [allProducts.length, priceMin, priceMax, priceBounds.min, priceBounds.max]);

  const chips = useMemo(() => {
    const list = [];

    selectedCategories.forEach((id) => {
      const cat = categories.find((c) => c.id === id);
      list.push({ key: `category:${id}`, label: cat?.name || id, onRemove: () => toggleCategory(id) });
    });

    if (status !== "all") {
      const opt = STATUS_OPTIONS.find((s) => s.id === status);
      list.push({ key: "status", label: opt?.label || status, onRemove: () => setStatus("all") });
    }

    selectedAvailability.forEach((a) => {
      const opt = AVAILABILITY_OPTIONS.find((o) => o.id === a);
      list.push({ key: `availability:${a}`, label: opt?.label || a, onRemove: () => toggleAvailability(a) });
    });

    if (priceMin > priceBounds.min || priceMax < priceBounds.max) {
      list.push({
        key: "price",
        label: `${formatINR(priceMin)} – ${formatINR(priceMax)}`,
        onRemove: () => setPriceRange(priceBounds.min, priceBounds.max),
      });
    }

    if (q) {
      list.push({ key: "q", label: `"${q}"`, onRemove: clearSearch });
    }

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedCategories.join(","),
    selectedAvailability.join(","),
    status,
    priceMin,
    priceMax,
    q,
  ]);

  const activeFilterCount =
    selectedCategories.length +
    selectedAvailability.length +
    (status !== "all" ? 1 : 0) +
    (priceMin > priceBounds.min || priceMax < priceBounds.max ? 1 : 0);

  const pageTitle = q
    ? `Search results for "${q}"`
    : selectedCategories.length === 1
    ? categories.find((c) => c.id === selectedCategories[0])?.name || "Products"
    : status !== "all"
    ? STATUS_OPTIONS.find((s) => s.id === status)?.label || "Products"
    : "All products";

  return (
    <>
      <SEO
        title={pageTitle}
        description="Browse RNS INFOTECH's full catalogue of pen tablets, pen displays, and stylus hardware — filter by category, price, and availability."
      />

      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingTop: 36, paddingBottom: 36 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">Catalogue</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>{pageTitle}</h1>

          <div style={{ position: "relative", maxWidth: 420, marginTop: 20 }}>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search pen tablets, displays, stylus..."
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 6,
                border: "1px solid var(--rns-line-strong)",
                fontSize: 14,
                fontFamily: "var(--rns-font-body)",
              }}
            />
          </div>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 64 }}>
        <div className="rns-products-toolbar">
          <button
            type="button"
            className="rns-filters-toggle"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <Icon name="sliders" size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="rns-filters-toggle__count">{activeFilterCount}</span>
            )}
          </button>
          <span className="rns-products-toolbar__count">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </span>
        </div>

        <div
          className="rns-products-layout"
          style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 40, alignItems: "start" }}
        >
          <ProductFilters
            categories={categories}
            selectedCategories={selectedCategories}
            onToggleCategory={toggleCategory}
            status={status}
            onStatusChange={setStatus}
            priceMin={priceMin}
            priceMax={priceMax}
            priceBounds={priceBounds}
            onPriceChange={setPriceRange}
            selectedAvailability={selectedAvailability}
            onToggleAvailability={toggleAvailability}
            sort={sort}
            onSortChange={setSort}
            onClearAll={clearAll}
            resultCount={filtered.length}
            mobileOpen={mobileFiltersOpen}
            onClose={() => setMobileFiltersOpen(false)}
          />

          <div>
            <FilterChips chips={chips} onClearAll={clearAll} />

            {loadError ? (
              <ErrorState message={loadError.message} action={{ label: "Try again", onClick: () => window.location.reload() }} />
            ) : loading ? (
              <SkeletonProductGrid count={PAGE_SIZE} columns={3} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="filter"
                title="No products match these filters"
                message="Try clearing a filter or searching a different term."
                action={{ label: "Clear all filters", onClick: clearAll }}
              />
            ) : (
              <>
                <div className="rns-grid rns-grid--3">
                  {paged.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>

                <div style={{ marginTop: 40, display: "flex", justifyContent: "center" }}>
                  <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />

      <style>{`
        .rns-products-toolbar { display: none; }

        @media (max-width: 760px) {
          .rns-products-layout { grid-template-columns: 1fr !important; }
          .rns-products-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--rns-line);
          }
          .rns-filters-toggle {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 13.5px;
            font-weight: 600;
            padding: 9px 14px;
            border-radius: var(--rns-r-sm);
            border: 1px solid var(--rns-line-strong);
            background: var(--rns-bg);
            cursor: pointer;
          }
          .rns-filters-toggle__count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 18px;
            height: 18px;
            padding: 0 5px;
            border-radius: 9px;
            background: var(--rns-primary);
            color: #fff;
            font-size: 11px;
            font-weight: 700;
          }
          .rns-products-toolbar__count {
            font-family: var(--rns-font-mono);
            font-size: 12.5px;
            color: var(--rns-ink-faint);
          }
        }
      `}</style>
    </>
  );
}
