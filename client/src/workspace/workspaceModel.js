import { getActivityImage } from "../utils/destinationImages";

const GRID_SIZE = 20;
const LANE_HEIGHT = 250;
const LANE_GAP = 76;
const LANE_TOP = 150;
const NODE_START_X = 380;
const NODE_WIDTH = 276;
const NODE_GAP = 78;

const clusterMeta = {
  amer_north_jaipur: { label: "Amer Cluster", color: "#14b8a6", glow: "rgba(20,184,166,0.16)" },
  walled_city_jaipur: { label: "Walled City", color: "#f97316", glow: "rgba(249,115,22,0.15)" },
  central_mi_road_cscheme: { label: "Central Jaipur", color: "#0ea5e9", glow: "rgba(14,165,233,0.15)" },
  rambagh_civil_lines_bani_park: { label: "Social / Palace District", color: "#a855f7", glow: "rgba(168,85,247,0.14)" },
  jln_malviya_south: { label: "Art + Airport Side", color: "#22c55e", glow: "rgba(34,197,94,0.14)" },
  east_galta_ghat_ki_guni: { label: "Galta Valley", color: "#eab308", glow: "rgba(234,179,8,0.16)" },
  sanganer_craft_south: { label: "Sanganer Craft", color: "#ec4899", glow: "rgba(236,72,153,0.14)" },
  vaishali_west_modern: { label: "West Jaipur", color: "#6366f1", glow: "rgba(99,102,241,0.15)" },
  outer_daytrip_jaipur: { label: "Outer Day Trip", color: "#64748b", glow: "rgba(100,116,139,0.16)" }
};

const roleCopy = {
  anchor_activity: "anchor",
  filler_activity: "filler",
  recovery_activity: "recovery",
  arrival_activity: "arrival",
  departure_activity: "departure",
  social_activity: "social",
  nightlife_activity: "nightlife",
  exploration_activity: "explore",
  contingency_activity: "backup"
};

export const buildWorkspaceFromItinerary = ({ itinerary, group }) => {
  const days = itinerary?.days?.length
    ? itinerary.days
    : Array.from({ length: 3 }, (_, index) => ({
      day: index + 1,
      title: `Day ${index + 1}`,
      subtitle: "Drop activities here to shape the route.",
      activities: []
    }));

  const lanes = days.map((day, index) => ({
    id: `day-${day.day}`,
    day: day.day,
    title: day.title || `Day ${day.day}`,
    subtitle: day.subtitle || "Editable planning lane",
    y: LANE_TOP + index * (LANE_HEIGHT + LANE_GAP),
    height: LANE_HEIGHT,
    collapsed: false
  }));

  const nodes = {};
  const hotelNodeId = "base-hotel";

  nodes[hotelNodeId] = {
    id: hotelNodeId,
    type: "hotel",
    day: 1,
    position: { x: 80, y: lanes[0]?.y + 56 || LANE_TOP },
    size: { width: 220, height: 112 },
    pinned: true,
    notes: [],
    data: {
      title: group?.destination ? `${group.destination} home base` : "Home base",
      subtitle: "Starting point",
      clusterId: "base",
      clusterLabel: "Home base",
      role: "home_base",
      fatigueScore: 0,
      weatherScore: 100,
      durationMinutes: 0,
      image: null,
      description: "Use this as the hotel, station, or meeting-point anchor for route reasoning."
    }
  };

  for (const day of days) {
    const lane = lanes.find((item) => item.day === day.day);
    for (const [activityIndex, activity] of (day.activities || []).entries()) {
      const nodeId = activity.placeId || `day-${day.day}-activity-${activityIndex}`;
      const clusterId = getClusterId(activity);
      const cluster = getClusterMeta(clusterId, activity.area);
      const primaryRole = activity.tripRoles?.[0] || inferRole(activity);
      const x = NODE_START_X + activityIndex * (NODE_WIDTH + NODE_GAP);

      nodes[nodeId] = {
        id: nodeId,
        type: activity.type === "food" && primaryRole === "recovery_activity"
          ? "recovery"
          : "activity",
        day: day.day,
        sourceDay: day.day,
        sourceIndex: activityIndex,
        position: { x, y: (lane?.y || LANE_TOP) + 46 },
        size: { width: NODE_WIDTH, height: 178 },
        pinned: false,
        notes: [],
        votes: { up: 0, down: 0 },
        data: {
          ...activity,
          title: activity.title || "Untitled activity",
          clusterId,
          clusterLabel: cluster.label,
          clusterColor: cluster.color,
          role: primaryRole,
          roleLabel: roleCopy[primaryRole] || String(primaryRole).replace(/_/g, " "),
          fatigueScore: Number(activity.fatigueScore || 10),
          weatherScore: getWeatherScore(activity),
          image: getActivityImage(activity, group?.destination),
          semanticLinks: buildSemanticLinks(activity)
        }
      };
    }
  }

  const state = {
    workspaceId: `workspace-${group?._id || "local"}`,
    sourceItineraryId: itinerary?.itineraryId || null,
    version: 1,
    lanes,
    nodes,
    edges: {},
    viewport: { x: -40, y: 0, zoom: 0.82 },
    selection: { nodeIds: [], activeNodeId: null },
    focus: { nodeId: null, clusterId: null },
    interaction: { mode: "select", showSemanticEdges: true, showMap: true },
    collaborators: [
      { id: "you", name: "You", color: "#14b8a6", cursor: { x: 560, y: 220 } },
      { id: "ai", name: "WayFinder AI", color: "#8b5cf6", cursor: { x: 860, y: 360 } }
    ],
    operationLog: [],
    pendingOps: [],
    comments: {},
    aiFeed: [],
    map: { focusedNodeId: null }
  };

  return refreshDerivedWorkspace({
    ...state,
    aiFeed: buildInsights(state).slice(0, 4)
  });
};

