import { useMemo, useRef, useState } from "react";
import {
  FiActivity,
  FiArrowLeft,
  FiArrowRight,
  FiCloud,
  FiCoffee,
  FiCopy,
  FiDollarSign,
  FiEye,
  FiEyeOff,
  FiGitBranch,
  FiLayers,
  FiLoader,
  FiLock,
  FiMap,
  FiMapPin,
  FiMaximize2,
  FiMessageCircle,
  FiMinus,
  FiMove,
  FiNavigation,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiSliders,
  FiStar,
  FiSun,
  FiTarget,
  FiUnlock,
  FiUsers,
  FiZap
} from "react-icons/fi";
import { getWorkspaceBounds } from "./workspaceModel";

const aiActions = [
  { id: "optimize_route", label: "Optimize Route", icon: FiNavigation },
  { id: "rebalance_fatigue", label: "Rebalance Fatigue", icon: FiActivity },
  { id: "add_hidden_gems", label: "Add Hidden Gems", icon: FiStar },
  { id: "make_relaxed", label: "Make More Relaxed", icon: FiCoffee },
  { id: "increase_exploration", label: "Increase Exploration", icon: FiTarget },
  { id: "add_food_stops", label: "Add Food Stops", icon: FiCoffee },
  { id: "weather_proof", label: "Weather-Proof Day", icon: FiCloud },
  { id: "reduce_budget", label: "Reduce Budget", icon: FiDollarSign },
  { id: "add_nightlife", label: "Add Social/Nightlife", icon: FiZap },
  { id: "luxury_flow", label: "Convert To Luxury Flow", icon: FiSparkleFallback }
];

