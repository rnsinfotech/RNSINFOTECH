import React, { useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import { createBlogPost, updateBlogPost } from "../../services/contentService";

const CATEGORY_OPTIONS = [
  { id: "pen-displays", label: "Pen Displays" },
  { id: "pen-tablets", label: "Pen Tablets" },
  { id: "stylus", label: "Stylus & Pens" },
  { id: "accessories", label: "Accessories" },
];

export default function BlogFormModal({ post, onClose, onSaved }) {
  const isEdit = Boolean(post);
  const [form, setForm] = useState({
    title: post?.title || "",
    slug: post?.slug || "",
    excerpt: post?.excerpt || "",
    coverImage: post?.coverImage || "",
    categoryId: post?.categoryId || CATEGORY_OPTIONS[0].id,
    author: post?.author || "RNS Editorial",
    date: post?.date || new Date().toISOString().slice(0, 10),
    readTime: post?.readTime || "3 min read",
    status: post?.status || "draft",
    contentText: (post?.content || []).join("\n\n"),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Title is required.");
    if (!form.excerpt.trim()) return setError("Excerpt is required.");

    const category = CATEGORY_OPTIONS.find((c) => c.id === form.categoryId);
    const payload = {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt,
      coverImage: form.coverImage,
      categoryId: form.categoryId,
      category: category?.label || "",
      author: form.author,
      date: form.date,
      publicationDate: form.date ? `${form.date}T00:00:00.000Z` : null,
      image: form.coverImage,
      readTime: form.readTime,
      status: form.status,
      content: form.contentText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateBlogPost(post.id, payload);
        onSaved("Post updated");
      } else {
        await createBlogPost(payload);
        onSaved("Post created");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 620, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>{isEdit ? "Edit post" : "Add post"}</h3>

        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                background: "var(--admin-danger-tint)",
                color: "var(--admin-danger)",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12.5,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
            <FormField label="Title" htmlFor="blog-title" required>
              <input id="blog-title" className="admin-input" value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />
            </FormField>

            {isEdit && (
              <FormField label="Slug" htmlFor="blog-slug" hint="URL slug — not editable after creation.">
                <input id="blog-slug" className="admin-input" value={form.slug} disabled />
              </FormField>
            )}

            <FormField label="Excerpt" htmlFor="blog-excerpt" required>
              <textarea id="blog-excerpt" className="admin-input" rows={2} value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
            </FormField>

            <FormField label="Cover image URL" htmlFor="blog-cover" hint="Path under /assets, or any image URL.">
              <input id="blog-cover" className="admin-input" value={form.coverImage} onChange={(e) => set("coverImage", e.target.value)} />
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormField label="Category" htmlFor="blog-category">
                <select id="blog-category" className="admin-select" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status" htmlFor="blog-status">
                <select id="blog-status" className="admin-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <FormField label="Author" htmlFor="blog-author">
                <input id="blog-author" className="admin-input" value={form.author} onChange={(e) => set("author", e.target.value)} />
              </FormField>
              <FormField label="Publication date" htmlFor="blog-date">
                <input id="blog-date" type="date" className="admin-input" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </FormField>
              <FormField label="Read time" htmlFor="blog-readtime">
                <input id="blog-readtime" className="admin-input" value={form.readTime} onChange={(e) => set("readTime", e.target.value)} />
              </FormField>
            </div>

            <FormField label="Content" htmlFor="blog-content" hint="Separate paragraphs with a blank line.">
              <textarea
                id="blog-content"
                className="admin-input"
                rows={8}
                value={form.contentText}
                onChange={(e) => set("contentText", e.target.value)}
              />
            </FormField>
          </div>

          <div className="admin-modal__actions">
            <button className="admin-btn admin-btn--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
              <Icon name="check" size={14} />
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
