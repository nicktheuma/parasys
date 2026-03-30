import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import styles from './parametricNodes.module.css'

const OPS = [
  { value: 'add', label: 'Add' },
  { value: 'mul', label: 'Multiply' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
] as const

export function ParamDimensionNode({ data }: NodeProps) {
  const dim = (data.dimension as string) ?? 'width'
  return (
    <div className={styles.card}>
      <div className={styles.badge}>Params</div>
      <div className={styles.title}>{typeof data.label === 'string' ? data.label : 'Dimension'}</div>
      <div className={styles.meta}>{dim} (from slider)</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  )
}

export function ParamConstantNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow()
  const v = typeof data.value === 'number' ? data.value : 0
  return (
    <div className={styles.card}>
      <div className={styles.badge}>Params</div>
      <label className={styles.constLabel}>
        Value (mm)
        <input
          className={styles.constInput}
          type="number"
          step={1}
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
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  )
}

export function ParamBinaryNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow()
  const op = (data.op as string) ?? 'add'
  return (
    <div className={styles.card}>
      <Handle type="target" position={Position.Left} id="a" className={styles.handleA} />
      <Handle type="target" position={Position.Left} id="b" className={styles.handleB} />
      <div className={styles.badge}>Math</div>
      <label className={styles.opLabel}>
        Operation
        <select
          className={styles.select}
          value={op}
          onChange={(e) => {
            const next = e.target.value
            setNodes((nds) =>
              nds.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, op: next } } : node,
              ),
            )
          }}
        >
          {OPS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  )
}

export function ParamOutputNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow()
  const raw = data.applyTo as string | null | undefined
  const sel = raw === 'width' || raw === 'depth' || raw === 'height' ? raw : ''
  return (
    <div className={styles.card}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className={styles.badge}>Output</div>
      <div className={styles.title}>{typeof data.label === 'string' ? data.label : 'Result'}</div>
      <label className={styles.opLabel}>
        Drive mesh
        <select
          className={styles.select}
          value={sel}
          onChange={(e) => {
            const v = e.target.value
            setNodes((nds) =>
              nds.map((node) =>
                node.id === id
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        applyTo: v === '' ? null : (v as 'width' | 'depth' | 'height'),
                      },
                    }
                  : node,
              ),
            )
          }}
        >
          <option value="">Readout only (no override)</option>
          <option value="width">Use as width (mm)</option>
          <option value="depth">Use as depth (mm)</option>
          <option value="height">Use as height (mm)</option>
        </select>
      </label>
    </div>
  )
}
