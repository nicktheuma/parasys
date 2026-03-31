import { useEffect, useMemo, useRef, useState } from 'react'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { useConfiguratorStore } from '@/stores/configuratorStore'
import { mmToM } from '@/lib/configuratorDimensions'
import { DIM_MM } from '@/lib/configuratorDimensions'
import { DimensionLine } from './DimensionLine'

export function DimensionsOverlay3D() {
  const {
    driven,
    showDimensions,
    setDim,
    dimensionUi,
    dimensionEditorEnabled,
    dimensionPickMode,
    dimensionPickPendingPoint,
    dimensionPickHoverPoint,
    setDimensionUi,
  } = useConfiguratorStore()
  const widthMm = driven.widthMm
  const depthMm = driven.depthMm
  const heightMm = driven.heightMm

  const w = mmToM(widthMm)
  const h = mmToM(heightMm)
  const d = mmToM(depthMm)

  const uiScale = 1

  const widthLocked = driven.overrideAxis === 'width'
  const heightLocked = driven.overrideAxis === 'height'
  const depthLocked = driven.overrideAxis === 'depth'
  const lineScale = Math.max(0.4, Math.min(3, dimensionUi?.lineScale ?? 1))
  const textScale = Math.max(0.4, Math.min(3, dimensionUi?.textScale ?? 1))
  const endpointScale = Math.max(0.4, Math.min(3, dimensionUi?.endpointScale ?? 1))
  const endpointType = dimensionUi?.endpointType ?? 'dot'
  const lineColor = dimensionUi?.lineColor ?? '#747474'
  const textColor = dimensionUi?.lockTextColorToLine ? lineColor : (dimensionUi?.textColor ?? '#747474')
  const hoverColor = '#060606'
  const showUnits = dimensionUi?.showUnits ?? true
  const unitSystem = dimensionUi?.unitSystem ?? 'mm'
  const textGapScale = Math.max(0.5, Math.min(4, dimensionUi?.textGapScale ?? 1))
  const gapScaleWidth = Math.max(0.2, Math.min(6, dimensionUi?.gapScaleWidth ?? 1))
  const gapScaleHeight = Math.max(0.2, Math.min(6, dimensionUi?.gapScaleHeight ?? 1))
  const gapScaleDepth = Math.max(0.2, Math.min(6, dimensionUi?.gapScaleDepth ?? 1))
  const pickPointSize = Math.max(0.001, Math.min(0.05, dimensionUi?.pickPointSize ?? 0.012))
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | undefined
  const [activeHandle, setActiveHandle] = useState<string | null>(null)
  const widthRef = useRef<THREE.Object3D | null>(null)
  const heightRef = useRef<THREE.Object3D | null>(null)
  const depthRef = useRef<THREE.Object3D | null>(null)
  const customRefs = useRef<Record<string, THREE.Object3D | null>>({})

  const baseGap = 0.05 * lineScale
  const midWidth = useMemo(() => new THREE.Vector3(0, h, -d / 2), [h, d])
  const midHeight = useMemo(() => new THREE.Vector3(w / 2, h / 2, -d / 2), [w, h, d])
  const midDepth = useMemo(() => new THREE.Vector3(w / 2, 0, 0), [w])
  useEffect(() => {
    if (widthRef.current) widthRef.current.position.set(midWidth.x, midWidth.y + baseGap * gapScaleWidth, midWidth.z)
    if (heightRef.current) heightRef.current.position.set(midHeight.x + baseGap * gapScaleHeight, midHeight.y, midHeight.z)
    if (depthRef.current) depthRef.current.position.set(midDepth.x + baseGap * gapScaleDepth, midDepth.y, midDepth.z)
  }, [midWidth, midHeight, midDepth, baseGap, gapScaleWidth, gapScaleHeight, gapScaleDepth])

  const activeRef =
    activeHandle === 'width'
      ? widthRef
      : activeHandle === 'height'
        ? heightRef
        : activeHandle === 'depth'
          ? depthRef
          : { current: activeHandle ? customRefs.current[activeHandle] ?? null : null }
  const customDimensions = dimensionUi?.customDimensions ?? []
  const customDefs = useMemo(
    () =>
      customDimensions.map((cd) => {
        const s = new THREE.Vector3(...cd.start)
        const e = new THREE.Vector3(...cd.end)
        const diff = e.clone().sub(s)
        const axis = Math.abs(diff.y) > Math.abs(diff.x) && Math.abs(diff.y) > Math.abs(diff.z) ? 'y' : Math.abs(diff.z) > Math.abs(diff.x) ? 'z' : 'x'
        const gapScale = Math.max(0.2, Math.min(6, cd.gapScale ?? 1))
        const base = axis === 'x' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
        const mid = s.clone().add(e).multiplyScalar(0.5).add(base.multiplyScalar(baseGap * gapScale))
        return { ...cd, s, e, axis, gapScale, mid }
      }),
    [customDimensions, baseGap],
  )
  const snapScale = (v: number, others: number[]) => {
    for (const o of others) {
      if (Math.abs(v - o) < 0.14) return o
    }
    return v
  }

  if (!showDimensions) return null

  return (
    <group name="DimensionsOverlay3D">
      {/* Width: along X, top-back edge */}
      <DimensionLine
        start={[-w / 2, h, -d / 2]}
        end={[w / 2, h, -d / 2]}
        label={widthMm}
        setDimension={widthLocked ? undefined : (v) => setDim('width', v)}
        min={DIM_MM.width.min}
        max={DIM_MM.width.max}
        step={1}
        dimensionGap={0.05 * lineScale * gapScaleWidth}
        anchorGap={0.012 * lineScale}
        fontSize={0.018 * textScale}
        uiScale={uiScale}
        uiScaleMin={0.95}
        endpointScale={endpointScale}
        endpointType={endpointType}
        lineColor={lineColor}
        textColor={textColor}
        hoverColor={hoverColor}
        showUnits={showUnits}
        unitSystem={unitSystem}
        textGapScale={textGapScale}
      />

      {/* Height: along Y, right-back edge (bottom=0, top=h) */}
      <DimensionLine
        start={[w / 2, 0, -d / 2]}
        end={[w / 2, h, -d / 2]}
        label={heightMm}
        setDimension={heightLocked ? undefined : (v) => setDim('height', v)}
        min={DIM_MM.height.min}
        max={DIM_MM.height.max}
        step={1}
        dimensionGap={0.05 * lineScale * gapScaleHeight}
        anchorGap={0.012 * lineScale}
        fontSize={0.018 * textScale}
        uiScale={uiScale}
        uiScaleMin={0.95}
        endpointScale={endpointScale}
        endpointType={endpointType}
        lineColor={lineColor}
        textColor={textColor}
        hoverColor={hoverColor}
        showUnits={showUnits}
        unitSystem={unitSystem}
        textGapScale={textGapScale}
      />

      {/* Depth: along Z, right-bottom edge */}
      <DimensionLine
        start={[w / 2, 0, d / 2]}
        end={[w / 2, 0, -d / 2]}
        label={depthMm}
        setDimension={depthLocked ? undefined : (v) => setDim('depth', v)}
        min={DIM_MM.depth.min}
        max={DIM_MM.depth.max}
        step={1}
        dimensionGap={0.05 * lineScale * gapScaleDepth}
        anchorGap={0.012 * lineScale}
        fontSize={0.018 * textScale}
        uiScale={uiScale}
        uiScaleMin={0.95}
        endpointScale={endpointScale}
        endpointType={endpointType}
        lineColor={lineColor}
        textColor={textColor}
        hoverColor={hoverColor}
        showUnits={showUnits}
        unitSystem={unitSystem}
        textGapScale={textGapScale}
      />
      {customDefs.map((cd) => (
        <DimensionLine
          key={cd.id}
          start={[cd.s.x, cd.s.y, cd.s.z]}
          end={[cd.e.x, cd.e.y, cd.e.z]}
          label={cd.s.distanceTo(cd.e) * 1000}
          min={0}
          max={10000}
          step={1}
          dimensionGap={0.05 * lineScale * cd.gapScale}
          anchorGap={0.012 * lineScale}
          fontSize={0.018 * textScale}
          uiScale={uiScale}
          uiScaleMin={0.95}
          endpointScale={endpointScale}
          endpointType={endpointType}
          lineColor={lineColor}
          textColor={textColor}
          hoverColor={hoverColor}
          showUnits={showUnits}
          unitSystem={unitSystem}
          textGapScale={textGapScale}
          labelPrefix={cd.name}
        />
      ))}
      {dimensionPickMode && dimensionPickHoverPoint ? (
        <mesh position={dimensionPickHoverPoint}>
          <sphereGeometry args={[pickPointSize, 14, 14]} />
          <meshBasicMaterial color="#ff4d4d" />
        </mesh>
      ) : null}
      {dimensionPickMode && dimensionPickPendingPoint && dimensionPickHoverPoint ? (
        <DimensionLine
          start={dimensionPickPendingPoint}
          end={dimensionPickHoverPoint}
          label={new THREE.Vector3(...dimensionPickPendingPoint).distanceTo(new THREE.Vector3(...dimensionPickHoverPoint)) * 1000}
          min={0}
          max={10000}
          step={1}
          dimensionGap={0.05 * lineScale}
          anchorGap={0.012 * lineScale}
          fontSize={0.018 * textScale}
          uiScale={uiScale}
          uiScaleMin={0.95}
          endpointScale={endpointScale}
          endpointType={endpointType}
          lineColor="#ff4d4d"
          textColor="#ff4d4d"
          hoverColor="#ff4d4d"
          showUnits={showUnits}
          unitSystem={unitSystem}
          textGapScale={textGapScale}
        />
      ) : null}
      {dimensionEditorEnabled ? (
        <>
          <mesh ref={widthRef} onPointerDown={(e) => { e.stopPropagation(); setActiveHandle('width') }}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshBasicMaterial color="#66e0ff" />
          </mesh>
          <mesh ref={heightRef} onPointerDown={(e) => { e.stopPropagation(); setActiveHandle('height') }}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshBasicMaterial color="#66e0ff" />
          </mesh>
          <mesh ref={depthRef} onPointerDown={(e) => { e.stopPropagation(); setActiveHandle('depth') }}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshBasicMaterial color="#66e0ff" />
          </mesh>
          {customDefs.map((cd) => (
            <mesh
              key={`h-${cd.id}`}
              ref={(el) => {
                customRefs.current[cd.id] = el
              }}
              position={[cd.mid.x, cd.mid.y, cd.mid.z]}
              onPointerDown={(e) => {
                e.stopPropagation()
                setActiveHandle(cd.id)
              }}
            >
              <sphereGeometry args={[0.016, 12, 12]} />
              <meshBasicMaterial color="#66e0ff" />
            </mesh>
          ))}
          {activeRef.current ? (
            <TransformControls
              object={activeRef.current}
              mode="translate"
              showX={activeHandle !== 'width'}
              showY={activeHandle === 'width'}
              showZ={false}
              onMouseDown={() => {
                if (controls && 'enabled' in controls) controls.enabled = false
              }}
              onMouseUp={() => {
                if (controls && 'enabled' in controls) controls.enabled = true
              }}
              onObjectChange={() => {
                if (!activeRef.current) return
                if (activeHandle === 'width') {
                  const raw = Math.max(0.2, Math.min(6, (activeRef.current.position.y - midWidth.y) / baseGap))
                  const scale = snapScale(raw, [gapScaleHeight, gapScaleDepth, ...customDefs.map((c) => c.gapScale)])
                  setDimensionUi({ gapScaleWidth: scale })
                  return
                }
                if (activeHandle === 'height') {
                  const raw = Math.max(0.2, Math.min(6, (activeRef.current.position.x - midHeight.x) / baseGap))
                  const scale = snapScale(raw, [gapScaleWidth, gapScaleDepth, ...customDefs.map((c) => c.gapScale)])
                  setDimensionUi({ gapScaleHeight: scale })
                  return
                }
                if (activeHandle === 'depth') {
                  const raw = Math.max(0.2, Math.min(6, (activeRef.current.position.x - midDepth.x) / baseGap))
                  const scale = snapScale(raw, [gapScaleWidth, gapScaleHeight, ...customDefs.map((c) => c.gapScale)])
                  setDimensionUi({ gapScaleDepth: scale })
                  return
                }
                const c = customDefs.find((x) => x.id === activeHandle)
                if (!c) return
                const raw = c.axis === 'x'
                  ? Math.max(0.2, Math.min(6, (activeRef.current.position.y - (c.s.y + c.e.y) * 0.5) / baseGap))
                  : Math.max(0.2, Math.min(6, (activeRef.current.position.x - (c.s.x + c.e.x) * 0.5) / baseGap))
                const scale = snapScale(raw, [gapScaleWidth, gapScaleHeight, gapScaleDepth, ...customDefs.filter((x) => x.id !== c.id).map((x) => x.gapScale)])
                setDimensionUi({
                  customDimensions: customDimensions.map((row) =>
                    row.id === c.id ? { ...row, gapScale: scale } : row,
                  ),
                })
              }}
            />
          ) : null}
        </>
      ) : null}
    </group>
  )
}
