import { adminApiRequest } from "../lib/adminApi";

function normalizeSettings(website = {}) {
  return {
    hero: website.hero || { title: "", subtitle: "", primaryCta: { label: "", href: "" }, secondaryCta: { label: "", href: "" }, stats: [] },
    promo: website.promo || { eyebrow: "", title: "", body: "", cta: { label: "", href: "" } },
    whyChooseUs: Array.isArray(website.whyChooseUs) ? website.whyChooseUs : [],
    solutions: Array.isArray(website.solutions) ? website.solutions : [],
    testimonials: Array.isArray(website.testimonials) ? website.testimonials : [],
  };
}

export async function getSettings() {
  const payload = await adminApiRequest("/website");
  return {
    ...normalizeSettings(payload?.website),
    publishedWebsite: normalizeSettings(payload?.publishedWebsite),
    homepagePublishedAt: payload?.homepagePublishedAt || null,
  };
}

export async function updateSettingsSection(section, data) {
  const payload = await adminApiRequest(`/website/${section}`, { method: "PATCH", body: data });
  return {
    ...normalizeSettings(payload?.website),
    publishedWebsite: normalizeSettings(payload?.publishedWebsite),
    homepagePublishedAt: payload?.homepagePublishedAt || null,
  };
}

export async function publishSettings() {
  const payload = await adminApiRequest("/website/publish", { method: "POST" });
  return normalizeSettings(payload?.website);
}

export async function getPreview() {
  const payload = await adminApiRequest("/website/preview");
  return normalizeSettings(payload?.website);
}

async function listSection(section) {
  const settings = await getSettings();
  return settings[section] || [];
}

async function createItem(section, data) {
  const payload = await adminApiRequest(`/website/${section}/items`, { method: "POST", body: data });
  return payload?.item || null;
}

async function updateItem(section, id, data) {
  const payload = await adminApiRequest(`/website/${section}/items/${id}`, { method: "PATCH", body: data });
  return payload?.item || null;
}

async function deleteItem(section, id) {
  await adminApiRequest(`/website/${section}/items/${id}`, { method: "DELETE" });
  return true;
}

export const getWhyChooseUs = () => listSection("whyChooseUs");
export const createWhyChooseUs = (data) => createItem("whyChooseUs", data);
export const updateWhyChooseUs = (id, data) => updateItem("whyChooseUs", id, data);
export const deleteWhyChooseUs = (id) => deleteItem("whyChooseUs", id);

export const getSolutions = () => listSection("solutions");
export const createSolution = (data) => createItem("solutions", data);
export const updateSolution = (id, data) => updateItem("solutions", id, data);
export const deleteSolution = (id) => deleteItem("solutions", id);

export const getTestimonials = () => listSection("testimonials");
export const createTestimonial = (data) => createItem("testimonials", data);
export const updateTestimonial = (id, data) => updateItem("testimonials", id, data);
export const deleteTestimonial = (id) => deleteItem("testimonials", id);
