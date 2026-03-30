import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { ReactNode } from 'react'
import type { GhInputMode } from '@shared/types'
import styles from './parametricNodes.module.css'

type PortDef = { id: string; label: string }

function portTop(i: number, n: number): string {
  return `${((i + 1) / (n + 1)) * 100}%`
}

function GhShell({
  categoryClass,
  shortTitle,
  fullTitle,
  portsLeft,
  portsRight,
  children,
}: {
  categoryClass: string
  shortTitle: string
  fullTitle: string
  portsLeft?: PortDef[]
  portsRight?: PortDef[]
  children?: ReactNode
}) {
  const nl = portsLeft?.length ?? 0
  const nr = portsRight?.length ?? 0
  return (
    <div className={`${styles.ghCard} ${categoryClass}`}>
      <div className={styles.ghShortTitle}>{shortTitle}</div>
      <div className={styles.ghFullTitle}>{fullTitle}</div>
      {portsLeft?.map((p, i) => (
        <Handle
          key={`L-${p.id}`}
          type="target"
          position={Position.Left}
          id={p.id}
          className={styles.ghHandle}
          style={{ top: portTop(i, nl) }}
          title={p.label}
        />
      ))}
      {portsRight?.map((p, i) => (
        <Handle
          key={`R-${p.id}`}
          type="source"
          position={Position.Right}
          id={p.id}
          className={styles.ghHandle}
          style={{ top: portTop(i, nr) }}
          title={p.label}
        />
      ))}
      {children}
    </div>
  )
}

const INPUT_MODES: { value: GhInputMode; label: string }[] = [
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'angle', label: 'Angle (°)' },
  { value: 'boolean', label: 'Boolean' },
]

export function GhSliderNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow()
  const v = typeof data.value === 'number' ? data.value : 0
  const mode = (data.inputMode as GhInputMode) ?? 'number'
  return (
    <GhShell
      categoryClass={styles.ghParams}
      shortTitle="Slider"
      fullTitle="Number Slider"
      portsRight={[{ id: 'out', label: 'out' }]}
    >
      <label className={styles.ghField}>
        Mode
        <select
          className={styles.select}
          value={mode}
          onChange={(e) => {
            const next = e.target.value as GhInputMode
            setNodes((nds) =>
              nds.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, inputMode: next } } : node,
              ),
            )
          }}
        >
          {INPUT_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.ghField}>
        {mode === 'angle' ? 'Angle (°)' : 'Value'}
        <input
          className={styles.constInput}
          type="number"
          step={mode === 'integer' ? 1 : mode === 'angle' ? 1 : 0.1}
          value={v}
          onChange={(e) => {
            const n = Number(e.target.value)
            setNodes((nds) =>
              nds.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, value: Number.isFinite(n) ? n : 0 } } : node,
              ),
            )
          }}
        />
      </label>
    </GhShell>
  )
}

export function GhPanelNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow()
  const x = typeof data.x === 'number' ? data.x : 0
  const y = typeof data.y === 'number' ? data.y : 0
  const z = typeof data.z === 'number' ? data.z : 0
  return (
    <GhShell
      categoryClass={styles.ghParams}
      shortTitle="Panel"
      fullTitle="Panel (X,Y,Z)"
      portsLeft={[
        { id: 'tx', label: 'tx' },
        { id: 'ty', label: 'ty' },
        { id: 'tz', label: 'tz' },
      ]}
      portsRight={[
        { id: 'x', label: 'x' },
        { id: 'y', label: 'y' },
        { id: 'z', label: 'z' },
      ]}
    >
      <div className={styles.ghPanelGrid}>
        <label>
          X
          <input
            type="number"
            className={styles.constInput}
            value={x}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, x: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
        <label>
          Y
          <input
            type="number"
            className={styles.constInput}
            value={y}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, y: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
        <label>
          Z
          <input
            type="number"
            className={styles.constInput}
            value={z}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, z: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
      </div>
    </GhShell>
  )
}

