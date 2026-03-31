import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Line, OrbitControls, TransformControls } from '@react-three/drei'
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

function resolveInitialCameraPosition(
  cameraSettings: {
    preset?: 'front' | 'top' | 'side' | 'iso' | 'custom'
    distanceFactor?: number
    position?: [number, number, number]
    target?: [number, number, number]
  } | null,
  fallbackTarget: THREE.Vector3,
): [number, number, number] {
  const dist = Math.max(0.6, Math.min(10, cameraSettings?.distanceFactor ?? 2.6))
  const d = Math.max(0.25 * dist, 0.7)
  if (cameraSettings?.preset === 'custom' && cameraSettings.position) {
    const tgt = new THREE.Vector3(...(cameraSettings.target ?? [fallbackTarget.x, fallbackTarget.y, fallbackTarget.z]))
    const basePos = new THREE.Vector3(...cameraSettings.position)
    const v = basePos.clone().sub(tgt)
    const p =
      v.lengthSq() < 1e-8
        ? tgt.clone().add(new THREE.Vector3(0, 0.24, 1).normalize().multiplyScalar(d))
        : tgt.clone().add(v.normalize().multiplyScalar(d))
    return [p.x, p.y, p.z]
  }
  const preset = cameraSettings?.preset ?? 'front'
  const dir =
    preset === 'top'
      ? new THREE.Vector3(0, 1, 0.01)
      : preset === 'side'
        ? new THREE.Vector3(1, 0.2, 0)
        : preset === 'iso'
          ? new THREE.Vector3(1, 0.75, 1)
          : new THREE.Vector3(0, 0.24, 1)
  const p = fallbackTarget.clone().addScaledVector(dir.normalize(), d)
  return [p.x, p.y, p.z]
}

