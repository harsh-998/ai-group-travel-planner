const PLACE_INTELLIGENCE_KEYS = [
  "placeId",
  "canonicalName",
  "aliases",
  "destination",
  "country",
  "localityClusterId",
  "coordinates",
  "primaryCategory",
  "subcategories",
  "semanticTags",
  "vibeTags",
  "tripRoles",
  "idealVisitWindows",
  "typicalDurationMinutes",
  "budgetTier",
  "estimatedCost",
  "fatigueScore",
  "indoorOutdoor",
  "weatherSuitability",
  "crowdProfile",
  "qualitySignals",
  "routing",
  "sourceRefs",
  "confidence",
  "embedding"
];

const PLACE_INTELLIGENCE_KEY_SET = new Set(PLACE_INTELLIGENCE_KEYS);

const allowedPrimaryCategories = new Set([
  "heritage",
  "food",
  "nature",
  "adventure",
  "wellness",
  "shopping",
  "nightlife",
  "culture",
  "logistics"
]);

const allowedTripRoles = new Set([
  "anchor_activity",
  "filler_activity",
  "recovery_activity",
  "arrival_activity",
  "departure_activity",
  "social_activity",
  "nightlife_activity",
  "exploration_activity",
  "contingency_activity"
]);

const allowedBudgetTiers = new Set(["free", "low", "mid", "high", "luxury"]);
const allowedIndoorOutdoor = new Set(["indoor", "outdoor", "mixed"]);
const allowedCrowdValues = new Set(["low", "medium", "high"]);

const qualitySignalKeys = [
  "popularityScore",
  "hiddenGemScore",
  "photographyValue",
  "familyFit",
  "groupFit",
  "nightlifeSuitability"
];

const sourceRefKeys = [
  "googlePlaceId",
  "foursquareId",
  "openTripMapXid",
  "geoapifyPlaceId"
];

const validatePlaceIntelligenceRecord = (place) => {
  const errors = [];
  const keys = Object.keys(place);
  const missingKeys = PLACE_INTELLIGENCE_KEYS.filter((key) => !(key in place));
  const extraKeys = keys.filter((key) => !PLACE_INTELLIGENCE_KEY_SET.has(key));

  if (missingKeys.length) errors.push(`Missing keys: ${missingKeys.join(", ")}`);
  if (extraKeys.length) errors.push(`Extra keys: ${extraKeys.join(", ")}`);

  if (!place.placeId || typeof place.placeId !== "string") errors.push("placeId must be a string.");
  if (!place.canonicalName || typeof place.canonicalName !== "string") errors.push("canonicalName must be a string.");
  if (!Array.isArray(place.aliases)) errors.push("aliases must be an array.");
  if (place.destination !== "Jaipur") errors.push("destination must be Jaipur.");
  if (place.country !== "India") errors.push("country must be India.");
  if (!place.localityClusterId) errors.push("localityClusterId is required.");
  if (!allowedPrimaryCategories.has(place.primaryCategory)) errors.push(`Invalid primaryCategory: ${place.primaryCategory}`);
  if (!allowedBudgetTiers.has(place.budgetTier)) errors.push(`Invalid budgetTier: ${place.budgetTier}`);
  if (!allowedIndoorOutdoor.has(place.indoorOutdoor)) errors.push(`Invalid indoorOutdoor: ${place.indoorOutdoor}`);

  validateNumber(place.coordinates?.lat, -90, 90, "coordinates.lat", errors);
  validateNumber(place.coordinates?.lng, -180, 180, "coordinates.lng", errors);
  validateInteger(place.typicalDurationMinutes, 10, 360, "typicalDurationMinutes", errors);
  validateInteger(place.fatigueScore, 0, 100, "fatigueScore", errors);
  validateArray(place.subcategories, "subcategories", errors);
  validateArray(place.semanticTags, "semanticTags", errors);
  validateArray(place.vibeTags, "vibeTags", errors);
  validateArray(place.tripRoles, "tripRoles", errors);
  validateArray(place.idealVisitWindows, "idealVisitWindows", errors);

  for (const role of place.tripRoles || []) {
    if (!allowedTripRoles.has(role)) errors.push(`Invalid tripRole: ${role}`);
  }

  if (place.estimatedCost?.currency !== "INR") errors.push("estimatedCost.currency must be INR.");
  validateInteger(place.estimatedCost?.min, 0, 100000, "estimatedCost.min", errors);
  validateInteger(place.estimatedCost?.max, 0, 100000, "estimatedCost.max", errors);
  if (place.estimatedCost?.min > place.estimatedCost?.max) errors.push("estimatedCost.min exceeds max.");

  for (const condition of ["clear", "hot", "rain"]) {
    validateNumber(place.weatherSuitability?.[condition], 0, 1, `weatherSuitability.${condition}`, errors);
  }

  for (const slot of ["weekdayMorning", "weekendAfternoon"]) {
    if (!allowedCrowdValues.has(place.crowdProfile?.[slot])) {
      errors.push(`Invalid crowdProfile.${slot}: ${place.crowdProfile?.[slot]}`);
    }
  }

  for (const key of qualitySignalKeys) {
    validateNumber(place.qualitySignals?.[key], 0, 1, `qualitySignals.${key}`, errors);
  }

  if (!place.routing?.routeZone) errors.push("routing.routeZone is required.");
  validateArray(place.routing?.nearbyPlaceIds, "routing.nearbyPlaceIds", errors);
  if (!place.routing?.backtrackingPenaltyGroup) errors.push("routing.backtrackingPenaltyGroup is required.");

  for (const key of sourceRefKeys) {
    if (!(key in (place.sourceRefs || {}))) errors.push(`sourceRefs.${key} is required.`);
  }

  validateNumber(place.confidence?.metadataCompleteness, 0, 1, "confidence.metadataCompleteness", errors);
  validateNumber(place.confidence?.sourceConfidence, 0, 1, "confidence.sourceConfidence", errors);
  if (!place.confidence?.lastVerifiedAt) errors.push("confidence.lastVerifiedAt is required.");

  if (!place.embedding?.embeddingText || place.embedding.embeddingText.length < 80) {
    errors.push("embedding.embeddingText must be a useful descriptive string.");
  }
  if (!("embeddingModel" in (place.embedding || {}))) errors.push("embedding.embeddingModel is required.");
  if (!("embeddingVersion" in (place.embedding || {}))) errors.push("embedding.embeddingVersion is required.");
  if (!("vector" in (place.embedding || {}))) errors.push("embedding.vector is required.");

  return errors;
};

const validateArray = (value, name, errors) => {
  if (!Array.isArray(value) || !value.length) {
    errors.push(`${name} must be a non-empty array.`);
  }
};

const validateNumber = (value, min, max, name, errors) => {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    errors.push(`${name} must be a number between ${min} and ${max}.`);
  }
};

const validateInteger = (value, min, max, name, errors) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${name} must be an integer between ${min} and ${max}.`);
  }
};

module.exports = {
  PLACE_INTELLIGENCE_KEYS,
  allowedPrimaryCategories,
  allowedTripRoles,
  validatePlaceIntelligenceRecord
};
