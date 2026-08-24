import React, { useCallback, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Icon from "./Icon";
import { uploadDescriptionImage } from "../services/productsService";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Default TipTap Image extension has no size control, so an inserted
// photo always renders at its native pixel size (clamped only by
// max-width:100%) — great for a genuinely full-width hero shot, but it
// means a 6000px product photo and a small icon-sized screenshot both
// render "as big as the column allows" with no way to size one down.
// This adds a `width` attribute (a CSS percentage) admins can set from
// the floating toolbar below, stored right on the <img> as inline style
// so it round-trips through save/sanitize/render unchanged.
const ResizableImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        parseHTML: (element) => element.style.width || element.getAttribute("width") || "100%",
        renderHTML: (attributes) => ({ style: `width:${attributes.width};max-width:100%;height:auto;` }),
      },
    };
  },
});

const WIDTH_PRESETS = [
  { label: "Small", value: "33%" },
  { label: "Medium", value: "60%" },
  { label: "Large", value: "85%" },
  { label: "Full width", value: "100%" },
];

function ToolbarButton({ active, disabled, onClick, label, children }) {
  return (
    <button
      type="button"
      className="admin-rte-btn"
      data-active={active ? "true" : "false"}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

/**
 * RichTextEditor — WYSIWYG editor for the product "full description" field.
 * Renders full-width (matches the surrounding form field) and lets admins
 * insert headings, lists, links, and large full-size images directly into
 * the description, instead of the plain textarea this replaced. Images
 * are uploaded immediately via POST /products/description-images (works
 * even before a product has been saved/has an id) and inserted by URL —
 * the editor's stored value is the resulting HTML string.
 */
export default function RichTextEditor({ value, onChange, placeholder = "Write a full, detailed description…" }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      ResizableImage.configure({ HTMLAttributes: { style: "max-width:100%;height:auto;" } }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ["paragraph"] }),
    ],
    content: value || "",
    editorProps: {
      attributes: { class: "admin-rte-content", "data-placeholder": placeholder },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML() === "<p></p>" ? "" : e.getHTML()),
  });

  const insertImage = useCallback(
    async (file) => {
      if (!editor) return;
      if (!ALLOWED_TYPES.has(file.type)) return setError("Only JPEG, PNG, WEBP, or GIF images are allowed.");
      if (file.size > MAX_IMAGE_SIZE) return setError("Each image must be 5 MB or smaller.");
      setError("");
      setUploading(true);
      try {
        const { url } = await uploadDescriptionImage(file);
        editor.chain().focus().setImage({ src: url, alt: "" }).run();
      } catch (err) {
        setError(err.message || "Image upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [editor]
  );

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (file) insertImage(file);
    e.target.value = "";
  }

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL", previous);
    if (url === null) return;
    if (url === "") return editor.chain().focus().extendMarkRange("link").unsetLink().run();
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  const imageSelected = editor?.isActive("image") ?? false;
  const activeWidth = editor?.getAttributes("image")?.width || "100%";

  function setImageWidth(width) {
    editor?.chain().focus().updateAttributes("image", { width }).run();
  }

  function deleteSelectedImage() {
    editor?.chain().focus().deleteSelection().run();
  }

  if (!editor) return null;

  return (
    <div className="admin-rte">
      <div className="admin-rte-toolbar">
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Icon name="bold" size={14} /></ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Icon name="italic" size={14} /></ToolbarButton>
        <span className="admin-rte-sep" />
        <ToolbarButton label="Heading" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Icon name="heading" size={14} /></ToolbarButton>
        <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><Icon name="list" size={14} /></ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><Icon name="listOrdered" size={14} /></ToolbarButton>
        <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Icon name="quote" size={14} /></ToolbarButton>
        <span className="admin-rte-sep" />
        <ToolbarButton label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><Icon name="alignLeft" size={14} /></ToolbarButton>
        <ToolbarButton label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><Icon name="alignCenter" size={14} /></ToolbarButton>
        <span className="admin-rte-sep" />
        <ToolbarButton label="Link" active={editor.isActive("link")} onClick={setLink}><Icon name="link" size={14} /></ToolbarButton>
        <ToolbarButton label="Insert image" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <span className="admin-rte-spinner" /> : <Icon name="image" size={14} />}
        </ToolbarButton>
        <span className="admin-rte-sep" />
        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}><Icon name="undo2" size={14} /></ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}><Icon name="redo2" size={14} /></ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={onFileChange} />
      </div>
      <EditorContent editor={editor} />
      {imageSelected && (
        <div className="admin-rte-imgbar">
          <span className="admin-rte-imgbar__label">Image size</span>
          {WIDTH_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className="admin-rte-imgbar__btn"
              data-active={activeWidth === preset.value ? "true" : "false"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setImageWidth(preset.value)}
            >
              {preset.label}
            </button>
          ))}
          <span className="admin-rte-sep" />
          <button
            type="button"
            className="admin-rte-imgbar__btn admin-rte-imgbar__btn--danger"
            onMouseDown={(e) => e.preventDefault()}
            onClick={deleteSelectedImage}
          >
            <Icon name="trash" size={12} /> Remove
          </button>
        </div>
      )}
      <div className="admin-rte-footer">
        <span>Click an inserted image to resize or remove it. Large images may take a moment to upload.</span>
      </div>
      {error && <div style={{ color: "var(--admin-danger)", fontSize: 12.5, marginTop: 6 }}>{error}</div>}
    </div>
  );
}
