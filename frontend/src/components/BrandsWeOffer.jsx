import React, { useState } from "react";
import { Link } from "react-router-dom";
import { SectionHeader } from "./SectionHeader";
import Reveal from "./ui/Reveal";

function BrandLogo({ name, logo }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      to={`/products?brand=${encodeURIComponent(name)}`}
      className="rns-card"
      aria-label={`Shop ${name} products`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "14px 24px",
        background: "var(--rns-bg)",
        height: "120px",
      }}
    >
      {logo && !imgFailed ? (
        <img
          src={logo}
          alt={`${name} logo`}
          loading="lazy"
          onError={() => setImgFailed(true)}
          style={{
            maxHeight: 56,
            maxWidth: "80%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
          }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div
            style={{
              height: 40,
              width: 40,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--rns-ink-soft)",
              color: "var(--rns-bg)",
              fontFamily: "var(--rns-font-display)",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {initials}
          </div>
          <div style={{ fontSize: 12, color: "var(--rns-ink-soft)", fontWeight: 500 }}>{name}</div>
        </div>
      )}
    </Link>
  );
}

export default function BrandsWeOffer({ brands }) {
  return (
    <section id="brands" className="rns-section rns-section--alt">
      <div className="rns-container">
        <SectionHeader eyebrow="Authorized reseller" title="Brands we offer" />
        <div
          className="rns-grid"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 14,
          }}
        >
          {brands.map((b, i) => (
            <Reveal key={b.name} delay={Math.min(i, 3)}>
              <BrandLogo name={b.name} logo={b.logo} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
