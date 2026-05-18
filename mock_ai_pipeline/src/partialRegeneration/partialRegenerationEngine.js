const retrieveCandidates = require("../retrieveCandidates");
const scoreCandidates = require("../scoreCandidates");
const validateItinerary = require("../validateItinerary");
const { estimateTravelMinutes, minutesToTime, parseDisplayTime } = require("../utils");
const { buildItineraryGraph } = require("./itineraryGraph");
const analyzeImpact = require("./impactAnalysis");
const scoreStability = require("./stabilityScoring");

const runPartialRegeneration = ({ itinerary, operation }) => {
  const before = deepClone(itinerary);
  const graph = buildItineraryGraph(before);
  const impact = analyzeImpact({ graph, itinerary: before, operation });
  const updated = deepClone(before);
  const changeLog = [];

  if (!impact.affectedNodeIds.length && operation.type !== "travelDelay") {
    return buildResult({ before, updated, operation, impact, changeLog, skipped: true });
  }

  if (operation.type === "replaceActivity") {
    replaceActivity({ itinerary: updated, operation, impact, changeLog });
  }

  if (operation.type === "regenerateDay") {
    regenerateDay({ itinerary: updated, operation, impact, changeLog });
  }

  if (operation.type === "reoptimizeSegment") {
    replaceAffectedActivities({ itinerary: updated, operation, impact, changeLog });
  }

  if (operation.type === "updateConstraint") {
    updated.input = {
      ...updated.input,
      [operation.constraintId]: operation.value,
      optimizationMode: operation.constraintId === "budget" ? operation.value : updated.input.optimizationMode
    };
    replaceAffectedActivities({ itinerary: updated, operation, impact, changeLog });
  }

  if (operation.type === "weatherDisruption") {
    replaceAffectedActivities({
      itinerary: updated,
      operation: {
        ...operation,
        replacementInterests: ["indoor", "food", "museum", "culture"]
      },
      impact,
      changeLog,
      candidateFilter: (candidate) => candidate.weatherSensitivity !== "outdoor"
    });
  }

  if (operation.type === "openingHoursConflict") {
    replaceActivity({
      itinerary: updated,
      operation: {
        ...operation,
        replacementInterests: operation.replacementInterests || ["indoor", "food", "culture"]
      },
      impact,
      changeLog
    });
  }

  if (operation.type === "travelDelay") {
    applyTravelDelay({ itinerary: updated, operation, impact, changeLog });
  }

  for (const dayId of impact.affectedDayIds) {
    recomputeDayStats(updated, dayId);
  }

  const validated = validateItinerary(updated);
  return buildResult({ before, updated: validated, operation, impact, changeLog });
};

const replaceActivity = ({ itinerary, operation, impact, changeLog }) => {
  const target = findActivity(itinerary, operation.activityId);
  if (!target || target.activity.locked) return;

  const replacement = selectReplacement({
    itinerary,
    targetActivity: target.activity,
    operation,
    excludeIds: preservedAndExistingIds(itinerary, target.activity.placeId),
    candidateFilter: operation.candidateFilter
  });

  if (!replacement) return;

  target.day.activities[target.index] = candidateToActivity(replacement, target.activity);
  changeLog.push({
    type: "replaceActivity",
    from: target.activity.placeId,
    to: replacement.id,
    day: target.day.day,
    reason: operation.reason || "Localized replacement requested."
  });

  markRecomputed(target.day.activities[target.index], impact);
};

const replaceAffectedActivities = ({ itinerary, operation, impact, changeLog, candidateFilter }) => {
  for (const activityId of impact.affectedNodeIds) {
    const target = findActivity(itinerary, activityId);
    if (!target || target.activity.locked) continue;

    const replacement = selectReplacement({
      itinerary,
      targetActivity: target.activity,
      operation,
      excludeIds: preservedAndExistingIds(itinerary, target.activity.placeId),
      candidateFilter
    });

    if (!replacement) continue;

    target.day.activities[target.index] = candidateToActivity(replacement, target.activity);
    changeLog.push({
      type: "replaceActivity",
      from: target.activity.placeId,
      to: replacement.id,
      day: target.day.day,
      reason: operation.reason || `${operation.type} affected this activity.`
    });
    markRecomputed(target.day.activities[target.index], impact);
  }
};

const regenerateDay = ({ itinerary, operation, impact, changeLog }) => {
  const day = itinerary.days.find((item) => item.day === operation.day);
  if (!day) return;

  const lockedActivities = day.activities.filter((activity) => activity.locked);
  const unlockedActivities = day.activities.filter((activity) => !activity.locked);

  for (const activity of unlockedActivities) {
    const replacement = selectReplacement({
      itinerary,
      targetActivity: activity,
      operation,
      excludeIds: preservedAndExistingIds(itinerary, activity.placeId),
      candidateFilter: operation.candidateFilter
    });

    if (!replacement) continue;

    const index = day.activities.findIndex((item) => item.placeId === activity.placeId);
    day.activities[index] = candidateToActivity(replacement, activity);
    markRecomputed(day.activities[index], impact);
    changeLog.push({
      type: "replaceActivity",
      from: activity.placeId,
      to: replacement.id,
      day: day.day,
      reason: `Day ${day.day} localized regeneration.`
    });
  }

  for (const locked of lockedActivities) {
    changeLog.push({
      type: "preserveLockedActivity",
      activityId: locked.placeId,
      day: day.day,
      reason: "Locked activity preserved during day regeneration."
    });
  }
};

