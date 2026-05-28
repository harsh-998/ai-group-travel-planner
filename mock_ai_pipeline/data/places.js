const jaipurPlaceIntelligence = require("./jaipurPlaceIntelligence");
const destinationPlaceIntelligence = require("./destinationPlaceIntelligence");
const {
  getDestinationImage,
  getStaticMapImage
} = require("./destinationVisualAssets");

const toLegacyPlace = (place) => {
  const tags = unique([
    place.primaryCategory,
    place.destination,
    place.country,
    ...(place.destinationAliases || []),
    ...place.subcategories,
    ...place.subcategories.map((tag) => tag.replace(/_/g, " ")),
    ...place.semanticTags,
    ...place.vibeTags,
    ...place.tripRoles,
    ...place.tripRoles.map((tag) => tag.replace(/_/g, " ")),
    ...place.idealVisitWindows,
    ...place.idealVisitWindows.map((tag) => tag.replace(/_/g, " "))
  ]);

  return {
    id: place.placeId,
    name: place.canonicalName,
    destination: place.destination,
    destinationAliases: place.destinationAliases || [],
    country: place.country,
    area: getAreaLabel(place),
    localityClusterId: place.localityClusterId,
    routeZone: place.routing.routeZone,
    type: place.primaryCategory,
    primaryCategory: place.primaryCategory,
    subcategories: place.subcategories,
    tags,
    vibeTags: place.vibeTags,
    tripRoles: place.tripRoles,
    budgetTier: place.budgetTier,
    estimatedCost: Math.round((place.estimatedCost.min + place.estimatedCost.max) / 2),
    estimatedCostRange: place.estimatedCost,
    durationMinutes: place.typicalDurationMinutes,
    bestTime: toLegacyBestTime(place.idealVisitWindows),
    idealVisitWindows: place.idealVisitWindows,
    coordinates: place.coordinates,
    popularityScore: Math.round(place.qualitySignals.popularityScore * 100),
    qualityScore: Math.round(average([
      place.qualitySignals.popularityScore,
      place.qualitySignals.photographyValue,
      place.qualitySignals.familyFit,
      place.qualitySignals.groupFit,
      place.confidence.metadataCompleteness
    ]) * 100),
    weatherSensitivity: place.indoorOutdoor,
    weatherSuitability: place.weatherSuitability,
    fatigueScore: place.fatigueScore,
    nearbyPlaceIds: place.routing.nearbyPlaceIds,
    backtrackingPenaltyGroup: place.routing.backtrackingPenaltyGroup,
    image: getPlaceImage(place),
    imageAttribution: place.visualAssets?.image?.attribution || null,
    imageSource: place.visualAssets?.image?.source || null,
    mapImage: place.visualAssets?.mapImage?.url || getStaticMapImage(place.coordinates),
    destinationImage: place.visualAssets?.destinationHeroImage?.url || getDestinationImage(place.destination),
    placeIntelligence: place,
    description: buildLegacyDescription(place)
  };
};

const toLegacyBestTime = (windows) => {
  const mapped = windows.map((window) => {
    if (window === "early_morning" || window === "morning") return "morning";
    if (window === "afternoon") return "afternoon";
    return "evening";
  });
  return unique(mapped);
};

const buildLegacyDescription = (place) => {
  const [summary] = place.embedding.embeddingText.split(" Subcategories:");
  return summary;
};

const getAreaLabel = (place) => {
  return jaipurPlaceIntelligence.localityClusters[place.localityClusterId]?.label ||
    place.routing?.clusterLabel ||
    toTitle(place.localityClusterId);
};

const getPlaceImage = (place) => {
  return place.visualAssets?.image?.url ||
    place.visualAssets?.destinationHeroImage?.url ||
    getDestinationImage(place.destination) ||
    getStaticMapImage(place.coordinates);
};

const unique = (values) => [...new Set(values.filter(Boolean))];

