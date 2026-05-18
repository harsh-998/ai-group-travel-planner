const { normalize } = require("./textSemantics");

const extractPreferences = (input, defaults) => {
  const budget = normalize(input.budget || defaults.budget || "balanced").replace("-", "_");
  const optimizationMode = normalize(input.optimizationMode || budget || "balanced").replace("-", "_");

  return {
    destination: input.destination || defaults.destination,
    days: Math.max(1, Math.min(7, Number(input.days || defaults.days))),
    budget,
    optimizationMode,
    pace: normalize(input.pace || defaults.pace || "balanced"),
    weather: normalizeWeather(input.weather || defaults.weather),
    adaptiveProfile: input.adaptiveProfile || input.preferenceProfile || input.adaptiveContext?.effectiveProfile || defaults.adaptiveProfile || null,
    adaptiveContext: input.adaptiveContext || defaults.adaptiveContext || null,
    interests: Array.isArray(input.interests)
      ? input.interests.map((interest) => normalize(interest)).filter(Boolean)
      : [],
    constraints: {
      maxDailyFatigue: Number(input.maxDailyFatigue || 100),
      maxDailyTravelMinutes: Number(input.maxDailyTravelMinutes || 180),
      requireGroundedPlaces: input.requireGroundedPlaces !== false
    }
  };
};

const normalizeWeather = (weather = {}) => {
  const condition = normalize(weather.condition || weather.weatherCondition || "clear");
  return {
    condition: ["clear", "hot", "rain"].includes(condition) ? condition : "clear",
    temperatureC: Number.isFinite(Number(weather.temperatureC)) ? Number(weather.temperatureC) : null
  };
};

module.exports = extractPreferences;
