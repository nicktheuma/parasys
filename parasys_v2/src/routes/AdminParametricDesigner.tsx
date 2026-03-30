import {
  addEdge,
  Background,
  Controls,
  type Connection,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJson } from '@/lib/api'
import type { ConfiguratorSettingsRow, ParamGraphNode, ParamGraphSettings } from '@shared/types'
import {
  GhBevelNode,
  GhCapNode,
  GhChamferNode,
  GhCrvNode,
  GhExtrudeNode,
  GhFilletNode,
  GhLineNode,
  GhMoveNode,
  GhPanelNode,
  GhPointNode,
  GhSliderNode,
  GhVectorNode,
} from './ghParametricNodes'
import {
  ParamBinaryNode,
  ParamConstantNode,
  ParamDimensionNode,
  ParamOutputNode,
} from './parametricNodes'
import styles from './adminParametricDesigner.module.css'

type Configurator = {
  id: string
  slug: string
  name: string
  settings: ConfiguratorSettingsRow | null
}

function toFlowType(t: ParamGraphNode['type']): string {
  switch (t) {
    case 'dimension':
      return 'paramDimension'
    case 'constant':
      return 'paramConstant'
    case 'binary':
      return 'paramBinary'
    case 'output':
      return 'paramOutput'
    default:
      return t
  }
}

function fromFlowType(flowType: string | undefined): ParamGraphNode['type'] {
  switch (flowType) {
    case 'paramDimension':
      return 'dimension'
    case 'paramConstant':
      return 'constant'
    case 'paramBinary':
      return 'binary'
    case 'paramOutput':
      return 'output'
    default:
      return (flowType as ParamGraphNode['type']) ?? 'dimension'
  }
}

function defaultGraph(): ParamGraphSettings {
  return {
    nodes: [
      {
        id: 'n-w',
        type: 'dimension',
        position: { x: 0, y: 20 },
        data: { label: 'Width', dimension: 'width' },
      },
      {
        id: 'n-d',
        type: 'dimension',
        position: { x: 0, y: 160 },
        data: { label: 'Depth', dimension: 'depth' },
      },
      {
        id: 'n-add',
        type: 'binary',
        position: { x: 260, y: 90 },
        data: { label: 'Add', op: 'add' },
      },
      {
        id: 'n-out',
        type: 'output',
        position: { x: 520, y: 90 },
        data: { label: 'Result', applyTo: null },
      },
    ],
    edges: [
      { id: 'e1', source: 'n-w', target: 'n-add', targetHandle: 'a' },
      { id: 'e2', source: 'n-d', target: 'n-add', targetHandle: 'b' },
      { id: 'e3', source: 'n-add', target: 'n-out', targetHandle: 'in' },
    ],
  }
}

function toFlowNodes(g: ParamGraphSettings): Node[] {
  return g.nodes.map((n) => ({
    id: n.id,
    type: toFlowType(n.type),
    position: n.position,
    data: {
      ...n.data,
      label: n.data.label ?? n.type,
    },
  }))
}

function toFlowEdges(g: ParamGraphSettings): Edge[] {
  return g.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
  }))
}

