const { Router } = require("express");

const catalogController = require("../controllers/catalog.controller");
const validate = require("../middleware/validate");
const validateParamPattern = require("../middleware/validateParamPattern");
const { listProductsQuerySchema } = require("../validators/catalog.validators");

const router = Router();

// Every route here is public — no requireAuth. Unlike admin-backend,
// this service's whole point (per BACKEND_PLAN.md) is mostly-public reads.
router.get("/categories", catalogController.listCategories);
router.get("/categories/:slug", validateParamPattern("slug", /^[a-z0-9]+(?:-[a-z0-9]+)*$/), catalogController.getCategoryBySlug);
// No query params, so no validate() middleware here — unlike /products,
// this endpoint always returns the same fixed shape (see controller).
router.get("/homepage-products", catalogController.getHomepageProducts);
router.get("/products", validate(listProductsQuerySchema, "query"), catalogController.listProducts);
router.get("/products/:slug", validateParamPattern("slug", /^[a-z0-9]+(?:-[a-z0-9]+)*$/), catalogController.getProductBySlug);

module.exports = router;
