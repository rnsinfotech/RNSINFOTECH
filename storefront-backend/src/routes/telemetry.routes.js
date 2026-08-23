const { Router } = require('express');
const { clientError } = require('../controllers/telemetry.controller');
const { generalRateLimit } = require('../middleware/rateLimit');
const router = Router();
router.post('/client-error', clientError);
module.exports = router;