export const workspaceReducer = (state, action) => {
  if (action.type === "RESET_WORKSPACE") return action.workspace;
  if (!state) return state;

  switch (action.type) {
    case "SET_VIEWPORT":
      return { ...state, viewport: action.viewport };
    case "PAN_VIEWPORT":
      return {
        ...state,
        viewport: {
          ...state.viewport,
          x: state.viewport.x + action.dx,
          y: state.viewport.y + action.dy
        }
      };
    case "ZOOM_VIEWPORT":
      return {
        ...state,
        viewport: {
          x: action.x,
          y: action.y,
          zoom: clamp(action.zoom, 0.45, 1.35)
        }
      };
    case "SELECT_NODE":
      return selectNode(state, action.nodeId, action.additive);
    case "CLEAR_SELECTION":
      return { ...state, selection: { nodeIds: [], activeNodeId: null }, focus: { nodeId: null, clusterId: null } };
    case "MOVE_NODE":
      return refreshDerivedWorkspace(moveNode(state, action.nodeId, action.position));
    case "TOGGLE_PIN":
      return updateNode(state, action.nodeId, (node) => ({ ...node, pinned: !node.pinned }));
    case "DUPLICATE_NODE":
      return refreshDerivedWorkspace(duplicateNode(state, action.nodeId));
    case "ADD_NOTE":
      return addNote(state, action.nodeId, action.text || "Planning note");
    case "ADD_STICKY":
      return refreshDerivedWorkspace(addSticky(state, action.position, action.text));
    case "EXPAND_DETAILS":
      return {
        ...state,
        selection: { nodeIds: [action.nodeId], activeNodeId: action.nodeId },
        focus: { nodeId: action.nodeId, clusterId: state.nodes[action.nodeId]?.data?.clusterId || null }
      };
    case "FOCUS_NODE":
      return {
        ...state,
        focus: {
          nodeId: action.nodeId,
          clusterId: state.nodes[action.nodeId]?.data?.clusterId || null
        },
        map: { ...state.map, focusedNodeId: action.nodeId }
      };
    case "TOGGLE_SEMANTIC_EDGES":
      return {
        ...state,
        interaction: {
          ...state.interaction,
          showSemanticEdges: !state.interaction.showSemanticEdges
        }
      };
    case "TOGGLE_LANE":
      return {
        ...state,
        lanes: state.lanes.map((lane) =>
          lane.id === action.laneId ? { ...lane, collapsed: !lane.collapsed } : lane
        )
      };
    case "APPLY_AI_ACTION":
      return refreshDerivedWorkspace(applyAiAction(state, action.actionId));
    default:
      return state;
  }
};

