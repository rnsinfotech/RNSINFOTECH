import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import ProductGallery from "./components/ProductGallery";
import ProductGrid from "./components/ProductGrid";
import SEO from "./components/SEO";
import Breadcrumbs, { buildBreadcrumbJsonLd } from "./components/ui/Breadcrumbs";
import { ErrorState } from "./components/ui/Stateviews";
import { useCart } from "./context/CartContext";
import { useCompare } from "./context/CompareContext";
import { useToast } from "./context/ToastContext";
import { useAuth } from "./context/AuthContext";

import { nav, footer } from "./data/siteData";
import { useSiteSettings } from "./context/SiteSettingsContext";
import { apiRequest, normalizeProduct, normalizeReview } from "./lib/api";

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

/**
 * Stars — renders a row of filled/half/empty star icons for a rating
 * out of 5. Purely presentational; `size` and `showValue` let callers
 * reuse it both for the big summary number and the small card badge.
 */
function Stars({ rating, size = 14, showValue = false, count }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "inline-flex", gap: 2 }}>
        {Array.from({ length: 5 }, (_, i) => {
          const filled = i < full || (i === full && hasHalf);
          return (
            <span
              key={i}
              style={{
                color: filled ? "#f5a623" : "var(--rns-line-strong)",
                display: "inline-flex",
              }}
            >
              <Icon name="star" size={size} strokeWidth={0} className="rns-star" />
            </span>
          );
        })}
      </div>
      {showValue && (
        <span style={{ fontSize: 13, color: "var(--rns-ink-soft)" }}>
          {rating.toFixed(1)}
          {typeof count === "number" && ` (${count} review${count === 1 ? "" : "s"})`}
        </span>
      )}
    </div>
  );
}

/**
 * ProductDetailPage — one reusable page, data-driven per product via
 * the :id route param. Everything on the page (gallery, price, specs,
 * reviews, related items) comes from the matching entry in
 * data/siteData.js — swap the data source later without touching layout.
 */
