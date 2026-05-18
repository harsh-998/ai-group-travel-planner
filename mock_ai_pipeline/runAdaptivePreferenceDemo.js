const { runPipeline, sampleInputs } = require("./src/runPipeline");
const {
  createPreferenceProfile,
  evolvePreferenceProfile
} = require("./src/adaptive/preferenceProfile");

const learnedSignals = [
  ...Array.from({ length: 4 }, () => ({
    type: "activity_replaced",
    source: "demo",
    place: {
      type: "nightlife",
      tripRoles: ["nightlife_activity"],
      fatigueScore: 18
    }
  })),
  ...Array.from({ length: 5 }, () => ({
    type: "ai_suggestion_accepted",
    source: "demo",
    metadata: { actionId: "add_food_stops" }
  })),
  ...Array.from({ length: 4 }, () => ({
    type: "ai_suggestion_accepted",
    source: "demo",
    metadata: { actionId: "rebalance_fatigue" }
  })),
  ...Array.from({ length: 4 }, () => ({
    type: "activity_pinned",
    source: "demo",
    place: {
      type: "heritage",
      tripRoles: ["anchor_activity"],
      tags: ["culture", "photography"],
      fatigueScore: 22
    }
  }))
];

const learnedProfile = evolvePreferenceProfile(
  createPreferenceProfile({ userId: "demo_user" }),
  learnedSignals
);

const baseInput = {
  ...sampleInputs.jaipur,
  interests: ["heritage", "nightlife", "culture", "food"]
};
const baseResult = runPipeline(baseInput);
const adaptiveResult = runPipeline({
  ...baseInput,
  adaptiveProfile: learnedProfile,
  adaptiveContext: { effectiveProfile: learnedProfile }
});

const compact = (result) => result.pipelineDebug.topCandidates.slice(0, 8).map((candidate) => ({
  name: candidate.name,
  type: candidate.type,
  score: candidate.score,
  adaptivePreference: candidate.adaptivePreference
}));

console.log("Learned preference profile");
console.table([
  {
    confidence: learnedProfile.confidence.profileConfidence,
    foodExploration: learnedProfile.travelStyle.foodExploration,
    recoveryPreference: learnedProfile.travelStyle.recoveryPreference,
    nightlifeAffinity: learnedProfile.travelStyle.nightlifeAffinity,
    heritagePreference: learnedProfile.travelStyle.heritagePreference
  }
]);

console.log("Base top candidates");
console.table(compact(baseResult));

console.log("Adaptive top candidates");
console.table(compact(adaptiveResult));