export const buildInsights = (state) => {
  const dayGroups = groupNodesByDay(state);
  const insights = [];

  for (const lane of state.lanes) {
    const dayNodes = dayGroups[lane.day] || [];
    const fatigue = sum(dayNodes.map((node) => node.data.fatigueScore || 0));
    const outdoorHotRisk = dayNodes.filter((node) =>
      node.type === "activity" &&
      node.data.weatherScore < 58 &&
      ["outdoor", "mixed"].includes(node.data.weatherSensitivity)
    );
    const anchors = dayNodes.filter((node) => node.data.role === "anchor_activity");
    const clusterJumps = countClusterJumps(dayNodes);

    if (fatigue > 88) {
      insights.push({
        id: `fatigue-${lane.day}`,
        tone: "warning",
        title: `Day ${lane.day} is running heavy`,
        body: `Estimated fatigue is ${fatigue}. Add a cafe, garden, or recovery block before evening.`,
        actionId: "rebalance_fatigue"
      });
    }

    if (outdoorHotRisk.length) {
      insights.push({
        id: `weather-${lane.day}`,
        tone: "weather",
        title: `Weather-proof Day ${lane.day}`,
        body: `${outdoorHotRisk[0].data.title} is exposed in heat or rain. Keep an indoor fallback nearby.`,
        actionId: "weather_proof"
      });
    }

    if (!anchors.length && dayNodes.length) {
      insights.push({
        id: `anchor-${lane.day}`,
        tone: "info",
        title: `Day ${lane.day} has no anchor`,
        body: "The day may feel like filler. Add one memorable place or convert the lane into a recovery day.",
        actionId: "increase_exploration"
      });
    }

    if (clusterJumps > 2) {
      insights.push({
        id: `route-${lane.day}`,
        tone: "route",
        title: `Route is zig-zagging`,
        body: `Day ${lane.day} crosses ${clusterJumps + 1} locality zones. Cluster continuity would make it smoother.`,
        actionId: "optimize_route"
      });
    }
  }

  if (!insights.length) {
    insights.push({
      id: "healthy-flow",
      tone: "success",
      title: "The canvas has a clean travel rhythm",
      body: "Days are grounded, clustered, and not overloaded. You can now tune mood, budget, or social energy.",
      actionId: "add_hidden_gems"
    });
  }

  return insights;
};

export const getWorkspaceBounds = (state) => {
  const nodes = Object.values(state.nodes);
  return {
    minX: Math.min(...nodes.map((node) => node.position.x), 0),
    minY: Math.min(...nodes.map((node) => node.position.y), 0),
    maxX: Math.max(...nodes.map((node) => node.position.x + node.size.width), 1400),
    maxY: Math.max(...nodes.map((node) => node.position.y + node.size.height), 900)
  };
};

export const getClusterMeta = (clusterId, fallbackLabel) => {
  if (clusterMeta[clusterId]) return clusterMeta[clusterId];
  return {
    label: fallbackLabel || toTitle(clusterId || "Flexible Zone"),
    color: "#64748b",
    glow: "rgba(100,116,139,0.14)"
  };
};

const refreshDerivedWorkspace = (state) => {
  const edges = buildEdges(state);
  return {
    ...state,
    edges,
    clusters: buildClusterRegions(state),
    aiFeed: buildInsights({ ...state, edges }).slice(0, 5),
    version: state.version + 1
  };
};

