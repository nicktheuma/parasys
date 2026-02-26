import * as THREE from 'three'
import { useControls } from 'leva'
import { useRef, useMemo, useEffect, useState, lazy } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

import { FurniturePanels } from './experience/components/FurniturePanels'
import { DimensionsOverlay } from './experience/components/DimensionsOverlay'
import { PropsGroup } from './experience/components/PropsGroup'
import { SceneGroup } from './experience/components/SceneGroup'
import {
  DIVIDER_MIN,
  DIVIDER_MAX,
  SHELF_MIN,
  SHELF_MAX,
  START_DIMS,
  MAX_DIMS,
  MATERIAL_THICKNESS,
  DEFAULT_MATERIAL_DEV_SETTINGS,
} from './experience/state/constants'
import { createControlsSchema } from './experience/state/createControlsSchema'
import { readStoredPanelState, persistPanelState } from './experience/state/panelStateStorage'
import { usePanelLayout } from './experience/hooks/usePanelLayout'
import { useConfiguredActiveMaterial } from './experience/hooks/useConfiguredActiveMaterial'
import { useOrbitAutoRotate } from './experience/hooks/useOrbitAutoRotate'
import { useFurnitureAnimation } from './experience/hooks/useFurnitureAnimation'
import { useFitCameraOnLoad } from './experience/hooks/useFitCameraOnLoad'
import { useSceneLightSetup } from './experience/hooks/useSceneLightSetup'

const LazyProps = lazy(() => import('./Props_1').then((module) => ({ default: module.Props_1 })))

