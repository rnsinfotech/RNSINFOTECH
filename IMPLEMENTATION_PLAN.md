# Specifications: label/value → plain string array

## Goal
Change product `specifications` from a labeled key/value structure
(`{ "Active Area": "10 x 6 in" }` on the backend, `{ label, value }` rows
in the UI) to a simple array of description strings
(`["10 x 6 in active area", "8,192 pressure levels"]`) — same shape as
the existing `highlights` and `packageContents` fields.

## Decisions locked in before implementation
- **Compare page**: specs will be shown as a plain bullet list per product
  (no more row-by-row alignment by label — that mechanism is removed).
- **Existing data migration**: for products that already have label/value
  specs saved, the migration keeps the *value* and drops the *label*
  (e.g. `{ "Active Area": "10 x 6 in" }` → `"10 x 6 in"`).

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Backend data layer: Mongoose models (both backends), Zod validators, DB migration script | ✅ Done |
| 2 | Admin portal: product form, product detail view, productsService normalize/payload, existing tests | ✅ Done |
| 3 | Storefront frontend: normalizeProduct, product detail page, Compare page | ✅ Done |
| 4 | Backend tests + seed data + final repo-wide sweep and verification | ✅ Done |

Each phase below is recorded with exactly what changed, so this file is a
running log — read top to bottom for full history, or jump to the latest
phase for current status.

---

## Phase 1 — Backend data layer

**Files changed:**
- `admin-backend/src/models/Product.js` — `specifications` field changed
  from `{ type: Map, of: String, default: {} }` to
  `{ type: [{ type: String, trim: true, maxlength: 200 }], default: [] }`
  (same shape/cap pattern as `highlights`).
- `storefront-backend/src/models/Product.js` — same change (this backend's
  schema is a read-only mirror of admin-backend's, per its existing
  comments).
- `admin-backend/src/validators/product.validators.js` — both the create
  schema (`productCreateSchema`) and update schema (`productUpdateSchema`)
  changed `specifications: z.record(z.string(), z.string())` to
  `specifications: z.array(z.string().trim().min(1).max(200)).max(20)`,
  matching the existing `highlights` validator line for line.

**New file:**
- `admin-backend/scripts/migrateSpecificationsToArray.js` — a one-time,
  idempotent migration script. Admin-backend and storefront-backend share
  one MongoDB `products` collection (same `MONGO_URI`, same collection
  name), so this single script covers both. For every product document it:
  - if `specifications` is a Map/object (the old shape), converts it to
    an array of just the values (labels dropped, per the locked-in
    decision above), skipping empty/blank values;
  - if `specifications` is already an array, leaves it untouched;
  - runs with `bypassDocumentValidation` off (relies on Mongoose casting)
    and logs a per-document before/after count plus a final summary.
  Run with `node scripts/migrateSpecificationsToArray.js` from
  `admin-backend/` once the new schema is deployed.

**Why this order:** the data layer has to land first — the migration
script and the new schema shape are what every later phase (admin UI,
storefront UI) will assume is already true of the data coming back from
the API.

**Not yet done at the end of Phase 1:** admin portal form/detail/service,
storefront frontend, Compare page, existing test files that still
reference `label`/`value` — none of those were touched yet, so the admin
portal and storefront would not build correctly against this schema until
Phase 2 and Phase 3 land. That zip was a backend-only checkpoint.

---

## Phase 2 — Admin portal

**Files changed:**
- `admin-portal/src/services/productsService.js` — `normalizeProduct`
  no longer converts `product.specifications` from a Map-turned-object
  into `{ label, value }` rows; it now just passes the backend's array
  straight through as `specs` (identical treatment to `highlights`). The
  old comment about the Map-serialization bug is removed since the
  Map is gone. `toApiPayload` no longer folds `data.specs` into an
  object keyed by label — it sends the array of strings as
  `specifications` directly.
- `admin-portal/src/pages/products/ProductFormPage.jsx` — the `specs`
  field in the blank form state changed from `[{ label: "", value: "" }]`
  to `[""]`. `setSpec`/`addSpec`/`removeSpec` now manage a plain string
  array (`setSpec(i, value)` instead of `setSpec(i, key, value)`). The
  submit handler trims/filters `specs` the same way `highlights` already
  was. The Specifications form section now renders one text input per
  spec (placeholder `"e.g. 10 x 6 in active area"`) instead of a
  label/value input pair.
- `admin-portal/src/pages/products/ProductDetailPage.jsx` — the
  Specifications card now renders `product.specs` as a plain bulleted
  list, matching the existing Highlights/Package contents cards exactly
  (same inline list styling), instead of the two-column label/value rows
  it used before.
- `admin-portal/src/test/productsService.test.js` — added a new
  `describe` block with 3 tests covering the new behavior:
  `normalizeProduct` passes the specifications array straight through,
  defaults to `[]` when missing, and `createProduct` sends the specs
  array unchanged as `specifications` in the request body. The existing
  tests already passed `specs: []`, which needed no changes since an
  empty array is valid under both the old and new shape.

**Verification:** the repo's `vitest` dev dependency wasn't present in
the uploaded `node_modules`, so the new tests couldn't be executed in
this environment — they were written and reviewed against the existing
test patterns in the same file, but you should run
`npm run test` (or `npx vitest run`) inside `admin-portal/` yourself
before merging to confirm they pass.

**Not yet done at the end of Phase 2:** the storefront frontend
(`frontend/`) still expects the old label/value shape in
`normalizeProduct`, `ProductDetailPage.jsx`, and `ComparePage.jsx` — the
public storefront will not render specs correctly until Phase 3.
Backend test suites (`admin-backend/tests`, `storefront-backend/tests`)
and seed scripts haven't been checked yet either — that's Phase 4.