export function GhPointNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow()
  const x = typeof data.x === 'number' ? data.x : 0
  const y = typeof data.y === 'number' ? data.y : 0
  const z = typeof data.z === 'number' ? data.z : 0
  return (
    <GhShell
      categoryClass={styles.ghVector}
      shortTitle="Pt"
      fullTitle="Construct Point"
      portsLeft={[
        { id: 'tx', label: 'tx' },
        { id: 'ty', label: 'ty' },
        { id: 'tz', label: 'tz' },
      ]}
      portsRight={[
        { id: 'x', label: 'x' },
        { id: 'y', label: 'y' },
        { id: 'z', label: 'z' },
      ]}
    >
      <div className={styles.ghPanelGrid}>
        <label>
          X
          <input
            type="number"
            className={styles.constInput}
            value={x}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, x: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
        <label>
          Y
          <input
            type="number"
            className={styles.constInput}
            value={y}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, y: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
        <label>
          Z
          <input
            type="number"
            className={styles.constInput}
            value={z}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, z: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
      </div>
    </GhShell>
  )
}

export function GhVectorNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow()
  const x = typeof data.x === 'number' ? data.x : 0
  const y = typeof data.y === 'number' ? data.y : 0
  const z = typeof data.z === 'number' ? data.z : 0
  return (
    <GhShell
      categoryClass={styles.ghVector}
      shortTitle="Vec"
      fullTitle="Vector XYZ"
      portsLeft={[
        { id: 'tx', label: 'tx' },
        { id: 'ty', label: 'ty' },
        { id: 'tz', label: 'tz' },
      ]}
      portsRight={[
        { id: 'x', label: 'x' },
        { id: 'y', label: 'y' },
        { id: 'z', label: 'z' },
      ]}
    >
      <div className={styles.ghPanelGrid}>
        <label>
          X
          <input
            type="number"
            className={styles.constInput}
            value={x}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, x: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
        <label>
          Y
          <input
            type="number"
            className={styles.constInput}
            value={y}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, y: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
        <label>
          Z
          <input
            type="number"
            className={styles.constInput}
            value={z}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, z: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
      </div>
    </GhShell>
  )
}

export function GhMoveNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow()
  const x = typeof data.x === 'number' ? data.x : 0
  const y = typeof data.y === 'number' ? data.y : 0
  const z = typeof data.z === 'number' ? data.z : 0
  return (
    <GhShell
      categoryClass={styles.ghTransform}
      shortTitle="Move"
      fullTitle="Move (P + V)"
      portsLeft={[
        { id: 'Px', label: 'Px' },
        { id: 'Py', label: 'Py' },
        { id: 'Pz', label: 'Pz' },
        { id: 'Vx', label: 'Vx' },
        { id: 'Vy', label: 'Vy' },
        { id: 'Vz', label: 'Vz' },
      ]}
      portsRight={[
        { id: 'x', label: 'X' },
        { id: 'y', label: 'Y' },
        { id: 'z', label: 'Z' },
      ]}
    >
      <p className={styles.ghMeta}>Default P (unwired)</p>
      <div className={styles.ghPanelGrid}>
        <label>
          Px
          <input
            type="number"
            className={styles.constInput}
            value={x}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, x: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
        <label>
          Py
          <input
            type="number"
            className={styles.constInput}
            value={y}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, y: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
        <label>
          Pz
          <input
            type="number"
            className={styles.constInput}
            value={z}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, z: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
      </div>
    </GhShell>
  )
}

function lineCrvNode(
  shortTitle: string,
  fullTitle: string,
  categoryClass: string,
  id: string,
  data: Record<string, unknown>,
  setNodes: ReturnType<typeof useReactFlow>['setNodes'],
) {
  const x = typeof data.x === 'number' ? data.x : 0
  const y = typeof data.y === 'number' ? data.y : 0
  const z = typeof data.z === 'number' ? data.z : 0
  return (
    <GhShell
      categoryClass={categoryClass}
      shortTitle={shortTitle}
      fullTitle={fullTitle}
      portsLeft={[
        { id: 'Ax', label: 'Ax' },
        { id: 'Ay', label: 'Ay' },
        { id: 'Az', label: 'Az' },
        { id: 'Bx', label: 'Bx' },
        { id: 'By', label: 'By' },
        { id: 'Bz', label: 'Bz' },
      ]}
      portsRight={[{ id: 'L', label: 'L' }]}
    >
      <p className={styles.ghMeta}>Point A default</p>
      <div className={styles.ghPanelGrid}>
        <label>
          Ax
          <input
            type="number"
            className={styles.constInput}
            value={x}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, x: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
        <label>
          Ay
          <input
            type="number"
            className={styles.constInput}
            value={y}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, y: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
        <label>
          Az
          <input
            type="number"
            className={styles.constInput}
            value={z}
            onChange={(e) => {
              const n = Number(e.target.value)
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, z: Number.isFinite(n) ? n : 0 } } : node,
                ),
              )
            }}
          />
        </label>
      </div>
    </GhShell>
  )
}

