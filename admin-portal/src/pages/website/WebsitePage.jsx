import PermissionBoundary from "../../components/PermissionBoundary";
import React, { useState } from "react";
import HomepageSettingsTab from "./HomepageSettingsTab";
import IconCardsListTab from "./IconCardsListTab";
import TestimonialsTab from "./TestimonialsTab";
import FlashMessagesTab from "./FlashMessagesTab";
import {
  getWhyChooseUs,
  createWhyChooseUs,
  updateWhyChooseUs,
  deleteWhyChooseUs,
  getSolutions,
  createSolution,
  updateSolution,
  deleteSolution,
} from "../../services/websiteService";

const whyChooseUsAdapter = {
  list: getWhyChooseUs,
  create: createWhyChooseUs,
  update: updateWhyChooseUs,
  remove: deleteWhyChooseUs,
};

const solutionsAdapter = {
  list: getSolutions,
  create: createSolution,
  update: updateSolution,
  remove: deleteSolution,
};

const TABS = [
  { value: "flash-messages", label: "Flash messages" },
  { value: "homepage", label: "Homepage" },
  { value: "why-choose-us", label: "Why choose us" },
  { value: "solutions", label: "Solutions" },
  { value: "testimonials", label: "Testimonials" },
];

/**
 * WebsitePage — Phase 7 (+ later addition). Manages everything that
 * renders outside the product catalogue on the storefront (all now
 * fetched live from GET /website / /flash-messages, not read from a
 * static file): the rotating flash-message strip (see
 * services/flashMessagesService.js), hero + promo banner (one-of-a-kind —
 * a settings singleton, see services/websiteService.js's getSettings/
 * updateSettingsSection), plus the Why choose us / Solutions /
 * Testimonials lists. Featured categories are NOT here — those already
 * belong to the Categories domain (Phase 2). FAQs are Phase 8 (Content),
 * per navConfig.js's descriptions.
 *
 * Cross-origin note: same caveat as every prior phase (Orders/Payments/
 * Chat) — the Admin Portal is a separate origin from the storefront, so
 * these edits persist admin-side only for now. See HANDOFF.md's Phase 7
 * notes for the full reasoning.
 */
export default function WebsitePage() {
  const [tab, setTab] = useState("flash-messages");

  return (
    <PermissionBoundary permission="website.write"><div>
      <div className="admin-page-header">
        <div>
          <h1>Website management</h1>
          <p>Edit the content sections shown on the storefront homepage.</p>
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

      {tab === "flash-messages" && <FlashMessagesTab />}
      {tab === "homepage" && <HomepageSettingsTab />}
      {tab === "why-choose-us" && (
        <IconCardsListTab label="Why choose us" emptyIcon="shield" service={whyChooseUsAdapter} />
      )}
      {tab === "solutions" && <IconCardsListTab label="Solution" emptyIcon="chip" service={solutionsAdapter} />}
      {tab === "testimonials" && <TestimonialsTab />}
    </div>
  </PermissionBoundary>
  );}
