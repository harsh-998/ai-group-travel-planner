const retrieveCandidates = require("./retrieveCandidates");
const scoreCandidates = require("./scoreCandidates");
const optimizeItinerary = require("./optimizeItinerary");
const generateItineraryJson = require("./generateItineraryJson");
const validateItinerary = require("./validateItinerary");
const generateExplanations = require("./generateExplanations");
const evaluatePipeline = require("./evaluatePipeline");
const extractPreferences = require("./extractPreferences");
const sampleInputs = require("../data/sampleInputs");

const defaultInput = sampleInputs.jaipur;

const runPipeline = (input = defaultInput) => {
  const tripInput = extractPreferences(input, defaultInput);

  const { candidates, retrievalMeta } = retrieveCandidates(tripInput);
  const rankedCandidates = scoreCandidates(candidates, tripInput);
  const optimizedDays = optimizeItinerary(rankedCandidates, tripInput);
  const itinerary = generateItineraryJson({
    tripInput,
    optimizedDays,
    retrievalMeta
  });

  const validatedItinerary = validateItinerary(itinerary);
  const explainedItinerary = generateExplanations({
    tripInput,
    retrievalMeta,
    rankedCandidates,
    itinerary: validatedItinerary
  });
  const evaluatedItinerary = evaluatePipeline({
    tripInput,
    retrievalMeta,
    rankedCandidates,
    itinerary: explainedItinerary
  });

  return {
    input: tripInput,
    pipelineDebug: {
      retrievalMeta,
      stageOrder: [
        "preference_extraction",
        "adaptive_preference_context",
        "semantic_retrieval",
        "adaptive_candidate_ranking",
        "optimization",
        "validation",
        "explanation_generation",
        "reliability_and_evaluation_metrics",
        "structured_json_output"
      ],
      topCandidates: rankedCandidates.slice(0, 10).map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        type: candidate.type,
        area: candidate.area,
        score: candidate.score,
        semanticScore: candidate.semanticScore,
        adaptivePreference: candidate.scoreBreakdown?.adaptivePreference,
        matchedTags: candidate.matchedTags,
        fuzzyMatchedTags: candidate.fuzzyMatchedTags,
        synonymMatchedTags: candidate.synonymMatchedTags,
        selectionReason: candidate.selectionReason,
        adaptiveFitReason: candidate.adaptiveFitReason
      }))
    },
    itinerary: evaluatedItinerary
  };
};

module.exports = {
  defaultInput,
  sampleInputs,
  runPipeline
};
