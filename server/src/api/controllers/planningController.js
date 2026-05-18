const Group = require("../../../models/GroupModel");
const { generatePlannedItinerary } = require("../../services/itinerary/itineraryPlanningService");
const {
  saveGeneratedItinerary,
  savePartialRegeneration
} = require("../../services/itinerary/itineraryPersistenceService");
const { regeneratePartialItinerary } = require("../../services/regeneration/partialRegenerationService");
const { validatePlanningItinerary } = require("../../services/validation/itineraryValidationService");
const { timeOperation } = require("../../services/observability/logger");
const {
  getAdaptivePlanningContext,
  recordBehaviorSignal
} = require("../../services/adaptive/adaptiveMemoryService");

const generateItinerary = async (req, res) => {
  const { groupId, input = {} } = req.body;

  const group = await Group.findById(groupId);
  if (!group) return res.status(404).json({ message: "Group not found", traceId: req.traceId });

  const adaptiveContext = await getAdaptivePlanningContext({
    group,
    userId: req.user?._id
  });

  const planningResult = await timeOperation("planning.generate", req.traceId, async () =>
    generatePlannedItinerary(group, {
      ...input,
      adaptiveContext,
      adaptiveProfile: adaptiveContext.effectiveProfile
    })
  );

  await saveGeneratedItinerary({
    groupId,
    planningResult,
    traceId: req.traceId
  });

  res.json({
    itinerary: planningResult.itinerary,
    pipelineDebug: planningResult.pipelineDebug,
    traceId: req.traceId
  });
};

const partialRegenerate = async (req, res) => {
  const { groupId } = req.params;
  const { operation } = req.body;

  const group = await Group.findById(groupId);
  if (!group) return res.status(404).json({ message: "Group not found", traceId: req.traceId });
  const adaptiveContext = await getAdaptivePlanningContext({
    group,
    userId: req.user?._id
  });

  const activeItinerary = group.aiPlanning?.activeItinerary || {
    itineraryId: `group_${group._id}`,
    destination: group.destination,
    input: {
      destination: group.destination,
      days: group.itinerary?.length || 1,
      budget: "balanced",
      interests: ["heritage", "food"]
    },
    optimizationMode: "balanced",
    days: group.itinerary || [],
    validation: { status: "not_validated", errors: [], warnings: [] }
  };

  const regenerationResult = await timeOperation("planning.partial_regenerate", req.traceId, async () =>
    regeneratePartialItinerary({
      itinerary: {
        ...activeItinerary,
        input: {
          ...(activeItinerary.input || {}),
          adaptiveContext,
          adaptiveProfile: adaptiveContext.effectiveProfile
        }
      },
      operation
    })
  );

  await savePartialRegeneration({
    groupId,
    regenerationResult,
    traceId: req.traceId,
    userId: req.user?._id
  });

  res.json({
    ...regenerationResult,
    traceId: req.traceId
  });
};

const recordInteraction = async (req, res) => {
  const { groupId } = req.params;
  const { event } = req.body;

  const result = await recordBehaviorSignal({
    groupId,
    userId: req.user?._id,
    event,
    traceId: req.traceId
  });

  res.json({
    ...result,
    traceId: req.traceId
  });
};

const validateItinerary = async (req, res) => {
  const group = await Group.findById(req.params.groupId);
  if (!group) return res.status(404).json({ message: "Group not found", traceId: req.traceId });

  const activeItinerary = group.aiPlanning?.activeItinerary || {
    days: group.itinerary || [],
    input: { days: group.itinerary?.length || 0 }
  };

  const validation = validatePlanningItinerary(activeItinerary).validation;
  res.json({ validation, traceId: req.traceId });
};

const getExplanations = async (req, res) => {
  const group = await Group.findById(req.params.groupId);
  if (!group) return res.status(404).json({ message: "Group not found", traceId: req.traceId });

  res.json({
    explanations: group.aiPlanning?.activeItinerary?.explanations || group.aiPlanning?.explanations || null,
    traces: group.explanationTraces || [],
    traceId: req.traceId
  });
};

const getStability = async (req, res) => {
  const group = await Group.findById(req.params.groupId);
  if (!group) return res.status(404).json({ message: "Group not found", traceId: req.traceId });

  res.json({
    stabilitySnapshots: group.stabilitySnapshots || [],
    traceId: req.traceId
  });
};

const getHistory = async (req, res) => {
  const group = await Group.findById(req.params.groupId);
  if (!group) return res.status(404).json({ message: "Group not found", traceId: req.traceId });

  res.json({
    regenerationHistory: group.regenerationHistory || [],
    traceId: req.traceId
  });
};

module.exports = {
  generateItinerary,
  partialRegenerate,
  recordInteraction,
  validateItinerary,
  getExplanations,
  getStability,
  getHistory
};
