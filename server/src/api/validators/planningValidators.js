const allowedOperations = new Set([
  "replaceActivity",
  "regenerateDay",
  "reoptimizeSegment",
  "updateConstraint",
  "weatherDisruption",
  "openingHoursConflict",
  "travelDelay"
]);

const validateGenerateItinerary = (req) => {
  const errors = [];

  if (!req.body.groupId) errors.push("groupId is required.");

  return {
    valid: errors.length === 0,
    errors
  };
};

const validatePartialRegeneration = (req) => {
  const errors = [];
  const operation = req.body.operation;

  if (!operation || typeof operation !== "object") {
    errors.push("operation object is required.");
  } else if (!allowedOperations.has(operation.type)) {
    errors.push(`operation.type must be one of: ${[...allowedOperations].join(", ")}.`);
  }

  if (operation?.type === "replaceActivity" && !operation.activityId) {
    errors.push("activityId is required for replaceActivity.");
  }

  if (operation?.type === "regenerateDay" && !operation.day) {
    errors.push("day is required for regenerateDay.");
  }

  if (operation?.type === "reoptimizeSegment" && !operation.segmentId && !operation.day) {
    errors.push("segmentId or day is required for reoptimizeSegment.");
  }

  if (operation?.type === "updateConstraint" && (!operation.constraintId || operation.value === undefined)) {
    errors.push("constraintId and value are required for updateConstraint.");
  }

  if (operation?.type === "travelDelay" && (!operation.activityId || operation.delayMinutes === undefined)) {
    errors.push("activityId and delayMinutes are required for travelDelay.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const validateBehaviorSignal = (req) => {
  const errors = [];
  const event = req.body.event;

  if (!event || typeof event !== "object") {
    errors.push("event object is required.");
  } else if (!event.type && !event.eventType) {
    errors.push("event.type is required.");
  }

  if (!req.params.groupId) errors.push("groupId is required.");

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateGenerateItinerary,
  validatePartialRegeneration,
  validateBehaviorSignal
};
