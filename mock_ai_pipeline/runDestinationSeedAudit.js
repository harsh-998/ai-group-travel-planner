const { runPipeline } = require("./src/runPipeline");
const destinationPlaces = require("./data/destinationPlaceIntelligence");
const { destinationProfiles } = require("./data/destinationVisualAssets");

const MIN_PLACES_PER_DESTINATION = 8;
const MIN_ACTIVITIES_PER_AUDIT = 5;
const errors = [];
const warnings = [];

const randomImageHosts = ["picsum.photos", "source.unsplash.com"];
const auditDaysByDestination = {
  Maldives: 3,
  "Great Barrier Reef": 3,
  Reykjavik: 3,
  "Banff National Park": 3,
  "Zakouma National Park": 4,
  Queenstown: 3,
  Havana: 3,
  Madagascar: 5
};

const placesByDestination = destinationPlaces.reduce((groups, place) => {
  groups[place.destination] = groups[place.destination] || [];
  groups[place.destination].push(place);
  return groups;
}, {});

for (const profile of destinationProfiles) {
  const places = placesByDestination[profile.destination] || [];
  if (places.length < MIN_PLACES_PER_DESTINATION) {
    errors.push(`${profile.destination}: expected at least ${MIN_PLACES_PER_DESTINATION} places, found ${places.length}.`);
  }

  if (!profile.heroImage?.url) {
    errors.push(`${profile.destination}: missing destination hero image.`);
  }

  if (containsRandomImage(profile.heroImage?.url)) {
    errors.push(`${profile.destination}: hero image uses a random image host.`);
  }

  for (const place of places) {
    const imageUrl = place.visualAssets?.image?.url;
    if (!imageUrl) errors.push(`${place.placeId}: missing place image.`);
    if (containsRandomImage(imageUrl)) errors.push(`${place.placeId}: image uses a random image host.`);
    if (!place.visualAssets?.mapImage?.url) errors.push(`${place.placeId}: missing exact map image.`);
    if (!place.embedding?.embeddingText || place.embedding.embeddingText.length < 180) {
      errors.push(`${place.placeId}: embedding text is too thin.`);
    }
  }

  const auditDays = auditDaysByDestination[profile.destination] || 2;
  const result = runPipeline({
    destination: profile.destination,
    days: auditDays,
    budget: "balanced",
    interests: ["heritage", "food", "nature"]
  });

  const itinerary = result.itinerary;
  const activities = itinerary.days.flatMap((day) => day.activities || []);
  if (itinerary.validation.status !== "valid") {
    errors.push(`${profile.destination}: generated itinerary is ${itinerary.validation.status}.`);
  }
  if (activities.length < MIN_ACTIVITIES_PER_AUDIT) {
    errors.push(`${profile.destination}: generated only ${activities.length} activities for ${auditDays}-day audit.`);
  }
  if (result.pipelineDebug.retrievalMeta.destinationMatches < MIN_PLACES_PER_DESTINATION) {
    errors.push(`${profile.destination}: retrieval coverage did not see the full seed.`);
  }
  if (activities.some((activity) => !activity.image && !activity.mapImage && !activity.destinationImage)) {
    errors.push(`${profile.destination}: itinerary activity missing visual grounding.`);
  }
  if (itinerary.reliability.fallbackUsed) {
    warnings.push(`${profile.destination}: semantic fallback used (${itinerary.reliability.fallbackReason}).`);
  }
}

const duplicateIds = destinationPlaces
  .map((place) => place.placeId)
  .filter((placeId, index, ids) => ids.indexOf(placeId) !== index);
if (duplicateIds.length) {
  errors.push(`Duplicate global placeIds: ${[...new Set(duplicateIds)].join(", ")}`);
}

console.log(`Destination seed audit: ${destinationPlaces.length} places across ${destinationProfiles.length} destinations`);
console.table(
  Object.entries(placesByDestination)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([destination, places]) => ({ destination, places: places.length }))
);

if (warnings.length) {
  console.warn("\nWarnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("\nErrors:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("\nDestination seed audit passed.");
}

function containsRandomImage(url) {
  return randomImageHosts.some((host) => String(url || "").includes(host));
}
