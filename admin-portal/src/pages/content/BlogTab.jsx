import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import { STATUS_TONE, statusLabel } from "../../utils/format";
import BlogFormModal from "./BlogFormModal";
import { getBlogPosts, deleteBlogPost, previewBlogPost } from "../../services/contentService";
import ContentPreviewModal from "./ContentPreviewModal";
import PageLoader from "../../components/PageLoader";

export default function BlogTab() {
  const { toast, showToast, clearToast } = useToast();
  const [posts, setPosts] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [preview, setPreview] = useState(null);

  async function load() {
    setPosts(await getBlogPosts());
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(post) {
    setEditing(post);
    setShowForm(true);
  }
  function handleSaved(message) {
    setShowForm(false);
    showToast(message);
    load();
  }
  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteBlogPost(pendingDelete.id);
    setPendingDelete(null);
    showToast(`Deleted "${pendingDelete.title}"`);
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button className="admin-btn admin-btn--primary" type="button" onClick={openAdd}>
          <Icon name="plus" size={15} />
          Add post
        </button>
      </div>

      {posts === null ? (
        <PageLoader />
      ) : posts.length === 0 ? (
        <EmptyState icon="fileText" title="No posts yet" description="Add your first blog post." />
      ) : (
        <div className="admin-card" style={{ padding: 0 }}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Category</th>
                  <th>Author</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="admin-table__title-cell">
                        {p.coverImage && (
                          <img className="admin-table__thumb" src={p.coverImage} alt="" onError={(e) => (e.target.style.visibility = "hidden")} />
                        )}
                        <div>
                          <div className="admin-table__title-main">{p.title}</div>
                          <div style={{ fontSize: 12, color: "var(--admin-ink-faint)" }}>{p.excerpt}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.category}</td>
                    <td>{p.author}</td>
                    <td>{p.date}</td>
                    <td>
                      <Badge tone={STATUS_TONE[p.status]}>{statusLabel(p.status)}</Badge>
                    </td>
                    <td>
                      <div className="admin-table__actions">
                        <button className="admin-icon-btn" type="button" aria-label="Preview" onClick={async () => setPreview(await previewBlogPost(p.id))}>
                          <Icon name="search" size={14} />
                        </button>
                        <button className="admin-icon-btn" type="button" aria-label="Edit" onClick={() => openEdit(p)}>
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          className="admin-icon-btn admin-icon-btn--danger"
                          type="button"
                          aria-label="Delete"
                          onClick={() => setPendingDelete(p)}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <BlogFormModal post={editing} onClose={() => setShowForm(false)} onSaved={handleSaved} />}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this post?"
        description={pendingDelete ? `"${pendingDelete.title}" will be permanently removed.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      {preview && <ContentPreviewModal type="blog" item={preview} onClose={() => setPreview(null)} />}
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  );
}