const toneStyles = {
  warning: "border-amber-300/50 bg-amber-400/10 text-amber-700",
  weather: "border-sky-300/50 bg-sky-400/10 text-sky-700",
  route: "border-rose-300/50 bg-rose-400/10 text-rose-700",
  success: "border-emerald-300/50 bg-emerald-400/10 text-emerald-700",
  info: "border-violet-300/50 bg-violet-400/10 text-violet-700"
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const TravelWorkspaceCanvas = ({
  workspace,
  dispatch,
  group,
  darkMode,
  setDarkMode,
  prompt,
  setPrompt,
  messages,
  generating,
  error,
  totalStops,
  onGenerate,
  onRegenerateDay,
  onReplaceNode,
  onTrackInteraction,
  onNavigateClassic,
  onNavigateTrip
}) => {
  const canvasRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [pan, setPan] = useState(null);
  const [localMessage, setLocalMessage] = useState("");

  const bounds = useMemo(() => getWorkspaceBounds(workspace), [workspace]);
  const stageSize = useMemo(() => ({
    width: Math.max(bounds.maxX + 720, 2600),
    height: Math.max(bounds.maxY + 360, 1100)
  }), [bounds]);

  const nodes = useMemo(() => Object.values(workspace.nodes), [workspace.nodes]);
  const collapsedDays = useMemo(
    () => new Set(workspace.lanes.filter((lane) => lane.collapsed).map((lane) => lane.day)),
    [workspace.lanes]
  );
  const visibleNodes = nodes.filter((node) => node.type === "hotel" || !collapsedDays.has(node.day));
  const visibleNodeMap = useMemo(
    () => Object.fromEntries(visibleNodes.map((node) => [node.id, node])),
    [visibleNodes]
  );
  const edges = useMemo(
    () => Object.values(workspace.edges || {}).filter((edge) =>
      visibleNodeMap[edge.source] &&
      visibleNodeMap[edge.target] &&
      (edge.type === "route" || workspace.interaction.showSemanticEdges)
    ),
    [visibleNodeMap, workspace.edges, workspace.interaction.showSemanticEdges]
  );
  const selectedNode = workspace.nodes[workspace.selection.activeNodeId];
  const shellClass = darkMode ? "bg-[#081015] text-white" : "bg-[#edf4f1] text-slate-950";

  const screenToCanvas = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - workspace.viewport.x) / workspace.viewport.zoom,
      y: (clientY - rect.top - workspace.viewport.y) / workspace.viewport.zoom
    };
  };

  const handleWheel = (event) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const rect = canvasRef.current.getBoundingClientRect();
      const nextZoom = clamp(workspace.viewport.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.45, 1.35);
      const canvasX = (event.clientX - rect.left - workspace.viewport.x) / workspace.viewport.zoom;
      const canvasY = (event.clientY - rect.top - workspace.viewport.y) / workspace.viewport.zoom;
      dispatch({
        type: "ZOOM_VIEWPORT",
        zoom: nextZoom,
        x: event.clientX - rect.left - canvasX * nextZoom,
        y: event.clientY - rect.top - canvasY * nextZoom
      });
      return;
    }

    dispatch({
      type: "PAN_VIEWPORT",
      dx: -event.deltaX,
      dy: -event.deltaY
    });
  };

  const handleNodePointerDown = (event, node) => {
    event.stopPropagation();
    const point = screenToCanvas(event.clientX, event.clientY);
    dispatch({ type: "SELECT_NODE", nodeId: node.id, additive: event.shiftKey || event.metaKey });
    setDrag({
      nodeId: node.id,
      startDay: node.day,
      startPosition: node.position,
      place: serializeNodeForLearning(node),
      offsetX: point.x - node.position.x,
      offsetY: point.y - node.position.y
    });
  };

  const handleCanvasPointerMove = (event) => {
    if (drag) {
      const point = screenToCanvas(event.clientX, event.clientY);
      dispatch({
        type: "MOVE_NODE",
        nodeId: drag.nodeId,
        position: {
          x: point.x - drag.offsetX,
          y: point.y - drag.offsetY
        }
      });
      return;
    }

    if (pan) {
      dispatch({
        type: "PAN_VIEWPORT",
        dx: event.clientX - pan.x,
        dy: event.clientY - pan.y
      });
      setPan({ x: event.clientX, y: event.clientY });
    }
  };

  const handleCanvasPointerUp = () => {
    if (drag) {
      const movedNode = workspace.nodes[drag.nodeId];
      const movedEnough = movedNode && (
        movedNode.day !== drag.startDay ||
        Math.abs(movedNode.position.x - drag.startPosition.x) > 24 ||
        Math.abs(movedNode.position.y - drag.startPosition.y) > 24
      );

      if (movedEnough) {
        onTrackInteraction?.({
          type: movedNode.day !== drag.startDay ? "activity_moved_day" : "activity_moved",
          source: "planning_canvas",
          activityId: movedNode.data?.placeId || movedNode.id,
          day: movedNode.day,
          place: drag.place,
          metadata: {
            fromDay: drag.startDay,
            toDay: movedNode.day,
            fromPosition: drag.startPosition,
            toPosition: movedNode.position,
            sameClusterFlow: true
          }
        });
      }
    }
    setDrag(null);
    setPan(null);
  };

  const handleBlankPointerDown = (event) => {
    dispatch({ type: "CLEAR_SELECTION" });
    setPan({ x: event.clientX, y: event.clientY });
  };

  const zoomBy = (amount) => {
    dispatch({
      type: "ZOOM_VIEWPORT",
      zoom: workspace.viewport.zoom + amount,
      x: workspace.viewport.x,
      y: workspace.viewport.y
    });
  };

  const resetView = () => {
    dispatch({ type: "SET_VIEWPORT", viewport: { x: -40, y: 0, zoom: 0.82 } });
  };

  const addSticky = () => {
    const center = screenToCanvas(
      canvasRef.current.getBoundingClientRect().left + canvasRef.current.clientWidth / 2,
      canvasRef.current.getBoundingClientRect().top + canvasRef.current.clientHeight / 2
    );
    dispatch({ type: "ADD_STICKY", position: center, text: "Vote, concern, or idea" });
    onTrackInteraction?.({
      type: "planning_note_added",
      source: "planning_canvas",
      metadata: { x: Math.round(center.x), y: Math.round(center.y) }
    });
  };

  const moveToNextDay = (node) => {
    const laneIndex = workspace.lanes.findIndex((lane) => lane.day === node.day);
    const nextLane = workspace.lanes[(laneIndex + 1) % workspace.lanes.length];
    if (!nextLane) return;
    dispatch({
      type: "MOVE_NODE",
      nodeId: node.id,
      position: { x: node.position.x + 40, y: nextLane.y + 58 }
    });
    onTrackInteraction?.({
      type: "activity_moved_day",
      source: "planning_canvas",
      activityId: node.data?.placeId || node.id,
      day: nextLane.day,
      place: serializeNodeForLearning(node),
      metadata: {
        fromDay: node.day,
        toDay: nextLane.day,
        trigger: "quick_action"
      }
    });
  };

  const runAiAction = (actionId) => {
    dispatch({ type: "APPLY_AI_ACTION", actionId });
    onTrackInteraction?.({
      type: actionId === "rebalance_fatigue" || actionId === "make_relaxed" ? "recovery_block_added" : "ai_suggestion_accepted",
      source: "planning_canvas",
      day: selectedNode?.day,
      place: selectedNode ? serializeNodeForLearning(selectedNode) : undefined,
      metadata: { actionId }
    });
  };

  const duplicateNode = (node) => {
    dispatch({ type: "DUPLICATE_NODE", nodeId: node.id });
    onTrackInteraction?.({
      type: "activity_duplicated",
      source: "planning_canvas",
      activityId: node.data?.placeId || node.id,
      day: node.day,
      place: serializeNodeForLearning(node)
    });
  };

  const togglePin = (node) => {
    dispatch({ type: "TOGGLE_PIN", nodeId: node.id });
    onTrackInteraction?.({
      type: node.pinned ? "activity_unpinned" : "activity_pinned",
      source: "planning_canvas",
      activityId: node.data?.placeId || node.id,
      day: node.day,
      place: serializeNodeForLearning(node)
    });
  };

  const addNodeNote = (node) => {
    dispatch({ type: "ADD_NOTE", nodeId: node.id, text: "Needs group review" });
    onTrackInteraction?.({
      type: "planning_note_added",
      source: "planning_canvas",
      activityId: node.data?.placeId || node.id,
      day: node.day,
      place: serializeNodeForLearning(node)
    });
  };

  const submitPrompt = () => {
    const nextPrompt = localMessage.trim() || prompt;
    if (!nextPrompt) return;
    onGenerate(nextPrompt);
    setLocalMessage("");
  };

  return (
    <div className={`min-h-screen ${shellClass}`}>
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[1fr_390px]">
        <section className="relative min-h-[780px] overflow-hidden">
          <WorkspaceHeader
            group={group}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            totalStops={totalStops}
            workspace={workspace}
            onNavigateClassic={onNavigateClassic}
            onNavigateTrip={onNavigateTrip}
          />

          <div
            ref={canvasRef}
            className="absolute inset-x-0 bottom-0 top-[92px] cursor-grab overflow-hidden active:cursor-grabbing"
            onWheel={handleWheel}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
          >
            <div
              className={`absolute inset-0 ${darkMode ? "workspace-grid-dark" : "workspace-grid-light"}`}
              onPointerDown={handleBlankPointerDown}
            />

            <div
              className="absolute left-0 top-0"
              style={{
                width: stageSize.width,
                height: stageSize.height,
                transform: `translate(${workspace.viewport.x}px, ${workspace.viewport.y}px) scale(${workspace.viewport.zoom})`,
                transformOrigin: "0 0"
              }}
            >
              <RouteEdges nodes={visibleNodeMap} edges={edges} darkMode={darkMode} />

              {workspace.lanes.map((lane) => (
                <DayLane
                  key={lane.id}
                  lane={lane}
                  stageWidth={stageSize.width}
                  darkMode={darkMode}
                  count={nodes.filter((node) => node.day === lane.day && node.type !== "hotel").length}
                  onToggle={() => dispatch({ type: "TOGGLE_LANE", laneId: lane.id })}
                  onRegenerate={() => onRegenerateDay(lane.day)}
                />
              ))}

              {Object.values(workspace.clusters || {}).map((cluster) => (
                <ClusterRegion
                  key={cluster.id}
                  cluster={cluster}
                  darkMode={darkMode}
                  hidden={cluster.nodeIds.every((nodeId) => collapsedDays.has(workspace.nodes[nodeId]?.day))}
                />
              ))}

              {visibleNodes.map((node) => (
                <WorkspaceNode
                  key={node.id}
                  node={node}
                  selected={workspace.selection.nodeIds.includes(node.id)}
                  focused={workspace.focus.nodeId === node.id}
                  darkMode={darkMode}
                  onPointerDown={(event) => handleNodePointerDown(event, node)}
                  onFocus={() => dispatch({ type: "FOCUS_NODE", nodeId: node.id })}
                  onDuplicate={() => duplicateNode(node)}
                  onPin={() => togglePin(node)}
                  onNote={() => addNodeNote(node)}
                  onMoveDay={() => moveToNextDay(node)}
                  onExpand={() => dispatch({ type: "EXPAND_DETAILS", nodeId: node.id })}
                  onOptimize={() => runAiAction("add_hidden_gems")}
                  onReplace={() => onReplaceNode(node)}
                />
              ))}

              <CollaboratorCursor collaborator={workspace.collaborators[1]} />
            </div>

            <CanvasToolbar
              darkMode={darkMode}
              zoom={workspace.viewport.zoom}
              showSemanticEdges={workspace.interaction.showSemanticEdges}
              onZoomIn={() => zoomBy(0.1)}
              onZoomOut={() => zoomBy(-0.1)}
              onReset={resetView}
              onSticky={addSticky}
              onToggleSemantic={() => dispatch({ type: "TOGGLE_SEMANTIC_EDGES" })}
            />

            <MiniRouteMap
              workspace={workspace}
              darkMode={darkMode}
              onFocus={(nodeId) => dispatch({ type: "FOCUS_NODE", nodeId })}
            />
          </div>
        </section>

        <CopilotPanel
          workspace={workspace}
          selectedNode={selectedNode}
          prompt={prompt}
          setPrompt={setPrompt}
          localMessage={localMessage}
          setLocalMessage={setLocalMessage}
          messages={messages}
          generating={generating}
          error={error}
          darkMode={darkMode}
          adaptiveSummary={group?.adaptivePlanning?.summary}
          onGenerate={submitPrompt}
          onAction={runAiAction}
        />
      </div>
    </div>
  );
};

