import React from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon";

/**
 * Breadcrumbs — trail of links, e.g. [{label:"Products", href:"/products"}, {label:"SketchDisplay 24"}]
 * (last item has no href and renders as the current page). Also
 * exports buildBreadcrumbJsonLd for SEO's structured-data prop.
 */
export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav className="rns-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to="/">Home</Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} aria-current={isLast ? "page" : undefined}>
              <Icon name="chevron" size={11} className="rns-breadcrumbs__sep" />
              {isLast || !item.href ? (
                <span>{item.label}</span>
              ) : (
                <Link to={item.href}>{item.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function buildBreadcrumbJsonLd(items = [], origin = window.location.origin) {
  const all = [{ label: "Home", href: "/" }, ...items];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: item.href ? origin + item.href : undefined,
    })),
  };
}
