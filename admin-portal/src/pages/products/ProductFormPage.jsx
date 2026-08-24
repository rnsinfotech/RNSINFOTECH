import PermissionBoundary from "../../components/PermissionBoundary";
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import StatusToggle from "../../components/StatusToggle";
import { getProduct, createProduct, updateProduct, uploadProductImages, replaceProductImage, deleteProductImage } from "../../services/productsService";
import { getCategories } from "../../services/categoriesService";
import { getBrands } from "../../services/brandsService";
import PageLoader from "../../components/PageLoader";
import RichTextEditor from "../../components/RichTextEditor";

// Suggestions only — tags[] is freeform (search/filtering elsewhere),
// fully decoupled from homepage curation. Featured & Best Sellers are
// their own admin-curated flags below, not tag values anymore.
const TAG_SUGGESTIONS = ["new", "sale", "bundle", "limited", "trending"];
const MAX_IMAGES = 12;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const BLANK = {
  name: "", categoryId: "", brand: "", sku: "", price: "", mrp: "", tags: [], stockQty: "", status: "active",
  isFeatured: false, homepageFeaturedOrder: "", isBestSeller: false, homepageBestSellerOrder: "",
  shortDescription: "", description: "", highlights: [""], specs: [{ label: "", value: "" }],
  downloadLinks: [{ label: "", url: "" }], images: [],
};

function validateFile(file) {
  if (!ALLOWED_TYPES.has(file.type)) return "Only JPEG, PNG, WEBP, or GIF images are allowed.";
  if (file.size > MAX_FILE_SIZE) return "Each image must be 5 MB or smaller.";
  return "";
}

function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The image could not be read.")); };
    img.src = url;
  });
}

