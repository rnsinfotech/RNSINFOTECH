import React, { useState } from "react";

/**
 * ProductGallery — main image + thumbnail strip for a product's `images`
 * array. Self-contained (owns its own active-index state) so any page
 * that has a product's `images` array can drop this in without wiring
 * up state itself. Supports mouse click and left/right arrow keys on
 * the thumbnail strip.
 */
export default function ProductGallery({ images, name }) {
  const [activeImage, setActiveImage] = useState(0);
  const safeImages = images && images.length ? images : [];

  function handleThumbKeyDown(e, i) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveImage((i + 1) % safeImages.length);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveImage((i - 1 + safeImages.length) % safeImages.length);
    }
  }

  return (
    <div>
      <div
        className="rns-card rns-pdp-mainimg"
        style={{
          aspectRatio: "1 / 1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: "var(--rns-bg-alt)",
        }}
      >
        {safeImages.length > 0 ? (
          <img
            src={safeImages[activeImage]}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <span style={{ color: "var(--rns-ink-faint)", fontSize: 13 }}>No image available</span>
        )}
      </div>

      {safeImages.length > 1 && (
        <div
          role="listbox"
          aria-label={`${name} images`}
          style={{ display: "flex", gap: 10, marginTop: 12 }}
        >
          {safeImages.map((img, i) => (
            <button
              key={i}
              type="button"
              role="option"
              aria-selected={activeImage === i}
              onClick={() => setActiveImage(i)}
              onKeyDown={(e) => handleThumbKeyDown(e, i)}
              aria-label={`Show image ${i + 1} of ${safeImages.length}`}
              style={{
                width: 68,
                height: 68,
                borderRadius: "var(--rns-r-sm)",
                border: `1px solid ${
                  activeImage === i ? "var(--rns-ink)" : "var(--rns-line)"
                }`,
                overflow: "hidden",
                padding: 0,
                background: "var(--rns-bg-alt)",
                flexShrink: 0,
                cursor: "pointer",
              }}
            >
              <img
                src={img}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
