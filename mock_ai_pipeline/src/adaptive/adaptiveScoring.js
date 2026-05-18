const { clamp } = require("../utils");
const { createPreferenceProfile } = require("./preferenceProfile");

const getAdaptiveProfile = (tripInput = {}) => (
  tripInput.adaptiveProfile ||
  tripInput.preferenceProfile ||
  tripInput.adaptiveContext?.effectiveProfile ||
  null
);

const buildAdaptiveWeights = (baseWeights, tripInput = {}) => {
  const rawProfile = getAdaptiveProfile(tripInput);
  if (!rawProfile) return baseWeights;

  const profile = createPreferenceProfile(rawProfile);
  const confidence = clamp(profile.confidence.profileConfidence || 0, 0, 1);
  if (confidence <= 0.02) return baseWeights;

  const style = profile.travelStyle;
  const patterns = profile.interactionPatterns;
  const influence = confidence * 0.34;
  const weights = { ...baseWeights };

  weights.preference = (weights.preference || 0) + influence * 0.22;
  weights.adaptivePreference = (weights.adaptivePreference || 0) + influence * 0.32;
  weights.distance = (weights.distance || 0) + influence * 0.12 * patterns.clusterStrictness;
  weights.clustering = (weights.clustering || 0) + influence * 0.18 * patterns.clusterStrictness;

  if (style.recoveryPreference > 0.58 || style.fatigueTolerance < 0.48) {
    weights.comfort = (weights.comfort || 0) + influence * 0.26;
  }

  if (style.explorationIntensity > 0.62) {
    weights.diversity = (weights.diversity || 0) + influence * 0.18;
    weights.semantic = (weights.semantic || 0) + influence * 0.1;
  }

  if (style.scheduleRigidity > 0.62) {
    weights.timeFit = (weights.timeFit || 0) + influence * 0.18;
    weights.distance = (weights.distance || 0) + influence * 0.1;
  }

  if (style.luxuryAffinity > 0.62) {
    weights.quality = (weights.quality || 0) + influence * 0.18;
    weights.budget = Math.max((weights.budget || 0) - influence * 0.08, 0.03);
  }

  return weights;
};

const scoreAdaptivePreference = (place, tripInput = {}) => {
  const rawProfile = getAdaptiveProfile(tripInput);
  if (!rawProfile) return 70;

  const profile = createPreferenceProfile(rawProfile);
  const confidence = clamp(profile.confidence.profileConfidence || 0, 0, 1);
  if (confidence <= 0.02) return 70;

  const style = profile.travelStyle;
  const tags = new Set([
    place.type,
    place.primaryCategory,
    place.localityClusterId,
    ...(place.tags || []),
    ...(place.subcategories || []),
    ...(place.vibeTags || []),
    ...(place.tripRoles || [])
  ].map(normalize));

  let score = 70;

  if (hasAny(tags, ["food", "cafe", "street food", "recovery_activity"])) {
    score += preferenceDelta(style.foodExploration, 30);
    score += preferenceDelta(style.recoveryPreference, 10);
  }

  if (hasAny(tags, ["heritage", "culture", "museum", "palace", "fort", "anchor_activity"])) {
    score += preferenceDelta(style.heritagePreference, 28);
  }

  if (hasAny(tags, ["nightlife", "bar", "nightlife_activity"])) {
    score += preferenceDelta(style.nightlifeAffinity, 34);
    score += preferenceDelta(style.socialEnergy, 12);
  }

  if (hasAny(tags, ["photography", "viewpoint", "sunset", "scenic"])) {
    score += preferenceDelta(style.photographyAffinity, 26);
  }

  if (hasAny(tags, ["hidden gem", "walking", "bazaar", "market", "exploration_activity"])) {
    score += preferenceDelta(style.explorationIntensity, 22);
  }

  if (hasAny(tags, ["recovery", "garden", "wellness"]) || place.tripRoles?.includes("recovery_activity")) {
    score += preferenceDelta(style.recoveryPreference, 22);
  }

  if (["high", "luxury"].includes(normalize(place.budgetTier))) {
    score += preferenceDelta(style.luxuryAffinity, 24);
  }

  const fatigueScore = Number(place.fatigueScore || 0);
  if (fatigueScore >= 28) {
    score += preferenceDelta(style.fatigueTolerance, 26);
    score += preferenceDelta(style.walkingTolerance, 14);
  } else if (fatigueScore <= 8) {
    score += preferenceDelta(style.recoveryPreference, 12);
  }

  return Math.round(clamp(70 + (score - 70) * confidence, 20, 100));
};

const explainAdaptiveFit = (place, tripInput = {}) => {
  const rawProfile = getAdaptiveProfile(tripInput);
  if (!rawProfile) return null;

  const profile = createPreferenceProfile(rawProfile);
  const score = scoreAdaptivePreference(place, tripInput);
  if (profile.confidence.profileConfidence < 0.15) return null;

  const reasons = [];
  if (place.type === "food" && profile.travelStyle.foodExploration > 0.62) {
    reasons.push("learned food exploration preference");
  }
  if (place.tripRoles?.includes("recovery_activity") && profile.travelStyle.recoveryPreference > 0.62) {
    reasons.push("recovery blocks are trending positive");
  }
  if (place.tripRoles?.includes("nightlife_activity") && profile.travelStyle.nightlifeAffinity < 0.38) {
    reasons.push("nightlife affinity is currently low");
  }
  if (Number(place.fatigueScore || 0) >= 28 && profile.travelStyle.fatigueTolerance < 0.45) {
    reasons.push("profile indicates lower fatigue tolerance");
  }

  if (!reasons.length) return `Adaptive fit ${score}/100 from current preference memory.`;
  return `Adaptive fit ${score}/100: ${reasons.slice(0, 2).join(", ")}.`;
};

const preferenceDelta = (value, range) => (Number(value || 0.5) - 0.5) * range;
const hasAny = (set, values) => values.some((value) => set.has(normalize(value)));
const normalize = (value) => String(value || "").trim().toLowerCase().replace(/_/g, " ");

module.exports = {
  buildAdaptiveWeights,
  explainAdaptiveFit,
  getAdaptiveProfile,
  scoreAdaptivePreference
};
