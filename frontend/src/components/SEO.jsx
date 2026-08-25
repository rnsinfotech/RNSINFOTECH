import { useEffect } from "react";

const SITE_NAME = "RNS INFOTECH";
const DEFAULT_DESCRIPTION =
  "RNS INFOTECH is an authorized dealer of pen tablets, pen displays, and stylus hardware for artists, designers, and creators, with genuine warranty support.";
const DEFAULT_IMAGE = "/rns_logo.jpg";

function setMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(id, data) {
  let el = document.getElementById(id);
  if (!data) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/**
 * SEO — sets document title, meta description/OG/Twitter tags, canonical
 * link, and an optional JSON-LD block for the current page. No external
 * dependency (no react-helmet) — plain DOM writes on mount/update, which
 * is all a client-rendered SPA needs for correct tab titles and share
 * previews. Drop one <SEO ... /> near the top of every page component.
 */
export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  noindex = false,
  jsonLd,
}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Pen Tablets, Displays & Stylus Hardware`;
    document.title = fullTitle;

    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:image", image);
    setMeta("property", "og:url", window.location.href);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);
    setLink("canonical", window.location.origin + window.location.pathname);
    setJsonLd("rns-jsonld", jsonLd || null);
  }, [title, description, image, noindex, jsonLd]);

  return null;
}