function CameraStartViewGizmos({
  enabled,
  cameraSettings,
}: {
  enabled: boolean
  cameraSettings: {
    position?: [number, number, number]
    target?: [number, number, number]
  } | null
}) {
  const controls = useThree((s) => s.controls) as { enabled?: boolean; target?: THREE.Vector3; update?: () => void } | undefined
  const setCamera = useConfiguratorStore((s) => s.setCamera)
  const posRef = useRef<THREE.Object3D | null>(null)
  const tgtRef = useRef<THREE.Object3D | null>(null)

  useLayoutEffect(() => {
    if (!enabled || !posRef.current || !tgtRef.current) return
    const p = cameraSettings?.position ?? [0, 0.28, 0.55]
    const t = cameraSettings?.target ?? [0, 0.15, 0]
    posRef.current.position.set(p[0], p[1], p[2])
    tgtRef.current.position.set(t[0], t[1], t[2])
  }, [enabled, cameraSettings?.position, cameraSettings?.target])

  if (!enabled) return null
  const p = posRef.current?.position ?? new THREE.Vector3(...(cameraSettings?.position ?? [0, 0.28, 0.55]))
  const t = tgtRef.current?.position ?? new THREE.Vector3(...(cameraSettings?.target ?? [0, 0.15, 0]))
  const dir = t.clone().sub(p).normalize()
  const up = new THREE.Vector3(0, 1, 0)
  let right = new THREE.Vector3().crossVectors(dir, up)
  if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0)
  right.normalize()
  const camUp = new THREE.Vector3().crossVectors(right, dir).normalize()
  const near = 0.22
  const far = 0.52
  const fov = THREE.MathUtils.degToRad(44)
  const nearH = Math.tan(fov / 2) * near
  const nearW = nearH * 1.35
  const farH = Math.tan(fov / 2) * far
  const farW = farH * 1.35
  const nc = p.clone().add(dir.clone().multiplyScalar(near))
  const fc = p.clone().add(dir.clone().multiplyScalar(far))
  const nlt = nc.clone().add(camUp.clone().multiplyScalar(nearH)).sub(right.clone().multiplyScalar(nearW))
  const nrt = nc.clone().add(camUp.clone().multiplyScalar(nearH)).add(right.clone().multiplyScalar(nearW))
  const nlb = nc.clone().sub(camUp.clone().multiplyScalar(nearH)).sub(right.clone().multiplyScalar(nearW))
  const nrb = nc.clone().sub(camUp.clone().multiplyScalar(nearH)).add(right.clone().multiplyScalar(nearW))
  const flt = fc.clone().add(camUp.clone().multiplyScalar(farH)).sub(right.clone().multiplyScalar(farW))
  const frt = fc.clone().add(camUp.clone().multiplyScalar(farH)).add(right.clone().multiplyScalar(farW))
  const flb = fc.clone().sub(camUp.clone().multiplyScalar(farH)).sub(right.clone().multiplyScalar(farW))
  const frb = fc.clone().sub(camUp.clone().multiplyScalar(farH)).add(right.clone().multiplyScalar(farW))
  return (
    <group>
      <Line points={[p.toArray() as [number, number, number], t.toArray() as [number, number, number]]} color="#59d1ff" lineWidth={1.5} depthTest={false} />
      <Line points={[nlt.toArray() as [number, number, number], nrt.toArray() as [number, number, number], nrb.toArray() as [number, number, number], nlb.toArray() as [number, number, number], nlt.toArray() as [number, number, number]]} color="#59d1ff" lineWidth={1.2} depthTest={false} />
      <Line points={[flt.toArray() as [number, number, number], frt.toArray() as [number, number, number], frb.toArray() as [number, number, number], flb.toArray() as [number, number, number], flt.toArray() as [number, number, number]]} color="#59d1ff" lineWidth={1.2} depthTest={false} />
      <Line points={[nlt.toArray() as [number, number, number], flt.toArray() as [number, number, number]]} color="#59d1ff" lineWidth={1.2} depthTest={false} />
      <Line points={[nrt.toArray() as [number, number, number], frt.toArray() as [number, number, number]]} color="#59d1ff" lineWidth={1.2} depthTest={false} />
      <Line points={[nlb.toArray() as [number, number, number], flb.toArray() as [number, number, number]]} color="#59d1ff" lineWidth={1.2} depthTest={false} />
      <Line points={[nrb.toArray() as [number, number, number], frb.toArray() as [number, number, number]]} color="#59d1ff" lineWidth={1.2} depthTest={false} />
      <mesh ref={posRef}>
        <sphereGeometry args={[0.03, 14, 14]} />
        <meshBasicMaterial color="#4db8ff" />
      </mesh>
      <mesh ref={tgtRef}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshBasicMaterial color="#ffb74d" />
      </mesh>
      {posRef.current ? (
        <TransformControls
          object={posRef.current}
          mode="translate"
          onMouseDown={() => {
            if (controls && 'enabled' in controls) controls.enabled = false
          }}
          onMouseUp={() => {
            if (controls && 'enabled' in controls) controls.enabled = true
          }}
          onObjectChange={() => {
            const p = posRef.current?.position
            if (!p) return
            setCamera({ position: [p.x, p.y, p.z], preset: 'custom' })
          }}
        />
      ) : null}
      {tgtRef.current ? (
        <TransformControls
          object={tgtRef.current}
          mode="translate"
          onMouseDown={() => {
            if (controls && 'enabled' in controls) controls.enabled = false
          }}
          onMouseUp={() => {
            if (controls && 'enabled' in controls) controls.enabled = true
          }}
          onObjectChange={() => {
            const t = tgtRef.current?.position
            if (!t) return
            setCamera({ target: [t.x, t.y, t.z], preset: 'custom' })
          }}
        />
      ) : null}
    </group>
  )
}

