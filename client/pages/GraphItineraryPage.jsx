import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiLoader } from "react-icons/fi";
import { getGroup } from "../src/api/groupApi";
import { generateItinerary, partialRegenerate } from "../src/api/planningApi";
import TravelWorkspaceCanvas from "../src/workspace/TravelWorkspaceCanvas";
import { useTravelWorkspace } from "../src/workspace/useTravelWorkspace";

const promptToInterests = (prompt = "") => {
  const text = prompt.toLowerCase();
  const rules = [
    ["heritage", ["heritage", "history", "temple", "fort", "culture", "palace"]],
    ["food", ["food", "cafe", "cafes", "restaurant", "local food", "snack"]],
    ["shopping", ["shopping", "market", "bazaar", "souvenir", "craft"]],
    ["nature", ["nature", "scenic", "views", "viewpoint", "garden", "sunset"]],
    ["nightlife", ["nightlife", "bar", "social", "evening"]],
    ["wellness", ["wellness", "relax", "slow", "spa", "recovery"]],
    ["photography", ["photo", "photography", "instagram", "sunrise", "sunset"]]
  ];

  const matched = rules
    .filter(([, words]) => words.some((word) => text.includes(word)))
    .map(([interest]) => interest);

  return matched.length ? matched : ["heritage", "food", "culture"];
};

const getTripDays = (group) => {
  if (!group?.startDate || !group?.endDate) return 3;
  const start = new Date(group.startDate);
  const end = new Date(group.endDate);
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
};

const getWorkspaceItinerary = (group, id) => {
  if (group?.aiPlanning?.activeItinerary) return group.aiPlanning.activeItinerary;
  if (group?.itinerary?.length) {
    return {
      itineraryId: `legacy-${id}`,
      input: { destination: group.destination },
      days: group.itinerary
    };
  }
  return {
    itineraryId: `draft-${id}`,
    input: { destination: group?.destination },
    days: []
  };
};

const GraphItineraryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const generatedOnce = useRef(false);
  const [group, setGroup] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("wayfinder-theme") === "dark");
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "I am watching route shape, cluster continuity, fatigue, weather exposure, and pacing as you rearrange the canvas."
    }
  ]);

  useEffect(() => {
    localStorage.setItem("wayfinder-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const trip = await getGroup(id);
        setGroup(trip);
        setPrompt(trip.userPreferences?.planningPrompt || "");
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load the planning workspace.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const workspaceItinerary = useMemo(() => getWorkspaceItinerary(group, id), [group, id]);
  const { workspace, dispatch } = useTravelWorkspace({ itinerary: workspaceItinerary, group });

  const totalStops = useMemo(
    () => (workspaceItinerary?.days || []).reduce((sum, day) => sum + (day.activities?.length || 0), 0),
    [workspaceItinerary]
  );

  const applyItinerary = useCallback((itinerary, extra = {}) => {
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
  }, []);

  const handleGenerate = useCallback(async (nextPrompt = prompt, automatic = false) => {
    try {
      if (generating) return;
      setGenerating(true);
      setError("");

      if (!automatic) {
        setMessages((items) => [
          ...items,
          { role: "user", text: nextPrompt || "Generate a balanced collaborative planning canvas." }
        ]);
      }

      const result = await generateItinerary({
        groupId: id,
        input: {
          destination: group?.destination,
          days: getTripDays(group),
          budget: nextPrompt.toLowerCase().includes("budget") ? "budget" : "balanced",
          interests: promptToInterests(nextPrompt),
          planningPrompt: nextPrompt
        }
      });

      applyItinerary(result.itinerary);
      setMessages((items) => [
        ...items,
        {
          role: "ai",
          text: `Generated a ${result.itinerary.days.length}-day proposal and rebuilt the editable spatial workspace from it.`
        }
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Workspace itinerary generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [applyItinerary, generating, group, id, prompt]);

  useEffect(() => {
    const hasActivities = workspaceItinerary?.days?.some((day) => day.activities?.length);
    if (loading || !group || hasActivities || generatedOnce.current) return;
    generatedOnce.current = true;
    handleGenerate(group.userPreferences?.planningPrompt || prompt, true);
  }, [group, handleGenerate, loading, prompt, workspaceItinerary]);

  const handleRegenerateDay = useCallback(async (day) => {
    try {
      if (generating) return;
      setGenerating(true);
      setError("");
      const result = await partialRegenerate({
        groupId: id,
        operation: {
          type: "regenerateDay",
          day,
          replacementInterests: promptToInterests(prompt),
          reason: `Canvas swimlane regeneration for Day ${day}`
        }
      });
      applyItinerary(result.updatedItinerary, {
        stabilitySnapshots: [
          ...(group?.stabilitySnapshots || []),
          result.stability
        ],
        explanationTraces: [
          ...(group?.explanationTraces || []),
          result.explanation
        ]
      });
      setMessages((items) => [
        ...items,
        { role: "ai", text: `Rebuilt Day ${day} while preserving the rest of the workspace proposal.` }
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Day regeneration failed.");
    } finally {
      setGenerating(false);
    }
  }, [applyItinerary, generating, group, id, prompt]);

  const handleReplaceNode = useCallback(async (node) => {
    if (!node?.data?.placeId) return;
    try {
      if (generating) return;
      setGenerating(true);
      setError("");
      const replacementInterests = node.data.type === "food"
        ? ["food", "cafe", "local", "recovery"]
        : ["heritage", "culture", "indoor", "nearby"];

      const result = await partialRegenerate({
        groupId: id,
        operation: {
          type: "replaceActivity",
          activityId: node.data.placeId,
          replacementInterests,
          preserveType: node.data.type === "food",
          reason: `Canvas quick-replace requested for ${node.data.title}`
        }
      });
      applyItinerary(result.updatedItinerary, {
        stabilitySnapshots: [
          ...(group?.stabilitySnapshots || []),
          result.stability
        ],
        explanationTraces: [
          ...(group?.explanationTraces || []),
          result.explanation
        ]
      });
      setMessages((items) => [
        ...items,
        { role: "ai", text: `Replaced ${node.data.title} and refreshed the canvas from the updated itinerary graph.` }
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Activity replacement failed.");
    } finally {
      setGenerating(false);
    }
  }, [applyItinerary, generating, group, id]);

  if (loading || !workspace) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#081015] text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
          <FiLoader className="animate-spin" />
          Loading collaborative planning canvas...
        </div>
      </div>
    );
  }

  return (
    <TravelWorkspaceCanvas
      workspace={workspace}
      dispatch={dispatch}
      group={group}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
      prompt={prompt}
      setPrompt={setPrompt}
      messages={messages}
      generating={generating}
      error={error}
      totalStops={totalStops}
      onGenerate={handleGenerate}
      onRegenerateDay={handleRegenerateDay}
      onReplaceNode={handleReplaceNode}
      onNavigateClassic={() => navigate(`/trip/${id}/itinerary`)}
      onNavigateTrip={() => navigate(`/trip/${id}`)}
    />
  );
};

export default GraphItineraryPage;