export const refreshWorkspaceDerived = (state) => refreshDerivedWorkspace(state);

const buildEdges = (state) => {
  const edges = {};
  const dayGroups = groupNodesByDay(state);

  for (const [day, nodes] of Object.entries(dayGroups)) {
    const sorted = sortByCanvasX(nodes);
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const source = sorted[index];
      const target = sorted[index + 1];
      edges[`route-${day}-${source.id}-${target.id}`] = {
        id: `route-${day}-${source.id}-${target.id}`,
        type: "route",
        source: source.id,
        target: target.id,
        label: estimateRouteLabel(source, target)
      };
    }
  }

  const activityNodes = Object.values(state.nodes).filter((node) => node.type === "activity" || node.type === "recovery");
  for (let index = 0; index < activityNodes.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < activityNodes.length; otherIndex += 1) {
      const left = activityNodes[index];
      const right = activityNodes[otherIndex];
      if (left.day === right.day) continue;
      if (!left.data.semanticLinks?.some((tag) => right.data.semanticLinks?.includes(tag))) continue;
      if (Object.values(edges).filter((edge) => edge.type === "semantic").length > 14) continue;

      edges[`semantic-${left.id}-${right.id}`] = {
        id: `semantic-${left.id}-${right.id}`,
        type: "semantic",
        source: left.id,
        target: right.id,
        label: left.data.semanticLinks.find((tag) => right.data.semanticLinks?.includes(tag))
      };
    }
  }

  return edges;
};

const buildClusterRegions = (state) => {
  const clusters = {};
  const nodes = Object.values(state.nodes).filter((node) => node.data?.clusterId && node.data.clusterId !== "base");

  for (const node of nodes) {
    const clusterId = node.data.clusterId;
    const meta = getClusterMeta(clusterId, node.data.clusterLabel);
    if (!clusters[clusterId]) {
      clusters[clusterId] = {
        id: clusterId,
        label: meta.label,
        color: meta.color,
        glow: meta.glow,
        nodeIds: [],
        bounds: {
          x: node.position.x - 34,
          y: node.position.y - 38,
          right: node.position.x + node.size.width + 34,
          bottom: node.position.y + node.size.height + 38
        }
      };
    }

    const region = clusters[clusterId];
    region.nodeIds.push(node.id);
    region.bounds.x = Math.min(region.bounds.x, node.position.x - 34);
    region.bounds.y = Math.min(region.bounds.y, node.position.y - 38);
    region.bounds.right = Math.max(region.bounds.right, node.position.x + node.size.width + 34);
    region.bounds.bottom = Math.max(region.bounds.bottom, node.position.y + node.size.height + 38);
  }

  for (const region of Object.values(clusters)) {
    region.bounds.width = region.bounds.right - region.bounds.x;
    region.bounds.height = region.bounds.bottom - region.bounds.y;
  }

  return clusters;
};

const moveNode = (state, nodeId, position) => {
  const node = state.nodes[nodeId];
  if (!node || node.pinned) return state;
  const snapped = snapPosition(position);
  const nearestLane = getNearestLane(state.lanes, snapped.y);

  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: {
        ...node,
        day: nearestLane?.day || node.day,
        position: {
          x: Math.max(0, snapped.x),
          y: nearestLane ? clamp(snapped.y, nearestLane.y + 32, nearestLane.y + nearestLane.height - 92) : snapped.y
        }
      }
    },
    operationLog: appendOperation(state, {
      type: "move_node",
      nodeId,
      day: nearestLane?.day || node.day
    })
  };
};

const selectNode = (state, nodeId, additive = false) => {
  const existing = state.selection.nodeIds;
  const nodeIds = additive
    ? existing.includes(nodeId)
      ? existing.filter((id) => id !== nodeId)
      : [...existing, nodeId]
    : [nodeId];

  return {
    ...state,
    selection: { nodeIds, activeNodeId: nodeId },
    focus: { nodeId, clusterId: state.nodes[nodeId]?.data?.clusterId || null },
    map: { ...state.map, focusedNodeId: nodeId }
  };
};

