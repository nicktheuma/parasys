import * as THREE from 'three'
import { useControls } from 'leva'
import { useRef, useMemo, useLayoutEffect, useEffect, useState, lazy, Suspense } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'

import { PlaneDimensionLine } from './DimensionManager'
import { GeneratePerlinNoiseTexture } from './NoiseGenerator'
import { generatePanelSpecs } from './parametric/panelSpecs'
import { createExtrudedPanelGeometry } from './parametric/profileBuilder'

const LazyProps = lazy(() => import('./Props_1').then((module) => ({ default: module.Props_1 })))

const easeOutCubic = (t) => 1 - ((1 - t) ** 3)
const easeOutBack = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + (c3 * ((t - 1) ** 3)) + (c1 * ((t - 1) ** 2))
}

const panelIdSeed = (panelId = '') => {
  let hash = 0
  for (let index = 0; index < panelId.length; index += 1) {
    hash = ((hash << 5) - hash) + panelId.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

const toVector3 = (value) => {
  if (value?.isVector3) return value.clone()
  if (Array.isArray(value)) {
    return new THREE.Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
  }
  if (value && typeof value === 'object') {
    return new THREE.Vector3(value.x || 0, value.y || 0, value.z || 0)
  }
  return new THREE.Vector3()
}

export function Experience({ onInitialObjectVisible = () => {}, selectedMaterialKey = null }) {
  const { gl } = useThree()
  const [enhancedAssetsReady, setEnhancedAssetsReady] = useState(false)
  const hasReportedInitialVisible = useRef(false)
  const lastInteractionAtRef = useRef(Date.now())
  const isUserInteractingRef = useRef(false)
  const currentAutoRotateSpeedRef = useRef(0)
  
  // const leftGroupRef = useRef()
  // const rightGroupRef = useRef()
  const Dimensions = useRef()
  const Bounding = useRef()
  const FurnitureGroup = useRef()
  const OrbitRef = useRef()
  const lightRef = useRef()
  const panelMeshRefs = useRef(new Map())
  const panelMeshTargetsRef = useRef(new Map())
  const introProgressRef = useRef(0)
  const materialFadeRef = useRef(0)

  const startDims = new THREE.Vector3(0.3, 0.1, 0.05);
  const maxDims = new THREE.Vector3(1.2, 1, 0.3);
  const materialThickness = 0.0012;
  // const MinMax_span = new THREE.Vector2(0.15, 0.6); // Minimum & maximum distance between dividers/shelves to avoid unbuildable scenarios
  // let desired_Dividers = 0;

  const uvDebugTexture = useMemo(() => {
    if (typeof document === 'undefined') return null

    const canvasSize = 1024
    const tileSize = 64
    const canvas = document.createElement('canvas')
    canvas.width = canvasSize
    canvas.height = canvasSize

    const context = canvas.getContext('2d')
    if (!context) return null

    for (let y = 0; y < canvasSize; y += tileSize) {
      for (let x = 0; x < canvasSize; x += tileSize) {
        const isDark = ((x / tileSize) + (y / tileSize)) % 2 === 0
        context.fillStyle = isDark ? '#111827' : '#f3f4f6'
        context.fillRect(x, y, tileSize, tileSize)
      }
    }

    context.strokeStyle = '#2563eb'
    context.lineWidth = 8
    context.beginPath()
    context.moveTo(0, 6)
    context.lineTo(canvasSize, 6)
    context.stroke()

    context.strokeStyle = '#0f766e'
    context.lineWidth = 8
    context.beginPath()
    context.moveTo(6, 0)
    context.lineTo(6, canvasSize)
    context.stroke()

    context.fillStyle = '#dc2626'
    context.beginPath()
    context.arc(20, 20, 10, 0, Math.PI * 2)
    context.fill()

    context.fillStyle = '#111827'
    context.font = 'bold 28px sans-serif'
    context.fillText('U', canvasSize - 40, 40)
    context.fillText('V', 16, canvasSize - 16)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(2, 2)
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.generateMipmaps = true
    texture.needsUpdate = true

    return texture
  }, [])

  // Memoize materials to avoid recreating them every render
  const materials = useMemo(() => ({
    mat_Dev: new THREE.MeshStandardMaterial( {map: null, color: '#ff0000', roughness: 1, transparent: true, opacity: 0.3}),
    mat_Dev_Wireframe: new THREE.MeshMatcapMaterial( {map: null, color: '#ff0000', wireframe: true, wireframeLinewidth: 0.1}),
    mat_Placeholder: new THREE.MeshStandardMaterial( {map: null, color: '#c5ccd3', roughness: 0.9, metalness: 0.05}),
    mat_Wireframe: new THREE.MeshMatcapMaterial( {map: null, color: '#000000', wireframe: true, wireframeLinewidth: 0.01}),
    mat_UVDebug: new THREE.MeshBasicMaterial({ map: uvDebugTexture, color: '#ffffff' }),
    mat_MATCAP: new THREE.MeshMatcapMaterial( {map: null, color: '#ffffff'}),
    mat_Shadow: new THREE.ShadowMaterial({ opacity: 0.1 }),
    mat_PBR: new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0.3, metalness: 1}),
    mat_Chrome: new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0.15, metalness: 1}),
    mat_PaintedMetal: new THREE.MeshStandardMaterial( {map: null, color: '#526982', roughness: 1, metalness: 0.2})
  }), [uvDebugTexture])

  const { mat_Dev, mat_Dev_Wireframe, mat_Placeholder, mat_Wireframe, mat_UVDebug, mat_MATCAP, mat_Shadow,mat_PBR, mat_Chrome, mat_PaintedMetal } = materials
  
  const [controls, setControls] = useControls(() => ({
    width: { value: startDims.x, min: startDims.x, max: maxDims.x, step: 0.01},
    height: { value: startDims.y, min: startDims.y, max: maxDims.y, step: 0.01},
    depth: { value: startDims.z, min: startDims.z, max: maxDims.z, step: 0.01},
    shelves: { value: 1, min: 0, max: 4, step: 1 },
    dividers: { value: 1, min: 0, max: 4, step: 1 },  // ((get) => get('width')
    edgeOffset: { value: 0.05, min: 0, max: 0.2, step: 0.01 },
    slotOffset: { value: 0.01, min: 0.015, max: 0.15, step: 0.001 },
    material: { value: mat_PaintedMetal, options: { PBR: mat_PBR, Chrome: mat_Chrome, Painted: mat_PaintedMetal, MATCAP: mat_MATCAP, Wireframe: mat_Wireframe, UVDebug: mat_UVDebug } },
    paintedMetal_Colour: { value: '#526982' },
    showDims: true,
    showProps: true,
    showDevTools: false,
    //DEV TOOLS
    x1: { value: 10, min: 0.001, max: 10, step: 0.1, render: get => get('showDevTools') },
    y1: { value: 1, min: 0.001, max: 10, step: 0.1, render: get => get('showDevTools')  },
    x2: { value: 4.9, min: 0.1, max: 10, step: 0.1, render: get => get('showDevTools')  },
    y2: { value: 10, min: 0.1, max: 10, step: 0.1, render: get => get('showDevTools')  },
    lightPos: { value: [0.14,0.19,0.12], render: get => get('showDevTools') },
    lightTarget: { value: [-0.2210000000000003,-0.7,-0.007999999999999612], render: get => get('showDevTools') },
    intensity: { value: 0.005, min: 0, max: 10 , render: get => get('showDevTools') },
    mapSize: { value: 1024, options: [512, 1024, 2048] , render: get => get('showDevTools') }, // Higher = Sharper
    near: { value: 0.001, min: 0, max: 10, render: get => get('showDevTools')  },
    far: { value: 10, min: 0.1, max: 100, render: get => get('showDevTools')  },
    contactShadowPos: { value: [0.086,-0.15,0], render: get => get('showDevTools') },
    wallSize: { value: 2, min: 0.01, max: 3, render: get => get('showDevTools')  },
    idleDelaySeconds: { value: 3, min: 0, max: 20, step: 0.5, render: get => get('showDevTools') },
    idleRotateSpeed: { value: 0.15, min: 0.05, max: 3, step: 0.05, render: get => get('showDevTools') },
    idleRampSeconds: { value: 5, min: 0.2, max: 12, step: 0.1, render: get => get('showDevTools') }
  }))

  const { width, height, depth, dividers, shelves, edgeOffset, slotOffset, material, showProps, showDims, showDevTools, paintedMetal_Colour, x1, x2, y1, y2, lightPos, lightTarget, intensity, mapSize, near, far, contactShadowPos, wallSize, idleDelaySeconds, idleRotateSpeed, idleRampSeconds } = controls

  const panelSpecs = useMemo(() => (
    generatePanelSpecs({
      width,
      height,
      depth,
      dividers,
      shelves,
      edgeOffset,
      slotOffset,
      materialThickness,
    })
  ), [width, height, depth, dividers, shelves, edgeOffset, slotOffset, materialThickness])

  const panelMeshes = useMemo(() => (
    panelSpecs.map((panelSpec) => ({
      panelSpec,
      ...createExtrudedPanelGeometry(panelSpec),
    }))
  ), [panelSpecs])

  const panelLayoutMetrics = useMemo(() => {
    if (panelSpecs.length === 0) {
      return {
        center: new THREE.Vector3(),
        explodeDistance: 0.12,
      }
    }

    const center = panelSpecs.reduce((accumulator, panelSpec) => {
      return accumulator.add(toVector3(panelSpec.center))
    }, new THREE.Vector3()).multiplyScalar(1 / panelSpecs.length)

    let maxRadius = 0
    panelSpecs.forEach((panelSpec) => {
      const panelCenter = toVector3(panelSpec.center)
      const radius = panelCenter.distanceTo(center) + (Math.max(panelSpec.width, panelSpec.height) * 0.5)
      if (radius > maxRadius) maxRadius = radius
    })

    return {
      center,
      explodeDistance: Math.max(0.08, maxRadius * 0.55),
    }
  }, [panelSpecs])

  useEffect(() => {
    return () => {
      panelMeshes.forEach(({ geometry }) => geometry.dispose())
    }
  }, [panelMeshes])

  useEffect(() => {
    if (lightRef.current) {
      // Point the light's target at the mesh
      // lightRef.current.target = Bounding.current.position
      lightRef.current.position.set(lightPos[0], lightPos[1], lightPos[2])
      lightRef.current.target.position.set(lightTarget[0], lightTarget[1], lightTarget[2])
      lightRef.current.intensity = intensity * 100
      lightRef.current.updateMatrixWorld()
      lightRef.current.target.updateMatrixWorld()
      // console.log("Light Position:", lightRef.current.position);
    }
  }, [])

  // useHelper(lightRef, THREE.SpotLightHelper, '#ff000043')

  useEffect(() => {
    let timeoutId = null
    let idleId = null

    const enableEnhancedAssets = () => {
      timeoutId = setTimeout(() => setEnhancedAssetsReady(true), 120)
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(enableEnhancedAssets, { timeout: 800 })
    } else {
      enableEnhancedAssets()
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [])

  // Memo-ise noise texture with proper dependency array
  const noiseTexture = useMemo(() => {
    if (!enhancedAssetsReady) return null

    const noiseResolution = 1024
    const noiseCanvas = GeneratePerlinNoiseTexture(noiseResolution, noiseResolution, x1, y1, x2, y2)
    const tex = new THREE.CanvasTexture(noiseCanvas)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    return tex
  }, [enhancedAssetsReady, x1, y1, x2, y2, gl])

  // Update mat_PBR roughness map when texture changes
  useMemo(() => {
    if (mat_PBR && noiseTexture) mat_PBR.roughnessMap = noiseTexture
  }, [noiseTexture, mat_PBR])
  
  // Update mat_PaintedMetal roughness map when texture changes
  useMemo(() => {
    if (mat_PaintedMetal && noiseTexture) {
      mat_PaintedMetal.roughnessMap = noiseTexture
      // mat_PaintedMetal.normalMap = noiseTexture
      mat_PaintedMetal.bumpMap = noiseTexture
      mat_PaintedMetal.color = new THREE.Color(controls.paintedMetal_Colour)
    }
  }, [noiseTexture, mat_PaintedMetal, controls.paintedMetal_Colour])

  const publicMaterialMap = useMemo(() => ({
    PBR: mat_PBR,
    Chrome: mat_Chrome,
    Painted: mat_PaintedMetal,
    MATCAP: mat_MATCAP,
    Wireframe: mat_Wireframe,
    UVDebug: mat_UVDebug,
  }), [mat_PBR, mat_Chrome, mat_PaintedMetal, mat_MATCAP, mat_Wireframe, mat_UVDebug])

  useEffect(() => {
    if (!mat_UVDebug) return
    mat_UVDebug.map = uvDebugTexture
    mat_UVDebug.needsUpdate = true
  }, [uvDebugTexture, mat_UVDebug])

  useEffect(() => {
    return () => {
      if (uvDebugTexture) uvDebugTexture.dispose()
    }
  }, [uvDebugTexture])

  const selectedSceneMaterial = selectedMaterialKey
    ? publicMaterialMap[selectedMaterialKey] || material
    : material

  const activeMaterial = selectedSceneMaterial || mat_Placeholder

  useEffect(() => {
    ;[mat_PBR, mat_Chrome, mat_PaintedMetal, mat_MATCAP, mat_Wireframe, mat_UVDebug].forEach((candidateMaterial) => {
      candidateMaterial.transparent = true
      candidateMaterial.depthWrite = false
      candidateMaterial.opacity = 0
      candidateMaterial.needsUpdate = true
    })
  }, [mat_PBR, mat_Chrome, mat_PaintedMetal, mat_MATCAP, mat_Wireframe, mat_UVDebug])

  // Memo-ise geometries to avoid recreating them every render
  const geometries = useMemo(() => ({
    boxMain: new THREE.BoxGeometry(startDims.x, startDims.y, startDims.z),
  }), [])

  const { boxMain } = geometries

  useEffect(() => {
    if (!hasReportedInitialVisible.current && panelSpecs.length > 0) {
      hasReportedInitialVisible.current = true
      onInitialObjectVisible()
    }
  }, [panelSpecs, onInitialObjectVisible])

  useLayoutEffect(() => {
    let rafId = null
    let attempts = 0
    let successfulFits = 0
    const maxAttempts = 30

    const fitOnLoad = () => {
      attempts += 1

      if (FurnitureGroup.current && OrbitRef.current) {
        const box = new THREE.Box3().setFromObject(FurnitureGroup.current)

        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const controls = OrbitRef.current
          const camera = controls.object
          const maxDim = Math.max(size.x, size.y, size.z)
          const fov = THREE.MathUtils.degToRad(camera.fov)
          const fitDistance = (maxDim / (2 * Math.tan(fov / 2))) * 1.25

          camera.position.set(center.x, center.y, center.z + fitDistance)
          controls.target.copy(center)
          controls.update()

          camera.near = 0.001
          camera.far = 500
          camera.updateProjectionMatrix()

          successfulFits += 1
        }
      }

      if (attempts < maxAttempts && successfulFits < 3) {
        rafId = requestAnimationFrame(fitOnLoad)
      }
    }

    rafId = requestAnimationFrame(fitOnLoad)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  useEffect(() => {
    if (!OrbitRef.current) return

    const orbit = OrbitRef.current

    const handleStart = () => {
      isUserInteractingRef.current = true
      lastInteractionAtRef.current = Date.now()
    }

    const handleEnd = () => {
      isUserInteractingRef.current = false
      lastInteractionAtRef.current = Date.now()
    }

    const handleChange = () => {
      if (isUserInteractingRef.current) {
        lastInteractionAtRef.current = Date.now()
      }
    }

    orbit.addEventListener('start', handleStart)
    orbit.addEventListener('end', handleEnd)
    orbit.addEventListener('change', handleChange)

    return () => {
      orbit.removeEventListener('start', handleStart)
      orbit.removeEventListener('end', handleEnd)
      orbit.removeEventListener('change', handleChange)
    }
  }, [])

  useFrame((_, delta) => {
    if (OrbitRef.current) {
      const idleForMs = Date.now() - lastInteractionAtRef.current
      const shouldAutoRotate = !isUserInteractingRef.current && idleForMs >= idleDelaySeconds * 1000
      const targetSpeed = shouldAutoRotate ? idleRotateSpeed : 0
      const rampSeconds = Math.max(0.2, idleRampSeconds)
      const smoothingLambda = 4.6 / rampSeconds
      const easingFactor = 1 - Math.exp(-delta * smoothingLambda)

      currentAutoRotateSpeedRef.current = THREE.MathUtils.lerp(
        currentAutoRotateSpeedRef.current,
        targetSpeed,
        easingFactor,
      )

      const hasIdleSpin = currentAutoRotateSpeedRef.current > 0.005
      OrbitRef.current.autoRotate = hasIdleSpin
      OrbitRef.current.autoRotateSpeed = currentAutoRotateSpeedRef.current
    }

    const introCap = enhancedAssetsReady ? 1 : 0.86
    const introBlend = 1 - Math.exp(-delta * 2.6)
    introProgressRef.current = THREE.MathUtils.lerp(introProgressRef.current, introCap, introBlend)
    const introT = THREE.MathUtils.clamp(introProgressRef.current, 0, 1)
    const positionT = easeOutCubic(introT)
    const scaleT = THREE.MathUtils.clamp(easeOutBack(introT), 0, 1.12)

    const targetFade = enhancedAssetsReady ? 1 : 0
    const fadeBlend = 1 - Math.exp(-delta * 3.2)
    materialFadeRef.current = THREE.MathUtils.lerp(materialFadeRef.current, targetFade, fadeBlend)
    const materialFade = THREE.MathUtils.clamp(materialFadeRef.current, 0, 1)

    ;[mat_PBR, mat_Chrome, mat_PaintedMetal, mat_MATCAP, mat_Wireframe, mat_UVDebug].forEach((candidateMaterial) => {
      candidateMaterial.opacity = materialFade
      candidateMaterial.depthWrite = materialFade > 0.98
    })

    const { center: layoutCenter, explodeDistance } = panelLayoutMetrics
    panelMeshRefs.current.forEach((mesh, panelId) => {
      const targetMeta = panelMeshTargetsRef.current.get(panelId)
      if (!mesh || !targetMeta) return

      const { targetPosition, seed } = targetMeta
      const direction = targetPosition.clone().sub(layoutCenter)
      if (direction.lengthSq() < 1e-6) {
        direction.set(
          THREE.MathUtils.mapLinear((seed % 97), 0, 96, -0.55, 0.55),
          THREE.MathUtils.mapLinear((seed % 89), 0, 88, -0.25, 0.4),
          THREE.MathUtils.mapLinear((seed % 83), 0, 82, -0.55, 0.55),
        )
      }
      direction.normalize()
      const startPosition = targetPosition.clone().add(direction.multiplyScalar(explodeDistance))

      mesh.position.lerpVectors(startPosition, targetPosition, positionT)
      mesh.scale.setScalar(THREE.MathUtils.clamp(scaleT, 0.001, 1.06))
    })

    {/* PARAMETRIC LOGIC */}
    if (Bounding.current && showDevTools===true) {
      Bounding.current.scale.x = THREE.MathUtils.lerp(Bounding.current.scale.x, width / startDims.x, 0.1)
      Bounding.current.scale.y = THREE.MathUtils.lerp(Bounding.current.scale.y, height / startDims.y, 0.1)
      Bounding.current.scale.z = THREE.MathUtils.lerp(Bounding.current.scale.z, depth / startDims.z, 0.1)
    }
  })

  return (
    <group dispose={null}>
      <group name="DevToolGroup">
        {/* THE BOUNDING BOX */}
        <mesh  ref={Bounding} visible={showDevTools} geometry={boxMain} material={mat_Dev_Wireframe} />
        {/* <CrossMarker position={Bounding.current?.position || new THREE.Vector3()} /> */}
        {/* <CrossMarker position={[0,0,0]}/> */}
      </group>
    
      <group name="FurnitureGroup" ref={FurnitureGroup}>
        {/* PARAMETRIC LOGIC */}

        {panelMeshes.map(({ panelSpec, geometry, vectorLoops }) => (
          <mesh
            key={panelSpec.id}
            ref={(node) => {
              if (node) {
                panelMeshRefs.current.set(panelSpec.id, node)
                panelMeshTargetsRef.current.set(panelSpec.id, {
                  targetPosition: toVector3(panelSpec.center),
                  seed: panelIdSeed(panelSpec.id),
                })
              } else {
                panelMeshRefs.current.delete(panelSpec.id)
                panelMeshTargetsRef.current.delete(panelSpec.id)
              }
            }}
            name={`Panel_${panelSpec.id}`}
            castShadow={true}
            receiveShadow={true}
            position={panelSpec.center}
            rotation={panelSpec.rotation}
            geometry={geometry}
            material={activeMaterial}
            userData={{
              panelId: panelSpec.id,
              panelKind: panelSpec.kind,
              panelPlane: panelSpec.plane,
              panelWidth: panelSpec.width,
              panelHeight: panelSpec.height,
              panelThickness: panelSpec.thickness,
              vectorLoops,
            }}
          />
        ))}
      </group>

      <group name="DimensionsGroup" ref={Dimensions} visible={showDims}>
        {/* Width Label - OVERALL*/}
        <PlaneDimensionLine 
          start={[-width/2, height / 2, -depth / 2]} 
          end={[width/2, height / 2, -depth / 2]} 
          label={width}
          setDimension={(v) => setControls({ width: v })}
          dimensionGap={0.025}
          anchorGap={0.005}
          fontSize={0.01}
        />
        {/* Height Label - OVERALL*/}
        <PlaneDimensionLine 
          start={[width/2, -height / 2, -depth / 2]} 
          end={[width/2, height / 2, -depth / 2]} 
          label={height}
          setDimension={(v) => setControls({ height: v })}
          dimensionGap={0.025}
          anchorGap={0.005}
          fontSize={0.01}
        />
        {/* Depth Label - OVERALL*/}
        <PlaneDimensionLine 
          start={[width/2, -height / 2, depth / 2]} 
          end={[width/2, -height / 2, -depth / 2]} 
          label={depth}
          setDimension={(v) => setControls({ depth: v })}
          dimensionGap={0.025}
          anchorGap={0.005}
          fontSize={0.01}
        />
      </group>

      {/* Props Instance */}
      {enhancedAssetsReady && (
        <Suspense fallback={null}>
          <group name="PropsGroup" visible={showProps} position={[0, 0, 0]} scale={0.1}>
            <LazyProps 
              vasePos={[(width*10)/2 - 1, (height*10)/2, 0]}
              cylinder004Pos={[-(width*10)/2 + 1, -(height*10)/2, 0]}
              cylinder003Pos={[-(width*10)/2 + 1, -(height*10)/2 + materialThickness, 0]}
              // cylinder001Pos={[-(width*10)/2 + 3, (height*10)/2, 0]}
              // cube008Pos={[(width*10)/2 + 1.5, (height*10)/2, 0]}
              // cube004Pos={[-(width*10)/2 + 3, -(height*10)/2, 0]}
              // cube004_1Pos={[-(width*10)/2 + 2, -(height*10)/2, 0]}
              // cube003Pos={[-(width*10)/2 + 2.5, (height*10)/2, 0]}
              // cube003_1Pos={[-(width*10)/2 + 1, (height*10)/2, 0]}
            />
          </group>
        </Suspense>
      )}

      <group name="SceneGroup">
        <OrbitControls ref={OrbitRef} makeDefault minDistance={0.01}/>
        
        {/* <mesh name="wall" geometry={new THREE.PlaneGeometry(wallSize, wallSize)} material={mat_Shadow} rotation={[0, 0, 0]} position={[0, contactShadowPos[1] + (wallSize/2), -depth/2]} receiveShadow={true} castShadow={false}/>
        <mesh name="floor" geometry={new THREE.PlaneGeometry(wallSize, wallSize)} material={mat_Shadow} rotation={[-(Math.PI/2), 0, 0]} position={new THREE.Vector3(0, contactShadowPos[1]-0.001, (wallSize/2) - depth/2)} receiveShadow={true} castShadow={false}/> */}

        {/* <directionalLight 
          ref={lightRef} 
          position={lightPos} 
          target-position={lightTarget}
          // rotation={[10,0.1,0]}
          intensity={intensity * 1000} 
        /> */}
        <spotLight //spotlight 1 main
          castShadow={true}
          shadow-mapSize={[mapSize, mapSize]}
          shadow-camera-near={near}
          shadow-camera-far={far}
          shadow-radius={60}
          shadow-bias={-0.0005}
          shadow-normalBias={0.0005}
          ref={lightRef} 
          position={lightPos} 
          target-position={lightTarget}
          intensity={intensity * 100}
          angle={Math.PI / 8}
          penumbra={1}
          decay={2}
          distance={2}
          color={"#fee7c2"}
        />
        <ContactShadows 
          position={new THREE.Vector3(contactShadowPos[0], contactShadowPos[1], contactShadowPos[2])}
          opacity={0.2} 
          scale={1} 
          blur={3} 
          far={10} 
        />
        {/* <CrossMarker position={lightTarget} color="red" /> */}
      </group>
    </group>
  )
}

//NOTES

    // console.log(leftGroupRef.current.position);
    // print("test"); //INTERESTING: PRINTS SCREENSHOT OF PAGE

    // Move the accessories on the left and right sides
    // const sideOffset = (width-startDims.x)/2
    // leftGroupRef.current.position.x = THREE.MathUtils.lerp(leftGroupRef.current.position.x, -sideOffset, 0.1)
    // rightGroupRef.current.position.x = THREE.MathUtils.lerp(rightGroupRef.current.position.x, sideOffset, 0.1)

      {/* LEFT SIDE ACCESSORIES (Stay on the left edge) */}
      // <group ref={leftGroupRef}>
      // </group>

      {/* RIGHT SIDE ACCESSORIES (Stay on the right edge) */}
      // <group ref={rightGroupRef}>
      // </group>

      {/* CENTER PIECES (Stay in the middle) */}
      // <group visible={showProps}>
      // </group>