export default function ProductDetailPage() {
  const { support } = useSiteSettings();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isComparing, toggleCompare, isFull, compareCategoryId } = useCompare();
  const toast = useToast();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [productRes, listRes] = await Promise.all([
          apiRequest(`/products/${encodeURIComponent(id)}`),
          apiRequest("/products?page=1&limit=24"),
        ]);

        if (ignore) return;

        const nextProduct = normalizeProduct(productRes?.product || productRes);
        setProduct(nextProduct);
        setRelatedProducts((listRes?.items || []).map(normalizeProduct).filter((item) => item.id !== nextProduct.id));
      } catch (error) {
        if (!ignore) {
          setLoadError(error);
          setProduct(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    if (id) load();
    return () => {
      ignore = true;
    };
  }, [id]);

  const [qty, setQty] = useState(1);
  // Which of the Description/Specifications tabs is showing in the info
  // section below the fold. Declared here (not inline where it's used) so
  // it runs unconditionally on every render, same as the other hooks —
  // see the useMemo note further down for why that matters.
  const [infoTab, setInfoTab] = useState("description");

  const { isAuthenticated } = useAuth();
  const [liveReviews, setLiveReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  // "idle" | "submitted" | "already" — tracks this browser session's
  // interaction with the form so a person can't spam the submit button
  // even though the backend's own one-review-per-product-per-user
  // constraint (a 409 on a second POST) is the real source of truth.
  const [reviewStatus, setReviewStatus] = useState("idle");
  // Verified-purchase gate: only someone whose order for this product
  // has actually shipped can write a review — see review.controller.js's
  // eligibility endpoint, which mirrors the same check `create` enforces
  // server-side. null while we haven't checked yet (or aren't signed in).
  const [reviewEligibility, setReviewEligibility] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function loadEligibility() {
      if (!isAuthenticated || !id) {
        setReviewEligibility(null);
        return;
      }
      try {
        const res = await apiRequest(`/products/${encodeURIComponent(id)}/reviews/eligibility`, { authRequired: true });
        if (!ignore) setReviewEligibility(res);
      } catch {
        if (!ignore) setReviewEligibility(null);
      }
    }
    loadEligibility();
    return () => {
      ignore = true;
    };
  }, [id, isAuthenticated]);

  useEffect(() => {
    let ignore = false;

    async function loadReviews() {
      setReviewsLoading(true);
      try {
        setReviewsError(null);
        const res = await apiRequest(`/products/${encodeURIComponent(id)}/reviews?page=1&limit=20`);
        if (ignore) return;
        setLiveReviews((res?.items || []).map(normalizeReview));
      } catch (error) {
        if (!ignore) setReviewsError(error);
      } finally {
        if (!ignore) setReviewsLoading(false);
      }
    }

    if (id) loadReviews();
    return () => {
      ignore = true;
    };
  }, [id]);

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (reviewForm.comment.trim().length < 3) {
      setReviewError("Tell us a little more — at least 3 characters.");
      return;
    }
    setReviewError("");
    setReviewSubmitting(true);
    try {
      const res = await apiRequest(`/products/${encodeURIComponent(id)}/reviews`, {
        method: "POST",
        body: { rating: reviewForm.rating, comment: reviewForm.comment.trim() },
        authRequired: true,
      });
      if (res?.review) {
        setLiveReviews((prev) => [normalizeReview(res.review), ...prev]);
      }
      setReviewStatus("submitted");
      setReviewEligibility({ canReview: false, reason: "already_reviewed" });
      setReviewForm({ rating: 5, comment: "" });
    } catch (err) {
      if (err.status === 409) {
        setReviewStatus("already");
        setReviewEligibility({ canReview: false, reason: "already_reviewed" });
      } else if (err.status === 403) {
        setReviewEligibility({ canReview: false, reason: "not_purchased" });
      } else {
        setReviewError(err.message || "Could not submit your review. Please try again.");
      }
    } finally {
      setReviewSubmitting(false);
    }
  }

  // These hooks must run unconditionally on every render, before the
  // early returns below (loading / 404 states) — otherwise those
  // renders execute fewer hooks than a render with data, which is
  // React error #310 ("rendered more hooks than during the previous
  // render"). Each memo below therefore reads from `product?.x` /
  // `id` rather than the destructured variables further down, since
  // `product` may still be null at this point.
  const related = useMemo(
    () => relatedProducts.filter((p) => p.categoryId === product?.categoryId && p.id !== id).slice(0, 4),
    [product?.categoryId, id, relatedProducts]
  );

  const ratingBreakdown = useMemo(() => {
    const counts = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: liveReviews.filter((r) => r.rating === star).length,
    }));
    const max = Math.max(1, ...counts.map((c) => c.count));
    return counts.map((c) => ({ ...c, pct: Math.round((c.count / max) * 100) }));
  }, [liveReviews]);

  // description is admin-authored rich-text HTML, already sanitized
  // server-side on save (see admin-backend/src/utils/sanitizeDescription.js);
  // sanitizing again here is a cheap second layer of defense before it's
  // rendered with dangerouslySetInnerHTML on this public page.
  const sanitizedDescription = useMemo(
    () =>
      DOMPurify.sanitize(product?.description || "", {
        ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "strike", "h1", "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "blockquote", "hr", "span"],
        ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "width", "height", "style", "class"],
      }),
    [product?.description]
  );

  // Per-product download links, added by the admin at product
  // creation/edit time and pointing at the manufacturer's own site —
  // no longer sourced from the static siteData `downloads` catalogue.
  // Not a hook, so it's safe to leave among the derived values below.
  const productDownloads = product?.downloadLinks || [];

  if (!loading && !product) {
    if (loadError && loadError.status !== 404) {
      return (<><SEO title="Unable to load product" noindex /><AnnouncementBar /><Navbar {...nav} /><section className="rns-section"><div className="rns-container" style={{ padding: "60px 0" }}><ErrorState message={loadError.message} /></div></section><Footer logo={nav.logo} {...footer} /></>);
    }
    return (
      <>
        <SEO title="Product not found" noindex />
        <AnnouncementBar />
        <Navbar {...nav} />
        <section className="rns-section">
          <div className="rns-container" style={{ textAlign: "center", padding: "60px 0" }}>
            <h1 className="rns-section-title">Product not found</h1>
            <p style={{ marginTop: 10, color: "var(--rns-ink-soft)" }}>
              The product you're looking for doesn't exist or may have been removed.
            </p>
            <Link to="/products" className="rns-btn rns-btn--primary" style={{ marginTop: 24 }}>
              Back to catalogue
            </Link>
          </div>
        </section>
        <Footer logo={nav.logo} {...footer} />
      </>
    );
  }

  if (loading || !product) {
    return (
      <>
        <SEO title="Loading product" noindex />
        <AnnouncementBar />
        <Navbar {...nav} />
        <section className="rns-section">
          <div className="rns-container" style={{ padding: "60px 0", textAlign: "center" }}>
            <h1 className="rns-section-title">Loading product…</h1>
          </div>
        </section>
        <Footer logo={nav.logo} {...footer} />
      </>
    );
  }

  const {
    name,
    category,
    categoryId,
    brand,
    sku,
    price,
    mrp,
    stock,
    images,
    shortDescription,
    description,
    highlights,
    specs,
    rating,
    reviewCount,
  } = product;

  const discount = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : null;
  const comparing = isComparing(id);

  const breadcrumbItems = [
    { label: category, href: `/products?category=${categoryId}` },
    { label: name },
  ];

  const productJsonLd = {
    "@type": "Product",
    name,
    sku,
    image: images,
    description: shortDescription,
    brand: { "@type": "Brand", name: brand },
    ...(reviewCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating, reviewCount } }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price,
      availability:
        stock === "in-stock" ? "https://schema.org/InStock" : "https://schema.org/LimitedAvailability",
      url: window.location.href,
    },
  };
  const { "@context": _breadcrumbContext, ...breadcrumbJsonLdNoContext } = buildBreadcrumbJsonLd(
    breadcrumbItems
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [productJsonLd, breadcrumbJsonLdNoContext],
  };

  function handleAddToCart() {
    addItem(product, qty);
    toast.success(`Added ${qty} × ${name} to cart`);
  }

  function handleNotifyMe() {
    // Placeholder until a real "notify on restock" endpoint exists —
    // mirrors how the newsletter form simulates a request elsewhere.
    toast.success(`We'll email you when ${name} is back in stock.`);
  }

  function handleOrderNow() {
    // "Order now" is a direct purchase — it must NOT touch the cart.
    // Send just this product straight to the checkout mid page, shaped
    // the same way a cart line item is so CheckoutPage/OrdersContext
    // don't need to know the difference.
    const buyNowItem = {
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      mrp: product.mrp,
      category: product.category,
      stock: product.stock,
      qty,
    };
    navigate("/checkout", { state: { items: [buyNowItem], mode: "buy-now" } });
  }

  function handleCompareToggle() {
    if (!comparing && isFull) {
      toast.info("You can compare up to 4 products at a time.");
      return;
    }
    if (!comparing && compareCategoryId && compareCategoryId !== product.categoryId) {
      toast.info("You can only compare products from the same category.");
      return;
    }
    toggleCompare(product);
    toast.success(comparing ? `Removed ${name} from compare` : `Added ${name} to compare`);
  }

  const whatsappHref = `https://wa.me/${support.whatsapp}?text=${encodeURIComponent(
    `Hi, I'm interested in ${name} (SKU: ${sku}) — could you share more details?`
  )}`;

  return (
    <>
      <SEO
        title={name}
        description={shortDescription}
        image={images[0]}
        jsonLd={jsonLd}
      />
      <AnnouncementBar />
      <Navbar {...nav} />

      {/* Breadcrumb */}
      <div className="rns-container" style={{ paddingTop: 22 }}>
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      {/* Main product section */}
      <section className="rns-container" style={{ paddingTop: 4, paddingBottom: 8 }}>
        <div className="rns-pdp-layout">
          {/* Gallery */}
          <ProductGallery images={images} name={name} />

          {/* Info panel */}
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <span className="rns-eyebrow">
                {brand} · SKU {sku}
              </span>
              <button
                type="button"
                onClick={handleCompareToggle}
                aria-pressed={comparing}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  fontWeight: 500,
                  padding: "6px 10px",
                  borderRadius: "var(--rns-r-sm)",
                  border: `1px solid ${comparing ? "var(--rns-ink)" : "var(--rns-line-strong)"}`,
                  background: comparing ? "var(--rns-ink)" : "transparent",
                  color: comparing ? "#fff" : "var(--rns-ink-soft)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Icon name="compare" size={13} />
                {comparing ? "Comparing" : "Compare"}
              </button>
            </div>
            <h1 style={{ fontSize: "clamp(22px, 3vw, 30px)", marginTop: 10, lineHeight: 1.25 }}>
              {name}
            </h1>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <Stars rating={rating} showValue count={reviewCount} />
              <a
                href="#reviews"
                style={{ fontSize: 13, color: "var(--rns-primary)" }}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                See reviews
              </a>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginTop: 20,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--rns-font-display)",
                  fontWeight: 700,
                  fontSize: 28,
                }}
              >
                {formatINR(price)}
              </span>
              {mrp && mrp > price && (
                <span
                  style={{
                    fontSize: 16,
                    color: "var(--rns-ink-faint)",
                    textDecoration: "line-through",
                  }}
                >
                  {formatINR(mrp)}
                </span>
              )}
              {discount && (
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0a7a58" }}>
                  Save {discount}%
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--rns-ink-faint)", marginTop: 4 }}>
              Inclusive of all taxes
            </div>

            {stock === "out-of-stock" && (
              <div style={{ marginTop: 14 }}>
                <span className="rns-tag" style={{ color: "#b3261e", borderColor: "#f3c9c5", background: "#fdf0ef" }}>
                  Out of stock
                </span>
              </div>
            )}

            <p style={{ marginTop: 20, fontSize: 14.5, color: "var(--rns-ink-soft)", lineHeight: 1.65 }}>
              {shortDescription}
            </p>

            <ul style={{ margin: "18px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {highlights.map((h) => (
                <li key={h} style={{ display: "flex", gap: 10, fontSize: 13.5, alignItems: "flex-start" }}>
                  <span style={{ color: "var(--rns-signal)", marginTop: 3, flexShrink: 0 }}>
                    <Icon name="check" size={14} />
                  </span>
                  <span style={{ color: "var(--rns-ink-soft)" }}>{h}</span>
                </li>
              ))}
            </ul>

            {/* Quantity + actions */}
            {stock === "out-of-stock" ? (
              <div style={{ marginTop: 26 }}>
                <button
                  onClick={handleNotifyMe}
                  className="rns-btn rns-btn--primary"
                  style={{ justifyContent: "center", width: "100%", maxWidth: 320 }}
                >
                  <Icon name="bell" size={16} />
                  Notify me when available
                </button>
              </div>
            ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 26, flexWrap: "wrap" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: "1px solid var(--rns-line-strong)",
                  borderRadius: "var(--rns-r-sm)",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  style={{
                    width: 38,
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "none",
                    border: "none",
                  }}
                >
                  <Icon name="minus" size={14} />
                </button>
                <span
                  style={{
                    width: 36,
                    textAlign: "center",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "var(--rns-font-mono)",
                  }}
                >
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  aria-label="Increase quantity"
                  style={{
                    width: 38,
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "none",
                    border: "none",
                  }}
                >
                  <Icon name="plus" size={14} />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                className="rns-btn rns-btn--ghost"
                style={{ flex: "1 1 160px", justifyContent: "center" }}
              >
                <Icon name="cart" size={16} />
                Add to cart
              </button>
              <button
                onClick={handleOrderNow}
                className="rns-btn rns-btn--primary"
                style={{ flex: "1 1 160px", justifyContent: "center" }}
              >
                Order now
              </button>
            </div>
            )}

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rns-btn rns-btn--ghost"
              style={{
                marginTop: 12,
                width: "100%",
                justifyContent: "center",
                color: "#1fa855",
                borderColor: "#bfe8d2",
              }}
            >
              <Icon name="whatsapp" size={16} />
              Enquire on WhatsApp
            </a>

            {/* Trust row */}
            <div
              className="rns-pdp-trust"
              style={{
                marginTop: 28,
                paddingTop: 22,
                borderTop: "1px solid var(--rns-line)",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
              }}
            >
              {[
                { icon: "truck", label: "Delivery", body: "3-4 days" },
                { icon: "shield", label: "100% genuine", body: "Authorized dealer" },
                { icon: "headset", label: "Product issue?", body: "Contact us directly" },
              ].map((t) => (
                <div key={t.label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "var(--rns-ink-soft)", flexShrink: 0 }}>
                    <Icon name={t.icon} size={18} />
                  </span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--rns-ink-faint)" }}>{t.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Description + specifications */}
      <section className="rns-section">
        <div className="rns-container">
          <div className="rns-pdp-tabs">
            <div className="rns-pdp-tabs__nav" role="tablist" aria-label="Product information">
              <button
                type="button"
                role="tab"
                id="tab-description"
                aria-selected={infoTab === "description"}
                aria-controls="panel-description"
                className={`rns-pdp-tab${infoTab === "description" ? " rns-pdp-tab--active" : ""}`}
                onClick={() => setInfoTab("description")}
              >
                Description
              </button>
              {specs.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  id="tab-specifications"
                  aria-selected={infoTab === "specifications"}
                  aria-controls="panel-specifications"
                  className={`rns-pdp-tab${infoTab === "specifications" ? " rns-pdp-tab--active" : ""}`}
                  onClick={() => setInfoTab("specifications")}
                >
                  Specifications
                </button>
              )}
            </div>

            {infoTab === "description" || specs.length === 0 ? (
              <div
                id="panel-description"
                role="tabpanel"
                aria-labelledby="tab-description"
                className="rns-rich-content"
                style={{ fontSize: 14.5, color: "var(--rns-ink-soft)", lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
              />
            ) : (
              <ul id="panel-specifications" role="tabpanel" aria-labelledby="tab-specifications" className="rns-spec-list">
                {specs.map((s, i) => (
                  <li key={s.label || i} className="rns-spec-list__item">
                    <Icon name="check" size={14} className="rns-spec-list__icon" />
                    <span>{s.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Downloads */}
      {productDownloads.length > 0 && (
        <section className="rns-section rns-section--alt">
          <div className="rns-container">
            <span className="rns-eyebrow">Drivers & manuals</span>
            <h2 className="rns-section-title" style={{ marginTop: 8 }}>
              Downloads for this product
            </h2>
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--rns-ink-soft)", maxWidth: 560 }}>
              Drivers, manuals, and setup guides, hosted on the manufacturer's own website.
            </p>
            <div
              style={{
                marginTop: 24,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 14,
              }}
            >
              {productDownloads.map((d) => (
                <a
                  key={d.id || d.url}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rns-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: 16,
                    color: "inherit",
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: "var(--rns-r-sm)",
                      background: "var(--rns-bg-alt)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--rns-ink-soft)",
                    }}
                  >
                    <Icon name="fileText" size={18} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{d.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--rns-ink-faint)", marginTop: 2 }}>
                      From the manufacturer's website
                    </div>
                  </div>
                  <Icon name="external" size={16} style={{ color: "var(--rns-ink-faint)", flexShrink: 0 }} />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      <section id="reviews" className="rns-section">
        <div className="rns-container">
          <span className="rns-eyebrow">Customer reviews</span>
          <h2 className="rns-section-title" style={{ marginTop: 8 }}>
            What buyers are saying
          </h2>

          <div className="rns-pdp-reviews" style={{ marginTop: 28 }}>
            {/* Summary */}
            <div>
              <div style={{ fontFamily: "var(--rns-font-display)", fontWeight: 700, fontSize: 44, lineHeight: 1 }}>
                {rating.toFixed(1)}
              </div>
              <div style={{ marginTop: 8 }}>
                <Stars rating={rating} size={18} />
              </div>
              <div style={{ fontSize: 13, color: "var(--rns-ink-faint)", marginTop: 6 }}>
                Based on {reviewCount} review{reviewCount === 1 ? "" : "s"}
              </div>

              <div style={{ marginTop: 20, display: "grid", gap: 8 }}>
                {ratingBreakdown.map((b) => (
                  <div key={b.star} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 40, color: "var(--rns-ink-soft)" }}>{b.star} star</span>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        background: "var(--rns-line)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${b.count > 0 ? b.pct : 0}%`,
                          height: "100%",
                          background: "#f5a623",
                        }}
                      />
                    </div>
                    <span style={{ width: 18, textAlign: "right", color: "var(--rns-ink-faint)" }}>
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* List */}
            <div style={{ display: "grid", gap: 14 }}>
              {/* Submission form / status */}
              <div className="rns-card" style={{ padding: 20 }}>
                {reviewStatus === "submitted" ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Icon name="check" size={16} style={{ color: "#0a7a58", marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>Thanks — your review is live</div>
                      <div style={{ fontSize: 12.5, color: "var(--rns-ink-soft)", marginTop: 4 }}>
                        It's already visible below, no waiting on moderation.
                      </div>
                    </div>
                  </div>
                ) : reviewStatus === "already" ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Icon name="info" size={16} style={{ color: "var(--rns-ink-soft)", marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>You've already reviewed this product</div>
                      <div style={{ fontSize: 12.5, color: "var(--rns-ink-soft)", marginTop: 4 }}>
                        Only one review per product per account — thanks for sharing your feedback.
                      </div>
                    </div>
                  </div>
                ) : isAuthenticated && reviewEligibility?.reason === "already_reviewed" ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Icon name="info" size={16} style={{ color: "var(--rns-ink-soft)", marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>You've already reviewed this product</div>
                      <div style={{ fontSize: 12.5, color: "var(--rns-ink-soft)", marginTop: 4 }}>
                        Only one review per product per account — thanks for sharing your feedback.
                      </div>
                    </div>
                  </div>
                ) : isAuthenticated && reviewEligibility?.reason === "not_purchased" ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Icon name="package" size={16} style={{ color: "var(--rns-ink-soft)", marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>Only verified buyers can review this product</div>
                      <div style={{ fontSize: 12.5, color: "var(--rns-ink-soft)", marginTop: 4 }}>
                        Once your order for this product is delivered, a "Write a review" link will show up in{" "}
                        <Link to="/orders" style={{ color: "var(--rns-primary)" }}>your orders</Link>.
                      </div>
                    </div>
                  </div>
                ) : isAuthenticated ? (
                  <form onSubmit={handleSubmitReview}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>Write a review</div>
                    <div style={{ marginTop: 10, display: "flex", gap: 4 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewForm((f) => ({ ...f, rating: star }))}
                          aria-label={`${star} star${star === 1 ? "" : "s"}`}
                          style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: star <= reviewForm.rating ? "#f5a623" : "var(--rns-line-strong)" }}
                        >
                          <Icon name="star" size={20} strokeWidth={0} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                      placeholder="What did you think? (min. 3 characters)"
                      rows={3}
                      maxLength={1000}
                      style={{
                        width: "100%",
                        marginTop: 12,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--rns-line-strong)",
                        fontSize: 13.5,
                        fontFamily: "inherit",
                        resize: "vertical",
                      }}
                    />
                    {reviewError && (
                      <div style={{ fontSize: 12.5, color: "#c0392b", marginTop: 8 }}>{reviewError}</div>
                    )}
                    <button
                      type="submit"
                      disabled={reviewSubmitting}
                      className="rns-btn rns-btn--primary"
                      style={{ marginTop: 12, opacity: reviewSubmitting ? 0.7 : 1 }}
                    >
                      {reviewSubmitting ? "Submitting…" : "Submit review"}
                    </button>
                  </form>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--rns-ink-soft)" }}>
                    <Link to="/login" style={{ color: "var(--rns-primary)" }}>Sign in</Link> to write a review.
                  </div>
                )}
              </div>

              {reviewsLoading ? (
                <div style={{ fontSize: 13, color: "var(--rns-ink-faint)", textAlign: "center", padding: "20px 0" }}>
                  Loading reviews…
                </div>
              ) : reviewsError ? (
                <ErrorState message={reviewsError.message} />
              ) : liveReviews.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--rns-ink-faint)", textAlign: "center", padding: "20px 0" }}>
                  No reviews yet — be the first to share your experience.
                </div>
              ) : (
                liveReviews.map((r) => (
                  <div key={r.id} className="rns-card" style={{ padding: 20, background: "var(--rns-bg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{r.reviewerName}</div>
                        <div style={{ marginTop: 4 }}>
                          <Stars rating={r.rating} size={12} />
                        </div>
                      </div>
                      {r.createdAt && (
                        <span style={{ fontSize: 12, color: "var(--rns-ink-faint)", whiteSpace: "nowrap" }}>
                          {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <p style={{ marginTop: 12, fontSize: 13.5, color: "var(--rns-ink-soft)", lineHeight: 1.6 }}>
                      {r.comment}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Related products */}
      {related.length > 0 && (
        <ProductGrid
          eyebrow="You may also like"
          title={`More from ${category}`}
          products={related}
          altBg
        />
      )}

      <Footer logo={nav.logo} {...footer} />

      <style>{`
        .rns-pdp-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: start;
        }
        .rns-pdp-reviews {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 48px;
          align-items: start;
        }
        .rns-star { fill: currentColor; stroke: none; }

        .rns-pdp-tabs__nav {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--rns-line);
          margin-bottom: 24px;
        }
        .rns-pdp-tab {
          appearance: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 12px 4px;
          margin-right: 28px;
          font-family: var(--rns-font-display);
          font-size: 15px;
          font-weight: 600;
          color: var(--rns-ink-faint);
          border-bottom: 2px solid transparent;
          transform: translateY(1px);
          transition: color .15s ease, border-color .15s ease;
        }
        .rns-pdp-tab:hover { color: var(--rns-ink-soft); }
        .rns-pdp-tab--active { color: var(--rns-ink); border-bottom-color: var(--rns-primary); }

        .rns-spec-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 32px;
        }
        .rns-spec-list__item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 13.5px;
          line-height: 1.5;
          color: var(--rns-ink-soft);
        }
        .rns-spec-list__icon { color: var(--rns-signal); flex-shrink: 0; margin-top: 3px; }

        @media (max-width: 760px) {
          .rns-pdp-layout { grid-template-columns: 1fr !important; gap: 28px !important; }
          .rns-pdp-reviews { grid-template-columns: 1fr !important; gap: 24px !important; }
          .rns-pdp-trust { grid-template-columns: 1fr !important; }
          .rns-spec-list { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}