import PermissionBoundary from "../../components/PermissionBoundary";
import React, { useState } from "react";
import FaqsTab from "./FaqsTab";
import PoliciesTab from "./PoliciesTab";
import BlogTab from "./BlogTab";

const TABS = [
  { value: "faqs", label: "FAQs" },
  { value: "policies", label: "Legal & policies" },
  { value: "blog", label: "Blog" },
];

/**
 * ContentPage — FAQs, legal/policy pages and blog posts. Data persistence
 * is provided by the backend content service while the existing admin UI
 * remains unchanged.
 */
export default function ContentPage() {
  const [tab, setTab] = useState("faqs");

  return (
    <PermissionBoundary permission="content.write"><div>
      <div className="admin-page-header">
        <div>
          <h1>Content</h1>
          <p>Manage FAQs, legal pages, and blog posts shown on the storefront.</p>
        </div>
      </div>

      <div className="admin-segmented" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`admin-segmented__btn${tab === t.value ? " is-active" : ""}`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "faqs" && <FaqsTab />}
      {tab === "policies" && <PoliciesTab />}
      {tab === "blog" && <BlogTab />}
    </div>
  </PermissionBoundary>
  );}
