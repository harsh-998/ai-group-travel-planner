const { estimateTravelMinutes, minutesToTime, timeToMinutes } = require("./utils");

const slotDefinitions = [
  { name: "morning", start: "09:00" },
  { name: "afternoon", start: "13:30" },
  { name: "evening", start: "18:00" }
];

const DAY_END_MINUTES = timeToMinutes("22:30");
const DEFAULT_MAX_WITHIN_DAY_TRAVEL_MINUTES = 180;

const typePenalty = (candidate, dayItems) => {
  const sameTypeCount = dayItems.filter((item) => item.type === candidate.type).length;
  return sameTypeCount * 8;
};

const areaPenalty = (candidate, dayItems) => {
  if (!dayItems.length) return 0;
  const sameAreaCount = dayItems.filter((item) => item.area === candidate.area).length;
  return sameAreaCount ? -8 : 10;
};

const timeSlotPenalty = (candidate, slotName, tripInput) => {
  let penalty = candidate.bestTime.includes(slotName) ? -18 : 48;
  const weatherCondition = tripInput.weather?.condition || "clear";
  const tags = new Set([candidate.type, ...(candidate.tags || [])].map((tag) => String(tag).toLowerCase()));
  const tripRoles = new Set((candidate.tripRoles || []).map((role) => String(role).toLowerCase()));

  if (tripRoles.has("nightlife_activity") && slotName !== "evening") penalty += 65;
  if (slotName === "evening" && (tags.has("sunset") || tags.has("viewpoint") || tags.has("scenic"))) penalty -= 12;
  if (slotName === "afternoon" && weatherCondition === "hot") {
    const hotFit = candidate.weatherSuitability?.hot ?? (candidate.weatherSensitivity === "indoor" ? 0.9 : 0.45);
    if (hotFit < 0.55) penalty += 40;
    if (hotFit >= 0.85) penalty -= 10;
  }

  if (slotName === "morning" && weatherCondition === "hot" && candidate.weatherSensitivity === "outdoor") {
    penalty -= 6;
  }

  return penalty;
};

const getMaxWithinDayTravel = (tripInput) =>
  Number(tripInput.constraints?.maxWithinDayTravelMinutes || DEFAULT_MAX_WITHIN_DAY_TRAVEL_MINUTES);

const countFeasibleCompanions = (candidate, pool, maxTravelMinutes) =>
  pool.filter((item) => item.id !== candidate.id && estimateTravelMinutes(candidate, item) <= maxTravelMinutes).length;

const getCandidateTiming = (candidate, dayItems, slotName, previousEnd, maxWithinDayTravelMinutes) => {
  const travelFromPrevious = dayItems.length
    ? estimateTravelMinutes(dayItems[dayItems.length - 1], candidate)
    : 0;

  if (dayItems.length && travelFromPrevious > maxWithinDayTravelMinutes) {
    return null;
  }

  const slotStart = timeToMinutes(slotDefinitions.find((slot) => slot.name === slotName).start);
  const startMinutes = previousEnd
    ? Math.max(slotStart, previousEnd + travelFromPrevious + 20)
    : slotStart;
  const endMinutes = startMinutes + candidate.durationMinutes;

  if (endMinutes > DAY_END_MINUTES) {
    return null;
  }

  return { startMinutes, travelFromPrevious };
};

const nextBestCandidate = (pool, dayItems, slotName, tripInput, previousEnd) => {
  let best = null;
  let bestScore = -Infinity;
  const maxWithinDayTravelMinutes = getMaxWithinDayTravel(tripInput);

  for (const candidate of pool) {
    const timing = getCandidateTiming(candidate, dayItems, slotName, previousEnd, maxWithinDayTravelMinutes);
    if (!timing) continue;

    const companionBonus = dayItems.length
      ? 0
      : countFeasibleCompanions(candidate, pool, maxWithinDayTravelMinutes) * 9;
    const travelPenalty = timing.travelFromPrevious * (timing.travelFromPrevious > 90 ? 0.7 : 0.35);
    const lateStartPenalty = Math.max(0, timing.startMinutes - timeToMinutes(slotDefinitions.find((slot) => slot.name === slotName).start)) * 0.12;

    const projectedFatigue = dayItems.reduce((sum, item) => sum + item.fatigueScore, 0) + candidate.fatigueScore;
    const fatigueLimit = Number(tripInput.constraints?.maxDailyFatigue || 100);
    const fatiguePenalty = Math.max(0, projectedFatigue - fatigueLimit) * 6;

    const adjustedScore =
      candidate.score -
      typePenalty(candidate, dayItems) -
      areaPenalty(candidate, dayItems) -
      timeSlotPenalty(candidate, slotName, tripInput) -
      travelPenalty -
      lateStartPenalty -
      fatiguePenalty;

    if (adjustedScore > bestScore) {
      best = { ...candidate, ...timing };
      bestScore = adjustedScore;
    }
  }

  return best;
};

const optimizeItinerary = (rankedCandidates, tripInput) => {
  const days = Math.max(1, Number(tripInput.days || 1));
  const pool = [...rankedCandidates];
  const optimizedDays = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const dayItems = [];
    let previousEnd = null;
    let estimatedTravelMinutes = 0;

    for (const slot of slotDefinitions) {
      if (!pool.length) break;

      const candidate = nextBestCandidate(pool, dayItems, slot.name, tripInput, previousEnd);
      if (!candidate) break;

      const candidateIndex = pool.findIndex((item) => item.id === candidate.id);
      pool.splice(candidateIndex, 1);

      estimatedTravelMinutes += candidate.travelFromPrevious;
      previousEnd = candidate.startMinutes + candidate.durationMinutes;

      dayItems.push({
        ...candidate,
        slot: slot.name,
        time: minutesToTime(candidate.startMinutes)
      });
    }

    optimizedDays.push({
      day: dayIndex + 1,
      theme: buildDayTheme(dayItems, dayIndex),
      items: dayItems,
      estimatedTravelMinutes,
      fatigueScore: dayItems.reduce((sum, item) => sum + item.fatigueScore, 0)
    });
  }

  return optimizedDays;
};

const buildDayTheme = (items, dayIndex) => {
  if (!items.length) return `Day ${dayIndex + 1} flexible exploration`;

  const types = [...new Set(items.map((item) => item.type))];
  const areas = [...new Set(items.map((item) => item.area))];

  if (types.includes("heritage") && types.includes("food")) {
    return "Heritage, local flavors, and easy city flow";
  }

  if (types.includes("beach")) return "Coastal views and relaxed food stops";
  if (types.includes("adventure")) return "Adventure and mountain exploration";

  return `${types.slice(0, 2).join(" and ")} around ${areas.slice(0, 2).join(" / ")}`;
};

module.exports = optimizeItinerary;
