const NEUTRAL = 0.5;
const MAX_SIGNAL_HISTORY = 250;

const travelStyleDefaults = {
  explorationIntensity: NEUTRAL,
  fatigueTolerance: 0.55,
  walkingTolerance: 0.55,
  spontaneity: NEUTRAL,
  scheduleRigidity: NEUTRAL,
  nightlifeAffinity: NEUTRAL,
  foodExploration: NEUTRAL,
  heritagePreference: NEUTRAL,
  luxuryAffinity: NEUTRAL,
  photographyAffinity: NEUTRAL,
  socialEnergy: NEUTRAL,
  recoveryPreference: NEUTRAL
};

const interactionPatternDefaults = {
  avgRegenerationsPerTrip: 0,
  avgDailyEdits: 0,
  preferredDayDensity: "medium",
  clusterStrictness: 0.55,
  aiSuggestionAcceptanceRate: 0
};

const createPreferenceProfile = (overrides = {}) => ({
  userId: overrides.userId || "",
  travelStyle: {
    ...travelStyleDefaults,
    ...(overrides.travelStyle || {})
  },
  interactionPatterns: {
    ...interactionPatternDefaults,
    ...(overrides.interactionPatterns || {})
  },
  confidence: {
    profileConfidence: clamp01(overrides.confidence?.profileConfidence ?? 0),
    lastUpdatedAt: overrides.confidence?.lastUpdatedAt || new Date().toISOString()
  },
  memoryStats: {
    totalSignals: Number(overrides.memoryStats?.totalSignals || 0),
    acceptedAiSuggestions: Number(overrides.memoryStats?.acceptedAiSuggestions || 0),
    rejectedAiSuggestions: Number(overrides.memoryStats?.rejectedAiSuggestions || 0),
    regenerationCount: Number(overrides.memoryStats?.regenerationCount || 0),
    editCount: Number(overrides.memoryStats?.editCount || 0),
    tripCount: Number(overrides.memoryStats?.tripCount || 0),
    dayEditCounts: {
      ...(overrides.memoryStats?.dayEditCounts || {})
    },
    lastSignalAt: overrides.memoryStats?.lastSignalAt || null
  }
});

const evolvePreferenceProfile = (currentProfile, rawSignals = [], options = {}) => {
  const now = options.now ? new Date(options.now) : new Date();
  const profile = decayProfile(createPreferenceProfile(currentProfile), now);
  const signals = rawSignals.map(normalizeBehaviorSignal).filter(Boolean);

  for (const signal of signals) {
    applySignal(profile, signal);
  }

  profile.interactionPatterns.preferredDayDensity = inferPreferredDayDensity(profile);
  profile.interactionPatterns.aiSuggestionAcceptanceRate = getAcceptanceRate(profile);
  profile.confidence.profileConfidence = calculateConfidence(profile);
  profile.confidence.lastUpdatedAt = now.toISOString();
  profile.memoryStats.lastSignalAt = signals.at(-1)?.createdAt || profile.memoryStats.lastSignalAt || now.toISOString();

  return profile;
};

const normalizeBehaviorSignal = (rawSignal = {}) => {
  const type = rawSignal.type || rawSignal.eventType;
  if (!type) return null;

  const place = rawSignal.place || rawSignal.activityContext || rawSignal.activity || {};
  const metadata = rawSignal.metadata || {};

  return {
    id: rawSignal.id || `signal_${Date.now()}_${Math.round(Math.random() * 100000)}`,
    type,
    source: rawSignal.source || "workspace",
    userId: rawSignal.userId || "",
    groupId: rawSignal.groupId || "",
    traceId: rawSignal.traceId || "",
    activityId: rawSignal.activityId || rawSignal.placeId || place.placeId || place.id || "",
    day: Number(rawSignal.day || metadata.day || 0) || null,
    weight: clamp(Number(rawSignal.weight ?? 1), 0.1, 3),
    createdAt: rawSignal.createdAt || new Date().toISOString(),
    place: {
      type: place.type || rawSignal.activityType || "",
      tags: normalizeList(place.tags || rawSignal.tags),
      vibeTags: normalizeList(place.vibeTags || rawSignal.vibeTags),
      tripRoles: normalizeList(place.tripRoles || rawSignal.tripRoles),
      localityClusterId: place.localityClusterId || rawSignal.localityClusterId || "",
      routeZone: place.routeZone || rawSignal.routeZone || "",
      budgetTier: place.budgetTier || rawSignal.budgetTier || "",
      fatigueScore: Number(place.fatigueScore ?? rawSignal.fatigueScore ?? 0),
      durationMinutes: Number(place.durationMinutes ?? rawSignal.durationMinutes ?? 0)
    },
    metadata
  };
};

