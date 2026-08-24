const sanitizeHtml = require("sanitize-html");

// The product "full description" field is authored with a rich-text editor
// in the admin portal (headings, bold/italic, lists, links, and embedded
// images) and rendered as raw HTML on the public storefront. Sanitizing on
// the way IN (here) — rather than trusting the editor's output or relying
// only on client-side sanitization — is what actually protects storefront
// visitors from stored XSS if an admin account is ever compromised or a
// pasted snippet carries script/style payloads.
const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
  "h1", "h2", "h3", "h4",
  "ul", "ol", "li",
  "a", "img",
  "blockquote", "hr",
  "span",
];

const ALLOWED_ATTRIBUTES = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "width", "height", "style"],
  span: ["style"],
  "*": ["class"],
};

function sanitizeDescription(html) {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    // Only allow a small, safe set of layout styles: paragraph alignment
    // and the image sizing (width/max-width/height:auto) the editor's
    // resize toolbar writes — never raw CSS (no url(), no background,
    // no positioning) that could be used to inject unwanted content.
    allowedStyles: {
      span: { "text-align": [/^left$|^right$|^center$|^justify$/] },
      img: {
        width: [/^\d{1,4}(px|%)$/],
        "max-width": [/^100%$/],
        height: [/^auto$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  }).trim();
}

module.exports = sanitizeDescription;
