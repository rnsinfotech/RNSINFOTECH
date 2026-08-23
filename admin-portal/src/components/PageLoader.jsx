import React from "react";

/**
 * PageLoader — the admin portal's equivalent of the storefront's
 * branded splash loader (frontend/src/components/PageLoader.jsx).
 * Kept as its own copy rather than a shared import since the two
 * apps are separate packages/builds, but the markup, class names,
 * and animation are intentionally identical so the brand moment
 * looks the same everywhere. Used for: route-level Suspense
 * fallbacks and the "checking admin session" gate in App.jsx.
 */
/**
 * PageLoader — the admin portal's equivalent of the storefront's
 * branded splash loader (frontend/src/components/PageLoader.jsx).
 * Kept as its own copy rather than a shared import since the two
 * apps are separate packages/builds, but the markup, class names,
 * and animation are intentionally identical so the brand moment
 * looks the same everywhere. Used for every full-page loading
 * moment: route-level Suspense fallbacks, the "checking admin
 * session" gate in App.jsx, and every per-page data fetch (dashboard
 * stats, list tables, detail pages, settings/content tabs). It's a
 * fixed full-viewport overlay everywhere it's used — genuinely waits
 * for the page's data to arrive rather than showing a small inline
 * spinner alongside stale/empty content.
 */
export default function PageLoader({ visible = true }) {
  return (
    <div
      className={`rns-splash-loader${visible ? "" : " rns-splash-loader--hide"}`}
      role="status"
      aria-live="polite"
      aria-label="Loading RNS INFOTECH admin portal"
    >
      <div className="rns-splash-loader__mark">
        <img src="/assets/rns_logo.jpg" alt="" className="rns-splash-loader__logo" />
      </div>

      <style>{`
        .rns-splash-loader {
          position: fixed;
          inset: 0;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--admin-bg);
          opacity: 1;
          visibility: visible;
          transition: opacity 0.4s ease, visibility 0s linear 0s;
        }
        .rns-splash-loader--hide {
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.4s ease, visibility 0s linear 0.4s;
          pointer-events: none;
        }
        .rns-splash-loader__mark {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 20px;
          padding: 14px;
        }
        .rns-splash-loader__logo {
          height: 68px;
          width: auto;
          display: block;
          border-radius: 10px;
          animation: rns-loader-pulse 1.1s ease-in-out infinite;
        }
        @keyframes rns-loader-pulse {
          0%, 100% { transform: scale(0.92); opacity: 0.55; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rns-splash-loader__logo { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