const updateNode = (state, nodeId, updater) => {
  const node = state.nodes[nodeId];
  if (!node) return state;
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: updater(node)
    },
    operationLog: appendOperation(state, { type: "update_node", nodeId })
  };
};

const duplicateNode = (state, nodeId) => {
  const node = state.nodes[nodeId];
  if (!node) return state;
  const duplicateId = `${nodeId}-copy-${Date.now()}`;

  return {
    ...state,
    nodes: {
      ...state.nodes,
      [duplicateId]: {
        ...node,
        id: duplicateId,
        pinned: false,
        sourceIndex: Number(node.sourceIndex || 0) + 0.5,
        position: {
          x: node.position.x + 60,
          y: node.position.y + 24
        },
        data: {
          ...node.data,
          title: `${node.data.title} copy`,
          role: "filler_activity",
          roleLabel: "filler"
        }
      }
    },
    selection: { nodeIds: [duplicateId], activeNodeId: duplicateId },
    operationLog: appendOperation(state, { type: "duplicate_node", nodeId, duplicateId })
  };
};

const addNote = (state, nodeId, text) => updateNode(state, nodeId, (node) => ({
  ...node,
  notes: [
    ...(node.notes || []),
    {
      id: `note-${Date.now()}`,
      text,
      author: "You",
      createdAt: new Date().toISOString()
    }
  ]
}));

const addSticky = (state, position, text = "New planning note") => {
  const id = `sticky-${Date.now()}`;
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [id]: {
        id,
        type: "sticky_note",
        day: getNearestLane(state.lanes, position.y)?.day || 1,
        position: snapPosition(position),
        size: { width: 240, height: 130 },
        pinned: false,
        notes: [],
        data: {
          title: text,
          subtitle: "Collaborative note",
          clusterId: "notes",
          clusterLabel: "Planning notes",
          role: "note",
          roleLabel: "note",
          fatigueScore: 0,
          weatherScore: 100,
          durationMinutes: 0,
          semanticLinks: ["note"]
        }
      }
    },
    selection: { nodeIds: [id], activeNodeId: id },
    operationLog: appendOperation(state, { type: "add_sticky", nodeId: id })
  };
};

const applyAiAction = (state, actionId) => {
  switch (actionId) {
    case "optimize_route":
      return optimizeRouteByCluster(state);
    case "rebalance_fatigue":
      return addRecoveryBlocks(state);
    case "add_hidden_gems":
      return addSuggestionNode(state, "Hidden gem candidate", "Add one underrated stop inside the current cluster instead of a distant top-ranked place.");
    case "make_relaxed":
      return addRecoveryBlocks(spreadNodes(state, 96));
    case "increase_exploration":
      return addSuggestionNode(state, "Exploration branch", "Add a short walking discovery block after the main anchor.");
    case "add_food_stops":
      return addSuggestionNode(state, "Nearby cafe decompression", "Insert a low-fatigue cafe between anchors to reduce walking intensity.");
    case "weather_proof":
      return addWeatherWarnings(state);
    case "reduce_budget":
      return addSuggestionNode(state, "Budget swap set", "Prefer free/low-cost markets, gardens, and classic snack stops for expensive blocks.");
    case "add_nightlife":
      return addSuggestionNode(state, "Social evening option", "Add nightlife only after a soft afternoon, then protect the next morning.");
    case "luxury_flow":
      return addSuggestionNode(state, "Luxury flow branch", "Upgrade dinner and recovery blocks while keeping heritage anchors unchanged.");
    default:
      return state;
  }
};