const average = (values) => {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const toTitle = (value) => String(value || "")
  .replace(/[_-]/g, " ")
  .replace(/\b\w/g, (char) => char.toUpperCase());

const legacyJaipurPlaces = jaipurPlaceIntelligence.map(toLegacyPlace);
const legacyDestinationPlaces = destinationPlaceIntelligence.map(toLegacyPlace);

const otherPlaces = [
  {
    id: "manali_hadimba_temple",
    name: "Hadimba Temple",
    destination: "Manali",
    area: "Old Manali",
    type: "heritage",
    tags: ["heritage", "temple", "forest", "culture", "photography"],
    budgetTier: "free",
    estimatedCost: 0,
    durationMinutes: 60,
    bestTime: ["morning"],
    coordinates: { lat: 32.2432, lng: 77.1892 },
    popularityScore: 86,
    qualityScore: 84,
    weatherSensitivity: "outdoor",
    fatigueScore: 15,
    description: "Wooden temple surrounded by cedar forest, close to Old Manali."
  },
  {
    id: "manali_johnsons_cafe",
    name: "Johnson's Cafe",
    destination: "Manali",
    area: "Circuit House Road",
    type: "food",
    tags: ["food", "cafe", "comfort", "trout", "group friendly"],
    budgetTier: "high",
    estimatedCost: 1000,
    durationMinutes: 80,
    bestTime: ["afternoon", "evening"],
    coordinates: { lat: 32.2449, lng: 77.1882 },
    popularityScore: 82,
    qualityScore: 86,
    weatherSensitivity: "indoor",
    fatigueScore: 5,
    description: "Comfortable cafe known for trout, mountain ambience, and relaxed meals."
  },
  {
    id: "manali_old_manali_cafes",
    name: "Old Manali Cafe Walk",
    destination: "Manali",
    area: "Old Manali",
    type: "food",
    tags: ["food", "cafes", "slow travel", "local", "walking"],
    budgetTier: "mid",
    estimatedCost: 600,
    durationMinutes: 120,
    bestTime: ["afternoon", "evening"],
    coordinates: { lat: 32.2507, lng: 77.1805 },
    popularityScore: 80,
    qualityScore: 82,
    weatherSensitivity: "mixed",
    fatigueScore: 20,
    description: "Slow cafe-hopping stretch with mountain views and casual food."
  },
  {
    id: "manali_solang_valley",
    name: "Solang Valley",
    destination: "Manali",
    area: "Solang",
    type: "adventure",
    tags: ["adventure", "views", "snow", "activities", "nature"],
    budgetTier: "mid",
    estimatedCost: 1500,
    durationMinutes: 240,
    bestTime: ["morning", "afternoon"],
    coordinates: { lat: 32.316, lng: 77.157 },
    popularityScore: 88,
    qualityScore: 82,
    weatherSensitivity: "outdoor",
    fatigueScore: 55,
    description: "Adventure valley for views and seasonal activities outside Manali town."
  },
  {
    id: "manali_mall_road",
    name: "Mall Road",
    destination: "Manali",
    area: "Manali Town",
    type: "shopping",
    tags: ["shopping", "food", "local", "market", "evening"],
    budgetTier: "low",
    estimatedCost: 300,
    durationMinutes: 90,
    bestTime: ["evening"],
    coordinates: { lat: 32.2396, lng: 77.1887 },
    popularityScore: 76,
    qualityScore: 72,
    weatherSensitivity: "outdoor",
    fatigueScore: 20,
    description: "Central market street for snacks, woolens, souvenirs, and easy evening wandering."
  },
  {
    id: "manali_vashisht",
    name: "Vashisht Hot Springs",
    destination: "Manali",
    area: "Vashisht",
    type: "wellness",
    tags: ["wellness", "heritage", "temple", "local", "relaxing"],
    budgetTier: "free",
    estimatedCost: 0,
    durationMinutes: 75,
    bestTime: ["morning", "afternoon"],
    coordinates: { lat: 32.2631, lng: 77.188 },
    popularityScore: 72,
    qualityScore: 74,
    weatherSensitivity: "mixed",
    fatigueScore: 12,
    description: "Village temple area known for natural hot springs and a slower local feel."
  },
  {
    id: "goa_baga_beach",
    name: "Baga Beach",
    destination: "Goa",
    area: "North Goa",
    type: "beach",
    tags: ["beach", "nightlife", "water sports", "food", "popular"],
    budgetTier: "mid",
    estimatedCost: 800,
    durationMinutes: 180,
    bestTime: ["afternoon", "evening"],
    coordinates: { lat: 15.5553, lng: 73.7517 },
    popularityScore: 88,
    qualityScore: 78,
    weatherSensitivity: "outdoor",
    fatigueScore: 25,
    description: "Busy North Goa beach with shacks, water sports, and nightlife nearby."
  },
  {
    id: "goa_fontainhas",
    name: "Fontainhas Latin Quarter",
    destination: "Goa",
    area: "Panaji",
    type: "heritage",
    tags: ["heritage", "walking", "photography", "cafes", "culture"],
    budgetTier: "free",
    estimatedCost: 0,
    durationMinutes: 100,
    bestTime: ["morning", "afternoon"],
    coordinates: { lat: 15.4957, lng: 73.8278 },
    popularityScore: 82,
    qualityScore: 88,
    weatherSensitivity: "outdoor",
    fatigueScore: 20,
    description: "Colorful Portuguese-era neighborhood with lanes, cafes, and heritage facades."
  },
  {
    id: "goa_bom_jesus",
    name: "Basilica of Bom Jesus",
    destination: "Goa",
    area: "Old Goa",
    type: "heritage",
    tags: ["heritage", "church", "unesco", "architecture", "culture"],
    budgetTier: "free",
    estimatedCost: 0,
    durationMinutes: 75,
    bestTime: ["morning", "afternoon"],
    coordinates: { lat: 15.5009, lng: 73.9116 },
    popularityScore: 84,
    qualityScore: 86,
    weatherSensitivity: "mixed",
    fatigueScore: 12,
    description: "UNESCO-listed church and one of Old Goa's most important heritage stops."
  },
  {
    id: "goa_fishermans_wharf",
    name: "The Fisherman's Wharf",
    destination: "Goa",
    area: "South Goa",
    type: "food",
    tags: ["food", "seafood", "riverside", "comfortable", "goan"],
    budgetTier: "high",
    estimatedCost: 1600,
    durationMinutes: 100,
    bestTime: ["evening"],
    coordinates: { lat: 15.168, lng: 73.948 },
    popularityScore: 82,
    qualityScore: 86,
    weatherSensitivity: "mixed",
    fatigueScore: 5,
    description: "Popular Goan seafood restaurant with a relaxed waterside setting."
  },
  {
    id: "goa_artjuna",
    name: "Artjuna Cafe",
    destination: "Goa",
    area: "Anjuna",
    type: "food",
    tags: ["food", "cafe", "brunch", "slow travel", "healthy"],
    budgetTier: "mid",
    estimatedCost: 800,
    durationMinutes: 90,
    bestTime: ["morning", "afternoon"],
    coordinates: { lat: 15.5818, lng: 73.7419 },
    popularityScore: 78,
    qualityScore: 84,
    weatherSensitivity: "mixed",
    fatigueScore: 5,
    description: "Relaxed cafe for brunch, coffee, and slow North Goa mornings."
  },
  {
    id: "goa_chapora_fort",
    name: "Chapora Fort",
    destination: "Goa",
    area: "North Goa",
    type: "viewpoint",
    tags: ["heritage", "viewpoint", "sunset", "photography", "fort"],
    budgetTier: "free",
    estimatedCost: 0,
    durationMinutes: 75,
    bestTime: ["evening"],
    coordinates: { lat: 15.6045, lng: 73.7393 },
    popularityScore: 80,
    qualityScore: 78,
    weatherSensitivity: "outdoor",
    fatigueScore: 25,
    description: "Hilltop fort ruins with popular sunset views over the coast."
  }
];

const enrichFallbackPlace = (place) => ({
  ...place,
  destinationAliases: place.destinationAliases || [],
  image: place.image || getDestinationImage(place.destination) || getStaticMapImage(place.coordinates),
  mapImage: place.mapImage || getStaticMapImage(place.coordinates),
  destinationImage: place.destinationImage || getDestinationImage(place.destination)
});

const places = [
  ...legacyJaipurPlaces,
  ...legacyDestinationPlaces,
  ...otherPlaces.map(enrichFallbackPlace)
];

module.exports = places;
