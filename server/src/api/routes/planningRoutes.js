const express = require("express");
const router = express.Router();

const protect = require("../../../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");
const validateRequest = require("../middleware/validateRequest");
const {
  validateGenerateItinerary,
  validatePartialRegeneration,
  validateBehaviorSignal
} = require("../validators/planningValidators");
const planningController = require("../controllers/planningController");

router.post(
  "/itineraries/generate",
  protect,
  validateRequest(validateGenerateItinerary),
  asyncHandler(planningController.generateItinerary)
);

router.post(
  "/itineraries/:groupId/partial-regenerate",
  protect,
  validateRequest(validatePartialRegeneration),
  asyncHandler(planningController.partialRegenerate)
);

router.post(
  "/itineraries/:groupId/interactions",
  protect,
  validateRequest(validateBehaviorSignal),
  asyncHandler(planningController.recordInteraction)
);

router.post(
  "/itineraries/:groupId/validate",
  protect,
  asyncHandler(planningController.validateItinerary)
);

router.get(
  "/itineraries/:groupId/explanations",
  protect,
  asyncHandler(planningController.getExplanations)
);

router.get(
  "/itineraries/:groupId/stability",
  protect,
  asyncHandler(planningController.getStability)
);

router.get(
  "/itineraries/:groupId/history",
  protect,
  asyncHandler(planningController.getHistory)
);

module.exports = router;
