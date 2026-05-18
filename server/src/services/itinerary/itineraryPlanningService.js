const path = require("path");

const mockPipelinePath = path.resolve(__dirname, "../../../../mock_ai_pipeline/src/runPipeline");
const { runPipeline } = require(mockPipelinePath);

const buildTripInputFromGroup = (group, overrideInput = {}) => {
  const start = group.startDate ? new Date(group.startDate) : new Date();
  const end = group.endDate ? new Date(group.endDate) : new Date(start);
  if (!group.endDate) end.setDate(start.getDate() + 2);

  const days = Math.max(
    1,
    Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
  );

  return {
    destination: group.destination || group.groupName,
    days,
    budget: overrideInput.budget || "balanced",
    optimizationMode: overrideInput.optimizationMode || overrideInput.budget || "balanced",
    interests: overrideInput.interests || ["heritage", "food"],
    adaptiveProfile: overrideInput.adaptiveProfile || overrideInput.adaptiveContext?.effectiveProfile || null,
    adaptiveContext: overrideInput.adaptiveContext || null,
    ...overrideInput
  };
};

const generatePlannedItinerary = (group, overrideInput = {}) => {
  const input = buildTripInputFromGroup(group, overrideInput);
  return runPipeline(input);
};

module.exports = {
  buildTripInputFromGroup,
  generatePlannedItinerary
};
