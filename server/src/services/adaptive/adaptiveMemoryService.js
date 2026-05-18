const path = require("path");
const Group = require("../../../models/GroupModel");
const User = require("../../../models/userModal");

const preferenceProfilePath = path.resolve(
  __dirname,
  "../../../../mock_ai_pipeline/src/adaptive/preferenceProfile"
);
const {
  appendSignalHistory,
  createPreferenceProfile,
  evolvePreferenceProfile,
  mergePreferenceProfiles,
  normalizeBehaviorSignal,
  summarizePreferenceProfile
} = require(preferenceProfilePath);

const getAdaptivePlanningContext = async ({ group, userId }) => {
  const user = userId ? await User.findById(userId).lean() : null;
  const groupProfile = group?.adaptivePlanning?.preferenceProfile
    ? createPreferenceProfile(group.adaptivePlanning.preferenceProfile)
    : createPreferenceProfile({ userId: String(userId || "") });
  const userProfile = user?.adaptivePreferenceProfile
    ? createPreferenceProfile(user.adaptivePreferenceProfile)
    : createPreferenceProfile({ userId: String(userId || "") });
  const effectiveProfile = mergePreferenceProfiles([groupProfile, userProfile]);

  return {
    enabled: true,
    effectiveProfile,
    groupProfile,
    userProfile,
    summary: summarizePreferenceProfile(effectiveProfile)
  };
};

const recordBehaviorSignal = async ({ groupId, userId, event, traceId }) => {
  const group = await Group.findById(groupId);
  if (!group) {
    const error = new Error("Group not found");
    error.statusCode = 404;
    throw error;
  }

  const signal = normalizeBehaviorSignal({
    ...event,
    groupId: String(groupId),
    userId: String(userId || ""),
    traceId
  });

  if (!signal) {
    const error = new Error("A valid behavior signal type is required.");
    error.statusCode = 400;
    throw error;
  }

  const groupSignals = appendSignalHistory(group.adaptivePlanning?.behaviorSignals || [], signal);
  const groupProfile = evolvePreferenceProfile(
    group.adaptivePlanning?.preferenceProfile,
    [signal]
  );

  group.adaptivePlanning = {
    ...(group.adaptivePlanning || {}),
    preferenceProfile: groupProfile,
    behaviorSignals: groupSignals,
    summary: summarizePreferenceProfile(groupProfile),
    lastUpdatedAt: new Date()
  };

  let userProfile = null;
  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      const userSignals = appendSignalHistory(user.behaviorSignals || [], signal);
      userProfile = evolvePreferenceProfile(
        user.adaptivePreferenceProfile,
        [signal]
      );
      user.adaptivePreferenceProfile = userProfile;
      user.behaviorSignals = userSignals;
      await user.save();
    }
  }

  await group.save();

  const adaptiveContext = await getAdaptivePlanningContext({ group, userId });
  return {
    signal,
    adaptivePlanning: group.adaptivePlanning,
    adaptiveContext,
    userPreferenceProfile: userProfile
  };
};

const recordPlanningOperationSignal = async ({ groupId, userId, operation, regenerationResult, traceId }) => {
  const event = operationToBehaviorSignal(operation, regenerationResult);
  if (!event) return null;
  return recordBehaviorSignal({
    groupId,
    userId,
    event,
    traceId
  });
};

const operationToBehaviorSignal = (operation = {}, regenerationResult = {}) => {
  if (operation.type === "replaceActivity") {
    return {
      type: "activity_replaced",
      source: "partial_regeneration",
      activityId: operation.activityId,
      place: operation.activityContext || operation.place || {},
      metadata: {
        reason: operation.reason,
        replacementInterests: operation.replacementInterests || [],
        skipped: regenerationResult.skipped === true,
        changeLog: regenerationResult.explanation?.changeLog || []
      }
    };
  }

  if (operation.type === "regenerateDay") {
    return {
      type: "day_regenerated",
      source: "partial_regeneration",
      day: operation.day,
      metadata: {
        reason: operation.reason,
        replacementInterests: operation.replacementInterests || [],
        skipped: regenerationResult.skipped === true
      }
    };
  }

  if (operation.type === "weatherDisruption") {
    return {
      type: "ai_suggestion_accepted",
      source: "partial_regeneration",
      day: operation.day,
      metadata: {
        actionId: "weather_proof",
        reason: operation.reason
      }
    };
  }

  return null;
};

module.exports = {
  getAdaptivePlanningContext,
  recordBehaviorSignal,
  recordPlanningOperationSignal
};
