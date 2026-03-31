import { Bounds, Center, ContactShadows, useBounds } from '@react-three/drei'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpotLight } from 'three'
import { TemplateProduct } from '@/features/configurator/TemplateProduct'
import type { ResolvedConfiguratorLighting } from '@/lib/configuratorLighting'
import type {
  ConfiguratorPropsSettings,
  MaterialShaderSpec,
  SurfaceUvMapping,
  TemplateParametricPreset,
} from '@shared/types'
import type { PropLibraryItem } from '@/features/configurator/props/types'
import { DimensionsOverlay3D } from '@/components/DimensionsOverlay3D'
import { StageLightingGizmos } from '@/components/LightingEditorGizmos'
import type { LightingTabId } from '@/lib/configuratorLighting'

type Props = {
  stageKey: string
  templateKey: string
  widthMm: number
  depthMm: number
  heightMm: number
  materialSpec: MaterialShaderSpec
  materialId: string | null
  templateParamOverrides: Record<string, TemplateParametricPreset> | null
  uvMappings: Record<string, SurfaceUvMapping> | null
  propsConfig: ConfiguratorPropsSettings | null
  propLibrary: PropLibraryItem[]
  resolvedLighting: ResolvedConfiguratorLighting
  lightingEditorPick: LightingTabId | null
  showStageLightGizmos?: boolean
  /** World-space center of the product bbox (from Bounds after Center lays out). */
  productCenter: THREE.Vector3
  onProductCenterChange: (center: THREE.Vector3) => void
}

/**
 * World +Z is the customer-facing side (open shelf / sofa seat / table long edge convention).
 * drei Bounds.fit() keeps the current camera→center ray; we set that ray to +Z (slightly elevated)
 * before fit so the product loads front-on.
 */
const FRONT_VIEW_DIR = new THREE.Vector3(0, 0.28, 1).normalize()

/**
 * Must be listed **after** `Center` (and after `ProductCenterReader` is fine) so Bounds
 * measures the laid-out product; otherwise the first fit uses an empty/wrong box.
 */
function FitOnceOnStageKey({ stageKey, radius }: { stageKey: string; radius: number }) {
  const bounds = useBounds()
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as
    | { target: THREE.Vector3; update: () => void }
    | undefined
  const invalidate = useThree((s) => s.invalidate)

  const fittedRef = useRef<{ key: string; done: boolean }>({ key: '', done: false })

  useLayoutEffect(() => {
    if (fittedRef.current.key !== stageKey) {
      fittedRef.current = { key: stageKey, done: false }
    }
    if (radius <= 0.001 || fittedRef.current.done) return
    bounds.refresh()
    const { center, distance } = bounds.getSize()
    camera.position.copy(center).addScaledVector(FRONT_VIEW_DIR, distance)
    bounds.fit()
    if (controls) {
      controls.target.copy(center)
      controls.update()
    }
    fittedRef.current.done = true
    invalidate()
  }, [bounds, camera, controls, invalidate, stageKey, radius])

  return null
}

function DebouncedRefitIfOutOfView({
  triggerKey,
  radius,
}: {
  triggerKey: string
  radius: number
}) {
  const bounds = useBounds()
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as
    | { target: THREE.Vector3; update: () => void }
    | undefined
  const invalidate = useThree((s) => s.invalidate)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    if (radius <= 0.001) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      bounds.refresh()
      const { box, center, distance } = bounds.getSize()
      const points = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      ]
      const outOfView = points.some((p) => {
        const ndc = p.clone().project(camera)
        return ndc.z > 1 || ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1
      })
      if (!outOfView) return
      camera.position.copy(center).addScaledVector(FRONT_VIEW_DIR, distance)
      bounds.fit()
      if (controls) {
        controls.target.copy(center)
        controls.update()
      }
      invalidate()
    }, 220)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [bounds, camera, controls, invalidate, triggerKey, radius])

  return null
}

/**
 * Runs after sibling Center lays out; refreshes Bounds and writes world bbox center for lighting.
 */
function ProductCenterReader({
  widthMm,
  depthMm,
  heightMm,
  stageKey,
  templateKey,
  onProductCenterChange,
}: {
  widthMm: number
  depthMm: number
  heightMm: number
  stageKey: string
  templateKey: string
  onProductCenterChange: (center: THREE.Vector3) => void
}) {
  const bounds = useBounds()

  useLayoutEffect(() => {
    bounds.refresh()
    const { center } = bounds.getSize()
    onProductCenterChange(center.clone())
  }, [bounds, widthMm, depthMm, heightMm, stageKey, templateKey, onProductCenterChange])

  return null
}

/**
 * Studio framing without drei Stage: Stage's `adjustCamera` refits the camera whenever the
 * bounding sphere changes (every dimension tweak), which causes jitter. We use Bounds with
 * fit/clip off so the camera is driven only by OrbitControls.
 *
 * ContactShadows sits at y ≈ 0 with bottom-aligned Center content (product floor at y = 0).
 * It is a sibling of Bounds (same as drei Stage), not inside Center, so it is not part of bbox.
 */
