import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";
import { useI18n } from "../context/I18nContext.jsx";
import IconButton from "./IconButton.jsx";
import EdgeKindFields from "./EdgeKindFields.jsx";
import {
  collectAgentIds,
  DEFAULT_EDGE_LIMIT,
  edgeLabel,
  flowToDisplayGraph,
  inferEdgeKind,
  insertAfterAgent,
  insertBlock,
  newStage,
  nextId,
} from "../pipeline/pipelineFlow.js";
import { sortByLabel } from "../utils/sortOptions.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";

function AgentNode({ data }) {
  return (
    <div className="min-w-[9rem] rounded-xl border border-line bg-paper px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-moss" />
      <p className="truncate text-sm font-semibold text-ink" title={data.agentId}>
        {data.label}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-moss" />
    </div>
  );
}

function BranchNode({ data }) {
  const { t } = useI18n();
  return (
    <div
      className="flex h-24 w-24 rotate-45 items-center justify-center border border-moss bg-paper shadow-sm"
      title={t("pipeline.ifElseTitle")}
    >
      <Handle type="target" position={Position.Top} className="!bg-moss -rotate-45" />
      <div className="-rotate-45 text-center">
        <p className="text-xs font-semibold text-moss">{t("pipeline.if")}</p>
        <p className="max-w-[4.5rem] truncate text-[10px] text-muted">
          {data.when?.type
            ? t(`pipeline.when.${data.when.type}`)
            : t("pipeline.whenFallback")}
        </p>
      </div>
      <Handle
        type="source"
        id="then"
        position={Position.Left}
        className="!bg-moss -rotate-45"
      />
      <Handle
        type="source"
        id="else"
        position={Position.Right}
        className="!bg-warn -rotate-45"
      />
    </div>
  );
}

function LoopGroupNode({ data }) {
  const { t } = useI18n();
  const whenType = data.when?.type;
  const cap = data.limit || data.max_visits;
  const typeLabel = whenType
    ? t(`pipeline.when.${whenType}`)
    : t("pipeline.retryFallback");
  return (
    <div className="h-full rounded-2xl border-2 border-dashed border-moss/80 bg-moss/5 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-moss">
        {t("pipeline.loop", { type: typeLabel })}
        {cap ? ` ×${cap}` : ""}
      </p>
    </div>
  );
}
const nodeTypes = { agent: AgentNode, branch: BranchNode, loopGroup: LoopGroupNode };

function graphToFlowNodes(graph, agentsById, t) {
  const nodes = (graph?.nodes || []).map((n) => ({
    id: n.id,
    type: "agent",
    position: n.position || { x: 0, y: 0 },
    data: {
      agentId: n.id,
      label: agentCompanyLabel(agentsById[n.id]) || n.id,
    },
  }));
  const edges = (graph?.edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: edgeLabel(e, t),
    data: {
      when: { ...(e.when || { type: "always" }) },
      role: e.role,
      kind: inferEdgeKind(e),
      limit: e.limit ?? e.max_visits ?? DEFAULT_EDGE_LIMIT,
    },
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 1.5 },
  }));
  return { nodes, edges, entry: graph?.entry || null };
}