const optimizeRouteByCluster = (state) => {
  const dayGroups = groupNodesByDay(state);
  const nodes = { ...state.nodes };

  for (const [day, dayNodes] of Object.entries(dayGroups)) {
    const sorted = [...dayNodes].sort((a, b) => {
      const clusterCompare = String(a.data.clusterId).localeCompare(String(b.data.clusterId));
      if (clusterCompare !== 0) return clusterCompare;
      return a.position.x - b.position.x;
    });
    const lane = state.lanes.find((item) => String(item.day) === String(day));
    sorted.forEach((node, index) => {
      nodes[node.id] = {
        ...nodes[node.id],
        position: {
          x: NODE_START_X + index * (NODE_WIDTH + NODE_GAP),
          y: lane.y + 46
        }
      };
    });
  }

  return {
    ...state,
    nodes,
    operationLog: appendOperation(state, { type: "ai_optimize_route" })
  };
};

const addRecoveryBlocks = (state) => {
  const dayGroups = groupNodesByDay(state);
  let nextState = state;

  for (const [day, nodes] of Object.entries(dayGroups)) {
    const fatigue = sum(nodes.map((node) => node.data.fatigueScore || 0));
    if (fatigue < 76) continue;
    const lane = state.lanes.find((item) => String(item.day) === String(day));
    const x = Math.max(...nodes.map((node) => node.position.x)) + NODE_WIDTH + 72;
    nextState = addSystemNode(nextState, {
      type: "recovery",
      day: Number(day),
      position: { x, y: lane.y + 56 },
      title: "Recovery cafe block",
      subtitle: "AI inserted decompression",
      clusterId: nodes[nodes.length - 1]?.data.clusterId || "recovery",
      role: "recovery_activity",
      fatigueScore: 1,
      weatherScore: 92,
      durationMinutes: 50
    });
  }

  return {
    ...nextState,
    operationLog: appendOperation(nextState, { type: "ai_rebalance_fatigue" })
  };
};

const addWeatherWarnings = (state) => {
  let nextState = state;
  const risky = Object.values(state.nodes).filter((node) =>
    node.type === "activity" &&
    node.data.weatherScore < 60 &&
    ["outdoor", "mixed"].includes(node.data.weatherSensitivity)
  );

  for (const node of risky.slice(0, 3)) {
    nextState = addSystemNode(nextState, {
      type: "weather_warning",
      day: node.day,
      position: { x: node.position.x + 24, y: node.position.y + 174 },
      title: "Weather fallback needed",
      subtitle: `${node.data.title} is exposed. Add an indoor nearby option.`,
      clusterId: node.data.clusterId,
      role: "contingency_activity",
      fatigueScore: 0,
      weatherScore: 100,
      durationMinutes: 0
    });
  }

  return {
    ...nextState,
    operationLog: appendOperation(nextState, { type: "ai_weather_proof" })
  };
};

const addSuggestionNode = (state, title, subtitle) => {
  const active = state.nodes[state.selection.activeNodeId] || Object.values(state.nodes).find((node) => node.type === "activity");
  const lane = state.lanes.find((item) => item.day === active?.day) || state.lanes[0];
  return addSystemNode(state, {
    type: "ai_suggestion",
    day: lane.day,
    position: {
      x: (active?.position.x || NODE_START_X) + NODE_WIDTH + 80,
      y: (active?.position.y || lane.y + 48) + 10
    },
    title,
    subtitle,
    clusterId: active?.data.clusterId || "suggestions",
    role: "contingency_activity",
    fatigueScore: 4,
    weatherScore: 88,
    durationMinutes: 45
  });
};

