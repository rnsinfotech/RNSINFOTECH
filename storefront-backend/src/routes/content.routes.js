const { Router } = require("express");
const validateParamPattern = require("../middleware/validateParamPattern");
const contentController = require("../controllers/content.controller");
const router = Router();

router.get("/flash-messages", contentController.listFlashMessages);
router.get("/website", contentController.getWebsite);
router.get("/store-profile", contentController.getStoreProfile);
router.get("/faqs", contentController.listFaqs);
router.get("/blog", contentController.listBlogPosts);
router.get("/blog/:slug", validateParamPattern("slug", /^[a-z0-9]+(?:-[a-z0-9]+)*$/), contentController.getBlogPost);
router.get("/policies/:key", validateParamPattern("key", /^(privacy|terms|returns|warranty|shipping)$/), contentController.getPolicy);

module.exports = router;
