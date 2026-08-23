import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import SEO from "./components/SEO";
import Breadcrumbs, { buildBreadcrumbJsonLd } from "./components/ui/Breadcrumbs";
import { EmptyState, ErrorState } from "./components/ui/Stateviews";

import { nav, footer } from "./data/siteData";
import { getBlogContent, getBlogPostContent } from "./lib/contentApi";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

function RelatedPostCard({ post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="rns-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, color: "inherit" }}>
      <img
        src={post.coverImage}
        alt=""
        style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "var(--rns-bg-alt)" }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            lineHeight: 1.35,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {post.title}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--rns-ink-faint)", marginTop: 4 }}>{post.readTime}</div>
      </div>
    </Link>
  );
}

/**
 * BlogPostPage — full post view keyed by :slug. Related posts prefer
 * same-category posts (mirrors ProductDetailPage's related-products
 * logic) and fall back to "everything else" if the category is too
 * small to fill the row, so the section never renders empty/sparse.
 */
export default function BlogPostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [blogPosts, setBlogPosts] = useState([]);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([getBlogPostContent(slug), getBlogContent()]).then(([nextPost, posts]) => {
      if (!ignore) { setLoadError(null); setPost(nextPost); setBlogPosts(posts); }
    }).catch((error) => { if (!ignore) { setLoadError(error); setPost(null); } });
    return () => { ignore = true; };
  }, [slug]);

  const related = useMemo(() => {
    if (!post) return [];
    const sameCategory = blogPosts.filter((p) => p.slug !== post.slug && p.categoryId === post.categoryId);
    const rest = blogPosts.filter((p) => p.slug !== post.slug && p.categoryId !== post.categoryId);
    return [...sameCategory, ...rest].slice(0, 3);
  }, [post, blogPosts]);

  if (!post) {
    const notFound = loadError?.status === 404;
    return (
      <>
        <SEO title="Post not found" noindex />
        <AnnouncementBar />
        <Navbar {...nav} />
        <section className="rns-container" style={{ padding: "64px 24px" }}>
          {notFound ? <EmptyState icon="fileText" title="Post not found" message="This post may have been moved or removed." action={{ label: "Back to blog", href: "/blog" }} /> : <ErrorState message={loadError?.message} action={{ label: "Retry", onClick: () => window.location.reload() }} />}
        </section>
        <Footer logo={nav.logo} {...footer} />
      </>
    );
  }

  const breadcrumbItems = [{ label: "Blog", href: "/blog" }, { label: post.title }];
  const { "@context": _c, ...breadcrumbJsonLdNoContext } = buildBreadcrumbJsonLd(breadcrumbItems);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: post.title,
        description: post.excerpt,
        image: post.coverImage,
        author: { "@type": "Organization", name: post.author },
        datePublished: post.date,
      },
      breadcrumbJsonLdNoContext,
    ],
  };

  return (
    <>
      <SEO title={post.title} description={post.excerpt} image={post.coverImage} jsonLd={jsonLd} />
      <AnnouncementBar />
      <Navbar {...nav} />

      <div className="rns-container" style={{ paddingTop: 22 }}>
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <section className="rns-container" style={{ paddingTop: 16, paddingBottom: 8 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
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
          <h1 style={{ marginTop: 10, fontSize: "clamp(26px, 3.4vw, 36px)", lineHeight: 1.25 }}>{post.title}</h1>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--rns-ink-faint)",
            }}
          >
            <span>{post.author}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(post.date)}</span>
            <span aria-hidden="true">·</span>
            <span>{post.readTime}</span>
          </div>

          <div
            style={{
              marginTop: 24,
              aspectRatio: "16 / 9",
              borderRadius: 14,
              overflow: "hidden",
              background: "var(--rns-bg-alt)",
            }}
          >
            <img src={post.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>

          <div style={{ marginTop: 28, display: "grid", gap: 18 }}>
            {post.content.map((para, i) => (
              <p key={i} style={{ fontSize: 15, lineHeight: 1.75, color: "var(--rns-ink-soft)" }}>
                {para}
              </p>
            ))}
          </div>

          <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--rns-line)" }}>
            <Link to="/blog" className="rns-btn rns-btn--ghost">
              <Icon name="chevron" size={14} style={{ transform: "rotate(90deg)" }} />
              Back to all posts
            </Link>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="rns-section rns-section--alt">
          <div className="rns-container">
            <span className="rns-eyebrow">Keep reading</span>
            <h2 className="rns-section-title" style={{ marginTop: 8 }}>
              More from the blog
            </h2>
            <div
              style={{
                marginTop: 24,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 14,
              }}
            >
              {related.map((p) => (
                <RelatedPostCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
