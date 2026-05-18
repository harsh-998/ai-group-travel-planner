const Group = require("../../../models/GroupModel");
const {
  recordPlanningOperationSignal
} = require("../adaptive/adaptiveMemoryService");

const saveGeneratedItinerary = async ({ groupId, planningResult, traceId }) => {
  const group = await Group.findById(groupId);
  if (!group) {
    const error = new Error("Group not found");
    error.statusCode = 404;
    throw error;
  }

  const itinerary = planningResult.itinerary;

  group.itinerary = itinerary.days;
  group.aiPlanning = {
    activeItinerary: itinerary,
    reliability: itinerary.reliability,
    validation: itinerary.validation,
    explanations: itinerary.explanations,
    evaluationMetrics: itinerary.evaluationMetrics,
    adaptiveContext: planningResult.input?.adaptiveContext || itinerary.input?.adaptiveContext || null,
    traceId,
    updatedAt: new Date()
  };

  await group.save();

  return group;
};

const savePartialRegeneration = async ({ groupId, regenerationResult, traceId, userId }) => {
  const group = await Group.findById(groupId);
  if (!group) {
    const error = new Error("Group not found");
    error.statusCode = 404;
    throw error;
  }

  const updated = regenerationResult.updatedItinerary;

  group.itinerary = updated.days;
  group.aiPlanning = {
    ...(group.aiPlanning || {}),
    activeItinerary: updated,
    validation: updated.validation,
    traceId,
    updatedAt: new Date()
  };

  group.regenerationHistory = group.regenerationHistory || [];
  group.regenerationHistory.push({
    operation: regenerationResult.operation,
    impact: regenerationResult.impact,
    explanation: regenerationResult.explanation,
    traceId,
    createdBy: userId,
    createdAt: new Date()
  });

  group.stabilitySnapshots = group.stabilitySnapshots || [];
  group.stabilitySnapshots.push({
    ...regenerationResult.stability,
    traceId,
    createdAt: new Date()
  });

  group.explanationTraces = group.explanationTraces || [];
  group.explanationTraces.push({
    ...regenerationResult.explanation,
    traceId,
    createdAt: new Date()
  });

  await group.save();

  try {
    await recordPlanningOperationSignal({
      groupId,
      userId,
      operation: regenerationResult.operation,
      regenerationResult,
      traceId
    });
  } catch (error) {
    console.warn("Adaptive planning signal skipped:", error.message);
  }

  return group;
};

module.exports = {
  saveGeneratedItinerary,
  savePartialRegeneration
};
