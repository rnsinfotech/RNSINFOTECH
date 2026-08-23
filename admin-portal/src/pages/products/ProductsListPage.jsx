import PermissionBoundary from "../../components/PermissionBoundary";
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import StatusToggle from "../../components/StatusToggle";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import { getProductsPage, deleteProduct, bulkProductAction, updateProductCuration } from "../../services/productsService";
import { getCategories } from "../../services/categoriesService";
import { getBrands } from "../../services/brandsService";
import { STATUS_TONE, statusLabel } from "../../utils/format";
import PageLoader from "../../components/PageLoader";

const PAGE_SIZE = 20;

export default function ProductsListPage() {
  const navigate = useNavigate();
  const { toast, showToast, clearToast } = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("");
  const [stock, setStock] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [selected, setSelected] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [curationBusyId, setCurationBusyId] = useState("");

  async function load(targetPage = page) {
    setLoading(true);
    try {
      const [p, c, b] = await Promise.all([
        getProductsPage({ q, categoryId, brand, status, sort, stock, page: targetPage, limit: PAGE_SIZE }),
        categories.length ? Promise.resolve(categories) : getCategories(),
        brands.length ? Promise.resolve(brands) : getBrands(),
      ]);
      setProducts(p.items); setPagination({ total: p.total, totalPages: p.totalPages });
      if (!categories.length) setCategories(c);
      if (!brands.length) setBrands(b);
      setSelected([]);
    } catch (err) {
      showToast(err.message || "Unable to load products.", "error");
    } finally { setLoading(false); }
  }

  useEffect(() => { setPage(1); }, [q, categoryId, brand, status, sort, stock]);
  useEffect(() => { load(page); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q, categoryId, brand, status, sort, stock, page]);

  function toggleSelected(id) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function toggleAll() { setSelected(selected.length === products.length ? [] : products.map((p) => p.id)); }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try { await deleteProduct(pendingDelete.id); setPendingDelete(null); showToast(`Deleted "${pendingDelete.name}"`, "success"); await load(page); }
    catch (err) { showToast(err.message || "Unable to delete product.", "error"); }
  }

  async function runBulkAction() {
    if (!selected.length || !bulkAction) return;
    if (bulkAction === "change-category" && !bulkCategory) { showToast("Choose a category first.", "error"); return; }
    const label = bulkAction === "delete" ? `Delete ${selected.length} selected products permanently?` : bulkAction === "activate" ? `Activate ${selected.length} selected products?` : bulkAction === "deactivate" ? `Deactivate ${selected.length} selected products?` : `Move ${selected.length} selected products to the selected category?`;
    if (!window.confirm(label)) return;
    setBulkBusy(true);
    try {
      const result = await bulkProductAction(bulkAction, selected, bulkCategory);
      showToast(bulkAction === "delete" ? `${result.deleted || 0} products deleted.` : "Bulk product action completed.", "success");
      setBulkAction(""); setBulkCategory(""); await load(page);
    } catch (err) { showToast(err.message || "Bulk action failed.", "error"); }
    finally { setBulkBusy(false); }
  }

  // Quick-toggle affordance: flip Featured/Best-Seller straight from the
  // list without opening the full edit form. Sends only the changed flag
  // (order auto-assigns) via updateProductCuration, then patches just
  // that row in place so filters/pagination/scroll position don't reset.
  async function toggleCuration(product, field) {
    setCurationBusyId(product.id);
    try {
      const updated = await updateProductCuration(product.id, { [field]: !product[field] });
      if (updated) setProducts((current) => current.map((p) => (p.id === product.id ? updated : p)));
    } catch (err) {
      showToast(err.message || "Unable to update product.", "error");
    } finally {
      setCurationBusyId("");
    }
  }

  const hasFilters = q || categoryId || brand || status || sort || stock;
  const allSelected = products.length > 0 && selected.length === products.length;
  const first = pagination.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, pagination.total);

  return (
    <PermissionBoundary permission="catalog.write"><div>
      <div className="admin-page-header"><div><h1>Products</h1><p>Manage your catalogue — add products, update pricing and stock, and control visibility.</p></div><button className="admin-btn admin-btn--primary" type="button" onClick={() => navigate("/products/new")}><Icon name="plus" size={15} /> Add product</button></div>

      <div className="admin-card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 16px 0" }}><div className="admin-toolbar">
          <div className="admin-toolbar__search"><Icon name="search" size={15} /><input className="admin-input" placeholder="Search name, SKU, description…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="admin-select" style={{ width: 160 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="admin-select" style={{ width: 140 }} value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">All brands</option>{brands.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}</select>
          <select className="admin-select" style={{ width: 140 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <select className="admin-select" style={{ width: 150 }} value={stock} onChange={(e) => setStock(e.target.value)}><option value="">All stock</option><option value="in-stock">In stock</option><option value="low-stock">Low stock</option><option value="out-of-stock">Out of stock</option></select>
          <select className="admin-select" style={{ width: 165 }} value={sort} onChange={(e) => setSort(e.target.value)}><option value="">Sort: newest</option><option value="name">Name A–Z</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="stock_asc">Stock: low to high</option><option value="stock_desc">Stock: high to low</option><option value="rating">Rating</option></select>
          {hasFilters && <button className="admin-btn admin-btn--ghost admin-btn--sm" type="button" onClick={() => { setQ(""); setCategoryId(""); setBrand(""); setStatus(""); setSort(""); setStock(""); }}>Clear</button>}
        </div></div>

        {selected.length > 0 && <div style={{ margin: "12px 16px", padding: 10, borderRadius: 8, background: "var(--admin-surface)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 12.5 }}>{selected.length} selected</strong>
          <select className="admin-select" style={{ width: 160 }} value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} disabled={bulkBusy}><option value="">Bulk action…</option><option value="activate">Activate</option><option value="deactivate">Deactivate</option><option value="change-category">Change category</option><option value="delete">Delete</option></select>
          {bulkAction === "change-category" && <select className="admin-select" style={{ width: 180 }} value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} disabled={bulkBusy}><option value="">Choose category…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
          <button className="admin-btn admin-btn--primary admin-btn--sm" type="button" disabled={!bulkAction || bulkBusy} onClick={runBulkAction}>{bulkBusy ? "Working…" : "Apply"}</button>
          <button className="admin-btn admin-btn--ghost admin-btn--sm" type="button" onClick={() => setSelected([])}>Clear selection</button>
        </div>}

        {loading ? <PageLoader /> : products.length === 0 ? <EmptyState icon="package" title="No products found" description="Try adjusting your filters, or add a new product." /> : <>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr>
            <th style={{ width: 42 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all products on this page" /></th><th>Product</th><th>Category</th><th>Brand</th><th>Price</th><th>Stock</th><th>Status</th><th>Featured</th><th>Best Seller</th><th style={{ textAlign: "right" }}>Actions</th>
          </tr></thead><tbody>{products.map((p) => <tr key={p.id}>
            <td><input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelected(p.id)} aria-label={`Select ${p.name}`} /></td>
            <td><div className="admin-table__title-cell"><img className="admin-table__thumb" src={p.image} alt="" /><div><Link to={`/products/${p.id}`} className="admin-table__title-main" style={{ textDecoration: "none" }}>{p.name}</Link><div className="admin-table__title-sub">{p.sku}</div></div></div></td>
            <td>{p.category}</td><td>{p.brand}</td><td>₹{p.price.toLocaleString("en-IN")}{p.mrp > p.price && <span className="admin-table__mrp">₹{p.mrp.toLocaleString("en-IN")}</span>}</td>
            <td><Badge tone={STATUS_TONE[p.stock]}>{statusLabel(p.stock)}</Badge><span style={{ marginLeft: 8, fontSize: 11.5, color: "var(--admin-ink-faint)" }}>{p.stockQty} units</span></td>
            <td><Badge tone={p.status === "active" ? "success" : "neutral"}>{statusLabel(p.status)}</Badge></td>
            <td><StatusToggle active={p.isFeatured} disabled={curationBusyId === p.id} onChange={() => toggleCuration(p, "isFeatured")} labels={{ on: "Yes", off: "No" }} /></td>
            <td><StatusToggle active={p.isBestSeller} disabled={curationBusyId === p.id} onChange={() => toggleCuration(p, "isBestSeller")} labels={{ on: "Yes", off: "No" }} /></td>
            <td><div className="admin-table__actions"><Link to={`/products/${p.id}`} className="admin-icon-btn" aria-label="View"><Icon name="arrowRight" size={14} /></Link><Link to={`/products/${p.id}/edit`} className="admin-icon-btn" aria-label="Edit"><Icon name="edit" size={14} /></Link><button className="admin-icon-btn admin-icon-btn--danger" type="button" aria-label="Delete" onClick={() => setPendingDelete(p)}><Icon name="trash" size={14} /></button></div></td>
          </tr>)}</tbody></table></div>
          <div className="admin-pagination"><span>Showing {first}–{last} of {pagination.total}</span><div className="admin-pagination__controls"><button className="admin-btn admin-btn--ghost admin-btn--sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} type="button">Previous</button><span style={{ fontSize: 12 }}>Page {page} of {Math.max(1, pagination.totalPages)}</span><button className="admin-btn admin-btn--ghost admin-btn--sm" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)} type="button">Next</button></div></div>
        </>}
      </div>
      <ConfirmDialog open={!!pendingDelete} title="Delete this product?" description={pendingDelete ? `"${pendingDelete.name}" will be permanently removed from the catalogue.` : ""} onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  </PermissionBoundary>
  );}