const addSystemNode = (state, config) => {
  const id = `${config.type}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  const cluster = getClusterMeta(config.clusterId);
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [id]: {
        id,
        type: config.type,
        day: config.day,
        position: snapPosition(config.position),
        size: { width: config.type === "weather_warning" ? 250 : 260, height: 126 },
        pinned: false,
        notes: [],
        data: {
          title: config.title,
          subtitle: config.subtitle,
          clusterId: config.clusterId,
          clusterLabel: cluster.label,
          clusterColor: cluster.color,
          role: config.role,
          roleLabel: roleCopy[config.role] || "AI",
          fatigueScore: config.fatigueScore,
          weatherScore: config.weatherScore,
          durationMinutes: config.durationMinutes,
          semanticLinks: ["ai", config.role]
        }
      }
    },
    selection: { nodeIds: [id], activeNodeId: id }
  };
};

const spreadNodes = (state, extraGap) => {
  const dayGroups = groupNodesByDay(state);
  const nodes = { ...state.nodes };

  for (const dayNodes of Object.values(dayGroups)) {
    sortByCanvasX(dayNodes).forEach((node, index) => {
      nodes[node.id] = {
        ...node,
        position: {
          ...node.position,
          x: NODE_START_X + index * (NODE_WIDTH + NODE_GAP + extraGap)
        }
      };
    });
  }

  return {
    ...state,
    nodes,
    operationLog: appendOperation(state, { type: "ai_spread_nodes" })
  };
};

const groupNodesByDay = (state) => {
  return Object.values(state.nodes)
    .filter((node) => ["activity", "recovery", "ai_suggestion", "weather_warning", "sticky_note"].includes(node.type))
    .reduce((groups, node) => {
      groups[node.day] = groups[node.day] || [];
      groups[node.day].push(node);
      return groups;
    }, {});
};

const sortByCanvasX = (nodes) => [...nodes].sort((a, b) => a.position.x - b.position.x);

const countClusterJumps = (nodes) => {
  const sorted = sortByCanvasX(nodes).filter((node) => node.data.clusterId && node.data.clusterId !== "notes");
  let jumps = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].data.clusterId !== sorted[index - 1].data.clusterId) jumps += 1;
  }
  return jumps;
};

const getNearestLane = (lanes, y) => {
  return lanes.reduce((best, lane) => {
    if (!best) return lane;
    const bestDistance = Math.abs((best.y + best.height / 2) - y);
    const laneDistance = Math.abs((lane.y + lane.height / 2) - y);
    return laneDistance < bestDistance ? lane : best;
  }, null);
};

const snapPosition = (position) => ({
  x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(position.y / GRID_SIZE) * GRID_SIZE
});

const getClusterId = (activity) => {
  if (activity.localityClusterId) return activity.localityClusterId;
  const area = String(activity.area || "flexible_zone").toLowerCase();
  if (area.includes("amer")) return "amer_north_jaipur";
  if (area.includes("walled") || area.includes("old city")) return "walled_city_jaipur";
  if (area.includes("central") || area.includes("mi road")) return "central_mi_road_cscheme";
  if (area.includes("galta")) return "east_galta_ghat_ki_guni";
  return area.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "flexible_zone";
};

const inferRole = (activity) => {
  if (activity.type === "food") return "recovery_activity";
  if (activity.type === "nightlife") return "nightlife_activity";
  if (activity.fatigueScore > 32) return "anchor_activity";
  return "filler_activity";
};

const getWeatherScore = (activity) => {
  if (activity.weatherSuitability?.hot !== undefined) return Math.round(activity.weatherSuitability.hot * 100);
  if (activity.weatherSensitivity === "indoor") return 92;
  if (activity.weatherSensitivity === "mixed") return 72;
  return 54;
};

const buildSemanticLinks = (activity) => {
  return [
    activity.type,
    activity.role,
    ...(activity.tripRoles || []),
    ...(activity.tags || []),
    ...(activity.vibeTags || [])
  ]
    .filter(Boolean)
    .map((tag) => String(tag).toLowerCase().replace(/_/g, " "))
    .slice(0, 18);
};

const estimateRouteLabel = (source, target) => {
  if (source.data.clusterId === target.data.clusterId) return "nearby";
  if (source.data.routeZone && source.data.routeZone === target.data.routeZone) return "same zone";
  return "route jump";
};

const appendOperation = (state, operation) => [
  ...state.operationLog.slice(-40),
  {
    id: `op-${Date.now()}`,
    createdAt: new Date().toISOString(),
    actor: "you",
    ...operation
  }
];

const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toTitle = (value) => String(value).replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