const WorkspaceHeader = ({ group, darkMode, setDarkMode, totalStops, workspace, onNavigateClassic, onNavigateTrip }) => (
  <div className={`absolute inset-x-0 top-0 z-20 flex h-[92px] items-center justify-between border-b px-5 backdrop-blur-2xl ${darkMode ? "border-white/10 bg-[#081015]/82" : "border-white/70 bg-white/68"}`}>
    <div className="flex items-center gap-4">
      <button
        onClick={onNavigateTrip}
        className={`grid h-11 w-11 place-items-center rounded-2xl border ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
        title="Back to trip"
      >
        <FiArrowLeft />
      </button>
      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${darkMode ? "text-teal-200/70" : "text-teal-700/70"}`}>
          Collaborative planning canvas
        </p>
        <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold">
          <FiMapPin className="text-teal-400" />
          {group?.destination || group?.groupName || "WayFinder Workspace"}
        </h1>
      </div>
    </div>

    <div className="hidden items-center gap-3 lg:flex">
      <MetricPill darkMode={darkMode} icon={FiLayers} label={`${workspace.lanes.length} day lanes`} />
      <MetricPill darkMode={darkMode} icon={FiGitBranch} label={`${Object.keys(workspace.edges || {}).length} links`} />
      <MetricPill darkMode={darkMode} icon={FiMap} label={`${totalStops} stops`} />
    </div>

    <div className="flex items-center gap-3">
      <button
        onClick={onNavigateClassic}
        className={`rounded-2xl border px-4 py-2 text-sm font-medium ${darkMode ? "border-white/10 bg-white/5 text-white" : "border-slate-200 bg-white text-slate-700"}`}
      >
        Classic itinerary
      </button>
      <button
        onClick={() => setDarkMode((value) => !value)}
        className={`grid h-11 w-11 place-items-center rounded-2xl border ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
        title="Toggle theme"
      >
        <FiSun />
      </button>
    </div>
  </div>
);

const MetricPill = ({ icon, label, darkMode }) => (
  <div className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${darkMode ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-200 bg-white/80 text-slate-600"}`}>
    {icon({ className: "text-teal-400" })}
    {label}
  </div>
);

