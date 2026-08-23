import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import SEO from "./components/SEO";
import { EmptyState, ErrorState } from "./components/ui/Stateviews";
import { useDebounce } from "./hooks/useDebounce";

import { nav, footer } from "./data/siteData";
import { getBlogContent } from "./lib/contentApi";
import { apiRequest } from "./lib/api";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

function PostCard({ post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="rns-card" style={{ display: "flex", flexDirection: "column", color: "inherit", height: "100%" }}>
      <div
        style={{
          aspectRatio: "16 / 9",
          background: "var(--rns-bg-alt)",
          borderBottom: "1px solid var(--rns-line)",
          borderRadius: "10px 10px 0 0",
          overflow: "hidden",
        }}
      >
        <img src={post.coverImage} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div
          style={{
            fontFamily: "var(--rns-font-mono)",
            fontSize: 11,
            color: "var(--rns-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          {post.category}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35, fontFamily: "var(--rns-font-display)" }}>{post.title}</div>
        <p style={{ fontSize: 13.5, color: "var(--rns-ink-soft)", lineHeight: 1.55, marginTop: 2 }}>{post.excerpt}</p>
        <div
          style={{
            marginTop: "auto",
            paddingTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--rns-ink-faint)",
          }}
        >
          <span>{formatDate(post.date)}</span>
          <span aria-hidden="true">·</span>
          <span>{post.readTime}</span>
        </div>
      </div>
    </Link>
  );
}

/**
 * BlogPage — card grid over published CMS posts with category
 * filter chips + a debounced title/excerpt search, matching the pattern
 * used by ProductsPage. Only 5 posts exist in this mock
 * dataset, so there's no pagination yet — add it back (Pagination
 * component, same PAGE_SIZE pattern as ProductsPage) once post count
 * grows past a page or two.
 */
export default function BlogPage() {
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogError, setBlogError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 250);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    getBlogContent().then(setBlogPosts).catch(setBlogError);
  }, []);

  useEffect(() => {
    let ignore = false;
    apiRequest("/categories")
      .then((res) => {
        if (!ignore) setCategories(res?.items || []);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const filters = useMemo(
    () => [
      { id: "all", label: "All posts" },
      ...categories.map((c) => ({ id: c.slug || c._id, label: c.name })),
      { id: "guides", label: "Guides" },
    ],
    [categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return blogPosts.filter((p) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "guides" ? p.categoryId === null : p.categoryId === activeFilter);
      const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, search, blogPosts]);

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "RNS INFOTECH Blog",
      description: "Buying guides and setup tips for pen tablets, pen displays, and stylus hardware.",
      blogPost: blogPosts.map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        description: p.excerpt,
        image: typeof window !== "undefined" ? window.location.origin + p.coverImage : p.coverImage,
        datePublished: p.date,
        author: { "@type": "Organization", name: p.author },
        url: typeof window !== "undefined" ? `${window.location.origin}/blog/${p.slug}` : `/blog/${p.slug}`,
      })),
    }),
    [blogPosts]
  );

  return (
    <>
      <SEO
        title="Blog"
        description="Buying guides and setup tips for pen tablets, pen displays, and stylus hardware from RNS INFOTECH."
        jsonLd={jsonLd}
      />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">From the team</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            Blog
          </h1>
          <p style={{ marginTop: 10, fontSize: 14, color: "var(--rns-ink-soft)", maxWidth: 560 }}>
            Buying guides, setup tips, and care advice for pen displays, pen tablets, and stylus hardware.
          </p>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`rns-tag ${activeFilter === f.id ? "rns-tag--live" : ""}`}
                style={{ cursor: "pointer", border: "1px solid var(--rns-line)" }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#fff",
              border: "1px solid var(--rns-line-strong)",
              borderRadius: 20,
              padding: "8px 14px",
              minWidth: 240,
            }}
          >
            <Icon name="search" size={15} style={{ color: "var(--rns-ink-faint)", flexShrink: 0 }} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search posts..."
              aria-label="Search blog posts"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, fontFamily: "var(--rns-font-body)", background: "transparent" }}
            />
          </div>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 64 }}>
        {filtered.length === 0 ? (
          blogError ? <ErrorState message={blogError.message} action={{ label: "Retry", onClick: () => window.location.reload() }} /> : <EmptyState icon="fileText" title="No posts match that search" message="Try a different category or search term." />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            {filtered.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </section>

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
