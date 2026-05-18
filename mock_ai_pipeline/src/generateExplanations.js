const generateExplanations = ({
  tripInput,
  retrievalMeta,
  rankedCandidates,
  itinerary
}) => {
  const selectedActivities = itinerary.days.flatMap((day) => day.activities);
  const topTypes = countBy(selectedActivities, "type");
  const topAreas = countBy(selectedActivities, "area");
  const averageScore = average(selectedActivities.map((activity) => activity.score));

  const activityExplanationMap = new Map();
  for (const activity of selectedActivities) {
    activityExplanationMap.set(activity.placeId, explainActivity(activity));
  }

  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      explanation: explainDay(day),
      activities: day.activities.map((activity) => ({
        ...activity,
        explanation: activityExplanationMap.get(activity.placeId)
      }))
    })),
    explanations: {
      summary: `WayFinder built a ${tripInput.days}-day ${tripInput.optimizationMode} itinerary for ${tripInput.destination} using ${selectedActivities.length} grounded activities.`,
      preferenceExtraction: `Detected interests: ${tripInput.interests.join(", ") || "none provided"}; budget mode: ${tripInput.budget}; optimization mode: ${tripInput.optimizationMode}.`,
      retrieval: `Semantic retrieval used ${retrievalMeta.returnedCandidates} of ${retrievalMeta.destinationMatches} destination records with average semantic score ${retrievalMeta.averageSemanticScore}.`,
      ranking: `Ranking favored ${formatTopCounts(topTypes)} with an average selected score of ${averageScore}.`,
      optimization: `Sequencing spread activities across ${formatTopCounts(topAreas)} while respecting morning, afternoon, and evening slots.`,
      validation: itinerary.validation.status === "valid"
        ? `Validation passed with ${itinerary.validation.warnings.length} warning(s).`
        : `Validation failed with ${itinerary.validation.errors.length} error(s).`,
      reliability: `Confidence is ${itinerary.reliability.confidenceScore}; retrieval coverage is ${itinerary.reliability.retrievalCoverage}; fallback used: ${itinerary.reliability.fallbackUsed}.`
    },
    explanationTrace: {
      topRankedCandidateIds: rankedCandidates.slice(0, 5).map((candidate) => candidate.id),
      selectedPlaceIds: selectedActivities.map((activity) => activity.placeId),
      dominantTypes: topTypes,
      dominantAreas: topAreas
    }
  };
};

const explainActivity = (activity) => {
  const strongFactors = Object.entries(activity.scoreBreakdown || {})
    .filter(([, score]) => score >= 80)
    .map(([factor]) => factor);

  const factors = strongFactors.length
    ? strongFactors.slice(0, 4).join(", ")
    : "overall fit";

  return {
    whySelected: `${activity.title} was selected because it scored well for ${factors}.`,
    retrievalGrounding: activity.retrievalReason || "Grounded in semantic retrieval.",
    rankingEvidence: {
      score: activity.score,
      strongestFactors: strongFactors.slice(0, 4),
      semanticScore: activity.semanticScore
    },
    sequencingReason: buildSequencingReason(activity)
  };
};

const buildSequencingReason = (activity) => {
  const routePart = activity.travelFromPrevious
    ? `about ${activity.travelFromPrevious} minutes from the previous activity`
    : `a natural start in the ${activity.localityClusterId || activity.area} cluster`;
  const rolePart = activity.tripRoles?.length
    ? `it can serve as ${activity.tripRoles.slice(0, 2).map((role) => role.replace(/_/g, " ")).join(" or ")}`
    : "it fits the requested activity mix";
  const weatherFit = activity.weatherSuitability?.hot !== undefined
    ? `hot-weather fit ${Math.round(activity.weatherSuitability.hot * 100)}`
    : `weather profile ${activity.weatherSensitivity}`;

  return `${activity.title} is placed in the ${activity.slot} slot because its best time is ${activity.bestTime.join(", ")}, ${routePart}, ${rolePart}, and ${weatherFit}.`;
};

const explainDay = (day) => {
  const types = [...new Set(day.activities.map((activity) => activity.type))];
  const areas = [...new Set(day.activities.map((activity) => activity.area))];

  return {
    themeReason: `This day combines ${types.join(", ")} around ${areas.join(" / ")}.`,
    loadReason: `Fatigue score is ${day.fatigueScore}; estimated travel time is ${day.estimatedTravelMinutes} minutes.`
  };
};

const countBy = (items, key) => {
  return items.reduce((counts, item) => {
    const value = item[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
};

const formatTopCounts = (counts) => {
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (!entries.length) return "no dominant pattern";
  return entries.map(([key, count]) => `${key} (${count})`).join(", ");
};

const average = (values) => {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
};

module.exports = generateExplanations;