const CanvasToolbar = ({
  darkMode,
  zoom,
  showSemanticEdges,
  onZoomIn,
  onZoomOut,
  onReset,
  onSticky,
  onToggleSemantic
}) => (
  <div className={`absolute left-5 top-5 z-30 flex flex-wrap items-center gap-2 rounded-3xl border p-2 shadow-2xl backdrop-blur-2xl ${darkMode ? "border-white/10 bg-black/45" : "border-white/80 bg-white/80"}`}>
    <IconButton icon={FiMinus} label="Zoom out" onClick={onZoomOut} darkMode={darkMode} />
    <span className={`w-14 text-center text-xs font-semibold ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
      {Math.round(zoom * 100)}%
    </span>
    <IconButton icon={FiPlus} label="Zoom in" onClick={onZoomIn} darkMode={darkMode} />
    <div className={`mx-1 h-7 w-px ${darkMode ? "bg-white/10" : "bg-slate-200"}`} />
    <IconButton icon={FiMaximize2} label="Reset view" onClick={onReset} darkMode={darkMode} />
    <IconButton icon={FiMessageCircle} label="Add sticky note" onClick={onSticky} darkMode={darkMode} />
    <IconButton
      icon={showSemanticEdges ? FiEye : FiEyeOff}
      label="Toggle semantic edges"
      onClick={onToggleSemantic}
      darkMode={darkMode}
      active={showSemanticEdges}
    />
  </div>
);

const IconButton = ({ icon, label, onClick, darkMode, active = false }) => (
  <button
    type="button"
    title={label}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      onClick?.();
    }}
    className={`grid h-10 w-10 place-items-center rounded-2xl text-sm transition hover:scale-105 ${active
      ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20"
      : darkMode ? "bg-white/7 text-slate-200 hover:bg-white/12" : "bg-slate-100 text-slate-700 hover:bg-white"}`}
  >
    {icon({})}
  </button>
);

const DayLane = ({ lane, stageWidth, darkMode, count, onToggle, onRegenerate }) => (
  <div
    className={`absolute left-8 rounded-[32px] border backdrop-blur-xl transition-all duration-300 ${darkMode ? "border-white/8 bg-white/[0.035]" : "border-white/80 bg-white/42"}`}
    style={{
      top: lane.y,
      width: stageWidth - 120,
      height: lane.collapsed ? 76 : lane.height
    }}
  >
    <div className="absolute left-7 top-5 flex items-center gap-4">
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className={`grid h-10 w-10 place-items-center rounded-2xl border ${darkMode ? "border-white/10 bg-black/30" : "border-slate-200 bg-white"}`}
        title={lane.collapsed ? "Expand day" : "Collapse day"}
      >
        {lane.collapsed ? <FiPlus /> : <FiMinus />}
      </button>
      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
          Day {String(lane.day).padStart(2, "0")} swimlane
        </p>
        <h2 className="mt-1 text-lg font-semibold">{lane.title}</h2>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-white/8 text-slate-300" : "bg-white text-slate-600"}`}>
        {count} nodes
      </span>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRegenerate();
        }}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${darkMode ? "bg-teal-400/12 text-teal-200" : "bg-teal-100 text-teal-700"}`}
      >
        <FiRefreshCw />
        Re-plan
      </button>
    </div>
  </div>
);

const ClusterRegion = ({ cluster, darkMode, hidden }) => {
  if (hidden) return null;
  return (
    <div
      className={`absolute rounded-[38px] border border-dashed transition-opacity duration-300 ${darkMode ? "backdrop-blur-[2px]" : ""}`}
      style={{
        left: cluster.bounds.x,
        top: cluster.bounds.y,
        width: cluster.bounds.width,
        height: cluster.bounds.height,
        borderColor: cluster.color,
        background: cluster.glow,
        boxShadow: `0 0 54px ${cluster.glow}`
      }}
    >
      <div
        className="absolute -top-4 left-8 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg"
        style={{ backgroundColor: cluster.color }}
      >
        {cluster.label}
      </div>
    </div>
  );
};

const RouteEdges = ({ nodes, edges, darkMode }) => (
  <svg className="pointer-events-none absolute inset-0 overflow-visible">
    {edges.map((edge) => {
      const source = nodes[edge.source];
      const target = nodes[edge.target];
      if (!source || !target) return null;
      const start = {
        x: source.position.x + source.size.width - 6,
        y: source.position.y + source.size.height / 2
      };
      const end = {
        x: target.position.x + 6,
        y: target.position.y + target.size.height / 2
      };
      const bend = Math.max(90, Math.abs(end.x - start.x) / 2);
      const path = `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}`;
      const route = edge.type === "route";
      return (
        <g key={edge.id}>
          <path
            d={path}
            fill="none"
            stroke={route ? "#14b8a6" : darkMode ? "#94a3b8" : "#64748b"}
            strokeWidth={route ? 2.5 : 1.4}
            strokeLinecap="round"
            strokeDasharray={route ? "9 12" : "4 8"}
            className={route ? "wayfinder-route-line" : ""}
            opacity={route ? 0.88 : 0.44}
          />
          {route && (
            <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 10} className="fill-teal-500 text-[11px] font-semibold">
              {edge.label}
            </text>
          )}
        </g>
      );
    })}
  </svg>
);

const WorkspaceNode = ({
  node,
  selected,
  focused,
  darkMode,
  onPointerDown,
  onFocus,
  onDuplicate,
  onPin,
  onNote,
  onMoveDay,
  onExpand,
  onOptimize,
  onReplace
}) => {
  if (node.type === "hotel") {
    return (
      <HomeBaseNode
        node={node}
        selected={selected}
        darkMode={darkMode}
        onPointerDown={onPointerDown}
        onFocus={onFocus}
        onExpand={onExpand}
      />
    );
  }

  if (node.type !== "activity" && node.type !== "recovery") {
    return (
      <SystemNode
        node={node}
        selected={selected}
        darkMode={darkMode}
        onPointerDown={onPointerDown}
        onFocus={onFocus}
        onDuplicate={onDuplicate}
        onPin={onPin}
        onNote={onNote}
      />
    );
  }

  const fatigue = Number(node.data.fatigueScore || 0);
  const weather = Number(node.data.weatherScore || 0);

  return (
    <div
      className={`absolute select-none rounded-[26px] border shadow-2xl transition-[box-shadow,transform,border-color] duration-200 ${darkMode ? "bg-[#101922]/90" : "bg-white/92"} ${selected ? "border-teal-300 ring-4 ring-teal-300/20" : darkMode ? "border-white/10" : "border-white"} ${focused ? "shadow-teal-500/30" : "shadow-black/12"}`}
      style={{
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
        width: node.size.width,
        height: node.size.height,
        backdropFilter: "blur(18px)"
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onExpand}
      onMouseEnter={onFocus}
    >
      <div className="grid h-full grid-cols-[86px_1fr] overflow-hidden rounded-[26px]">
        <div className="relative h-full">
          <img src={node.data.image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {node.data.type || node.data.roleLabel}
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold ${darkMode ? "text-teal-200" : "text-teal-700"}`}>
                {node.data.time || "Flexible"} · {node.data.durationMinutes || 90} min
              </p>
              <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-tight">
                {node.data.title}
              </h3>
            </div>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onPin();
              }}
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl ${node.pinned ? "bg-teal-500 text-white" : darkMode ? "bg-white/8 text-slate-300" : "bg-slate-100 text-slate-600"}`}
              title={node.pinned ? "Unpin" : "Pin"}
            >
              {node.pinned ? <FiLock size={13} /> : <FiUnlock size={13} />}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge color={node.data.clusterColor} label={node.data.clusterLabel} />
            <ScoreBadge label={`F${fatigue}`} tone={fatigue > 30 ? "amber" : "emerald"} />
            <ScoreBadge label={weather > 70 ? "weather ok" : "exposed"} tone={weather > 70 ? "sky" : "rose"} />
          </div>

          <div className="mt-auto flex items-center justify-between gap-1 pt-2">
            <NodeAction icon={FiRefreshCw} label="Replace" onClick={onReplace} />
            <NodeAction icon={FiCopy} label="Duplicate" onClick={onDuplicate} />
            <NodeAction icon={FiArrowRight} label="Move to another day" onClick={onMoveDay} />
            <NodeAction icon={FiMessageCircle} label="Add note" onClick={onNote} />
            <NodeAction icon={FiTarget} label="AI optimize nearby" onClick={onOptimize} />
            <NodeAction icon={FiMaximize2} label="Expand details" onClick={onExpand} />
          </div>
        </div>
      </div>
    </div>
  );
};

const HomeBaseNode = ({ node, selected, darkMode, onPointerDown, onFocus, onExpand }) => (
  <div
    className={`absolute select-none rounded-[26px] border p-4 shadow-xl ${selected ? "border-teal-300 ring-4 ring-teal-300/20" : darkMode ? "border-white/10 bg-teal-300/10" : "border-teal-200 bg-white/90"}`}
    style={{
      transform: `translate(${node.position.x}px, ${node.position.y}px)`,
      width: node.size.width,
      height: node.size.height
    }}
    onPointerDown={onPointerDown}
    onMouseEnter={onFocus}
    onDoubleClick={onExpand}
  >
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-500 text-white">
        <FiMapPin />
      </div>
      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-teal-100/70" : "text-teal-700/70"}`}>
          Home base
        </p>
        <h3 className="text-sm font-semibold">{node.data.title}</h3>
      </div>
    </div>
    <p className={`mt-3 text-xs leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
      Anchors routing, arrival/departure pacing, and cluster continuity.
    </p>
  </div>
);

const SystemNode = ({ node, selected, darkMode, onPointerDown, onFocus, onDuplicate, onPin, onNote }) => {
  const colors = {
    ai_suggestion: "from-violet-500/22 to-teal-500/14",
    weather_warning: "from-sky-500/22 to-amber-500/16",
    sticky_note: "from-yellow-300/28 to-orange-300/18",
    recovery: "from-emerald-400/22 to-teal-400/16"
  };
  return (
    <div
      className={`absolute select-none rounded-[24px] border bg-gradient-to-br p-4 shadow-xl ${colors[node.type] || colors.ai_suggestion} ${selected ? "border-teal-300 ring-4 ring-teal-300/20" : darkMode ? "border-white/10" : "border-white"}`}
      style={{
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
        width: node.size.width,
        height: node.size.height,
        backdropFilter: "blur(18px)"
      }}
      onPointerDown={onPointerDown}
      onMouseEnter={onFocus}
    >
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${darkMode ? "bg-black/28" : "bg-white/65"}`}>
          {node.type === "weather_warning" ? <FiCloud /> : node.type === "sticky_note" ? <FiMessageCircle /> : <FiZap />}
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold">{node.data.title}</h3>
          <p className={`mt-1 line-clamp-2 text-xs leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
            {node.data.subtitle}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-1">
        <NodeAction icon={FiCopy} label="Duplicate" onClick={onDuplicate} />
        <NodeAction icon={node.pinned ? FiLock : FiUnlock} label="Pin" onClick={onPin} />
        <NodeAction icon={FiMessageCircle} label="Add note" onClick={onNote} />
      </div>
    </div>
  );
};

const NodeAction = ({ icon, label, onClick }) => (
  <button
    type="button"
    title={label}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      onClick?.();
    }}
    className="grid h-7 w-7 place-items-center rounded-xl bg-black/5 text-slate-600 transition hover:bg-teal-500 hover:text-white dark:bg-white/8"
  >
    {icon({ size: 13 })}
  </button>
);

const Badge = ({ color, label }) => (
  <span className="inline-flex max-w-[168px] items-center gap-1 rounded-full bg-black/5 px-2 py-1 text-[10px] font-semibold text-slate-600">
    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color || "#14b8a6" }} />
    <span className="truncate">{label}</span>
  </span>
);

const ScoreBadge = ({ label, tone }) => {
  const tones = {
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    sky: "bg-sky-100 text-sky-700",
    rose: "bg-rose-100 text-rose-700"
  };
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tones[tone] || tones.emerald}`}>
      {label}
    </span>
  );
};

