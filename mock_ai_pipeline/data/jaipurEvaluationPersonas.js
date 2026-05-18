const jaipurEvaluationPersonas = {
  jaipur_luxury_couple: {
    destination: "Jaipur",
    days: 3,
    budget: "luxury",
    optimizationMode: "luxury",
    interests: ["heritage", "fine dining", "romantic", "photography", "nightlife"],
    pace: "balanced",
    weather: { condition: "clear", temperatureC: 31 }
  },
  jaipur_budget_solo: {
    destination: "Jaipur",
    days: 2,
    budget: "cheapest",
    optimizationMode: "cheapest",
    interests: ["heritage", "street food", "markets", "walking", "budget"],
    pace: "active",
    weather: { condition: "clear", temperatureC: 30 }
  },
  jaipur_photography_enthusiast: {
    destination: "Jaipur",
    days: 3,
    budget: "balanced",
    optimizationMode: "time_efficient",
    interests: ["photography", "viewpoint", "sunset", "architecture", "hidden gem"],
    pace: "active",
    weather: { condition: "clear", temperatureC: 28 }
  },
  jaipur_foodie_group: {
    destination: "Jaipur",
    days: 3,
    budget: "balanced",
    optimizationMode: "balanced",
    interests: ["food", "street food", "cafe", "social", "local"],
    pace: "balanced",
    weather: { condition: "hot", temperatureC: 39 }
  },
  jaipur_cultural_explorer: {
    destination: "Jaipur",
    days: 4,
    budget: "balanced",
    optimizationMode: "balanced",
    interests: ["culture", "heritage", "craft", "museum", "workshop"],
    pace: "slow",
    weather: { condition: "hot", temperatureC: 38 }
  },
  jaipur_low_energy_family: {
    destination: "Jaipur",
    days: 3,
    budget: "balanced",
    optimizationMode: "time_efficient",
    interests: ["family", "heritage", "indoor", "food", "garden"],
    maxDailyFatigue: 70,
    pace: "slow",
    weather: { condition: "hot", temperatureC: 40 }
  },
  jaipur_weekend_traveler: {
    destination: "Jaipur",
    days: 2,
    budget: "balanced",
    optimizationMode: "time_efficient",
    interests: ["iconic", "heritage", "food", "market", "sunset"],
    pace: "balanced",
    weather: { condition: "clear", temperatureC: 32 }
  }
};

module.exports = jaipurEvaluationPersonas;
