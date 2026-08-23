const { Router } = require('express');
const { sitemap, robots } = require('../controllers/seo.controller');
const router = Router();
router.get('/sitemap.xml', sitemap);
router.get('/robots.txt', robots);
module.exports = router;
