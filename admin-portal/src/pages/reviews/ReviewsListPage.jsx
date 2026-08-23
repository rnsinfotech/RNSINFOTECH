import PermissionBoundary from "../../components/PermissionBoundary";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import StatCard from "../../components/StatCard";
import useToast from "../../hooks/useToast";
import { getReviews, getReviewStats, deleteReview } from "../../services/reviewsService";
import PageLoader from "../../components/PageLoader";

function Stars({ rating }) {
  return (
    <span style={{ display: "inline-flex", gap: 1, color: "var(--admin-warning)" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon key={i} name="star" size={13} style={{ fill: i < rating ? "currentColor" : "none" }} />
      ))}
    </span>
  );
}

/**
 * ReviewsListPage — reviews go live the moment a shopper submits them
 * (see storefront-backend's review.controller.js), so there's no
 * pending/approved/rejected queue to work through here. The admin can
 * only browse what's live and delete anything inappropriate or spammy;
 * deleting recomputes that product's rating automatically.
 */
export default function ReviewsListPage() {
  const { toast, showToast, clearToast } = useToast();
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  async function load() {
    setError("");
    try {
      const [items, s] = await Promise.all([getReviews(), getReviewStats()]);
      setReviews(items);
      setStats(s);
    } catch (err) {
      setReviews(null);
      setError(err.message || "Unable to load reviews.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!reviews) return [];
    const q = search.trim().toLowerCase();
    return reviews
      .filter(
        (r) =>
          !q ||
          r.productName.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.comment.toLowerCase().includes(q)
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [reviews, search]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteReview(pendingDelete.id);
    setPendingDelete(null);
    showToast("Review deleted");
    load();
  }

  return (
    <PermissionBoundary permission="reviews.write"><div>
      <div className="admin-page-header">
        <div>
          <h1>Reviews</h1>
          <p>Reviews are visible on the site as soon as a customer submits them. Delete anything inappropriate or spammy — that's the only moderation available here.</p>
        </div>
      </div>

      {stats && (
        <div className="admin-stat-grid" style={{ marginBottom: 20 }}>
          <StatCard label="Total reviews" value={stats.total} icon="star" />
          <StatCard label="Average rating" value={stats.averageRating ? stats.averageRating.toFixed(1) : "—"} icon="check" />
        </div>
      )}

      <div className="admin-toolbar">
        <div className="admin-toolbar__search">
          <Icon name="search" size={15} />
          <input
            className="admin-input"
            placeholder="Search product, customer, or comment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div className="admin-card"><div style={{ color: "var(--admin-danger)", marginBottom: 12 }}>{error}</div><button className="admin-btn admin-btn--ghost" type="button" onClick={() => load()}>Try again</button></div>
      ) : reviews === null ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState icon="star" title="No reviews yet" description="Reviews customers submit will show up here." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((r) => (
            <div key={r.id} className="admin-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong>{r.customerName}</strong>
                    <Stars rating={r.rating} />
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--admin-ink-soft)", marginTop: 2 }}>
                    on{" "}
                    <Link to={`/products/${r.productId}`} style={{ color: "var(--admin-primary)" }}>
                      {r.productName}
                    </Link>{" "}
                    · {r.date}
                  </div>
                  <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55 }}>{r.comment}</p>
                </div>
                <div className="admin-table__actions" style={{ flexShrink: 0 }}>
                  <button
                    className="admin-icon-btn admin-icon-btn--danger"
                    type="button"
                    aria-label="Delete"
                    title="Delete"
                    onClick={() => setPendingDelete(r)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this review?"
        description={pendingDelete ? `The review from "${pendingDelete.customerName}" will be permanently removed.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  </PermissionBoundary>
  );
}