const CollaboratorCursor = ({ collaborator }) => {
  if (!collaborator) return null;
  return (
    <div
      className="pointer-events-none absolute"
      style={{ transform: `translate(${collaborator.cursor.x}px, ${collaborator.cursor.y}px)` }}
    >
      <div
        className="h-4 w-4 rotate-45 rounded-br-sm"
        style={{ backgroundColor: collaborator.color }}
      />
      <div
        className="ml-3 mt-1 rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-lg"
        style={{ backgroundColor: collaborator.color }}
      >
        {collaborator.name}
      </div>
    </div>
  );
};

const MiniRouteMap = ({ workspace, darkMode, onFocus }) => {
  const routeNodes = Object.values(workspace.nodes).filter((node) => node.type === "activity" || node.type === "recovery");
  const points = normalizeMapPoints(routeNodes);

  return (
    <div className={`absolute bottom-5 left-5 z-30 w-[282px] rounded-[28px] border p-4 shadow-2xl backdrop-blur-2xl ${darkMode ? "border-white/10 bg-black/48" : "border-white/80 bg-white/82"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Assistive route map
          </p>
          <h3 className="text-sm font-semibold">Cluster continuity</h3>
        </div>
        <FiMap className="text-teal-400" />
      </div>
      <svg viewBox="0 0 250 150" className={`h-[150px] w-full rounded-2xl ${darkMode ? "bg-white/5" : "bg-slate-100"}`}>
        <path
          d={points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")}
          fill="none"
          stroke="#14b8a6"
          strokeWidth="2"
          strokeDasharray="5 6"
          opacity="0.75"
        />
        {points.map((point, index) => (
          <g key={point.id} onClick={() => onFocus(point.id)} className="cursor-pointer">
            <circle
              cx={point.x}
              cy={point.y}
              r={workspace.map.focusedNodeId === point.id ? 7 : 5}
              fill={point.color || "#14b8a6"}
              stroke="white"
              strokeWidth="2"
            />
            <text x={point.x + 8} y={point.y + 4} className="fill-slate-500 text-[9px] font-semibold">
              {index + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const CopilotPanel = ({
  workspace,
  selectedNode,
  prompt,
  setPrompt,
  localMessage,
  setLocalMessage,
  messages,
  generating,
  error,
  darkMode,
  adaptiveSummary,
  onGenerate,
  onAction
}) => (
  <aside className={`relative z-40 flex min-h-screen flex-col border-l p-5 ${darkMode ? "border-white/10 bg-[#0b1118]" : "border-white/80 bg-white/76"} backdrop-blur-2xl`}>
    <div className="mb-5">
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${darkMode ? "text-teal-200/70" : "text-teal-700/70"}`}>
            WayFinder AI
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Live copilot</h2>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-500 text-white shadow-lg shadow-teal-500/25">
          <FiZap />
        </div>
      </div>
      <p className={`mt-3 text-sm leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
        Watching route shape, locality jumps, fatigue load, weather exposure, and missing anchors as you move nodes.
      </p>
    </div>

    <AdaptiveMemoryCard adaptiveSummary={adaptiveSummary} darkMode={darkMode} />

    {error && (
      <div className="mb-4 rounded-2xl border border-rose-300/50 bg-rose-400/10 p-3 text-sm text-rose-600">
        {error}
      </div>
    )}

    <div className="space-y-3">
      {workspace.aiFeed.map((insight) => (
        <div key={insight.id} className={`rounded-3xl border p-4 ${toneStyles[insight.tone] || toneStyles.info}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{insight.title}</h3>
              <p className="mt-1 text-xs leading-relaxed opacity-80">{insight.body}</p>
            </div>
            <button
              type="button"
              onClick={() => onAction(insight.actionId)}
              className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-700"
            >
              Apply
            </button>
          </div>
        </div>
      ))}
    </div>

    <div className="mt-5">
      <p className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
        AI actions
      </p>
      <div className="grid grid-cols-2 gap-2">
        {aiActions.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onAction(id)}
            className={`flex min-h-[66px] items-center gap-2 rounded-2xl border p-3 text-left text-xs font-semibold transition hover:-translate-y-0.5 ${darkMode ? "border-white/10 bg-white/5 hover:bg-white/9" : "border-slate-200 bg-white hover:border-teal-200"}`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-500/12 text-teal-500">
              {icon({})}
            </span>
            {label}
          </button>
        ))}
      </div>
    </div>

    <SelectedNodePanel selectedNode={selectedNode} darkMode={darkMode} />

    <div className="mt-5">
      <p className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
        Collaboration layer
      </p>
      <div className={`rounded-3xl border p-4 ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            {workspace.collaborators.map((collaborator) => (
              <div
                key={collaborator.id}
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white"
                style={{ backgroundColor: collaborator.color }}
                title={collaborator.name}
              >
                {collaborator.name.slice(0, 1)}
              </div>
            ))}
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${darkMode ? "bg-white/8 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
            <FiUsers />
            multiplayer-ready state
          </div>
        </div>
        <div className="max-h-24 space-y-2 overflow-y-auto">
          {(workspace.operationLog.length ? workspace.operationLog.slice(-4).reverse() : [{ id: "seed", type: "canvas_ready", actor: "ai" }]).map((op) => (
            <div key={op.id} className={`rounded-2xl px-3 py-2 text-xs ${darkMode ? "bg-black/24 text-slate-300" : "bg-slate-50 text-slate-600"}`}>
              <span className="font-semibold">{op.actor || "you"}</span> · {String(op.type).replace(/_/g, " ")}
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="mt-auto pt-5">
      <div className={`rounded-[28px] border p-3 ${darkMode ? "border-white/10 bg-black/26" : "border-slate-200 bg-white"}`}>
        <div className="mb-2 flex items-center gap-2 px-2 text-xs text-slate-400">
          <FiSearch />
          Ask for a route mutation
        </div>
        <textarea
          value={localMessage || prompt}
          onChange={(event) => {
            setLocalMessage(event.target.value);
            setPrompt(event.target.value);
          }}
          placeholder="Example: make this slower, add one hidden cafe, avoid outdoor noon heat."
          className={`min-h-[102px] w-full resize-none bg-transparent px-2 text-sm outline-none ${darkMode ? "placeholder:text-slate-600" : "placeholder:text-slate-400"}`}
        />
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 disabled:opacity-60"
        >
          {generating ? <FiLoader className="animate-spin" /> : <FiSend />}
          Generate new proposal
        </button>
      </div>

      {messages.length > 0 && (
        <div className="mt-3 max-h-28 space-y-2 overflow-y-auto text-xs">
          {messages.slice(-3).map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-2xl px-3 py-2 ${message.role === "user" ? "bg-teal-500 text-white" : darkMode ? "bg-white/5 text-slate-300" : "bg-slate-100 text-slate-600"}`}
            >
              {message.text}
            </div>
          ))}
        </div>
      )}
    </div>
  </aside>
);

