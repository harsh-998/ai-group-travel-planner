import { useEffect, useMemo, useReducer, useRef } from "react";
import { buildWorkspaceFromItinerary, refreshWorkspaceDerived, workspaceReducer } from "./workspaceModel";

const STORAGE_PREFIX = "wayfinder-workspace:";

export const useTravelWorkspace = ({ itinerary, group }) => {
  const sourceSignature = useMemo(() => getItinerarySignature(itinerary), [itinerary]);
  const workspaceKey = `${STORAGE_PREFIX}${group?._id || "draft"}:${itinerary?.itineraryId || "proposal"}:${sourceSignature || "empty"}`;
  const lastSourceRef = useRef("");

  const initialWorkspace = useMemo(() => {
    if (!itinerary && !group) return null;
    return hydrateWorkspace(workspaceKey, buildWorkspaceFromItinerary({ itinerary, group }));
  }, [group, itinerary, workspaceKey]);

  const [workspace, dispatch] = useReducer(workspaceReducer, initialWorkspace);

  useEffect(() => {
    const sourceKey = `${group?._id || "draft"}:${itinerary?.itineraryId || "proposal"}:${itinerary?.generatedAt || sourceSignature || "empty"}`;
    if (!itinerary && !group) return;
    if (lastSourceRef.current === sourceKey) return;
    lastSourceRef.current = sourceKey;
    dispatch({
      type: "RESET_WORKSPACE",
      workspace: hydrateWorkspace(workspaceKey, buildWorkspaceFromItinerary({ itinerary, group }))
    });
  }, [group, itinerary, sourceSignature, workspaceKey]);

  useEffect(() => {
    if (!workspace?.workspaceId) return;
    try {
      const snapshot = {
        viewport: workspace.viewport,
        lanes: workspace.lanes,
        nodes: workspace.nodes,
        selection: workspace.selection,
        interaction: workspace.interaction,
        operationLog: workspace.operationLog
      };
      localStorage.setItem(workspaceKey, JSON.stringify(snapshot));
    } catch (error) {
      console.warn("Workspace persistence skipped:", error);
    }
  }, [workspace, workspaceKey]);

  return { workspace, dispatch };
};

const getItinerarySignature = (itinerary) => {
  const value = (itinerary?.days || [])
    .map((day) => `${day.day}:${(day.activities || []).map((activity) => activity.placeId || activity.title).join(",")}`)
    .join("|");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return value ? `sig-${Math.abs(hash)}` : "";
};

const hydrateWorkspace = (key, workspace) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return workspace;
    const saved = JSON.parse(raw);
    return refreshWorkspaceDerived({
      ...workspace,
      viewport: saved.viewport || workspace.viewport,
      lanes: saved.lanes || workspace.lanes,
      nodes: saved.nodes || workspace.nodes,
      selection: saved.selection || workspace.selection,
      interaction: saved.interaction || workspace.interaction,
      operationLog: saved.operationLog || workspace.operationLog
    });
  } catch (error) {
    console.warn("Workspace hydrate skipped:", error);
    return workspace;
  }
};
