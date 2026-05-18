const jaipurPlaces = require("./data/jaipurPlaceIntelligence");
const jaipurEvaluationPersonas = require("./data/jaipurEvaluationPersonas");
const { validatePlaceIntelligenceRecord } = require("./src/placeIntelligenceSchema");

const EXPECTED_MIN_PLACES = 100;
const EXPECTED_MAX_PLACES = 150;

const errors = [];
const warnings = [];
const placeIds = new Set(jaipurPlaces.map((place) => place.placeId));

if (jaipurPlaces.length < EXPECTED_MIN_PLACES || jaipurPlaces.length > EXPECTED_MAX_PLACES) {
  errors.push(`Expected ${EXPECTED_MIN_PLACES}-${EXPECTED_MAX_PLACES} Jaipur places, found ${jaipurPlaces.length}.`);
}

const duplicateIds = jaipurPlaces
  .map((place) => place.placeId)
  .filter((placeId, index, ids) => ids.indexOf(placeId) !== index);
if (duplicateIds.length) errors.push(`Duplicate placeIds: ${[...new Set(duplicateIds)].join(", ")}`);

for (const place of jaipurPlaces) {
  const recordErrors = validatePlaceIntelligenceRecord(place);
  for (const error of recordErrors) errors.push(`${place.placeId}: ${error}`);

  for (const nearbyPlaceId of place.routing.nearbyPlaceIds) {
    if (!placeIds.has(nearbyPlaceId)) {
      errors.push(`${place.placeId}: nearbyPlaceId does not exist: ${nearbyPlaceId}`);
    }
    if (nearbyPlaceId === place.placeId) {
      errors.push(`${place.placeId}: nearbyPlaceIds includes itself.`);
    }
  }
}

const categoryCounts = countBy(jaipurPlaces, "primaryCategory");
const clusterCounts = countBy(jaipurPlaces, "localityClusterId");
const roleCounts = jaipurPlaces.reduce((counts, place) => {
  for (const role of place.tripRoles) counts[role] = (counts[role] || 0) + 1;
  return counts;
}, {});

const requiredCategories = ["heritage", "food", "shopping", "culture", "nature", "nightlife"];
for (const category of requiredCategories) {
  if (!categoryCounts[category]) errors.push(`Missing required category coverage: ${category}`);
}

const requiredRoles = [
  "anchor_activity",
  "filler_activity",
  "recovery_activity",
  "arrival_activity",
  "departure_activity",
  "social_activity",
  "nightlife_activity",
  "exploration_activity",
  "contingency_activity"
];
for (const role of requiredRoles) {
  if (!roleCounts[role]) errors.push(`Missing required trip role coverage: ${role}`);
}

if (Object.keys(clusterCounts).length < 7) errors.push("Expected at least 7 locality clusters.");

const hotSafePlaces = jaipurPlaces.filter((place) => place.weatherSuitability.hot >= 0.85);
const rainSafePlaces = jaipurPlaces.filter((place) => place.weatherSuitability.rain >= 0.75);
const lowFatiguePlaces = jaipurPlaces.filter((place) => place.fatigueScore <= 10);
const sunsetPlaces = jaipurPlaces.filter((place) => place.idealVisitWindows.includes("sunset"));

if (hotSafePlaces.length < 30) warnings.push(`Only ${hotSafePlaces.length} hot-safe places; consider more indoor/recovery options.`);
if (rainSafePlaces.length < 25) warnings.push(`Only ${rainSafePlaces.length} rain-safe places; consider more contingency options.`);
if (lowFatiguePlaces.length < 30) warnings.push(`Only ${lowFatiguePlaces.length} low-fatigue places; recovery pacing may be thin.`);
if (sunsetPlaces.length < 8) warnings.push(`Only ${sunsetPlaces.length} sunset candidates; scenic pacing may be thin.`);

const personaCoverage = Object.entries(jaipurEvaluationPersonas).map(([personaId, persona]) => {
  const matches = jaipurPlaces.filter((place) => personaMatchesPlace(persona, place));
  return {
    personaId,
    interests: persona.interests.join(", "),
    matchingPlaces: matches.length,
    anchorMatches: matches.filter((place) => place.tripRoles.includes("anchor_activity")).length,
    recoveryMatches: matches.filter((place) => place.tripRoles.includes("recovery_activity")).length
  };
});

for (const coverage of personaCoverage) {
  if (coverage.matchingPlaces < 8) {
    errors.push(`${coverage.personaId}: only ${coverage.matchingPlaces} matching places.`);
  }
  if (coverage.anchorMatches < 2) {
    errors.push(`${coverage.personaId}: only ${coverage.anchorMatches} matching anchor places.`);
  }
}

console.log(`Jaipur seed audit: ${jaipurPlaces.length} places`);
console.table(sortCounts(categoryCounts));
console.table(sortCounts(clusterCounts));
console.table(sortCounts(roleCounts));
console.table(personaCoverage);

if (warnings.length) {
  console.warn("\nWarnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("\nErrors:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("\nJaipur seed audit passed.");
}

function personaMatchesPlace(persona, place) {
  const text = [
    place.canonicalName,
    place.primaryCategory,
    place.budgetTier,
    ...place.subcategories,
    ...place.semanticTags,
    ...place.vibeTags,
    ...place.tripRoles,
    place.embedding.embeddingText
  ].join(" ").toLowerCase();

  return persona.interests.some((interest) => {
    const normalized = interest.toLowerCase();
    return normalized.split(/\s+/).some((token) => token.length > 2 && text.includes(token));
  });
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function sortCounts(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}