export function ConfiguratorStageContent({
  stageKey,
  templateKey,
  widthMm,
  depthMm,
  heightMm,
  materialSpec,
  materialId,
  templateParamOverrides,
  uvMappings,
  propsConfig,
  propLibrary,
  resolvedLighting,
  lightingEditorPick,
  showStageLightGizmos,
  productCenter,
  onProductCenterChange,
}: Props) {
  const [radius, setRadius] = useState(0.25)
  const onCentered = useCallback(
    (p: { boundingSphere: { radius: number } }) => {
      const r = p.boundingSphere.radius
      if (r > 0.001) setRadius(r)
    },
    [],
  )

  const contactShadow = useMemo(
    () => ({
      scale: Math.max(18, radius * 5),
      far: Math.max(12, radius * 8),
      opacity: 0.82,
      blur: 4,
      resolution: 4096,
      color: '#000000' as const,
      smooth: true,
    }),
    [radius],
  )

  const ks = resolvedLighting.keySpot
  const fp = resolvedLighting.fillPoint

  const keyLightRef = useRef<SpotLight>(null)
  const fillLightRef = useRef<THREE.PointLight>(null)
  const spotTargetRef = useRef<THREE.Object3D>(null)

  const spotOffset = useMemo(
    () =>
      new THREE.Vector3(
        ks.position[0] * radius,
        ks.position[1] * radius,
        ks.position[2] * radius,
      ),
    [ks.position, radius],
  )
  const fillOffset = useMemo(
    () =>
      new THREE.Vector3(
        fp.position[0] * radius,
        fp.position[1] * radius,
        fp.position[2] * radius,
      ),
    [fp.position, radius],
  )

  useLayoutEffect(() => {
    const l = keyLightRef.current
    const t = spotTargetRef.current
    if (!l || !t) return
    l.target = t
  }, [])

  useLayoutEffect(() => {
    const l = keyLightRef.current
    const t = spotTargetRef.current
    const pl = fillLightRef.current
    if (!l || !t) return
    const c = productCenter
    l.position.copy(c).add(spotOffset)
    t.position.copy(c)
    l.target.updateMatrixWorld()
    if (pl) pl.position.copy(c).add(fillOffset)
  }, [productCenter, spotOffset, fillOffset, radius])

  useLayoutEffect(() => {
    const l = keyLightRef.current
    if (!l) return
    const sh = l.shadow
    sh.mapSize.set(4096, 4096)
    sh.radius = 18
    sh.bias = -0.0001
    sh.normalBias = 0.04
    sh.camera.near = 0.08
    sh.camera.far = Math.max(25, radius * 20)
    sh.camera.updateProjectionMatrix()
  }, [radius])

  return (
    <group key={stageKey}>
      <ambientLight intensity={resolvedLighting.ambientIntensity} />
      <spotLight
        ref={keyLightRef}
        penumbra={ks.softness ?? 1}
        intensity={ks.intensity}
        color={ks.color}
        castShadow
        shadow-bias={-0.0001}
        shadow-normalBias={0.04}
        shadow-mapSize={4096}
      />
      {/* Spot target at product bbox center (position set in useLayoutEffect) */}
      <object3D ref={spotTargetRef} />
      <pointLight ref={fillLightRef} intensity={fp.intensity} color={fp.color} />

      <Bounds fit={false} clip={false} margin={1.1} observe={false}>
        <Center bottom onCentered={onCentered}>
          <TemplateProduct
            templateKey={templateKey}
            widthMm={widthMm}
            depthMm={depthMm}
            heightMm={heightMm}
            materialSpec={materialSpec}
            materialId={materialId}
            templateParamOverrides={templateParamOverrides}
            uvMappings={uvMappings}
            propsConfig={propsConfig}
            propLibrary={propLibrary}
          />
          <DimensionsOverlay3D />
        </Center>
        <ProductCenterReader
          widthMm={widthMm}
          depthMm={depthMm}
          heightMm={heightMm}
          stageKey={stageKey}
          templateKey={templateKey}
          onProductCenterChange={onProductCenterChange}
        />
        <FitOnceOnStageKey stageKey={stageKey} radius={radius} />
        <DebouncedRefitIfOutOfView
          triggerKey={`${widthMm}-${depthMm}-${heightMm}`}
          radius={radius}
        />
      </Bounds>

      {/* Slightly below y=0 avoids z-fighting with bottom faces; world floor matches bbox bottom */}
      <ContactShadows position={[0, -0.0008, 0]} {...contactShadow} />

      {showStageLightGizmos ? (
        <StageLightingGizmos
          radius={radius}
          resolved={resolvedLighting}
          selectedId={lightingEditorPick}
          productCenter={productCenter}
        />
      ) : null}
    </group>
  )
}