const AdaptiveMemoryCard = ({ adaptiveSummary, darkMode }) => {
  const signals = adaptiveSummary?.strongestSignals || [];

  return (
    <div className={`mb-4 rounded-3xl border p-4 ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Preference memory
          </p>
          <h3 className="mt-1 text-sm font-semibold">
            {adaptiveSummary ? "Learning from this trip" : "Ready to learn"}
          </h3>
        </div>
        <span className="rounded-full bg-teal-500/12 px-3 py-1 text-[11px] font-semibold text-teal-500">
          {Math.round((adaptiveSummary?.profileConfidence || 0) * 100)}%
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {signals.length ? signals.slice(0, 3).map((signal) => (
          <span
            key={signal.dimension}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${signal.direction === "positive" ? "bg-emerald-500/12 text-emerald-600" : "bg-rose-500/12 text-rose-600"}`}
          >
            {signal.dimension.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`)} {signal.value}
          </span>
        )) : (
          <span className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Pin, move, replace, or accept AI actions to start shaping scoring.
          </span>
        )}
      </div>
    </div>
  );
};

const SelectedNodePanel = ({ selectedNode, darkMode }) => {
  if (!selectedNode) {
    return (
      <div className={`mt-5 rounded-3xl border p-4 ${darkMode ? "border-white/10 bg-white/5 text-slate-400" : "border-slate-200 bg-white text-slate-600"}`}>
        <p className="text-sm font-semibold">Select a node</p>
        <p className="mt-1 text-xs leading-relaxed">
          Details, notes, group votes, and AI explanations appear here once a place is active.
        </p>
      </div>
    );
  }

  return (
    <div className={`mt-5 rounded-3xl border p-4 ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Selected node
          </p>
          <h3 className="mt-1 text-lg font-semibold">{selectedNode.data.title}</h3>
        </div>
        <span className="rounded-full bg-teal-500/12 px-3 py-1 text-[11px] font-semibold text-teal-500">
          Day {selectedNode.day}
        </span>
      </div>
      <p className={`mt-3 text-sm leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
        Placed here because it fits the {selectedNode.data.roleLabel || "planning"} role, belongs to {selectedNode.data.clusterLabel || "this cluster"}, and can be re-ordered without touching the generated itinerary proposal.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <NodeStat label="Fatigue" value={selectedNode.data.fatigueScore ?? 0} darkMode={darkMode} />
        <NodeStat label="Weather" value={selectedNode.data.weatherScore ?? 100} darkMode={darkMode} />
        <NodeStat label="Notes" value={selectedNode.notes?.length || 0} darkMode={darkMode} />
      </div>
    </div>
  );
};

const NodeStat = ({ label, value, darkMode }) => (
  <div className={`rounded-2xl p-3 ${darkMode ? "bg-black/24" : "bg-slate-50"}`}>
    <div className="text-base font-semibold">{value}</div>
    <div className={`text-[10px] uppercase tracking-wide ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
      {label}
    </div>
  </div>
);

const normalizeMapPoints = (nodes) => {
  if (!nodes.length) return [];
  const coordinatePoints = nodes
    .map((node) => {
      const lat = Number(node.data.coordinates?.lat ?? node.data.coordinates?.latitude);
      const lng = Number(node.data.coordinates?.lng ?? node.data.coordinates?.lon ?? node.data.coordinates?.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return { node, rawX: lng, rawY: lat };
    })
    .filter(Boolean);

  const base = coordinatePoints.length >= 2
    ? coordinatePoints
    : nodes.map((node) => ({ node, rawX: node.position.x, rawY: node.position.y }));

  const xs = base.map((point) => point.rawX);
  const ys = base.map((point) => point.rawY);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spreadX = maxX - minX || 1;
  const spreadY = maxY - minY || 1;

  return base
    .sort((a, b) => a.node.day - b.node.day || a.node.position.x - b.node.position.x)
    .map(({ node, rawX, rawY }) => ({
      id: node.id,
      color: node.data.clusterColor,
      x: 22 + ((rawX - minX) / spreadX) * 206,
      y: 126 - ((rawY - minY) / spreadY) * 102
    }));
};

const serializeNodeForLearning = (node) => ({
  placeId: node.data?.placeId || node.id,
  type: node.data?.type || node.type,
  tags: node.data?.tags || [],
  vibeTags: node.data?.vibeTags || [],
  tripRoles: node.data?.tripRoles || [],
  localityClusterId: node.data?.localityClusterId || node.data?.clusterId,
  routeZone: node.data?.routeZone,
  budgetTier: node.data?.budgetTier,
  fatigueScore: node.data?.fatigueScore,
  durationMinutes: node.data?.durationMinutes
});

function FiSparkleFallback() {
  return <FiSliders />;
}

export default TravelWorkspaceCanvas;
