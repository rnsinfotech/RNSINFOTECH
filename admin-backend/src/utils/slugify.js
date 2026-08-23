// Small dependency-free slugify — good enough for product/category names
// (ASCII, no need for a full unicode-transliteration library here).
function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

module.exports = slugify;