export function GhLineNode(props: NodeProps) {
  const { setNodes } = useReactFlow()
  return lineCrvNode('Line', 'Line (length)', styles.ghCurve, props.id, props.data as Record<string, unknown>, setNodes)
}

export function GhCrvNode(props: NodeProps) {
  const { setNodes } = useReactFlow()
  return lineCrvNode('Crv', 'Curve → length', styles.ghCurve, props.id, props.data as Record<string, unknown>, setNodes)
}

export function GhExtrudeNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow()
  const h = typeof data.height === 'number' ? data.height : 100
  return (
    <GhShell
      categoryClass={styles.ghSurface}
      shortTitle="Ext"
      fullTitle="Extrude (C×H)"
      portsLeft={[
        { id: 'C', label: 'C' },
        { id: 'tH', label: 'tH' },
      ]}
      portsRight={[{ id: 'V', label: 'V' }]}
    >
      <label className={styles.ghField}>
        H default (mm)
        <input
          type="number"
          className={styles.constInput}
          value={h}
          step={1}
          onChange={(e) => {
            const n = Number(e.target.value)
            setNodes((nds) =>
              nds.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, height: Number.isFinite(n) ? n : 100 } } : node,
              ),
            )
          }}
        />
      </label>
    </GhShell>
  )
}

export function GhCapNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow()
  const h = typeof data.height === 'number' ? data.height : 0
  const cap = data.cap === true
  return (
    <GhShell
      categoryClass={styles.ghSurface}
      shortTitle="Cap"
      fullTitle="Cap ends"
      portsLeft={[{ id: 'H', label: 'H' }]}
      portsRight={[{ id: 'O', label: 'O' }]}
    >
      <label className={styles.ghField}>
        H default
        <input
          type="number"
          className={styles.constInput}
          value={h}
          onChange={(e) => {
            const n = Number(e.target.value)
            setNodes((nds) =>
              nds.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, height: Number.isFinite(n) ? n : 0 } } : node,
              ),
            )
          }}
        />
      </label>
      <label className={styles.ghCheck}>
        <input
          type="checkbox"
          checked={cap}
          onChange={(e) => {
            const c = e.target.checked
            setNodes((nds) =>
              nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, cap: c } } : node)),
            )
          }}
        />
        Closed solid
      </label>
    </GhShell>
  )
}

function filletFamily(shortTitle: string, fullTitle: string, id: string, data: Record<string, unknown>, setNodes: ReturnType<typeof useReactFlow>['setNodes']) {
  const r = typeof data.radius === 'number' ? data.radius : 2
  return (
    <GhShell
      categoryClass={styles.ghMesh}
      shortTitle={shortTitle}
      fullTitle={fullTitle}
      portsLeft={[
        { id: 'tR', label: 'tR' },
        { id: 'tE', label: 'tE' },
      ]}
      portsRight={[{ id: 'R', label: 'R' }]}
    >
      <label className={styles.ghField}>
        R default (mm)
        <input
          type="number"
          className={styles.constInput}
          value={r}
          min={0}
          step={0.5}
          onChange={(e) => {
            const n = Number(e.target.value)
            setNodes((nds) =>
              nds.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, radius: Number.isFinite(n) ? n : 0 } } : node,
              ),
            )
          }}
        />
      </label>
    </GhShell>
  )
}

export function GhChamferNode(props: NodeProps) {
  const { setNodes } = useReactFlow()
  return filletFamily('Chf', 'Chamfer', props.id, props.data as Record<string, unknown>, setNodes)
}

export function GhBevelNode(props: NodeProps) {
  const { setNodes } = useReactFlow()
  return filletFamily('Bvl', 'Bevel', props.id, props.data as Record<string, unknown>, setNodes)
}

export function GhFilletNode(props: NodeProps) {
  const { setNodes } = useReactFlow()
  return filletFamily('Flt', 'Fillet', props.id, props.data as Record<string, unknown>, setNodes)
}