const applyTravelDelay = ({ itinerary, operation, impact, changeLog }) => {
  const target = findActivity(itinerary, operation.activityId);
  if (!target) return;

  const delay = Number(operation.delayMinutes || 0);
  const affected = target.day.activities.slice(target.index + 1);

  for (const activity of affected) {
    const current = parseDisplayTime(activity.time);
    if (Number.isNaN(current)) continue;
    activity.time = minutesToTime(current + delay);
    activity.regenerationMeta = {
      ...(activity.regenerationMeta || {}),
      recomputed: true,
      recomputeReason: `Shifted by ${delay} minutes due to travel delay.`
    };
  }

  changeLog.push({
    type: "shiftTiming",
    after: operation.activityId,
    delayMinutes: delay,
    affectedActivities: affected.map((activity) => activity.placeId)
  });
};

const selectReplacement = ({ itinerary, targetActivity, operation, excludeIds, candidateFilter }) => {
  const replacementInterests = operation.replacementInterests ||
    operation.interests ||
    targetActivity.tags ||
    [targetActivity.type];

  const scopedInput = {
    ...itinerary.input,
    interests: replacementInterests,
    budget: operation.constraintId === "budget" ? operation.value : itinerary.input?.budget,
    optimizationMode: operation.constraintId === "budget" ? operation.value : itinerary.input?.optimizationMode
  };

  const { candidates } = retrieveCandidates(scopedInput);
  const ranked = scoreCandidates(candidates, scopedInput);

  return ranked.find((candidate) => {
    if (excludeIds.has(candidate.id)) return false;
    if (candidate.id === targetActivity.placeId) return false;
    if (candidateFilter && !candidateFilter(candidate)) return false;
    if (operation.preserveType && candidate.type !== targetActivity.type) return false;
    if (targetActivity.slot && candidate.bestTime?.length && !candidate.bestTime.includes(targetActivity.slot)) {
      return operation.allowSlotMismatch === true;
    }
    return true;
  });
};

const candidateToActivity = (candidate, previousActivity) => ({
  placeId: candidate.id,
  time: previousActivity.time,
  durationMinutes: candidate.durationMinutes,
  title: candidate.name,
  description: candidate.description,
  type: candidate.type,
  tags: candidate.tags,
  slot: previousActivity.slot,
  bestTime: candidate.bestTime,
  area: candidate.area,
  coordinates: candidate.coordinates,
  budgetTier: candidate.budgetTier,
  estimatedCost: candidate.estimatedCost,
  fatigueScore: candidate.fatigueScore,
  score: candidate.score,
  semanticScore: candidate.semanticScore,
  source: "partial_regeneration",
  retrievalReason: candidate.retrievalReason,
  semanticSignals: candidate.semanticSignals,
  selectionReason: candidate.selectionReason,
  adaptiveFitReason: candidate.adaptiveFitReason,
  scoreBreakdown: candidate.scoreBreakdown,
  locked: false,
  weatherSensitivity: candidate.weatherSensitivity,
  regenerationMeta: {
    recomputed: true,
    previousPlaceId: previousActivity.placeId,
    preservedTime: previousActivity.time,
    preservedSlot: previousActivity.slot
  }
});

const recomputeDayStats = (itinerary, dayId) => {
  const day = itinerary.days.find((item) => item.day === dayId);
  if (!day) return;

  let travelMinutes = 0;
  for (let i = 1; i < day.activities.length; i += 1) {
    travelMinutes += estimateTravelMinutes(
      activityLikePlace(day.activities[i - 1]),
      activityLikePlace(day.activities[i])
    );
  }

  day.fatigueScore = day.activities.reduce((sum, activity) => sum + Number(activity.fatigueScore || estimateFatigue(activity)), 0);
  day.estimatedTravelMinutes = travelMinutes;
  day.subtitle = `${day.activities.length} planned stops after localized regeneration.`;
};

const activityLikePlace = (activity) => ({
  coordinates: activity.coordinates || approximateCoordinates(activity)
});

const approximateCoordinates = () => null;

const estimateFatigue = (activity) => {
  if (activity.type === "food") return 5;
  if (activity.type === "heritage") return 25;
  if (activity.type === "viewpoint") return 25;
  if (activity.type === "adventure") return 55;
  return 15;
};

const buildResult = ({ before, updated, operation, impact, changeLog, skipped = false }) => {
  const stability = scoreStability(before, updated);
  const preserved = impact.preservedNodeIds;
  const recomputed = changeLog
    .filter((entry) => entry.to || entry.affectedActivities)
    .flatMap((entry) => entry.to ? [entry.to] : entry.affectedActivities);

  return {
    operation,
    skipped,
    updatedItinerary: updated,
    impact,
    stability,
    explanation: {
      changeReason: operation.reason || impact.reasons.join(" "),
      preserved,
      recomputed,
      constraintsTriggered: impact.affectedConstraints,
      changeLog
    }
  };
};

const markRecomputed = (activity, impact) => {
  activity.regenerationMeta = {
    ...(activity.regenerationMeta || {}),
    recomputed: true,
    affectedConstraints: impact.affectedConstraints
  };
};

const findActivity = (itinerary, activityId) => {
  for (const day of itinerary.days || []) {
    const index = day.activities.findIndex((activity) => activity.placeId === activityId);
    if (index >= 0) return { day, index, activity: day.activities[index] };
  }
  return null;
};

const preservedAndExistingIds = (itinerary, exceptId) => new Set(
  (itinerary.days || [])
    .flatMap((day) => day.activities || [])
    .map((activity) => activity.placeId)
    .filter((id) => id !== exceptId)
);

const deepClone = (value) => JSON.parse(JSON.stringify(value));

module.exports = runPartialRegeneration;
