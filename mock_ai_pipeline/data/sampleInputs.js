const jaipurEvaluationPersonas = require("./jaipurEvaluationPersonas");

const sampleInputs = {
  jaipur: {
    destination: "Jaipur",
    days: 3,
    budget: "balanced",
    interests: ["heritage", "food"],
    weather: { condition: "hot", temperatureC: 38 }
  },
  jaipur_fuzzy: {
    destination: "Jaipur",
    days: 2,
    budget: "balanced",
    interests: ["heriage", "caffes", "scenic"],
    weather: { condition: "clear", temperatureC: 31 }
  },
  goa: {
    destination: "Goa",
    days: 2,
    budget: "cheapest",
    optimizationMode: "cheapest",
    interests: ["beach", "food"]
  },
  manali: {
    destination: "Manali",
    days: 2,
    budget: "balanced",
    optimizationMode: "time_efficient",
    interests: ["adventure", "food"]
  },
  ...jaipurEvaluationPersonas
};

module.exports = sampleInputs;
