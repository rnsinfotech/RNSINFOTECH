import React from "react";

/**
 * PageLoader — full-viewport branded splash shown while the homepage's
 * backend-driven content (hero, banners, curated product rails) is still
 * loading. Sits on top of the page as a fixed overlay so the homepage
 * underneath can mount and fetch immediately; once `visible` flips to
 * false this just fades out and stops intercepting clicks, it never
 * unmounts abruptly mid-animation.
 */
export default function PageLoader({ visible = true }) {
  return (
    <div
      className={`rns-splash-loader${visible ? "" : " rns-splash-loader--hide"}`}
      role="status"
      aria-live="polite"
      aria-label="Loading RNS INFOTECH"
    >
      <div className="rns-splash-loader__mark">
        <img src="/rns_logo.jpg" alt="" className="rns-splash-loader__logo" />
      </div>

      <style>{`
        .rns-splash-loader {
          position: fixed;
          inset: 0;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--rns-bg);
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