const panelIdSeed = (panelId = '') => {
  let hash = 0
  for (let index = 0; index < panelId.length; index += 1) {
    hash = ((hash << 5) - hash) + panelId.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

export function Experience({ onInitialObjectVisible = () => {}, selectedMaterialKey = null, publicShowDimensions = true, onDevToolsVisibilityChange = () => {} }) {
  const { gl } = useThree()
  const [enhancedAssetsReady, setEnhancedAssetsReady] = useState(false)
  const [materialResetNonce, setMaterialResetNonce] = useState(0)
  const hasReportedInitialVisible = useRef(false)
  
  const Bounding = useRef()
  const FurnitureGroup = useRef()
  const OrbitRef = useRef()
  const lightRef = useRef()
  const panelMeshRefs = useRef(new Map())
  const panelMeshTargetsRef = useRef(new Map())

  const startDims = new THREE.Vector3(START_DIMS.x, START_DIMS.y, START_DIMS.z)
  const maxDims = new THREE.Vector3(MAX_DIMS.x, MAX_DIMS.y, MAX_DIMS.z)
  const materialThickness = MATERIAL_THICKNESS

  // Memoize materials to avoid recreating them every render
  const materials = useMemo(() => ({
    mat_Dev: new THREE.MeshStandardMaterial( {map: null, color: '#ff0000', roughness: 1, transparent: true, opacity: 0.3}),
    mat_Dev_Wireframe: new THREE.MeshMatcapMaterial( {map: null, color: '#ff0000', wireframe: true, wireframeLinewidth: 0.1}),
    mat_Placeholder: new THREE.MeshStandardMaterial( {map: null, color: '#c5ccd3', roughness: 0.9, metalness: 0.05}),
    mat_Wireframe: new THREE.MeshMatcapMaterial( {map: null, color: '#000000', wireframe: true, wireframeLinewidth: 0.01}),
    mat_UVDebug: new THREE.MeshBasicMaterial({ map: null, color: '#ffffff' }),
    mat_MATCAP: new THREE.MeshMatcapMaterial( {map: null, color: '#ffffff'}),
    mat_Brushed: new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0.3, metalness: 1}),
    mat_Chrome: new THREE.MeshStandardMaterial( {map: null, color: '#ffffff', roughness: 0.15, metalness: 1}),
    mat_PaintedMetal: new THREE.MeshStandardMaterial( {map: null, color: '#526982', roughness: 1, metalness: 0.2})
  }), [])

  const { mat_Dev, mat_Dev_Wireframe, mat_Placeholder, mat_Wireframe, mat_UVDebug, mat_MATCAP, mat_Brushed, mat_Chrome, mat_PaintedMetal } = materials

  const isDevMaterialVisible = (get, key) => {
    const activeKey = get('activeMaterialKey')

    return get('showDevTools') && activeKey === key
  }
  
  const [controls, setControls] = useControls(() => createControlsSchema({
    startDims,
    maxDims,
    selectedMaterialKey,
    materials: {
      mat_Brushed,
      mat_Chrome,
      mat_PaintedMetal,
      mat_MATCAP,
      mat_Wireframe,
      mat_UVDebug,
    },
    isDevMaterialVisible,
    onResetMaterialPresets: () => setMaterialResetNonce((value) => value + 1),
  }))

  const didHydrateControlsRef = useRef(false)

  useEffect(() => {
    if (didHydrateControlsRef.current) return
    didHydrateControlsRef.current = true
    const savedState = readStoredPanelState()
    if (!savedState || typeof savedState !== 'object') return
    setControls(savedState)
  }, [setControls])

  useEffect(() => {
    if (!selectedMaterialKey) return

    const selectedMaterialObject = {
      Brushed: mat_Brushed,
      PBR: mat_Brushed,
      Chrome: mat_Chrome,
      Painted: mat_PaintedMetal,
      MATCAP: mat_MATCAP,
      Wireframe: mat_Wireframe,
      UVDebug: mat_UVDebug,
    }[selectedMaterialKey]

    setControls({
      activeMaterialKey: selectedMaterialKey,
      ...(selectedMaterialObject ? { material: selectedMaterialObject } : {}),
    })
  }, [selectedMaterialKey, setControls, mat_Brushed, mat_Chrome, mat_PaintedMetal, mat_MATCAP, mat_Wireframe, mat_UVDebug])

  useEffect(() => {
    onDevToolsVisibilityChange(Boolean(controls?.showDevTools))
  }, [controls?.showDevTools, onDevToolsVisibilityChange])

  useEffect(() => {
    if (!didHydrateControlsRef.current) return
    persistPanelState(controls)
  }, [controls])

  useEffect(() => {
    if (materialResetNonce === 0) return
    setControls(DEFAULT_MATERIAL_DEV_SETTINGS)
  }, [materialResetNonce, setControls])

  const { width, height, depth, dividers, shelves, edgeOffset, slotOffset, interlockSlotsEnabled, interlockSlotClearance, interlockSlotLengthFactor, bevelEnabled, bevelSize, bevelThickness, bevelSegments, showProps, showDevTools, lightPos, lightTarget, intensity, mapSize, near, far, ui3dDimsScaleMin, ui3dDimsScaleMax, ui3dButtonsScaleMin, ui3dButtonsScaleMax, contactShadowPos, idleDelaySeconds, idleRotateSpeed, idleRampSeconds } = controls
  const furnitureUiScale = useMemo(() => {
    const maxFurnitureDimension = Math.max(width, height, depth)
    return THREE.MathUtils.clamp(maxFurnitureDimension / 0.55, 0.75, 2.2)
  }, [width, height, depth])
  const uiScaleClampDims = useMemo(() => {
    const minValue = Math.max(0.1, ui3dDimsScaleMin)
    const maxValue = Math.max(minValue + 0.05, ui3dDimsScaleMax)
    return { min: minValue, max: maxValue }
  }, [ui3dDimsScaleMin, ui3dDimsScaleMax])

  const uiScaleClampButtons = useMemo(() => {
    const minValue = Math.max(0.1, ui3dButtonsScaleMin)
    const maxValue = Math.max(minValue + 0.05, ui3dButtonsScaleMax)
    return { min: minValue, max: maxValue }
  }, [ui3dButtonsScaleMin, ui3dButtonsScaleMax])

  const {
    panelSpecs,
    panelMeshes,
    panelLayoutMetrics,
    dividerControlAnchors,
    shelfControlAnchors,
    toVector3,
  } = usePanelLayout({
    width,
    height,
    depth,
    dividers,
    shelves,
    edgeOffset,
    slotOffset,
    materialThickness,
    bevelEnabled,
    bevelSize,
    bevelThickness,
    bevelSegments,
    interlockSlotsEnabled,
    interlockSlotClearance,
    interlockSlotLengthFactor,
  })

  useEffect(() => {
    return () => {
      panelMeshes.forEach(({ geometry }) => geometry.dispose())
    }
  }, [panelMeshes])

  useSceneLightSetup({
    lightRef,
    lightPos,
    lightTarget,
    intensity,
  })

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

  const { activeMaterial } = useConfiguredActiveMaterial({
    materials: {
      mat_Placeholder,
      mat_Brushed,
      mat_Chrome,
      mat_PaintedMetal,
      mat_MATCAP,
      mat_Wireframe,
      mat_UVDebug,
    },
    controls,
    selectedMaterialKey,
    enhancedAssetsReady,
    gl,
  })

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

  useFitCameraOnLoad({
    furnitureGroupRef: FurnitureGroup,
    orbitRef: OrbitRef,
  })

  const fadeMaterials = useMemo(() => ([
    mat_Brushed,
    mat_Chrome,
    mat_PaintedMetal,
    mat_MATCAP,
    mat_Wireframe,
    mat_UVDebug,
  ]), [mat_Brushed, mat_Chrome, mat_PaintedMetal, mat_MATCAP, mat_Wireframe, mat_UVDebug])

  const { animateOrbit } = useOrbitAutoRotate({
    orbitRef: OrbitRef,
    idleDelaySeconds,
    idleRotateSpeed,
    idleRampSeconds,
  })

  const { animateFurniture } = useFurnitureAnimation({
    dividers,
    shelves,
    panelLayoutMetrics,
    panelMeshRefs,
    panelMeshTargetsRef,
    fadeMaterials,
    enhancedAssetsReady,
    boundingRef: Bounding,
    showDevTools,
    width,
    height,
    depth,
    startDims,
  })

  useFrame((_, delta) => {
    animateOrbit(delta)
    animateFurniture(delta)
  })

  return (
    <group dispose={null}>
      <group name="DevToolGroup">
        {/* THE BOUNDING BOX */}
        <mesh  ref={Bounding} visible={showDevTools} geometry={boxMain} material={mat_Dev_Wireframe} />
        {/* <CrossMarker position={Bounding.current?.position || new THREE.Vector3()} /> */}
        {/* <CrossMarker position={[0,0,0]}/> */}
      </group>
    
      <FurniturePanels
        groupRef={FurnitureGroup}
        panelMeshes={panelMeshes}
        panelMeshRefs={panelMeshRefs}
        panelMeshTargetsRef={panelMeshTargetsRef}
        toVector3={toVector3}
        panelIdSeed={panelIdSeed}
        activeMaterial={activeMaterial}
      />

      <DimensionsOverlay
        visible={publicShowDimensions}
        dividerControlAnchors={dividerControlAnchors}
        shelfControlAnchors={shelfControlAnchors}
        furnitureUiScale={furnitureUiScale}
        uiScaleClampButtons={uiScaleClampButtons}
        uiScaleClampDims={uiScaleClampDims}
        dividers={dividers}
        shelves={shelves}
        dividerMin={DIVIDER_MIN}
        dividerMax={DIVIDER_MAX}
        shelfMin={SHELF_MIN}
        shelfMax={SHELF_MAX}
        width={width}
        height={height}
        depth={depth}
        setControls={setControls}
      />

      <PropsGroup
        visible={showProps}
        enhancedAssetsReady={enhancedAssetsReady}
        LazyProps={LazyProps}
        width={width}
        height={height}
        materialThickness={materialThickness}
      />

      <SceneGroup
        orbitRef={OrbitRef}
        lightRef={lightRef}
        lightPos={lightPos}
        lightTarget={lightTarget}
        intensity={intensity}
        mapSize={mapSize}
        near={near}
        far={far}
        contactShadowPos={contactShadowPos}
      />
    </group>
  )
}