---

## Phase 3 — Storefront frontend

**Files changed:**
- `frontend/src/lib/api.js` — `normalizeProduct` no longer converts
  `product.specifications` into `{ label, value }` rows; `specs` is now
  just the backend's array passed straight through, identical to how
  `highlights` is handled.
- `frontend/src/ProductDetailPage.jsx` — the Specifications tab panel now
  renders each entry as a plain string (`<span>{s}</span>`) instead of
  `<strong>{s.label}:</strong> {s.value}`. The list `key` changed from
  `s.label || i` to `i` since there's no label to key on anymore. The
  tab's own visibility check (`specs.length > 0`) and the destructuring
  of `specs` off `product` needed no changes — neither assumed the old
  shape.
- `frontend/src/ComparePage.jsx` — **this is the one place the label
  removal changes actual product behavior, not just plumbing.** The old
  Compare page built a union of every compared product's spec *labels*
  and rendered one table row per label, aligning each product's value
  for that label into the matching column — e.g. an "Active Area" row
  showing both tablets' active areas side by side. With specs now
  unlabeled, there's no key left to align rows on, so per your decision
  this page now shows a **single "Specifications" row** where each
  product's column lists that product's specs as a plain bulleted list,
  instead of one row per matched label. Concretely: the `specLabels`
  memo and `specValue()` helper (which searched a row's specs by label)
  were removed, replaced by a `hasAnySpecs` check and a single row that
  renders `r.specs` as a `<ul>` per product.

**Design trade-off worth knowing about:** you no longer get row-by-row
alignment on the Compare page (e.g. instantly seeing two tablets'
"Active Area" values on the same line) — you get each product's full
spec list stacked in its own column, which the person compares by eye.
This was the explicit choice you made over the alternative of dropping
specs from Compare entirely, or keeping a fragile position-based
alignment.

**Not yet done at the end of Phase 3:** `admin-backend/tests` and
`storefront-backend/tests` haven't been checked for stale label/value
spec assertions, and the seed scripts / any other repo-wide references
haven't had a final sweep — that's Phase 4, the last phase.

---

## Phase 4 — Backend tests, seed data, final repo-wide sweep

**Checked, no changes needed:**
- `admin-backend/tests/*.js` and `storefront-backend/tests/*.js` — grepped
  for any `specification`/`specs` reference; there are none. Neither
  backend's test suite ever exercised the `specifications` field, so
  there was nothing there to break or update.
- `admin-backend/scripts/seedCmsContent.js` — its one match for
  "specifications" is a sentence of returns-policy copy text ("Please
  check specifications and compatibility carefully before ordering."),
  unrelated to the product field. Left as-is.
- `admin-backend/scripts/seedBusinessContent.js` — no product-spec data;
  seeds brands, flash messages, and site settings only.
- Backend controllers (`admin-backend/src/controllers/product.controller.js`,
  storefront-backend's product controller) — neither reads or reshapes
  `specifications` directly; both pass the validated request body through
  to Mongoose, so no controller changes were needed at any phase.

**Final repo-wide sweep:** ran a case-insensitive grep for
`specification` across every `.js`/`.jsx`/`.ts`/`.tsx` file in the repo
(excluding `node_modules`). Every remaining match is one of:
- UI copy/labels — the word "Specifications" as a heading, tab title, or
  `aria-*`/`id` string (admin portal and storefront both still call the
  section "Specifications" for the shopper/admin — only the *data shape*
  changed, not the section's name);
- code already converted to the plain-array shape in Phases 1–3;
- comments describing the new array shape or the migration script.

Also specifically checked for any leftover `s.label` / `s.value` access
on a spec entry anywhere in the repo — none found. Every `.map()` over
`specs`/`specifications` now treats each entry as a plain string.

**End-to-end shape, after all 4 phases:**
- MongoDB: `products.specifications` is an array of trimmed strings,
  max 20 entries, max 200 chars each — identical constraints to
  `highlights`.
- API (both backends): request/response bodies carry `specifications`
  as a plain string array; Zod validates it the same way as `highlights`.
- Admin portal: the product form has a single-input-per-row "Add spec"
  list (no more Label/Value pair); the product detail page and list
  render specs as a plain bulleted list.
- Storefront: the product page's Specifications tab renders each spec as
  a plain list item (no bold label prefix); the Compare page shows one
  "Specifications" row per comparison with each product's specs stacked
  as a bullet list in its own column (row-by-row label alignment was
  removed, per your decision in the clarifying questions).
- Migration: `admin-backend/scripts/migrateSpecificationsToArray.js`
  converts any pre-existing label/value documents by keeping only the
  values (labels dropped), run once against the shared MongoDB database.

**Still worth doing on your end before merging:**
- Run `npm run test` (or `npx vitest run`) in `admin-portal/` — the new
  spec tests in `productsService.test.js` couldn't be executed in this
  environment (see Phase 2 notes) and should be confirmed passing.
- Run the `admin-backend` and `storefront-backend` test suites normally;
  they weren't affected by this change but running them is good hygiene
  after a schema/validator edit.
- Run `node scripts/migrateSpecificationsToArray.js` from `admin-backend/`
  against your actual database once this deploys, before anyone opens the
  product form (Mongoose will now reject specs saved in the old shape).
- Take a fresh look at the Compare page's new single "Specifications" row
  layout once it's live — the label-based row alignment it used to have
  is gone by design, but it's worth confirming it reads well with your
  real product data.

This is the final phase — all four are complete.
