import { useEffect, useRef, useState } from 'react'
import { Billboard, Html, Line, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const DIM_COLOR = '#747474'
const HOVER_COLOR = '#060606'

type DimensionLineProps = {
  start: [number, number, number]
  end: [number, number, number]
  /** Current value in mm */
  label: number
  /** Callback receiving mm */
  setDimension?: (valueMm: number) => void
  min?: number
  max?: number
  step?: number
  dimensionGap?: number
  anchorGap?: number
  fontSize?: number
  uiScale?: number
  uiScaleMin?: number
  uiScaleMax?: number
  endpointScale?: number
  endpointType?: 'dot' | 'arrow' | 'diagonal' | 'cross'
  lineColor?: string
  textColor?: string
  hoverColor?: string
  showUnits?: boolean
  unitSystem?: 'mm' | 'm' | 'ft_in'
  textGapScale?: number
  labelPrefix?: string
}

function formatDimensionLabel(
  mm: number,
  unitSystem: 'mm' | 'm' | 'ft_in',
  showUnits: boolean,
): string {
  if (unitSystem === 'm') {
    const v = (mm / 1000).toFixed(3).replace(/\.?0+$/, '')
    return showUnits ? `${v}m` : v
  }
  if (unitSystem === 'ft_in') {
    const totalInches = mm / 25.4
    const feet = Math.floor(totalInches / 12)
    const inches = Math.max(0, totalInches - feet * 12)
    const inchText = inches.toFixed(1).replace(/\.0$/, '')
    return showUnits ? `${feet}' ${inchText}"` : `${feet} ${inchText}`
  }
  const v = String(Math.round(mm))
  return showUnits ? `${v}mm` : v
}

export function DimensionLine({
  start: startProp,
  end: endProp,
  label,
  setDimension,
  min = 200,
  max = 2400,
  step = 10,
  dimensionGap = 0.025,
  anchorGap = 0.005,
  fontSize = 0.01,
  uiScale = 1,
  uiScaleMin = 0.65,
  uiScaleMax = 8,
  endpointScale = 1,
  endpointType = 'dot',
  lineColor = DIM_COLOR,
  textColor = DIM_COLOR,
  hoverColor = HOVER_COLOR,
  showUnits = true,
  unitSystem = 'mm',
  textGapScale = 1,
  labelPrefix,
}: DimensionLineProps) {
  const diff = new THREE.Vector3(
    endProp[0] - startProp[0],
    endProp[1] - startProp[1],
    endProp[2] - startProp[2],
  )

  const dimGapVec = new THREE.Vector3()
  const anchorGapVec = new THREE.Vector3()
  const centerGapVec = new THREE.Vector3()
  const valueText = formatDimensionLabel(label, unitSystem, showUnits)
  const labelText = labelPrefix && labelPrefix.trim().length > 0 ? `${labelPrefix}: ${valueText}` : valueText
  const labelLen = Math.max(4, labelText.length)
  const centerGap = Math.max(fontSize * (1.9 + labelLen * 0.45) * textGapScale, 0.002)

  if (diff.x === 0 && diff.z === 0) {
    dimGapVec.set(dimensionGap, 0, 0)
    centerGapVec.set(0, centerGap * 0.35, 0)
    anchorGapVec.set(anchorGap, 0, 0)
  } else if (diff.y === 0 && diff.z === 0) {
    dimGapVec.set(0, dimensionGap, 0)
    centerGapVec.set(centerGap, 0, 0)
    anchorGapVec.set(0, anchorGap, 0)
  } else if (diff.x === 0 && diff.y === 0) {
    dimGapVec.set(dimensionGap, 0, 0)
    centerGapVec.set(0, 0, centerGap * -0.5)
    anchorGapVec.set(anchorGap, 0, 0)
  }

  const s = new THREE.Vector3(
    startProp[0] + dimGapVec.x,
    startProp[1] + dimGapVec.y,
    startProp[2] + dimGapVec.z,
  )
  const e = new THREE.Vector3(
    endProp[0] + dimGapVec.x,
    endProp[1] + dimGapVec.y,
    endProp[2] + dimGapVec.z,
  )
  const center = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5)
  const centerL = center.clone().sub(centerGapVec)
  const centerR = center.clone().add(centerGapVec)

  const witnessStart: [number, number, number] = [
    startProp[0] + anchorGapVec.x,
    startProp[1] + anchorGapVec.y,
    startProp[2] + anchorGapVec.z,
  ]
  const witnessEnd: [number, number, number] = [
    endProp[0] + anchorGapVec.x,
    endProp[1] + anchorGapVec.y,
    endProp[2] + anchorGapVec.z,
  ]

  const dragging = useRef(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const startLabel = useRef(label)
  const totalMovement = useRef(0)
  const editOrigin = useRef({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(String(Math.round(label)))
  const inputRef = useRef<HTMLInputElement>(null)
  const billboardRef = useRef<THREE.Group>(null)
  const tempWorldPos = useRef(new THREE.Vector3())
  const { controls, camera } = useThree()
  const isVerticalDimension = Math.abs(diff.y) > Math.abs(diff.x) && Math.abs(diff.y) > Math.abs(diff.z)

  useFrame(() => {
    if (!billboardRef.current) return
    billboardRef.current.getWorldPosition(tempWorldPos.current)
    const distance = camera.position.distanceTo(tempWorldPos.current)
    const distanceScale = THREE.MathUtils.clamp(distance * 0.12, 0.7, 3)
    const minLegibleScale = 12 / Math.max(1, fontSize * 1000)
    const finalScale = THREE.MathUtils.clamp(
      distanceScale * uiScale,
      Math.max(uiScaleMin, minLegibleScale),
      uiScaleMax,
    )
    billboardRef.current.scale.setScalar(finalScale)
  })

  const onPointerDown = (evt: THREE.Event) => {
    if (!setDimension) return
    const e = evt as unknown as { stopPropagation: () => void; nativeEvent?: MouseEvent; pointerId?: number; target?: { setPointerCapture?: (id: number) => void } }
    e.stopPropagation()
    dragging.current = true
    try { e.target?.setPointerCapture?.(e.pointerId!) } catch { /* noop */ }
    startX.current = e.nativeEvent?.clientX ?? 0
    startY.current = e.nativeEvent?.clientY ?? 0
    startLabel.current = label
    totalMovement.current = 0
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false

    const handleGlobalMove = (moveEvt: MouseEvent) => {
      if (!dragging.current) return
      totalMovement.current = Math.max(
        Math.abs(moveEvt.clientX - startX.current),
        Math.abs(moveEvt.clientY - startY.current),
      )
    }

    const handleGlobalUp = (upEvt: MouseEvent) => {
      dragging.current = false
      if (controls) (controls as unknown as { enabled: boolean }).enabled = true
      document.removeEventListener('mousemove', handleGlobalMove)
      document.removeEventListener('mouseup', handleGlobalUp)
      if (totalMovement.current < 5) {
        setIsEditing(true)
        setInputValue(String(Math.round(label)))
        editOrigin.current = { x: upEvt.clientX, y: upEvt.clientY }
      }
    }

    document.addEventListener('mousemove', handleGlobalMove)
    document.addEventListener('mouseup', handleGlobalUp)
  }

  const onPointerMove = (evt: THREE.Event) => {
    if (!dragging.current || !setDimension) return
    const e = evt as unknown as { stopPropagation: () => void; nativeEvent?: MouseEvent }
    e.stopPropagation()
    const clientX = e.nativeEvent?.clientX ?? 0
    const clientY = e.nativeEvent?.clientY ?? 0
    const screenDx = clientX - startX.current
    const screenDy = startY.current - clientY
    totalMovement.current = Math.max(Math.abs(screenDx), Math.abs(screenDy))
    const signedPixels = isVerticalDimension ? screenDy : screenDx
    const mmDelta = signedPixels * 2
    const newMm = startLabel.current + mmDelta
    const snapped = Math.min(max, Math.max(min, Math.round(newMm / step) * step))
    if (snapped !== label) setDimension(snapped)
  }

  const onPointerUp = (evt: THREE.Event) => {
    if (!setDimension) return
    const e = evt as unknown as { stopPropagation: () => void; pointerId?: number; target?: { releasePointerCapture?: (id: number) => void } }
    e.stopPropagation()
    dragging.current = false
    try { e.target?.releasePointerCapture?.(e.pointerId!) } catch { /* noop */ }
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true
  }

  const applyInput = () => {
    if (!setDimension) return
    const v = parseFloat(inputValue)
    if (!isNaN(v)) {
      const clamped = Math.min(max, Math.max(min, v))
      const snapped = Math.round(clamped / step) * step
      setDimension(snapped)
    }
    setIsEditing(false)
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) return
    const onMove = (e: MouseEvent) => {
      if (
        Math.abs(e.clientX - editOrigin.current.x) > 30 ||
        Math.abs(e.clientY - editOrigin.current.y) > 30
      ) {
        setIsEditing(false)
      }
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [isEditing])

  const color = hovered ? hoverColor : lineColor
  const labelColor = hovered ? hoverColor : textColor
  const endpointRadius = Math.max(0.0015, fontSize * 0.18 * endpointScale)
  const lineDir = new THREE.Vector3().subVectors(e, s).normalize()
  const endpointHalf = Math.max(endpointRadius * 2.4, 0.004)

  const endpointGlyph = (pos: THREE.Vector3, sign: 1 | -1, key: string) => {
    const along = lineDir.clone().multiplyScalar(sign)
    const perp = new THREE.Vector3(0, 1, 0)
    if (Math.abs(along.dot(perp)) > 0.9) perp.set(1, 0, 0)
    perp.cross(along).normalize()
    if (endpointType === 'cross') {
      const p1 = pos.clone().add(along.clone().multiplyScalar(endpointHalf))
      const p2 = pos.clone().add(along.clone().multiplyScalar(-endpointHalf))
      const p3 = pos.clone().add(perp.clone().multiplyScalar(endpointHalf))
      const p4 = pos.clone().add(perp.clone().multiplyScalar(-endpointHalf))
      return (
        <group key={key}>
          <Line points={[p1, p2]} color={color} lineWidth={1} />
          <Line points={[p3, p4]} color={color} lineWidth={1} />
        </group>
      )
    }
    if (endpointType === 'diagonal') {
      const d1 = pos
        .clone()
        .add(along.clone().multiplyScalar(endpointHalf))
        .add(perp.clone().multiplyScalar(endpointHalf))
      const d2 = pos
        .clone()
        .add(along.clone().multiplyScalar(-endpointHalf))
        .add(perp.clone().multiplyScalar(-endpointHalf))
      return <Line key={key} points={[d1, d2]} color={color} lineWidth={1} />
    }
    if (endpointType === 'arrow') {
      return (
        <mesh key={key} position={[pos.x, pos.y, pos.z]} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), along)}>
          <coneGeometry args={[endpointRadius * 1.35, endpointRadius * 3.3, 10]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )
    }
    return (
      <mesh key={key} position={[pos.x, pos.y, pos.z]}>
        <sphereGeometry args={[endpointRadius, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    )
  }

  return (
    <group>
      <Line points={[s, centerL]} color={color} lineWidth={1} />
      <Line points={[centerR, e]} color={color} lineWidth={1} />

      <Line points={[[s.x, s.y, s.z], witnessStart]} color={color} lineWidth={1} />
      <Line points={[[e.x, e.y, e.z], witnessEnd]} color={color} lineWidth={1} />
      {endpointGlyph(s, -1, 'ep-s')}
      {endpointGlyph(e, 1, 'ep-e')}

      <Billboard
        ref={billboardRef}
        position={[center.x, center.y, center.z]}
        follow
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <group>
          <mesh
            onPointerDown={onPointerDown as unknown as (e: THREE.Event) => void}
            onPointerMove={onPointerMove as unknown as (e: THREE.Event) => void}
            onPointerUp={onPointerUp as unknown as (e: THREE.Event) => void}
            onPointerOver={(e) => {
              (e as unknown as { stopPropagation: () => void }).stopPropagation()
              setHovered(true)
            }}
            onPointerOut={(e) => {
              (e as unknown as { stopPropagation: () => void }).stopPropagation()
              setHovered(false)
            }}
          >
            <planeGeometry args={[0.12, 0.045]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>

          {isEditing ? (
            <Html center scale={0.001} distanceFactor={1}>
              <input
                ref={inputRef}
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={applyInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyInput()
                  else if (e.key === 'Escape') setIsEditing(false)
                }}
                step={step}
                min={min}
                max={max}
                style={{
                  fontSize: `${fontSize * 1.2 * 1000}px`,
                  width: `${fontSize * 1000 * 5}px`,
                  height: `${fontSize * 1000 * 1.5}px`,
                  padding: `${fontSize * 1000 * 0.2}px ${fontSize * 1000 * 0.3}px`,
                  borderRadius: '4px',
                  backgroundColor: '#ffffffee',
                  color: hoverColor,
                  border: `1px solid ${lineColor}`,
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </Html>
          ) : (
            <Text
              fontSize={fontSize}
              color={labelColor}
              anchorX="center"
              anchorY="middle"
            >
              {labelText}
            </Text>
          )}
        </group>
      </Billboard>
    </group>
  )
}
