const generateItineraryJson = ({ tripInput, optimizedDays, retrievalMeta }) => {
  const destination = tripInput.destination;
  const optimizationMode = tripInput.optimizationMode || tripInput.budget || "balanced";

  const days = optimizedDays.map((day) => ({
    day: day.day,
    title: `Day ${day.day}: ${day.theme}`,
    subtitle: buildSubtitle(day, optimizationMode),
    fatigueScore: day.fatigueScore,
    estimatedTravelMinutes: day.estimatedTravelMinutes,
    activities: day.items.map((item) => ({
      placeId: item.id,
      time: item.time,
      durationMinutes: item.durationMinutes,
      title: item.name,
      description: item.description,
      travelFromPrevious: item.travelFromPrevious,
      type: item.type,
      tags: item.tags,
      vibeTags: item.vibeTags,
      tripRoles: item.tripRoles,
      slot: item.slot,
      bestTime: item.bestTime,
      idealVisitWindows: item.idealVisitWindows,
      area: item.area,
      localityClusterId: item.localityClusterId,
      routeZone: item.routeZone,
      coordinates: item.coordinates,
      budgetTier: item.budgetTier,
      estimatedCost: item.estimatedCost,
      estimatedCostRange: item.estimatedCostRange,
      fatigueScore: item.fatigueScore,
      weatherSensitivity: item.weatherSensitivity,
      weatherSuitability: item.weatherSuitability,
      nearbyPlaceIds: item.nearbyPlaceIds,
      score: item.score,
      semanticScore: item.semanticScore,
      source: "semantic_retrieval",
      retrievalReason: item.retrievalReason,
      semanticSignals: item.semanticSignals,
      selectionReason: item.selectionReason,
      adaptiveFitReason: item.adaptiveFitReason,
      scoreBreakdown: item.scoreBreakdown
    }))
  }));

  const groundingStrength = calculateGroundingStrength(days);
  const constraintSatisfaction = calculateConstraintSatisfaction(days);
  const rankingConfidence = calculateRankingConfidence(days);
  const validationQuality = 0.95;
  const retrievalCoverage = retrievalMeta.retrievalCoverage;

  const confidenceScore =
    groundingStrength * 0.3 +
    retrievalCoverage * 0.25 +
    constraintSatisfaction * 0.2 +
    rankingConfidence * 0.15 +
    validationQuality * 0.1;

  return {
    itineraryId: `mock_${Date.now()}`,
    destination,
    input: tripInput,
    optimizationMode,
    days,
    reliability: {
      confidenceScore: Number(confidenceScore.toFixed(2)),
      groundingStrength: Number(groundingStrength.toFixed(2)),
      retrievalCoverage: Number(retrievalCoverage.toFixed(2)),
      rankingConfidence: Number(rankingConfidence.toFixed(2)),
      constraintSatisfaction: Number(constraintSatisfaction.toFixed(2)),
      fallbackUsed: retrievalMeta.fallbackUsed,
      fallbackReason: retrievalMeta.fallbackReason,
      warnings: buildReliabilityWarnings(retrievalMeta, confidenceScore)
    },
    validation: {
      status: "not_validated",
      errors: [],
      warnings: []
    }
  };
};

const buildSubtitle = (day, optimizationMode) => {
  const activityCount = day.items.length;
  return `${activityCount} planned stops optimized for ${optimizationMode} travel.`;
};

const calculateGroundingStrength = (days) => {
  const activities = days.flatMap((day) => day.activities);
  if (!activities.length) return 0;
  const grounded = activities.filter((activity) => activity.placeId && activity.source === "semantic_retrieval");
  return grounded.length / activities.length;
};

const calculateConstraintSatisfaction = (days) => {
  if (!days.length) return 0;
  const validDays = days.filter(
    (day) => day.fatigueScore <= 100 && day.estimatedTravelMinutes <= 180
  );
  return validDays.length / days.length;
};

const calculateRankingConfidence = (days) => {
  const activities = days.flatMap((day) => day.activities);
  if (!activities.length) return 0;
  const averageScore = activities.reduce((sum, activity) => sum + activity.score, 0) / activities.length;
  return Math.min(1, averageScore / 100);
};

const buildReliabilityWarnings = (retrievalMeta, confidenceScore) => {
  const warnings = [];

  if (retrievalMeta.fallbackUsed) {
    warnings.push(retrievalMeta.fallbackReason);
  }

  if (confidenceScore < 0.7) {
    warnings.push("Overall confidence is below the recommended final-itinerary threshold.");
  }

  return warnings.filter(Boolean);
};

module.exports = generateItineraryJson;
