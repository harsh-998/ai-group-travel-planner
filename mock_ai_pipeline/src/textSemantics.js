const synonymMap = {
  heritage: ["history", "historic", "culture", "cultural", "palace", "fort", "museum", "temple", "church", "architecture", "unesco"],
  food: ["cafe", "cafes", "restaurant", "restaurants", "snack", "snacks", "street", "street food", "thali", "seafood", "brunch", "dinner", "sweets"],
  beach: ["beaches", "coast", "coastal", "sea", "seaside", "water sports"],
  beaches: ["beach", "coast", "coastal", "sea", "seaside", "water sports"],
  adventure: ["activities", "trek", "snow", "valley", "outdoor", "views"],
  scenic: ["view", "views", "viewpoint", "sunset", "photography", "mountain", "coastal"],
  photography: ["photogenic", "photo", "photo stop", "viewpoint", "architecture", "scenic", "sunset"],
  photogenic: ["photography", "photo", "viewpoint", "scenic"],
  viewpoint: ["view", "views", "scenic", "sunset", "photography"],
  "hidden gem": ["hidden", "underrated", "quiet", "unexpected", "offbeat", "less touristy"],
  cafes: ["cafe", "food", "brunch", "coffee", "slow travel"],
  cafe: ["cafes", "food", "brunch", "coffee", "slow travel"],
  nightlife: ["evening", "bars", "clubs", "night"],
  relaxed: ["slow", "wellness", "comfort", "comfortable", "easy"],
  family: ["family friendly", "garden", "indoor", "low fatigue", "easy"],
  craft: ["workshop", "textiles", "hand printing", "block printing", "pottery", "jewellery"],
  market: ["markets", "bazaar", "shopping", "souvenirs"],
  markets: ["market", "bazaar", "shopping", "souvenirs"],
  budget: ["cheap", "free", "low", "affordable"],
  cheap: ["budget", "free", "low", "affordable"]
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "around",
  "at",
  "for",
  "in",
  "near",
  "of",
  "on",
  "the",
  "to",
  "with"
]);

const normalize = (value) => String(value || "").trim().toLowerCase();

const tokenize = (value) => {
  return normalize(value)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && !stopWords.has(token));
};

const expandTerms = (terms) => {
  const expanded = new Set();

  for (const term of terms.map(normalize)) {
    expanded.add(term);
    for (const token of tokenize(term)) expanded.add(token);
    for (const synonym of synonymMap[term] || []) {
      expanded.add(normalize(synonym));
      for (const token of tokenize(synonym)) expanded.add(token);
    }
  }

  return [...expanded];
};

const placeSearchText = (place) => {
  return [
    place.name,
    place.destination,
    place.area,
    place.type,
    place.budgetTier,
    place.description,
    ...(place.tags || []),
    ...(place.bestTime || [])
  ].join(" ");
};

const buildPlaceSemanticProfile = (place) => {
  const rawTerms = [
    place.name,
    place.area,
    place.type,
    place.budgetTier,
    ...(place.tags || []),
    ...(place.bestTime || []),
    ...tokenize(place.description)
  ];

  return {
    searchText: placeSearchText(place),
    terms: expandTerms(rawTerms),
    tokenSet: new Set(tokenize(placeSearchText(place)))
  };
};

const semanticMatch = (queryTerms, place) => {
  const profile = buildPlaceSemanticProfile(place);
  const expandedQueryTerms = expandTerms(queryTerms);
  const exactMatches = [];
  const fuzzyMatches = [];
  const synonymMatches = [];

  for (const queryTerm of expandedQueryTerms) {
    if (profile.terms.includes(queryTerm) || profile.tokenSet.has(queryTerm)) {
      exactMatches.push(queryTerm);
      continue;
    }

    const closeTerm = profile.terms.find((placeTerm) => fuzzySimilarity(queryTerm, placeTerm) >= 0.82);
    if (closeTerm) {
      fuzzyMatches.push({ queryTerm, matchedTerm: closeTerm });
      continue;
    }

    const synonymHit = (synonymMap[queryTerm] || []).find((synonym) =>
      profile.terms.includes(normalize(synonym))
    );
    if (synonymHit) {
      synonymMatches.push({ queryTerm, matchedTerm: synonymHit });
    }
  }

  const uniqueExact = [...new Set(exactMatches)];
  const uniqueFuzzy = dedupePairs(fuzzyMatches);
  const uniqueSynonyms = dedupePairs(synonymMatches);
  const totalQueryTerms = Math.max(1, new Set(expandedQueryTerms).size);

  const directScore = uniqueExact.length / totalQueryTerms;
  const fuzzyScore = uniqueFuzzy.length / totalQueryTerms;
  const synonymScore = uniqueSynonyms.length / totalQueryTerms;
  const typeBoost = queryTerms.map(normalize).includes(normalize(place.type)) ? 0.12 : 0;

  const semanticScore = Math.min(
    1,
    directScore * 0.75 + fuzzyScore * 0.5 + synonymScore * 0.45 + typeBoost
  );

  return {
    semanticScore: Number(semanticScore.toFixed(3)),
    exactMatches: uniqueExact.slice(0, 10),
    fuzzyMatches: uniqueFuzzy.slice(0, 8),
    synonymMatches: uniqueSynonyms.slice(0, 8)
  };
};

const dedupePairs = (pairs) => {
  const seen = new Set();
  return pairs.filter((pair) => {
    const key = `${pair.queryTerm}:${pair.matchedTerm}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const fuzzySimilarity = (a, b) => {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 4 || right.length < 4) return 0;

  const distance = levenshteinDistance(left, right);
  const maxLength = Math.max(left.length, right.length);
  return 1 - distance / maxLength;
};

const levenshteinDistance = (a, b) => {
  const rows = Array.from({ length: a.length + 1 }, () => []);

  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      );
    }
  }

  return rows[a.length][b.length];
};

module.exports = {
  expandTerms,
  normalize,
  semanticMatch,
  tokenize
};
