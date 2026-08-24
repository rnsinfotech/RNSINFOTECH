import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import { getProduct, deleteProduct } from "../../services/productsService";
import { STATUS_TONE, statusLabel } from "../../utils/format";
import PageLoader from "../../components/PageLoader";

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, showToast, clearToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getProduct(id).then((p) => {
      if (!alive) return;
      setProduct(p);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (location.state?.savedMessage) {
      showToast(location.state.savedMessage, "success");
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete() {
    await deleteProduct(id);
    navigate("/products");
  }

  if (loading) {
    return <PageLoader />;
  }

  if (!product) {
    return (
      <div className="admin-card admin-empty">
        <h3>Product not found</h3>
        <p>It may have already been deleted.</p>
        <Link to="/products" className="admin-btn admin-btn--primary" style={{ marginTop: 14 }}>
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/products" className="admin-back-link">
        <Icon name="chevronLeft" size={13} />
        Back to products
      </Link>

      <div className="admin-page-header">
        <div className="admin-detail-header">
          <img src={product.image} alt={product.name} />
          <div>
            <h1>{product.name}</h1>
            <p style={{ marginBottom: 8 }}>
              {product.sku} · {product.category} · {product.brand}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone={product.status === "active" ? "success" : "neutral"}>{statusLabel(product.status)}</Badge>
              <Badge tone={STATUS_TONE[product.stock]}>{statusLabel(product.stock)}</Badge>
              {product.isFeatured && <Badge tone="info">Featured{product.homepageFeaturedOrder != null ? ` #${product.homepageFeaturedOrder}` : ""}</Badge>}
              {product.isBestSeller && <Badge tone="info">Best Seller{product.homepageBestSellerOrder != null ? ` #${product.homepageBestSellerOrder}` : ""}</Badge>}
              {(product.tags || []).map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setConfirmOpen(true)}>
            <Icon name="trash" size={14} />
            Delete
          </button>
          <Link to={`/products/${id}/edit`} className="admin-btn admin-btn--primary">
            <Icon name="edit" size={14} />
            Edit product
          </Link>
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {product.shortDescription && (
            <div className="admin-card">
              <h3 style={{ fontSize: 14, marginBottom: 10 }}>Short description</h3>
              <p style={{ fontSize: 13.5, color: "var(--admin-ink-soft)", lineHeight: 1.6 }}>{product.shortDescription}</p>
            </div>
          )}

          <div className="admin-card">
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>Full description</h3>
            {/* description is admin-authored rich-text HTML, sanitized server-side
                on save (see admin-backend/src/utils/sanitizeDescription.js) before
                it's ever stored — rendering it as plain text below showed the raw
                HTML tags instead of the formatted content the admin actually wrote. */}
            {product.description ? (
              <div
                className="admin-rich-content"
                style={{ fontSize: 13.5, color: "var(--admin-ink-soft)", lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            ) : (
              <p style={{ fontSize: 13.5, color: "var(--admin-ink-faint)" }}>No description added yet.</p>
            )}
          </div>

          {product.packageContents?.length > 0 && (
            <div className="admin-card">
              <h3 style={{ fontSize: 14, marginBottom: 12 }}>Package contents</h3>
              <div className="admin-kv-list">
                {product.packageContents.map((p, i) => (
                  <div key={p.id || i}>
                    <span>{p.name}</span>
                    <span>{p.description || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.highlights?.length > 0 && (
            <div className="admin-card">
              <h3 style={{ fontSize: 14, marginBottom: 12 }}>Highlights</h3>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5 }}>
                {product.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {product.specs?.length > 0 && (
            <div className="admin-card">
              <h3 style={{ fontSize: 14, marginBottom: 12 }}>Specifications</h3>
              <div className="admin-kv-list">
                {product.specs.map((s, i) => (
                  <div key={i}>
                    <span>{s.label}</span>
                    <span>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.downloadLinks?.length > 0 && (
            <div className="admin-card">
              <h3 style={{ fontSize: 14, marginBottom: 12 }}>Download links</h3>
              <div className="admin-kv-list">
                {product.downloadLinks.map((d, i) => (
                  <div key={d.id || i}>
                    <span>{d.label}</span>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--admin-accent)" }}>
                      {d.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-card">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Pricing &amp; stock</h3>
            <div className="admin-kv-list">
              <div>
                <span>Price</span>
                <span>₹{product.price.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span>MRP</span>
                <span>₹{product.mrp.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span>Stock quantity</span>
                <span>{product.stockQty} units</span>
              </div>
              <div>
                <span>Rating</span>
                <span>
                  {product.rating || "—"} {product.reviewCount ? `(${product.reviewCount} reviews)` : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this product?"
        description={`"${product.name}" will be permanently removed from the catalogue.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  );
}
