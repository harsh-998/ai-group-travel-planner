const places = require("../data/places");
const { budgetRank, budgetTarget } = require("./utils");
const { expandTerms, normalize, semanticMatch } = require("./textSemantics");

const isBudgetCompatible = (place, budget) => {
  const mode = normalize(budget) || "balanced";
  if (mode === "luxury") return true;
  const placeRank = budgetRank[place.budgetTier] ?? 2;
  const target = budgetTarget[mode] ?? budgetTarget.balanced;
  return placeRank <= target + 1;
};

const retrieveCandidates = (tripInput) => {
  const destination = normalize(tripInput.destination);
  const interests = (tripInput.interests || []).map(normalize);
  const queryTerms = expandTerms([
    destination,
    tripInput.budget,
    tripInput.optimizationMode,
    ...(tripInput.interests || [])
  ]);

  const destinationMatches = places.filter((place) => {
    const destinationAliases = [
      place.destination,
      ...(place.destinationAliases || [])
    ].map(normalize);
    return destinationAliases.includes(destination);
  });

  const semanticThreshold = 0.16;
  const semanticallyScored = destinationMatches
    .map((place) => {
      const match = semanticMatch(queryTerms, place);
      const budgetCompatible = isBudgetCompatible(place, tripInput.budget);
      const budgetPenalty = budgetCompatible ? 0 : 0.08;
      const adjustedSemanticScore = Math.max(0, match.semanticScore - budgetPenalty);

      return {
        ...place,
        semanticScore: Number(adjustedSemanticScore.toFixed(3)),
        rawSemanticScore: match.semanticScore,
        budgetCompatible,
        semanticSignals: {
          exactMatches: match.exactMatches,
          fuzzyMatches: match.fuzzyMatches,
          synonymMatches: match.synonymMatches
        }
      };
    })
    .sort((a, b) => b.semanticScore - a.semanticScore);

  let candidates = semanticallyScored.filter(
    (place) => place.semanticScore >= semanticThreshold && place.budgetCompatible
  );

  let fallbackUsed = false;
  let fallbackReason = null;

  if (candidates.length < Math.min(6, destinationMatches.length)) {
    fallbackUsed = true;
    fallbackReason = "Semantic threshold was relaxed because too few candidates matched.";
    candidates = semanticallyScored.filter((place) => place.budgetCompatible).slice(0, 8);
  }

  if (candidates.length < Math.min(6, destinationMatches.length)) {
    fallbackUsed = true;
    fallbackReason = "Budget filters were relaxed because destination coverage was sparse.";
    candidates = semanticallyScored.slice(0, 8);
  }

  const enrichedCandidates = candidates.map((place) => {
    const matchedTags = [...new Set(
      [place.type, ...place.tags].filter((tag) =>
        interests.includes(normalize(tag))
      )
    )];
    const fuzzyMatchedTags = place.semanticSignals.fuzzyMatches.map(
      (match) => `${match.queryTerm}->${match.matchedTerm}`
    );
    const synonymMatchedTags = place.semanticSignals.synonymMatches.map(
      (match) => `${match.queryTerm}->${match.matchedTerm}`
    );

    return {
      ...place,
      matchedTags,
      fuzzyMatchedTags,
      synonymMatchedTags,
      retrievalReason: matchedTags.length
        ? `Matched interests: ${matchedTags.join(", ")}`
        : buildSemanticRetrievalReason(place)
    };
  });

  return {
    candidates: enrichedCandidates,
    retrievalMeta: {
      method: "local_semantic_fuzzy",
      queryTerms,
      semanticThreshold,
      destinationMatches: destinationMatches.length,
      returnedCandidates: enrichedCandidates.length,
      averageSemanticScore: average(enrichedCandidates.map((candidate) => candidate.semanticScore)),
      fuzzyMatchCount: enrichedCandidates.reduce(
        (sum, candidate) => sum + candidate.semanticSignals.fuzzyMatches.length,
        0
      ),
      synonymMatchCount: enrichedCandidates.reduce(
        (sum, candidate) => sum + candidate.semanticSignals.synonymMatches.length,
        0
      ),
      retrievalCoverage: destinationMatches.length
        ? Number((enrichedCandidates.length / destinationMatches.length).toFixed(2))
        : 0,
      fallbackUsed,
      fallbackReason
    }
  };
};

const buildSemanticRetrievalReason = (place) => {
  const exact = place.semanticSignals.exactMatches.slice(0, 3);
  const fuzzy = place.semanticSignals.fuzzyMatches.slice(0, 2);
  const synonyms = place.semanticSignals.synonymMatches.slice(0, 2);

  if (exact.length) return `Semantically matched terms: ${exact.join(", ")}`;
  if (synonyms.length) {
    return `Matched via synonyms: ${synonyms.map((match) => `${match.queryTerm}->${match.matchedTerm}`).join(", ")}`;
  }
  if (fuzzy.length) {
    return `Fuzzy matched terms: ${fuzzy.map((match) => `${match.queryTerm}->${match.matchedTerm}`).join(", ")}`;
  }

  return "Included by semantic fallback coverage";
};

const average = (values) => {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
};

module.exports = retrieveCandidates;