export default function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [localPreviews, setLocalPreviews] = useState([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const [c, b] = await Promise.all([getCategories(), getBrands()]);
        setCategories(c); setBrands(b);
        if (isEdit) {
          const product = await getProduct(id);
          if (product) setForm({
            ...BLANK, ...product,
            price: String(product.price), mrp: String(product.mrp), stockQty: String(product.stockQty),
            tags: Array.isArray(product.tags) ? product.tags : [],
            homepageFeaturedOrder: product.homepageFeaturedOrder == null ? "" : String(product.homepageFeaturedOrder),
            homepageBestSellerOrder: product.homepageBestSellerOrder == null ? "" : String(product.homepageBestSellerOrder),
            downloadLinks: product.downloadLinks && product.downloadLinks.length ? product.downloadLinks : [{ label: "", url: "" }],
            images: product.images || [],
          });
          setLoading(false);
        } else if (c[0]) {
          setForm((f) => ({ ...f, categoryId: c[0].id, brand: b[0]?.name || "" }));
        }
      } catch (err) {
        setError(err.message || "Unable to load product form.");
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => () => localPreviews.forEach((preview) => URL.revokeObjectURL(preview.url)), [localPreviews]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }
  function setHighlight(i, value) { setForm((f) => ({ ...f, highlights: f.highlights.map((h, idx) => (idx === i ? value : h)) })); }
  function addHighlight() { setForm((f) => ({ ...f, highlights: [...f.highlights, ""] })); }
  function removeHighlight(i) { setForm((f) => ({ ...f, highlights: f.highlights.filter((_, idx) => idx !== i) })); }
  function setSpec(i, key, value) { setForm((f) => ({ ...f, specs: f.specs.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)) })); }
  function addSpec() { setForm((f) => ({ ...f, specs: [...f.specs, { label: "", value: "" }] })); }
  function removeSpec(i) { setForm((f) => ({ ...f, specs: f.specs.filter((_, idx) => idx !== i) })); }

  function setDownloadLink(i, key, value) { setForm((f) => ({ ...f, downloadLinks: f.downloadLinks.map((d, idx) => (idx === i ? { ...d, [key]: value } : d)) })); }
  function addDownloadLink() { setForm((f) => ({ ...f, downloadLinks: [...f.downloadLinks, { label: "", url: "" }] })); }
  function removeDownloadLink(i) { setForm((f) => ({ ...f, downloadLinks: f.downloadLinks.filter((_, idx) => idx !== i) })); }

  function addTag(raw) {
    const value = (raw ?? tagInput).trim().toLowerCase();
    setTagInput("");
    if (!value || form.tags.includes(value)) return;
    setForm((f) => ({ ...f, tags: [...f.tags, value] }));
  }
  function removeTag(value) { setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== value) })); }
  function onTagInputKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
    else if (e.key === "Backspace" && !tagInput && form.tags.length) removeTag(form.tags[form.tags.length - 1]);
  }

  async function addFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setMediaError("");
    if (!files.length) return;
    if (form.images.length + pendingFiles.length + files.length > MAX_IMAGES) {
      setMediaError(`A product may have at most ${MAX_IMAGES} images.`); return;
    }
    const valid = [];
    for (const file of files) {
      const basicError = validateFile(file);
      if (basicError) { setMediaError(`${file.name}: ${basicError}`); return; }
      try {
        const dimensions = await readImageDimensions(file);
        if (dimensions.width < 100 || dimensions.height < 100 || dimensions.width > 6000 || dimensions.height > 6000 || dimensions.width * dimensions.height > 25_000_000) {
          setMediaError(`${file.name}: image dimensions must be between 100×100 and 6000×6000 pixels, with at most 25 megapixels.`); return;
        }
      } catch (err) { setMediaError(`${file.name}: ${err.message}`); return; }
      valid.push(file);
    }
    setPendingFiles((current) => [...current, ...valid]);
    setLocalPreviews((current) => [...current, ...valid.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  function removePending(index) {
    setPendingFiles((current) => current.filter((_, i) => i !== index));
    setLocalPreviews((current) => current.filter((_, i) => i !== index));
  }

  async function replaceImage(image) {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const basicError = validateFile(file);
      if (basicError) { setMediaError(basicError); return; }
      try {
        const dimensions = await readImageDimensions(file);
        if (dimensions.width < 100 || dimensions.height < 100 || dimensions.width > 6000 || dimensions.height > 6000 || dimensions.width * dimensions.height > 25_000_000) throw new Error("Image dimensions are outside the allowed range.");
        setUploading(true); setUploadProgress(0); setMediaError("");
        const updated = await replaceProductImage(id, image.id, file, { onProgress: setUploadProgress });
        setForm((f) => ({ ...f, images: updated.images || [] }));
      } catch (err) { setMediaError(err.message || "Unable to replace image."); }
      finally { setUploading(false); }
    };
    input.click();
  }

  async function removeImage(image) {
    if (!window.confirm("Delete this product image? This cannot be undone.")) return;
    try {
      setUploading(true); setMediaError("");
      const updated = await deleteProductImage(id, image.id);
      setForm((f) => ({ ...f, images: updated.images || [] }));
    } catch (err) { setMediaError(err.message || "Unable to delete image."); }
    finally { setUploading(false); }
  }

  async function uploadPending(productId) {
    if (!pendingFiles.length) return productId;
    setUploading(true); setUploadProgress(0); setMediaError("");
    try {
      const updated = await uploadProductImages(productId, pendingFiles, { onProgress: setUploadProgress });
      setPendingFiles([]); setLocalPreviews([]);
      setForm((f) => ({ ...f, images: updated.images || [] }));
    } finally { setUploading(false); }
    return productId;
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError("");
    if (!form.name.trim() || !form.categoryId || !form.brand || !form.sku.trim() || form.price === "") { setError("Please fill in name, category, brand, SKU, and price."); return; }
    const payload = {
      name: form.name.trim(), categoryId: form.categoryId, brand: form.brand, sku: form.sku.trim(), price: Number(form.price) || 0,
      mrp: Number(form.mrp) || Number(form.price) || 0, tags: form.tags, stockQty: Number(form.stockQty) || 0, status: form.status,
      isFeatured: form.isFeatured, homepageFeaturedOrder: form.homepageFeaturedOrder,
      isBestSeller: form.isBestSeller, homepageBestSellerOrder: form.homepageBestSellerOrder,
      shortDescription: form.shortDescription.trim(), description: form.description.trim() || form.shortDescription.trim(),
      highlights: form.highlights.map((h) => h.trim()).filter(Boolean), specs: form.specs.filter((s) => s.label.trim() && s.value.trim()),
      downloadLinks: form.downloadLinks
        .map((d) => ({ label: d.label.trim(), url: d.url.trim() }))
        .filter((d) => d.label && d.url),
    };
    setSaving(true);
    try {
      if (isEdit) {
        await updateProduct(id, payload);
        await uploadPending(id);
        navigate(`/products/${id}`, { state: { savedMessage: "Product updated" } });
      } else {
        const created = await createProduct(payload);
        if (pendingFiles.length) await uploadPending(created.id);
        navigate(`/products/${created.id}`, { state: { savedMessage: "Product created" } });
      }
    } catch (err) { setError(err.message || "Something went wrong. Please try again."); }
    finally { setSaving(false); }
  }

  if (loading) return <PageLoader />;

  return (
    <PermissionBoundary permission="catalog.write"><div>
      <Link to={isEdit ? `/products/${id}` : "/products"} className="admin-back-link"><Icon name="chevronLeft" size={13} /> Back</Link>
      <div className="admin-page-header"><div><h1>{isEdit ? "Edit product" : "Add product"}</h1><p>{isEdit ? "Update this product's details, pricing, stock, and media." : "Add a new product to the catalogue."}</p></div></div>
      <form className="admin-card" onSubmit={handleSubmit}>
        {error && <div style={{ background: "var(--admin-danger-tint)", color: "var(--admin-danger)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 18 }}>{error}</div>}

        <div className="admin-form-section"><h3>Basic details</h3><div className="admin-form-grid">
          <FormField label="Product name" htmlFor="name" required full><input id="name" className="admin-input" value={form.name} onChange={(e) => set("name", e.target.value)} /></FormField>
          <FormField label="Category" htmlFor="categoryId" required><select id="categoryId" className="admin-select" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField>
          <FormField label="Brand" htmlFor="brand" required><select id="brand" className="admin-select" value={form.brand} onChange={(e) => set("brand", e.target.value)}>{brands.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}</select></FormField>
          <FormField label="SKU" htmlFor="sku" required><input id="sku" className="admin-input" value={form.sku} onChange={(e) => set("sku", e.target.value)} /></FormField>
          <FormField label="Tags" htmlFor="tagInput" full hint="Freeform — used for search/filtering elsewhere on the storefront. Featured and Best Seller are set separately below.">
            {form.tags.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {form.tags.map((t) => <span key={t} className="admin-badge" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                {t}
                <button type="button" onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`} style={{ display: "inline-flex", background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit" }}><Icon name="close" size={11} /></button>
              </span>)}
            </div>}
            <div style={{ display: "flex", gap: 8 }}>
              <input id="tagInput" className="admin-input" list="tag-suggestions" placeholder="Type a tag and press Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={onTagInputKeyDown} />
              <datalist id="tag-suggestions">{TAG_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
              <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => addTag()}>Add</button>
            </div>
          </FormField>
        </div></div>

        <div className="admin-form-section"><h3>Homepage curation</h3><p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginTop: -4 }}>Featured and Best Sellers are admin-picked rails on the homepage. New Arrivals and Discounted are fully automatic and need no input here.</p>
          <div className="admin-form-grid">
            <FormField label="Featured" htmlFor="isFeatured">
              <StatusToggle active={form.isFeatured} onChange={(v) => set("isFeatured", v)} labels={{ on: "Featured", off: "Not featured" }} />
            </FormField>
            <FormField label="Featured order" htmlFor="homepageFeaturedOrder" hint={form.isFeatured ? "Lower shows first. Leave blank to auto-assign the next slot." : "Enable Featured to set an order."}>
              <input id="homepageFeaturedOrder" type="number" min="0" className="admin-input" disabled={!form.isFeatured} placeholder="auto" value={form.homepageFeaturedOrder} onChange={(e) => set("homepageFeaturedOrder", e.target.value)} />
            </FormField>
            <FormField label="Best Seller" htmlFor="isBestSeller">
              <StatusToggle active={form.isBestSeller} onChange={(v) => set("isBestSeller", v)} labels={{ on: "Best Seller", off: "Not a best seller" }} />
            </FormField>
            <FormField label="Best Seller order" htmlFor="homepageBestSellerOrder" hint={form.isBestSeller ? "Lower shows first. Leave blank to auto-assign the next slot." : "Enable Best Seller to set an order."}>
              <input id="homepageBestSellerOrder" type="number" min="0" className="admin-input" disabled={!form.isBestSeller} placeholder="auto" value={form.homepageBestSellerOrder} onChange={(e) => set("homepageBestSellerOrder", e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="admin-form-section"><h3>Pricing &amp; stock</h3><div className="admin-form-grid">
          <FormField label="Price (₹)" htmlFor="price" required><input id="price" type="number" min="0" className="admin-input" value={form.price} onChange={(e) => set("price", e.target.value)} /></FormField>
          <FormField label="MRP (₹)" htmlFor="mrp"><input id="mrp" type="number" min="0" className="admin-input" value={form.mrp} onChange={(e) => set("mrp", e.target.value)} /></FormField>
          <FormField label="Stock quantity" htmlFor="stockQty"><input id="stockQty" type="number" min="0" className="admin-input" value={form.stockQty} onChange={(e) => set("stockQty", e.target.value)} /></FormField>
          <FormField label="Visibility" htmlFor="status"><select id="status" className="admin-select" value={form.status} onChange={(e) => set("status", e.target.value)}><option value="active">Active (visible on storefront)</option><option value="inactive">Inactive (hidden)</option></select></FormField>
        </div></div>

        <div className="admin-form-section"><h3>Product images</h3><p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginTop: -4 }}>JPEG, PNG, WEBP or GIF · 5 MB max each · 100×100 to 6000×6000 pixels · up to 12 images.</p>
          {(form.images.length + localPreviews.length) > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12, margin: "14px 0" }}>
            {form.images.map((image, index) => <div key={image.id || image.url} style={{ border: "1px solid var(--admin-border)", borderRadius: 10, padding: 8 }}>
              <img src={image.url} alt={`${form.name} ${index + 1}`} style={{ width: "100%", aspectRatio: "1", objectFit: "contain", borderRadius: 7, background: "var(--admin-surface)" }} />
              <div style={{ display: "flex", gap: 6, marginTop: 7 }}><button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" disabled={uploading || saving} onClick={() => replaceImage(image)}>Replace</button><button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" disabled={uploading || saving} onClick={() => removeImage(image)}>Delete</button></div>
            </div>)}
            {localPreviews.map((preview, index) => <div key={`${preview.file.name}-${index}`} style={{ border: "1px dashed var(--admin-border)", borderRadius: 10, padding: 8 }}><img src={preview.url} alt="Pending upload" style={{ width: "100%", aspectRatio: "1", objectFit: "contain", borderRadius: 7 }} /><div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 7, fontSize: 11 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.file.name}</span><button type="button" className="admin-icon-btn admin-icon-btn--danger" onClick={() => removePending(index)} aria-label="Remove pending image"><Icon name="close" size={13} /></button></div></div>)}
          </div>}
          <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={addFiles} style={{ display: "none" }} />
          <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" disabled={uploading || saving || form.images.length + pendingFiles.length >= MAX_IMAGES} onClick={() => fileInputRef.current?.click()}><Icon name="upload" size={13} /> Add images</button>
          {uploading && <div style={{ marginTop: 10 }}><div style={{ height: 6, background: "var(--admin-border)", borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${uploadProgress}%`, height: "100%", background: "var(--admin-accent)", transition: "width .15s" }} /></div><div style={{ fontSize: 11.5, marginTop: 5 }}>Uploading… {uploadProgress}%</div></div>}
          {mediaError && <div style={{ color: "var(--admin-danger)", fontSize: 12.5, marginTop: 10 }}>{mediaError}</div>}
        </div>

        <div className="admin-form-section"><h3>Media &amp; description</h3><div className="admin-form-grid">
          <FormField label="Short description" htmlFor="shortDescription" full hint="Plain text — used in listing cards, search results, and SEO snippets."><textarea id="shortDescription" className="admin-textarea" style={{ minHeight: 56 }} value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} /></FormField>
          <FormField label="Full description" htmlFor="description" full hint="Shown on the product page. Format text and drop in full-size images — they'll display at full page width on the storefront.">
            <RichTextEditor value={form.description} onChange={(html) => set("description", html)} />
          </FormField>
        </div></div>

        <div className="admin-form-section"><h3>Highlights</h3>{form.highlights.map((h, i) => <div className="admin-dyn-row" key={i}><input className="admin-input" value={h} onChange={(e) => setHighlight(i, e.target.value)} placeholder="e.g. 8,192 pressure levels with tilt recognition" /><button type="button" className="admin-icon-btn admin-icon-btn--danger" onClick={() => removeHighlight(i)} aria-label="Remove highlight"><Icon name="close" size={13} /></button></div>)}<button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={addHighlight}><Icon name="plus" size={13} /> Add highlight</button></div>

        <div className="admin-form-section"><h3>Specifications</h3>{form.specs.map((s, i) => <div className="admin-dyn-row" key={i}><input className="admin-input" style={{ maxWidth: 180 }} value={s.label} onChange={(e) => setSpec(i, "label", e.target.value)} placeholder="Label" /><input className="admin-input" value={s.value} onChange={(e) => setSpec(i, "value", e.target.value)} placeholder="Value" /><button type="button" className="admin-icon-btn admin-icon-btn--danger" onClick={() => removeSpec(i)} aria-label="Remove spec"><Icon name="close" size={13} /></button></div>)}<button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={addSpec}><Icon name="plus" size={13} /> Add spec</button></div>

        <div className="admin-form-section"><h3>Download links</h3><p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginTop: -4 }}>Link out to drivers, manuals, or setup guides hosted on the manufacturer's own website — shown on this product's page. Leave empty if none apply.</p>{form.downloadLinks.map((d, i) => <div className="admin-dyn-row" key={i}><input className="admin-input" style={{ maxWidth: 220 }} value={d.label} onChange={(e) => setDownloadLink(i, "label", e.target.value)} placeholder="Label, e.g. Driver (Windows/Mac)" /><input className="admin-input" type="url" value={d.url} onChange={(e) => setDownloadLink(i, "url", e.target.value)} placeholder="https://manufacturer.com/downloads/driver.exe" /><button type="button" className="admin-icon-btn admin-icon-btn--danger" onClick={() => removeDownloadLink(i)} aria-label="Remove download link"><Icon name="close" size={13} /></button></div>)}<button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={addDownloadLink}><Icon name="plus" size={13} /> Add download link</button></div>

        <div className="admin-form-actions"><Link to={isEdit ? `/products/${id}` : "/products"} className="admin-btn admin-btn--ghost">Cancel</Link><button className="admin-btn admin-btn--primary" type="submit" disabled={saving || uploading}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}</button></div>
      </form>
    </div>
  </PermissionBoundary>
  );}