const appendSignalHistory = (existingSignals = [], signal) => [
  ...existingSignals,
  signal
].slice(-MAX_SIGNAL_HISTORY);

const mergePreferenceProfiles = (profiles = []) => {
  const usable = profiles.filter(Boolean).map(createPreferenceProfile);
  if (!usable.length) return createPreferenceProfile();

  const weighted = usable.map((profile) => ({
    profile,
    weight: Math.max(0.15, profile.confidence.profileConfidence || 0)
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const merged = createPreferenceProfile();

  for (const key of Object.keys(travelStyleDefaults)) {
    merged.travelStyle[key] = Number(
      (weighted.reduce((sum, item) => sum + item.profile.travelStyle[key] * item.weight, 0) / totalWeight).toFixed(3)
    );
  }

  merged.interactionPatterns = {
    ...interactionPatternDefaults,
    clusterStrictness: Number(
      (weighted.reduce((sum, item) => sum + item.profile.interactionPatterns.clusterStrictness * item.weight, 0) / totalWeight).toFixed(3)
    ),
    avgRegenerationsPerTrip: average(usable.map((profile) => profile.interactionPatterns.avgRegenerationsPerTrip)),
    avgDailyEdits: average(usable.map((profile) => profile.interactionPatterns.avgDailyEdits)),
    preferredDayDensity: inferPreferredDayDensity(merged),
    aiSuggestionAcceptanceRate: average(usable.map((profile) => profile.interactionPatterns.aiSuggestionAcceptanceRate))
  };
  merged.confidence.profileConfidence = clamp01(average(usable.map((profile) => profile.confidence.profileConfidence)));
  merged.confidence.lastUpdatedAt = new Date().toISOString();
  merged.memoryStats.totalSignals = usable.reduce((sum, profile) => sum + profile.memoryStats.totalSignals, 0);

  return merged;
};

const summarizePreferenceProfile = (profileInput) => {
  const profile = createPreferenceProfile(profileInput);
  const style = profile.travelStyle;
  const strongest = Object.entries(style)
    .map(([key, value]) => ({ key, value, distance: Math.abs(value - NEUTRAL) }))
    .filter((item) => item.distance >= 0.12)
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 6);

  return {
    profileConfidence: profile.confidence.profileConfidence,
    preferredDayDensity: profile.interactionPatterns.preferredDayDensity,
    clusterStrictness: profile.interactionPatterns.clusterStrictness,
    strongestSignals: strongest.map((item) => ({
      dimension: item.key,
      direction: item.value >= NEUTRAL ? "positive" : "negative",
      value: Number(item.value.toFixed(2))
    }))
  };
};

const decayProfile = (profile, now) => {
  const lastUpdated = profile.confidence.lastUpdatedAt
    ? new Date(profile.confidence.lastUpdatedAt)
    : now;
  const daysSinceUpdate = Math.max(0, (now - lastUpdated) / (1000 * 60 * 60 * 24));
  const decayStrength = clamp(daysSinceUpdate / 45, 0, 0.18);

  if (decayStrength <= 0) return profile;

  for (const key of Object.keys(profile.travelStyle)) {
    profile.travelStyle[key] = moveToward(profile.travelStyle[key], NEUTRAL, decayStrength);
  }

  profile.interactionPatterns.clusterStrictness = moveToward(
    profile.interactionPatterns.clusterStrictness,
    interactionPatternDefaults.clusterStrictness,
    decayStrength
  );

  return profile;
};

const applySignal = (profile, signal) => {
  const impacts = getSignalImpacts(signal);
  const scaledWeight = signal.weight * 0.055;

  for (const [dimension, delta] of Object.entries(impacts.travelStyle || {})) {
    profile.travelStyle[dimension] = clamp01(
      profile.travelStyle[dimension] + delta * scaledWeight
    );
  }

  for (const [dimension, delta] of Object.entries(impacts.interactionPatterns || {})) {
    profile.interactionPatterns[dimension] = clamp01(
      profile.interactionPatterns[dimension] + delta * scaledWeight
    );
  }

  profile.memoryStats.totalSignals += 1;
  if (impacts.counts?.edit) profile.memoryStats.editCount += 1;
  if (impacts.counts?.regeneration) profile.memoryStats.regenerationCount += 1;
  if (impacts.counts?.acceptedAiSuggestion) profile.memoryStats.acceptedAiSuggestions += 1;
  if (impacts.counts?.rejectedAiSuggestion) profile.memoryStats.rejectedAiSuggestions += 1;

  if (signal.day) {
    const key = String(signal.day);
    profile.memoryStats.dayEditCounts[key] = Number(profile.memoryStats.dayEditCounts[key] || 0) + 1;
  }

  const tripCount = Math.max(1, profile.memoryStats.tripCount || 1);
  profile.interactionPatterns.avgRegenerationsPerTrip = Number(
    (profile.memoryStats.regenerationCount / tripCount).toFixed(2)
  );
  profile.interactionPatterns.avgDailyEdits = calculateAverageDailyEdits(profile);
};

const getSignalImpacts = (signal) => {
  const type = signal.type;
  const placeImpacts = getPlaceImpacts(signal.place);

  if (type === "activity_pinned" || type === "activity_duplicated") {
    return {
      travelStyle: {
        ...scaleImpacts(placeImpacts, 0.9),
        scheduleRigidity: 0.25
      },
      counts: { edit: true }
    };
  }

  if (type === "activity_unpinned") {
    return {
      travelStyle: {
        ...scaleImpacts(placeImpacts, -0.25),
        scheduleRigidity: -0.12
      },
      counts: { edit: true }
    };
  }

  if (type === "activity_replaced" || type === "activity_removed") {
    return {
      travelStyle: {
        ...scaleImpacts(placeImpacts, -0.85),
        spontaneity: 0.35,
        scheduleRigidity: -0.25
      },
      counts: { edit: true, regeneration: type === "activity_replaced" }
    };
  }

  if (type === "activity_moved_day" || type === "activity_moved") {
    return {
      travelStyle: {
        spontaneity: 0.22,
        scheduleRigidity: -0.18
      },
      interactionPatterns: {
        clusterStrictness: signal.metadata?.sameClusterFlow === false ? 0.28 : 0.1
      },
      counts: { edit: true }
    };
  }

  if (type === "day_regenerated") {
    return {
      travelStyle: {
        spontaneity: 0.28,
        scheduleRigidity: -0.18
      },
      counts: { edit: true, regeneration: true }
    };
  }

  if (type === "ai_suggestion_accepted") {
    return {
      travelStyle: {
        ...getAiActionImpacts(signal.metadata?.actionId),
        spontaneity: 0.16
      },
      counts: { edit: true, acceptedAiSuggestion: true }
    };
  }

  if (type === "recovery_block_added") {
    return {
      travelStyle: {
        recoveryPreference: 0.8,
        fatigueTolerance: -0.35,
        walkingTolerance: -0.18
      },
      counts: { edit: true }
    };
  }

  if (type === "duration_extended") {
    return {
      travelStyle: {
        recoveryPreference: 0.34,
        scheduleRigidity: 0.14
      },
      counts: { edit: true }
    };
  }

  if (type === "planning_note_added") {
    return {
      travelStyle: {},
      counts: { edit: true }
    };
  }

  return {
    travelStyle: scaleImpacts(placeImpacts, 0.2),
    counts: { edit: true }
  };
};

const getPlaceImpacts = (place = {}) => {
  const tags = new Set([
    place.type,
    ...(place.tags || []),
    ...(place.vibeTags || []),
    ...(place.tripRoles || [])
  ].map(normalize));
  const impacts = {};

  if (tags.has("food") || tags.has("cafe") || tags.has("street food") || tags.has("recovery_activity")) {
    impacts.foodExploration = 0.85;
    impacts.recoveryPreference = 0.22;
  }
  if (tags.has("heritage") || tags.has("culture") || tags.has("museum") || tags.has("anchor_activity")) {
    impacts.heritagePreference = 0.75;
    impacts.explorationIntensity = 0.18;
  }
  if (tags.has("nightlife") || tags.has("bar") || tags.has("nightlife_activity")) {
    impacts.nightlifeAffinity = 0.9;
    impacts.socialEnergy = 0.45;
  }
  if (tags.has("photography") || tags.has("viewpoint") || tags.has("sunset") || tags.has("scenic")) {
    impacts.photographyAffinity = 0.82;
    impacts.explorationIntensity = 0.22;
  }
  if (tags.has("shopping") || tags.has("market") || tags.has("bazaar")) {
    impacts.socialEnergy = 0.18;
    impacts.explorationIntensity = 0.16;
  }
  if (tags.has("recovery") || tags.has("wellness") || tags.has("garden")) {
    impacts.recoveryPreference = 0.72;
  }
  if (["high", "luxury"].includes(normalize(place.budgetTier))) {
    impacts.luxuryAffinity = 0.65;
  }
  if (Number(place.fatigueScore || 0) >= 28) {
    impacts.fatigueTolerance = 0.45;
    impacts.walkingTolerance = 0.28;
  }

  return impacts;
};

const getAiActionImpacts = (actionId) => {
  const impacts = {
    optimize_route: { scheduleRigidity: 0.22 },
    rebalance_fatigue: { recoveryPreference: 0.75, fatigueTolerance: -0.4, walkingTolerance: -0.25 },
    add_hidden_gems: { explorationIntensity: 0.7, spontaneity: 0.45 },
    make_relaxed: { recoveryPreference: 0.7, fatigueTolerance: -0.32, scheduleRigidity: -0.1 },
    increase_exploration: { explorationIntensity: 0.7, walkingTolerance: 0.18 },
    add_food_stops: { foodExploration: 0.8, recoveryPreference: 0.28 },
    weather_proof: { scheduleRigidity: 0.14, recoveryPreference: 0.14 },
    reduce_budget: { luxuryAffinity: -0.52 },
    add_nightlife: { nightlifeAffinity: 0.75, socialEnergy: 0.48 },
    luxury_flow: { luxuryAffinity: 0.76, scheduleRigidity: 0.18 }
  };

  return impacts[actionId] || {};
};

const inferPreferredDayDensity = (profile) => {
  const style = profile.travelStyle;
  if (style.recoveryPreference > 0.66 || style.fatigueTolerance < 0.42) return "low";
  if (style.explorationIntensity > 0.68 && style.fatigueTolerance > 0.56) return "high";
  return "medium";
};

const getAcceptanceRate = (profile) => {
  const accepted = profile.memoryStats.acceptedAiSuggestions;
  const rejected = profile.memoryStats.rejectedAiSuggestions;
  const total = accepted + rejected;
  if (!total) return 0;
  return Number((accepted / total).toFixed(2));
};

const calculateConfidence = (profile) => {
  const signalConfidence = 1 - Math.exp(-profile.memoryStats.totalSignals / 18);
  const diversityCount = Object.values(profile.travelStyle)
    .filter((value) => Math.abs(value - NEUTRAL) > 0.08)
    .length;
  return Number(clamp01(signalConfidence * 0.78 + Math.min(0.22, diversityCount * 0.025)).toFixed(2));
};

const calculateAverageDailyEdits = (profile) => {
  const counts = Object.values(profile.memoryStats.dayEditCounts || {});
  if (!counts.length) return 0;
  return Number((counts.reduce((sum, count) => sum + count, 0) / counts.length).toFixed(2));
};

const scaleImpacts = (impacts, multiplier) => Object.fromEntries(
  Object.entries(impacts).map(([key, value]) => [key, value * multiplier])
);

const normalizeList = (value = []) => (
  Array.isArray(value) ? value : [value]
).filter(Boolean).map(normalize);

const normalize = (value) => String(value || "").trim().toLowerCase().replace(/_/g, " ");
const average = (values) => Number((values.reduce((sum, value) => sum + Number(value || 0), 0) / Math.max(1, values.length)).toFixed(2));
const moveToward = (value, target, amount) => clamp01(value + (target - value) * amount);
const clamp01 = (value) => clamp(value, 0, 1);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

module.exports = {
  MAX_SIGNAL_HISTORY,
  appendSignalHistory,
  createPreferenceProfile,
  evolvePreferenceProfile,
  mergePreferenceProfiles,
  normalizeBehaviorSignal,
  summarizePreferenceProfile
};