function PdfCaptureBridge({ productCenter }: { productCenter: THREE.Vector3 }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const controls = useThree((s) => s.controls) as unknown as
    | { target?: THREE.Vector3; update?: () => void; enabled?: boolean }
    | undefined
  const setCapture = useConfiguratorStore((s) => s.setCapturePdfViews)

  useLayoutEffect(() => {
    const target = productCenter.clone()

    const captureOne = async (preset: 'plan' | 'section' | 'elevation', wPx: number, hPx: number) => {
      const prev = {
        px: camera.position.clone(),
        q: camera.quaternion.clone(),
        fov: camera.fov,
        near: camera.near,
        far: camera.far,
      }
      const prevTarget = controls?.target?.clone()
      const prevEnabled = controls?.enabled
      const prevPR = gl.getPixelRatio()
      const prevSize = { w: size.width, h: size.height }

      try {
        if (controls) controls.enabled = false

        const dist = 1.45
        const dir =
          preset === 'plan'
            ? new THREE.Vector3(0, 1, 0.001)
            : preset === 'section'
              ? new THREE.Vector3(1, 0, 0)
              : new THREE.Vector3(0, 0.22, 1)
        const pos = target.clone().addScaledVector(dir.normalize(), dist)
        camera.position.copy(pos)
        camera.lookAt(target)
        camera.updateMatrixWorld(true)
        camera.updateProjectionMatrix()
        if (controls?.target) controls.target.copy(target)
        controls?.update?.()

        gl.setPixelRatio(1)
        gl.setSize(wPx, hPx, false)
        gl.compile(scene, camera)
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        gl.render(scene, camera)
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        gl.render(scene, camera)
        gl.render(scene, camera)

        const dataUrl = gl.domElement.toDataURL('image/png')
        return dataUrl
      } finally {
        gl.setSize(prevSize.w, prevSize.h, false)
        gl.setPixelRatio(prevPR)
        camera.position.copy(prev.px)
        camera.quaternion.copy(prev.q)
        camera.fov = prev.fov
        camera.near = prev.near
        camera.far = prev.far
        camera.updateProjectionMatrix()
        if (controls?.target && prevTarget) controls.target.copy(prevTarget)
        if (controls && prevEnabled !== undefined) controls.enabled = prevEnabled
        controls?.update?.()
      }
    }

    setCapture(async () => {
      // Portrait A4-ish bitmap sizes (kept reasonable for request payloads).
      const W = 1400
      const H = 1980
      const plan = await captureOne('plan', W, H)
      const section = await captureOne('section', W, H)
      const elevation = await captureOne('elevation', W, H)
      return {
        planPngDataUrl: plan,
        sectionPngDataUrl: section,
        elevationPngDataUrl: elevation,
      }
    })

    return () => setCapture(null)
  }, [camera, controls, gl, scene, productCenter, setCapture, size.height, size.width])

  return null
}

export function ConfiguratorCanvas({ adminMode }: { adminMode?: boolean }) {
  const {
    templateKey,
    driven,
    materialSpec,
    materialId,
    materialHydrated,
    camera,
    cameraEditorEnabled,
    templateParamOverrides,
    uvMappings,
    lighting,
    lightingEditorPick,
    propsConfig,
    propLibrary,
  } = useConfiguratorStore()

  const resolvedLighting = useMemo(() => resolveConfiguratorLighting(lighting), [lighting])

  const [productCenter, setProductCenter] = useState(() => new THREE.Vector3(0, 0.15, 0))
  const initialTarget = useMemo(
    () => new THREE.Vector3(...(camera?.target ?? [0, 0.15, 0])),
    [camera?.target],
  )
  const initialCameraPos = useMemo(
    () => resolveInitialCameraPosition(camera ?? null, initialTarget),
    [camera, initialTarget],
  )
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
        gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]}
        camera={{ position: initialCameraPos, near: 0.002, far: 10 }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          gl.shadowMap.autoUpdate = true
        }}
      >
        <Suspense fallback={null}>
          <PdfCaptureBridge productCenter={productCenter} />
          <ConfiguratorStageContent
            stageKey={stageKey}
            templateKey={templateKey}
            widthMm={driven.widthMm}
            depthMm={driven.depthMm}
            heightMm={driven.heightMm}
            materialSpec={materialSpec}
            materialId={materialId}
            materialHydrated={materialHydrated}
            adminMode={adminMode}
            cameraSettings={camera}
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
          <SyncOrbitTarget target={camera?.target ? initialTarget : productCenter} />
          <CameraStartViewGizmos enabled={Boolean(adminMode && cameraEditorEnabled)} cameraSettings={camera} />
        </Suspense>
      </Canvas>
      </CanvasErrorBoundary>
    </div>
  )
}