function DesignerInner() {
  const nodeTypes = useMemo(
    () => ({
      paramDimension: ParamDimensionNode,
      paramConstant: ParamConstantNode,
      paramBinary: ParamBinaryNode,
      paramOutput: ParamOutputNode,
      ghSlider: GhSliderNode,
      ghPanel: GhPanelNode,
      ghPoint: GhPointNode,
      ghVector: GhVectorNode,
      ghMove: GhMoveNode,
      ghLine: GhLineNode,
      ghCrv: GhCrvNode,
      ghExtrude: GhExtrudeNode,
      ghCap: GhCapNode,
      ghChamfer: GhChamferNode,
      ghBevel: GhBevelNode,
      ghFillet: GhFilletNode,
    }),
    [],
  )

  const [configs, setConfigs] = useState<Configurator[]>([])
  const [configId, setConfigId] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selected = useMemo(() => configs.find((c) => c.id === configId), [configs, configId])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const r = await fetchJson<{ items: Configurator[] }>('/api/admin/configurators', { method: 'GET' })
      if (cancelled) return
      setLoading(false)
      if (!r.ok) {
        setErr(r.error ?? 'Failed to load')
        return
      }
      const list = r.data?.items ?? []
      setConfigs(list)
      setConfigId((prev) => prev || list[0]?.id || '')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const cfg = configs.find((c) => c.id === configId)
    if (!cfg) return
    const g = cfg.settings?.paramGraph ?? defaultGraph()
    setNodes(toFlowNodes(g))
    setEdges(toFlowEdges(g))
  }, [configId, configs, setNodes, setEdges])

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  )

  const addConstant = useCallback(() => {
    const id = `n-${Date.now().toString(36)}`
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'paramConstant',
        position: { x: 120 + nds.length * 8, y: 280 + nds.length * 4 },
        data: { label: 'Constant', value: 100 },
      },
    ])
  }, [setNodes])

  const addBinary = useCallback(() => {
    const id = `n-${Date.now().toString(36)}`
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'paramBinary',
        position: { x: 260, y: 260 + nds.length * 6 },
        data: { label: 'Math', op: 'add' },
      },
    ])
  }, [setNodes])

  const addSchemaNode = useCallback(
    (schemaType: ParamGraphNode['type'], data: Record<string, unknown>) => {
      const id = `n-${Date.now().toString(36)}`
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: toFlowType(schemaType),
          position: { x: 60 + (nds.length % 10) * 24, y: 200 + Math.floor(nds.length / 10) * 90 },
          data,
        } as Node,
      ])
    },
    [setNodes],
  )

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    setErr(null)
    const paramGraph: ParamGraphSettings = {
      nodes: nodes.map((n) => {
        const d = n.data ?? {}
        return {
          id: n.id,
          type: fromFlowType(typeof n.type === 'string' ? n.type : undefined),
          position: n.position,
          data: {
            label: typeof d.label === 'string' ? d.label : undefined,
            dimension: d.dimension as 'width' | 'depth' | 'height' | undefined,
            value: typeof d.value === 'number' ? d.value : undefined,
            op: d.op as 'add' | 'mul' | 'min' | 'max' | undefined,
            applyTo:
              d.applyTo === 'width' || d.applyTo === 'depth' || d.applyTo === 'height'
                ? d.applyTo
                : d.applyTo === null
                  ? null
                  : undefined,
            inputMode:
              d.inputMode === 'number' ||
              d.inputMode === 'integer' ||
              d.inputMode === 'angle' ||
              d.inputMode === 'boolean'
                ? d.inputMode
                : undefined,
            x: typeof d.x === 'number' ? d.x : undefined,
            y: typeof d.y === 'number' ? d.y : undefined,
            z: typeof d.z === 'number' ? d.z : undefined,
            height: typeof d.height === 'number' ? d.height : undefined,
            radius: typeof d.radius === 'number' ? d.radius : undefined,
            cap: typeof d.cap === 'boolean' ? d.cap : undefined,
          },
        }
      }),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      })),
    }
    const settings: ConfiguratorSettingsRow = {
      ...selected.settings,
      defaultDims: selected.settings?.defaultDims,
      paramGraph,
    }
    const r = await fetchJson<{ item: Configurator }>(`/api/admin/configurators/${encodeURIComponent(selected.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ settings }),
    })
    setSaving(false)
    if (!r.ok) {
      setErr(r.error ?? 'Save failed')
      return
    }
    if (r.data?.item) {
      setConfigs((prev) => prev.map((c) => (c.id === r.data!.item.id ? r.data!.item : c)))
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Parametric graph</h1>
      <p className={styles.sub}>
        Grasshopper-style components: <strong>Params</strong> (sliders, panel), <strong>Vector</strong> (Pt, Vec),{' '}
        <strong>Transform</strong> (Move), <strong>Curve</strong> (Line, Crv length), <strong>Surface</strong> (Extrude, Cap),
        and <strong>Mesh</strong> (Chamfer, Bevel, Fillet). Wires carry scalars (mm); Pt/Vec expose x,y,z on separate handles
        (tx/ty/tz in, x/y/z out). Geometry ops are numeric placeholders until a full mesh kernel is wired. Connect to{' '}
        <strong>Output</strong> → set &quot;Drive mesh&quot; to override one axis (mm) or readout only.
      </p>

      {loading ? <p className={styles.muted}>Loading…</p> : null}
      {err ? <p className={styles.error}>{err}</p> : null}

      {!loading ? (
        <div className={styles.toolbar}>
          <label className={styles.pick}>
            Configurator
            <select className={styles.select} value={configId} onChange={(e) => setConfigId(e.target.value)}>
              <option value="">— Select —</option>
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.slug})
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={styles.addBtn} onClick={addConstant}>
            + Number
          </button>
          <button type="button" className={styles.addBtn} onClick={addBinary}>
            + Math
          </button>
          <span className={styles.ghGroupLabel}>Params</span>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghSlider', { label: 'Slider', value: 100, inputMode: 'number' })}>
            Slider
          </button>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghPanel', { label: 'Panel', x: 0, y: 0, z: 0 })}>
            Panel
          </button>
          <span className={styles.ghGroupLabel}>Vector</span>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghPoint', { label: 'Pt', x: 0, y: 0, z: 0 })}>
            Pt
          </button>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghVector', { label: 'Vec', x: 0, y: 0, z: 1 })}>
            Vec
          </button>
          <span className={styles.ghGroupLabel}>Xform</span>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghMove', { label: 'Move', x: 0, y: 0, z: 0 })}>
            Move
          </button>
          <span className={styles.ghGroupLabel}>Curve</span>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghLine', { label: 'Line', x: 0, y: 0, z: 0 })}>
            Line
          </button>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghCrv', { label: 'Crv', x: 0, y: 0, z: 0 })}>
            Crv
          </button>
          <span className={styles.ghGroupLabel}>Srf</span>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghExtrude', { label: 'Extrude', height: 100 })}>
            Extrude
          </button>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghCap', { label: 'Cap', height: 0, cap: true })}>
            Cap
          </button>
          <span className={styles.ghGroupLabel}>Mesh</span>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghChamfer', { label: 'Chamfer', radius: 2 })}>
            Chamfer
          </button>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghBevel', { label: 'Bevel', radius: 2 })}>
            Bevel
          </button>
          <button type="button" className={styles.addBtn} onClick={() => addSchemaNode('ghFillet', { label: 'Fillet', radius: 2 })}>
            Fillet
          </button>
          <button type="button" className={styles.save} disabled={!configId || saving} onClick={(e) => void onSave(e)}>
            {saving ? 'Saving…' : 'Save graph'}
          </button>
        </div>
      ) : null}

      {configId ? (
        <div className={styles.flowWrap}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            proOptions={{ hideAttribution: true }}
            minZoom={0.4}
            maxZoom={1.5}
          >
            <Background />
            <Controls />
            <MiniMap zoomable pannable />
          </ReactFlow>
        </div>
      ) : null}
    </div>
  )
}

export function AdminParametricDesigner() {
  return (
    <ReactFlowProvider>
      <DesignerInner />
    </ReactFlowProvider>
  )
}
