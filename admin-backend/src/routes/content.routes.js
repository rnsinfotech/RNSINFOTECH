const { Router } = require("express");
const validateParam = require("../middleware/validateParam");

const contentController = require("../controllers/content.controller");
const validate = require("../middleware/validate");
const validateParamPattern = require("../middleware/validateParamPattern");
const requireAdmin = require("../middleware/requireAdmin");
const requirePermission = require("../middleware/requirePermission");
const { sensitiveRateLimit } = require("../middleware/rateLimit");
const {
  listFaqsQuerySchema,
  createFaqSchema,
  updateFaqSchema,
  createBlogPostSchema,
  updateBlogPostSchema,
  updatePolicySchema,
} = require("../validators/content.validators");

const router = Router();

router.get("/faqs", requireAdmin, validate(listFaqsQuerySchema, "query"), contentController.listFaqs);
router.post("/faqs", requireAdmin, requirePermission("content.write"), validate(createFaqSchema), contentController.createFaq);
router.patch("/faqs/:id", validateParam("id"), requireAdmin, requirePermission("content.write"), validate(updateFaqSchema), contentController.updateFaq);
router.delete("/faqs/:id", validateParam("id"), requireAdmin, requirePermission("content.write"), contentController.deleteFaq);

router.get("/blog", requireAdmin, validate(listFaqsQuerySchema, "query"), contentController.listBlogPosts);
router.post("/blog", requireAdmin, requirePermission("content.write"), validate(createBlogPostSchema), contentController.createBlogPost);
router.patch("/blog/:id", validateParam("id"), requireAdmin, requirePermission("content.write"), validate(updateBlogPostSchema), contentController.updateBlogPost);
router.delete("/blog/:id", validateParam("id"), requireAdmin, requirePermission("content.write"), contentController.deleteBlogPost);

router.get("/policies", requireAdmin, contentController.getPolicies);
router.patch("/policies/:key", validateParamPattern("key", /^(privacy|terms|returns|warranty|shipping)$/), requireAdmin, requirePermission("content.write"), validate(updatePolicySchema), contentController.updatePolicy);
router.post("/policies/:key/publish", sensitiveRateLimit, validateParamPattern("key", /^(privacy|terms|returns|warranty|shipping)$/), requireAdmin, requirePermission("content.write"), contentController.publishPolicy);

router.get("/preview/faqs/:id", validateParam("id"), requireAdmin, contentController.previewFaq);
router.get("/preview/blog/:id", validateParam("id"), requireAdmin, contentController.previewBlogPost);
router.get("/preview/policies/:key", requireAdmin, contentController.previewPolicy);

module.exports = router;
