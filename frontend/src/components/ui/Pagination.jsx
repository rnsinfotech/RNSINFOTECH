import React from "react";
import Icon from "../Icon";

/**
 * Pagination — numbered pager with ellipsis collapsing for large page
 * counts. Purely controlled: pass `page` (1-indexed) and `onChange`.
 */
export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = getPageList(page, totalPages);

  function go(p) {
    if (p < 1 || p > totalPages || p === page) return;
    onChange(p);
  }

  return (
    <nav className="rns-pagination" aria-label="Pagination">
      <button
        type="button"
        className="rns-pagination__nav"
        onClick={() => go(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        <Icon name="chevron" size={14} className="rns-pagination__chev-left" />
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="rns-pagination__ellipsis" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`rns-pagination__num ${p === page ? "is-active" : ""}`}
            onClick={() => go(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Page ${p}`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        className="rns-pagination__nav"
        onClick={() => go(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        <Icon name="chevron" size={14} className="rns-pagination__chev-right" />
      </button>
    </nav>
  );
}

function getPageList(page, total) {
  const delta = 1;
  const range = [];
  const withDots = [];
  let last;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= page - delta && i <= page + delta)) {
      range.push(i);
    }
  }

  for (const i of range) {
    if (last) {
      if (i - last === 2) withDots.push(last + 1);
      else if (i - last > 2) withDots.push("…");
    }
    withDots.push(i);
    last = i;
  }

  return withDots;
}