function AgentGraphDesignerInner({
  agents,
  flow,
  graph,
  unstructured,
  onFlowChange,
  onGraphChange,
  onPositionsChange,
}) {
  const { t, locale } = useI18n();
  const agentsById = useMemo(() => {    const map = {};
    for (const a of agents) map[a.id] = a;
    return map;
  }, [agents]);

  const agentsAz = useMemo(
    () => sortByLabel(agents, (a) => agentCompanyLabel(a), locale),
    [agents, locale],
  );
  const positions = useMemo(() => {
    const map = {};
    for (const n of graph?.nodes || []) {
      if (n.id && n.position) map[n.id] = n.position;
    }
    return map;
  }, [graph]);

  const display = useMemo(() => {
    if (!unstructured && flow) {
      return flowToDisplayGraph(flow, agentsById, positions, t);
    }
    return graphToFlowNodes(graph, agentsById, t);
  }, [unstructured, flow, graph, agentsById, positions, t]);
  const [nodes, setNodes, onNodesChange] = useNodesState(display.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(display.edges);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [paletteId, setPaletteId] = useState(agents[0]?.id || "");

  useEffect(() => {
    setNodes(display.nodes);
    setEdges(
      display.edges.map((e) => ({
        ...e,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 1.5 },
      })),
    );
  }, [display, setNodes, setEdges]);

  useEffect(() => {
    if (!paletteId && agents[0]?.id) setPaletteId(agents[0].id);
  }, [agents, paletteId]);

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null;
  const usedIds = new Set(collectAgentIds(flow, []));
  if (unstructured) {
    for (const n of graph?.nodes || []) usedIds.add(n.id);
  }

  const onConnect = useCallback(
    (connection) => {
      if (!unstructured) return;
      onGraphChange((prev) => ({
        ...prev,
        edges: [
          ...(prev.edges || []),
          {
            id: nextId("e"),
            source: connection.source,
            target: connection.target,
            direction: "forward",
            kind: "forward",
            when: { type: "always" },
            limit: DEFAULT_EDGE_LIMIT,
          },
        ],
      }));
    },
    [unstructured, onGraphChange],
  );

  function handleEdgesChange(changes) {
    onEdgesChange(changes);
    if (!unstructured) return;
    const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
    if (!removed.length) return;
    onGraphChange((prev) => ({
      ...prev,
      edges: (prev.edges || []).filter((e) => !removed.includes(e.id)),
    }));
  }

  function handleNodesChange(changes) {
    onNodesChange(changes);
    if (unstructured) {
      const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
      if (removed.length) {
        onGraphChange((prev) => {
          const nodesLeft = (prev.nodes || []).filter((n) => !removed.includes(n.id));
          return {
            ...prev,
            nodes: nodesLeft,
            edges: (prev.edges || []).filter(
              (e) => !removed.includes(e.source) && !removed.includes(e.target),
            ),
            entry: removed.includes(prev.entry) ? nodesLeft[0]?.id || null : prev.entry,
          };
        });
      }
    }
    const moved = changes.filter((c) => c.type === "position" && c.position);
    let changed = false;
    const next = { ...positions };
    for (const c of moved) {
      if (c.id && graph?.nodes?.some((n) => n.id === c.id)) {
        next[c.id] = c.position;
        changed = true;
      }
    }
    if (changed) onPositionsChange(next);
  }

  function addAgentNode() {
    if (!paletteId || usedIds.has(paletteId)) return;
    if (!unstructured && flow) {
      if (selectedNodeId && agentsById[selectedNodeId]) {
        onFlowChange(insertAfterAgent(flow, selectedNodeId, newStage(paletteId)));
      } else {
        onFlowChange(insertBlock(flow, [], (flow.children || []).length, newStage(paletteId)));
      }
      return;
    }
    onGraphChange((prev) => ({
      ...prev,
      entry: prev.entry || paletteId,
      nodes: [
        ...(prev.nodes || []),
        {
          id: paletteId,
          position: { x: 80 + (prev.nodes || []).length * 24, y: 80 },
        },
      ],
    }));
  }

  function updateSelectedEdge(partial) {
    if (!selectedEdgeId || !unstructured) return;
    onGraphChange((prev) => ({
      ...prev,
      edges: (prev.edges || []).map((e) => {
        if (e.id !== selectedEdgeId) return e;
        const next = { ...e };
        if (partial.kind) {
          next.kind = partial.kind;
          next.direction = partial.kind === "back" ? "back" : "forward";
          if (partial.kind === "back") {
            next.when = e.when?.type === "on_retry" ? e.when : { type: "on_retry" };
            next.role = "loop";
          } else if (partial.kind === "forward") {
            next.when = { type: "always" };
            delete next.role;
          } else if (partial.kind === "result_is") {
            next.when = { type: "on_status", status: e.when?.status || "" };
            next.role = "then";
          } else if (partial.kind === "if") {
            next.when =
              e.when?.type && e.when.type !== "always"
                ? e.when
                : { type: "on_failure" };
            next.role = next.role === "else" ? "else" : "then";
          }
        }
        if (partial.when) {
          next.when = { ...(next.when || { type: "always" }), ...partial.when };
          if (next.when.type !== "on_status") delete next.when.status;
          if (next.when.type === "on_status") next.kind = "result_is";
        }
        if (partial.target) next.target = partial.target;
        if (partial.limit != null) next.limit = partial.limit;
        return next;
      }),
    }));
  }

  return (
    <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[1fr_16rem]">
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-end gap-2">
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("pipeline.addAgent")}</span>
            <select
              value={paletteId}
              onChange={(e) => setPaletteId(e.target.value)}
              className="mt-1 block min-w-[12rem] rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss"
            >
              {agentsAz.map((a) => (
                <option key={a.id} value={a.id} disabled={usedIds.has(a.id)} title={a.id}>
                  {usedIds.has(a.id)
                    ? t("pipeline.onFlow", { name: agentCompanyLabel(a) })
                    : agentCompanyLabel(a)}
                </option>
              ))}
            </select>
          </label>
          <IconButton
            type="button"
            icon={Plus}
            onClick={addAgentNode}
            disabled={!paletteId || usedIds.has(paletteId)}
            className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium hover:bg-fog/80 disabled:opacity-50"
          >
            {t("pipeline.addToCanvas")}
          </IconButton>
        </div>
        <div dir="ltr" className="min-h-[22rem] flex-1 overflow-hidden rounded-2xl border border-line/80 bg-fog/20">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={unstructured ? handleEdgesChange : undefined}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
            }}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
            }}
            onPaneClick={() => {
              setSelectedEdgeId(null);
              setSelectedNodeId(null);
            }}
            fitView
            deleteKeyCode={unstructured ? ["Backspace", "Delete"] : null}
          >
            <Background gap={16} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-line/80 bg-paper/80 p-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {unstructured ? t("pipeline.edgeCondition") : t("pipeline.selection")}
        </h3>
        {!unstructured ? (
          <p className="text-sm text-muted">{t("pipeline.graphMirrorsArrange")}</p>
        ) : !selectedEdge ? (
          <p className="text-sm text-muted">{t("pipeline.selectEdge")}</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="font-mono text-xs text-muted">{selectedEdge.id}</p>
            <p className="font-mono text-xs text-muted">
              {selectedEdge.source} → {selectedEdge.target}
            </p>
            <EdgeKindFields
              showKindSelect
              kind={inferEdgeKind({
                kind: selectedEdge.data?.kind,
                role: selectedEdge.data?.role,
                when: selectedEdge.data?.when,
              })}
              when={selectedEdge.data?.when}
              limit={selectedEdge.data?.limit}
              target={selectedEdge.target}
              agents={agents}
              idPrefix={selectedEdge.id}
              onChange={updateSelectedEdge}
            />
          </div>
        )}
        {unstructured && selectedEdge ? (
          <IconButton
            type="button"
            onClick={() => {
              onGraphChange((prev) => ({
                ...prev,
                edges: (prev.edges || []).filter((e) => e.id !== selectedEdgeId),
              }));
              setSelectedEdgeId(null);
            }}
            className="rounded-xl border border-line bg-fog px-3 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("pipeline.deleteEdge")}
          </IconButton>
        ) : null}
        {!unstructured && selectedNodeId ? (
          <p className="text-xs text-muted">
            {t("pipeline.selected", { id: selectedNodeId })}
          </p>
        ) : null}
      </aside>
    </div>
  );
}

export default function AgentGraphDesigner(props) {
  return (
    <ReactFlowProvider>
      <AgentGraphDesignerInner {...props} />
    </ReactFlowProvider>
  );
}
