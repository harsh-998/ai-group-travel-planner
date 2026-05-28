import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import StabilityBadge from "../components/planning/StabilityBadge";
import ExplanationPanel from "../components/planning/ExplanationPanel";
import ValidationNotice from "../components/planning/ValidationNotice";
import { getMe } from "../src/api/authApi";
import { getGroup } from "../src/api/groupApi";
import { generateItinerary, partialRegenerate } from "../src/api/planningApi";
import { getActivityImage } from "../src/utils/destinationImages";

import {
  HiOutlineViewGrid,
  HiOutlineCalendar,
  HiOutlineChatAlt2
} from "react-icons/hi";

import {
  FiLoader,
  FiClock,
  FiRefreshCw
} from "react-icons/fi";

import { FaMapMarkerAlt } from "react-icons/fa";

const Itinerary = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [operationLoading, setOperationLoading] = useState(null);
  const [lastPlanningResult, setLastPlanningResult] = useState(null);
  const [error, setError] = useState("");

  const fetchGroup = async () => {
    try {
      setLoading(true);
      const data = await getGroup(id);
      setGroup(data);
      if (data.aiPlanning?.activeItinerary) {
        setLastPlanningResult({ updatedItinerary: data.aiPlanning.activeItinerary });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load trip data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const data = await getMe();
        setUser(data);
      } catch {
        setUser(null);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    if (id) fetchGroup();
  }, [id]);

  useEffect(() => {
    const reload = () => {
      fetchGroup();
    };

    window.addEventListener("tripUpdated", reload);
    return () => window.removeEventListener("tripUpdated", reload);
  }, [id]);

  const applyItineraryToState = (itinerary, extra = {}) => {
    setGroup((current) => ({
      ...current,
      itinerary: itinerary.days,
      aiPlanning: {
        ...(current?.aiPlanning || {}),
        activeItinerary: itinerary,
        validation: itinerary.validation,
        reliability: itinerary.reliability,
        explanations: itinerary.explanations,
        evaluationMetrics: itinerary.evaluationMetrics
      },
      ...extra
    }));
  };

  const handleGenerate = async () => {
    try {
      if (generating) return;
      setGenerating(true);
      setError("");

      const result = await generateItinerary({
        groupId: id,
        input: {
          destination: group?.destination,
          budget: "balanced",
          interests: ["heritage", "food"]
        }
      });

      applyItineraryToState(result.itinerary);
      setLastPlanningResult({ updatedItinerary: result.itinerary, traceId: result.traceId });
    } catch (err) {
      setError(err.response?.data?.message || "Itinerary generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handlePartialRegenerate = async (operation) => {
    try {
      if (operationLoading) return;
      setOperationLoading(operation.type);
      setError("");

      const result = await partialRegenerate({
        groupId: id,
        operation
      });

      applyItineraryToState(result.updatedItinerary, {
        stabilitySnapshots: [
          ...(group?.stabilitySnapshots || []),
          result.stability
        ],
        explanationTraces: [
          ...(group?.explanationTraces || []),
          result.explanation
        ]
      });
      setLastPlanningResult(result);
    } catch (err) {
      setError(err.response?.data?.message || "Partial regeneration failed");
    } finally {
      setOperationLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2">
        <FiLoader className="animate-spin" />
        Loading trip data...
      </div>
    );
  }

  const activeItinerary = group?.aiPlanning?.activeItinerary;
  const itineraryDays = activeItinerary?.days || group?.itinerary || [];
  const hasItinerary = itineraryDays.length > 0;
  const latestStability = lastPlanningResult?.stability;
  const latestValidation = lastPlanningResult?.updatedItinerary?.validation || activeItinerary?.validation;

  return (
    <div className="bg-[#f6f7f8] min-h-screen pb-28">
      <Navbar isDashboard user={user} />

      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm inline-block mb-3">
              AI-OPTIMIZED ITINERARY
            </div>

            <h1 className="text-4xl font-bold flex items-center gap-3">
              <FaMapMarkerAlt />
              {group?.destination || group?.groupName}
            </h1>

            <p className="text-gray-500 mt-2">
              Connected to the modular WayFinder planning engine.
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <StabilityBadge stability={latestStability} />
            {hasItinerary && (
              <button
                onClick={() => handlePartialRegenerate({
                  type: "weatherDisruption",
                  day: 1,
                  slot: "evening",
                  reason: "Weather disruption requested from itinerary UI"
                })}
                disabled={Boolean(operationLoading)}
                className="rounded-full border border-teal-200 bg-white px-4 py-2 text-sm text-teal-700 shadow-sm"
              >
                {operationLoading === "weatherDisruption" ? "Updating..." : "Weather-safe evening"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-8 space-y-4">
          <ExplanationPanel result={lastPlanningResult} />
          <ValidationNotice validation={latestValidation} />
        </div>

        {!hasItinerary && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-teal-700 text-white px-6 py-3 rounded-lg flex items-center gap-2"
          >
            {generating ? (
              <>
                <FiLoader className="animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Itinerary"
            )}
          </button>
        )}

        {hasItinerary &&
          itineraryDays.map((day) => (
            <div key={day.day} className="mb-16">
              <div className="flex items-start justify-between gap-5 mb-8">
                <div className="flex items-start gap-5">
                  <div className="text-center">
                    <div className="text-xs text-gray-400">DAY</div>
                    <div className="text-3xl font-bold text-teal-700">
                      {String(day.day).padStart(2, "0")}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">
                      {day.title}
                    </h2>
                    <p className="text-gray-500 text-sm">{day.subtitle}</p>
                    {day.explanation?.loadReason && (
                      <p className="mt-2 text-xs text-gray-400">{day.explanation.loadReason}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handlePartialRegenerate({
                    type: "regenerateDay",
                    day: day.day,
                    replacementInterests: ["heritage", "food", "indoor"],
                    reason: `Regenerate Day ${day.day} from itinerary UI`
                  })}
                  disabled={Boolean(operationLoading)}
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-teal-700 shadow-sm"
                >
                  {operationLoading === "regenerateDay" ? "Regenerating..." : "Regenerate Day"}
                </button>
              </div>

              <div className="relative pl-8">
                <div className="absolute left-2 top-0 bottom-0 w-[2px] bg-gray-300"></div>

                <div className="space-y-10">
                  {day.activities?.map((act, i) => (
                    <div key={act.placeId || `${day.day}-${i}`} className="relative">
                      <div className="absolute -left-[6px] top-8 w-3 h-3 bg-teal-600 rounded-full"></div>

                      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="flex">
                          <div className="w-[280px] bg-gray-200">
                            <img
                              src={getActivityImage(act, group?.destination)}
                              alt={act.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = act.mapImage || group?.image || "";
                              }}
                            />
                          </div>

                          <div className="flex flex-col justify-between p-6 flex-1">
                            <div>
                              <p className="text-sm tracking-wider text-teal-600 font-semibold mb-2">
                                {act.time}
                              </p>

                              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                {act.title}
                              </h3>

                              <p className="text-md text-gray-600 leading-relaxed">
                                {act.description}
                              </p>

                              {act.explanation?.whySelected && (
                                <p className="mt-3 text-xs text-gray-400">
                                  {act.explanation.whySelected}
                                </p>
                              )}
                            </div>

                            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-orange-500 text-xs">
                                <FiClock />
                                <span>{act.durationMinutes || 180} min est.</span>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {act.placeId && (
                                  <button
                                    onClick={() => handlePartialRegenerate({
                                      type: "replaceActivity",
                                      activityId: act.placeId,
                                      replacementInterests: act.type === "food"
                                        ? ["heritage", "museum", "indoor"]
                                        : ["food", "local", "indoor"],
                                      reason: `Replace ${act.title} from itinerary UI`
                                    })}
                                    disabled={Boolean(operationLoading)}
                                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600"
                                  >
                                    <FiRefreshCw />
                                    Replace
                                  </button>
                                )}

                                {act.placeId && i === 0 && (
                                  <button
                                    onClick={() => handlePartialRegenerate({
                                      type: "travelDelay",
                                      activityId: act.placeId,
                                      delayMinutes: 30,
                                      reason: `Apply 30 minute delay after ${act.title}`
                                    })}
                                    disabled={Boolean(operationLoading)}
                                    className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600"
                                  >
                                    +30m Delay
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white shadow-lg border border-gray-200 rounded-2xl px-10 py-3 flex items-center gap-16 z-50">
        <div
          onClick={() => navigate(`/trip/${id}`)}
          className="flex flex-col items-center text-gray-400 cursor-pointer hover:text-gray-600"
        >
          <HiOutlineViewGrid className="text-xl" />
          <span className="text-[10px] mt-1 font-medium">WORKSPACE</span>
        </div>

        <div className="flex flex-col items-center text-teal-700">
          <div className="bg-teal-100 p-2 rounded-lg">
            <HiOutlineCalendar className="text-lg" />
          </div>
          <span className="text-[10px] mt-1 font-semibold">ITINERARY</span>
        </div>

        <div
          onClick={() => navigate(`/trip/${id}/proposals`)}
          className="flex flex-col items-center text-gray-400 cursor-pointer hover:text-gray-600"
        >
          <HiOutlineChatAlt2 className="text-xl" />
          <span className="text-[10px] mt-1 font-medium">PROPOSALS</span>
        </div>
      </div>
    </div>
  );
};

export default Itinerary;
