const Product = require('../models/Product');
const BlogPost = require('../models/BlogPost');
const { env } = require('../config/env');

function siteUrl() { return String(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '').replace(/\/$/, ''); }
async function sitemap(req, res, next) {
  try {
    const base = siteUrl();
    if (!base) return res.status(503).type('text/plain').send('PUBLIC_SITE_URL is not configured');
    const urls = ['/', '/products', '/help', '/about', '/request-quote', '/privacy-policy', '/terms', '/return-policy', '/warranty', '/corporate-sales', '/blog', '/compare'];
    const [products, posts] = await Promise.all([
      Product.find({ isActive: true }).select('_id updatedAt').lean().limit(50000),
      BlogPost.find({ status: 'published', publicationDate: { $lte: new Date() } }).select('slug updatedAt').lean().limit(10000),
    ]);
    const xmlUrls = [
      ...urls.map(path => ({ loc: `${base}${path}` })),
      ...products.map(p => ({ loc: `${base}/products/${p._id}`, lastmod: p.updatedAt })),
      ...posts.map(p => ({ loc: `${base}/blog/${encodeURIComponent(p.slug)}`, lastmod: p.updatedAt })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${xmlUrls.map(u => `<url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ''}</url>`).join('')}</urlset>`;
    res.type('application/xml').send(xml);
  } catch (err) { next(err); }
}
function robots(req, res) {
  const base = siteUrl();
  const sitemapUrl = base ? `${base}/sitemap.xml` : '/sitemap.xml';
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /checkout\nDisallow: /orders\nDisallow: /profile\nDisallow: /login\nDisallow: /signup\nSitemap: ${sitemapUrl}\n`);
}
function escapeXml(v) { return String(v).replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c])); }
module.exports = { sitemap, robots };
