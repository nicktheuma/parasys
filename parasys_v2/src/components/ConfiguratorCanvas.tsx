import { Canvas, useThree } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { resolveConfiguratorLighting, type ResolvedConfiguratorLighting } from '@/lib/configuratorLighting'
import { useConfiguratorStore } from '@/stores/configuratorStore'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'
import { DirectionalLightGizmos } from './LightingEditorGizmos'
import { ConfiguratorStageContent } from './ConfiguratorStageContent'
import styles from '@/routes/configuratorPublic.module.css'

function SceneDirectionalLights({
  productCenter,
  resolved,
}: {
  productCenter: THREE.Vector3
  resolved: ResolvedConfiguratorLighting
}) {
  const targetRef = useRef<THREE.Object3D>(null)
  const d0 = useRef<THREE.DirectionalLight>(null)
  const d1 = useRef<THREE.DirectionalLight>(null)
  const d2 = useRef<THREE.DirectionalLight>(null)

  const p0 = useMemo(
    () => productCenter.clone().add(new THREE.Vector3(...resolved.directional0.position)),
    [productCenter, resolved.directional0.position],
  )
  const p1 = useMemo(
    () => productCenter.clone().add(new THREE.Vector3(...resolved.directional1.position)),
    [productCenter, resolved.directional1.position],
  )
  const p2 = useMemo(
    () => productCenter.clone().add(new THREE.Vector3(...resolved.directional2.position)),
    [productCenter, resolved.directional2.position],
  )

  useLayoutEffect(() => {
    const t = targetRef.current
    if (!t) return
    t.position.copy(productCenter)
    for (const r of [d0, d1, d2]) {
      const l = r.current
      if (l) l.target = t
    }
  }, [productCenter])

  return (
    <>
      <object3D ref={targetRef} />
      <directionalLight
        ref={d0}
        position={[p0.x, p0.y, p0.z]}
        intensity={resolved.directional0.intensity}
        color={resolved.directional0.color}
      />
      <directionalLight
        ref={d1}
        position={[p1.x, p1.y, p1.z]}
        intensity={resolved.directional1.intensity}
        color={resolved.directional1.color}
      />
      <directionalLight
        ref={d2}
        position={[p2.x, p2.y, p2.z]}
        intensity={resolved.directional2.intensity}
        color={resolved.directional2.color}
      />
    </>
  )
}

/** Keep orbit pivot on the product when bbox center updates (dims / template). */
function SyncOrbitTarget({ target }: { target: THREE.Vector3 }) {
  const controls = useThree((s) => s.controls) as unknown as
    | { target: THREE.Vector3; update: () => void }
    | undefined

  useLayoutEffect(() => {
    if (!controls) return
    controls.target.copy(target)
    controls.update()
  }, [controls, target, target.x, target.y, target.z])

  return null
}

export function ConfiguratorCanvas({ adminMode }: { adminMode?: boolean }) {
  const {
    templateKey,
    driven,
    materialSpec,
    materialId,
    templateParamOverrides,
    uvMappings,
    lighting,
    lightingEditorPick,
    propsConfig,
    propLibrary,
  } = useConfiguratorStore()

  const resolvedLighting = useMemo(() => resolveConfiguratorLighting(lighting), [lighting])

  const [productCenter, setProductCenter] = useState(() => new THREE.Vector3(0, 0.15, 0))
  const onProductCenterChange = useCallback((center: THREE.Vector3) => {
    setProductCenter(center.clone())
  }, [])

  const stageKey = templateKey
  const showLightingGizmos = Boolean(adminMode && lightingEditorPick != null)

  return (
    <div className={`${styles.canvasWrap} ${adminMode ? styles.canvasWrapAdmin : ''}`}>
      <CanvasErrorBoundary>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        camera={{ position: [0, 0.28, 0.55], near: 0.002, far: 10 }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          gl.shadowMap.autoUpdate = true
        }}
      >
        <Suspense fallback={null}>
          <ConfiguratorStageContent
            stageKey={stageKey}
            templateKey={templateKey}
            widthMm={driven.widthMm}
            depthMm={driven.depthMm}
            heightMm={driven.heightMm}
            materialSpec={materialSpec}
            materialId={materialId}
            templateParamOverrides={templateParamOverrides}
            uvMappings={uvMappings}
            propsConfig={propsConfig}
            propLibrary={propLibrary}
            resolvedLighting={resolvedLighting}
            lightingEditorPick={lightingEditorPick}
            showStageLightGizmos={showLightingGizmos}
            productCenter={productCenter}
            onProductCenterChange={onProductCenterChange}
          />

          {showLightingGizmos ? (
            <DirectionalLightGizmos
              resolved={resolvedLighting}
              selectedId={lightingEditorPick}
              productCenter={productCenter}
            />
          ) : null}

          <SceneDirectionalLights productCenter={productCenter} resolved={resolvedLighting} />

          <Environment
            key={`env-${resolvedLighting.environmentBlur}`}
            files="/monochrome_studio_02_1k.hdr"
            blur={resolvedLighting.environmentBlur}
            environmentIntensity={resolvedLighting.environmentIntensity}
          />

          <OrbitControls
            makeDefault
            minDistance={0.01}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2 - 0.05}
          />
          <SyncOrbitTarget target={productCenter} />
        </Suspense>
      </Canvas>
      </CanvasErrorBoundary>
    </div>
  )
}
