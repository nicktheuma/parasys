import { Bounds, Center, ContactShadows, useBounds } from '@react-three/drei'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpotLight } from 'three'
import { TemplateProduct } from '@/features/configurator/TemplateProduct'
import type { ResolvedConfiguratorLighting } from '@/lib/configuratorLighting'
import { useConfiguratorStore } from '@/stores/configuratorStore'
import type {
  CameraSettings,
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
  materialHydrated?: boolean
  adminMode?: boolean
  cameraSettings?: CameraSettings | null
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
 * Must be listed **after** `Center` (and after `ProductCenterReader` is fine) so Bounds
 * measures the laid-out product; otherwise the first fit uses an empty/wrong box.
 */
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
  materialHydrated,
  adminMode,
  cameraSettings,
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

  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as
    | { target: THREE.Vector3; update: () => void }
    | undefined
  const cameraPreviewNonce = useConfiguratorStore((s) => s.cameraPreviewNonce)
  const appliedCameraStageRef = useRef<string>('')
  const appliedPreviewNonceRef = useRef<number>(-1)
  const shouldApplyByPreview = cameraPreviewNonce !== appliedPreviewNonceRef.current
  const shouldApplyByStage = appliedCameraStageRef.current !== `${stageKey}|${templateKey}`
  const lastDistanceRef = useRef<number | null>(null)
  const distanceNow = cameraSettings?.distanceFactor ?? 2.6
  const shouldApplyByDistance = lastDistanceRef.current == null || Math.abs(lastDistanceRef.current - distanceNow) > 1e-6
  useLayoutEffect(() => {
    if (!controls || radius <= 0.001) return
    if (!shouldApplyByPreview && !shouldApplyByStage && !shouldApplyByDistance) return

    const preset = cameraSettings?.preset ?? 'front'
    const dist = Math.max(0.6, Math.min(10, cameraSettings?.distanceFactor ?? 2.6))
    const d = Math.max(radius * dist, 0.7)
    let target = productCenter.clone()
    let pos: THREE.Vector3
    if (preset === 'custom' && cameraSettings?.position && cameraSettings?.target) {
      const basePos = new THREE.Vector3(...cameraSettings.position)
      target = new THREE.Vector3(...cameraSettings.target)
      const v = basePos.clone().sub(target)
      if (v.lengthSq() < 1e-8) {
        pos = target.clone().add(new THREE.Vector3(0, 0.24, 1).normalize().multiplyScalar(d))
      } else {
        pos = target.clone().add(v.normalize().multiplyScalar(d))
      }
    } else {
      const dir =
        preset === 'top'
          ? new THREE.Vector3(0, 1, 0.01)
          : preset === 'side'
            ? new THREE.Vector3(1, 0.2, 0)
            : preset === 'iso'
              ? new THREE.Vector3(1, 0.75, 1)
              : new THREE.Vector3(0, 0.24, 1)
      pos = target.clone().addScaledVector(dir.normalize(), d)
    }
    camera.position.copy(pos)
    controls.target.copy(target)
    controls.update()
    appliedCameraStageRef.current = `${stageKey}|${templateKey}`
    appliedPreviewNonceRef.current = cameraPreviewNonce
    lastDistanceRef.current = distanceNow
  }, [
    camera,
    controls,
    radius,
    stageKey,
    templateKey,
    cameraSettings,
    productCenter,
    cameraPreviewNonce,
    distanceNow,
    shouldApplyByPreview,
    shouldApplyByStage,
    shouldApplyByDistance,
  ])

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
            materialHydrated={materialHydrated}
            adminMode={adminMode}
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
        {/* Keep user camera stable after interaction/config changes. */}
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
