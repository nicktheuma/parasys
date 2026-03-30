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
  uiScaleMin = 0.45,
  uiScaleMax = 4.2,
}: DimensionLineProps) {
  const diff = new THREE.Vector3(
    endProp[0] - startProp[0],
    endProp[1] - startProp[1],
    endProp[2] - startProp[2],
  )

  const dimGapVec = new THREE.Vector3()
  const anchorGapVec = new THREE.Vector3()
  const centerGapVec = new THREE.Vector3()
  const centerGap = Math.max(fontSize * 1.8, 0.001)

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

  useFrame(() => {
    if (!billboardRef.current) return
    billboardRef.current.getWorldPosition(tempWorldPos.current)
    const distance = camera.position.distanceTo(tempWorldPos.current)
    const distanceScale = THREE.MathUtils.clamp(distance * 0.12, 0.7, 3)
    const finalScale = THREE.MathUtils.clamp(distanceScale * uiScale, uiScaleMin, uiScaleMax)
    billboardRef.current.scale.setScalar(finalScale)
  })

  const onPointerDown = (evt: THREE.Event) => {
    if (!setDimension) return
    const e = evt as unknown as { stopPropagation: () => void; nativeEvent?: MouseEvent; pointerId?: number; target?: { setPointerCapture?: (id: number) => void } }
    e.stopPropagation()
    dragging.current = true
    try { e.target?.setPointerCapture?.(e.pointerId!) } catch { /* noop */ }
    startX.current = e.nativeEvent?.clientX ?? 0
    startLabel.current = label
    totalMovement.current = 0
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false

    const handleGlobalMove = (moveEvt: MouseEvent) => {
      if (!dragging.current) return
      totalMovement.current = Math.abs(moveEvt.clientX - startX.current)
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
    const screenDx = clientX - startX.current
    totalMovement.current = Math.abs(screenDx)
    const mmDelta = screenDx * 2
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

  const color = hovered ? HOVER_COLOR : DIM_COLOR

  return (
    <group>
      <Line points={[s, centerL]} color={color} lineWidth={1} />
      <Line points={[centerR, e]} color={color} lineWidth={1} />

      <Line points={[[s.x, s.y, s.z], witnessStart]} color={color} lineWidth={1} />
      <Line points={[[e.x, e.y, e.z], witnessEnd]} color={color} lineWidth={1} />

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
            <planeGeometry args={[0.08, 0.03]} />
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
                  color: HOVER_COLOR,
                  border: `1px solid ${DIM_COLOR}`,
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </Html>
          ) : (
            <Text
              fontSize={fontSize}
              color={color}
              anchorX="center"
              anchorY="middle"
            >
              {Math.round(label)}mm
            </Text>
          )}
        </group>
      </Billboard>
    </group>
  )
}
