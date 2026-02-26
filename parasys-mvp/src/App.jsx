import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Stage, Environment } from '@react-three/drei'
import { Suspense, useEffect, useState } from 'react'
// import { EffectComposer, DepthOfField } from "@react-three/postprocessing";
import { Experience } from './Experience'
import { downloadScene, downloadNestedPdf, downloadNestedDxf } from './SceneDownloader';
import { useSceneStore } from './useSceneStore';
import { Leva } from 'leva'
import './App.css'

const APP_UI_STATE_KEY = 'parasys:ui-state:v1'

const readStoredUiState = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(APP_UI_STATE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Component to sync scene to store
const SceneSync = () => {
  const { scene, camera, gl } = useThree();
  const setScene = useSceneStore((state) => state.setScene);
  const setRenderContext = useSceneStore((state) => state.setRenderContext);
  
  useEffect(() => {
    setScene(scene);
    setRenderContext({ camera, renderer: gl });
  }, [scene, camera, gl, setScene, setRenderContext]);
  
  return null;
};

const MATERIAL_OPTIONS = [
  { key: 'Painted', label: 'Painted', thumbnailClass: 'material-thumb--painted' },
  { key: 'PBR', label: 'PBR', thumbnailClass: 'material-thumb--pbr' },
  { key: 'Chrome', label: 'Chrome', thumbnailClass: 'material-thumb--chrome' },
  { key: 'MATCAP', label: 'Matcap', thumbnailClass: 'material-thumb--matcap' },
  { key: 'Wireframe', label: 'Wireframe', thumbnailClass: 'material-thumb--wireframe' },
  { key: 'UVDebug', label: 'UV Debug', thumbnailClass: 'material-thumb--uvdebug' },
]

const PublicControls = ({ selectedMaterial, onMaterialChange, showDimensions, onToggleDimensions }) => {
  const scene = useSceneStore((state) => state.scene);

  return (
    <div className="public-controls" role="region" aria-label="Viewer controls">
      <div className="material-row" role="group" aria-label="Material choices">
        {MATERIAL_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onMaterialChange(option.key)}
            className={`material-tile ${selectedMaterial === option.key ? 'is-active' : ''}`}
          >
            <span className={`material-thumb ${option.thumbnailClass}`} aria-hidden="true" />
            <span className="material-label">{option.label}</span>
          </button>
        ))}
      </div>
      <div className="download-row" role="group" aria-label="Download options">
        <button
          type="button"
          onClick={() => downloadNestedPdf(scene, selectedMaterial, { pdfPageFormat: 'A4' })}
          className="public-button public-button--compact"
        >
          ⬇ PDF
        </button>
        <button
          type="button"
          onClick={() => downloadNestedDxf(scene, selectedMaterial)}
          className="public-button public-button--compact"
        >
          ⬇ DXF
        </button>
        <button
          type="button"
          onClick={() => downloadScene(scene)}
          className="public-button public-button--compact"
        >
          ⬇ 3D
        </button>
        <button
          type="button"
          onClick={onToggleDimensions}
          aria-pressed={showDimensions}
          className="public-button public-button--compact"
        >
          {showDimensions ? '👁 Dims On' : '🚫 Dims Off'}
        </button>
      </div>
    </div>
  );
};

const LoadingOverlay = ({ visible }) => {
  if (!visible) return null

  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-card">
        <div className="loading-spinner" />
        <p>Building...</p>
      </div>
    </div>
  )
}

function App() {
  const storedUiState = readStoredUiState()
  const [levaVisible, setLevaVisible] = useState(storedUiState?.levaVisible ?? true)
  const [isInitialObjectVisible, setIsInitialObjectVisible] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState(storedUiState?.selectedMaterial ?? 'Painted')
  const [showDimensions, setShowDimensions] = useState(storedUiState?.showDimensions ?? true)
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  const dprRange = isMobile ? [1, 1.5] : [1, 2]

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload = {
      levaVisible,
      selectedMaterial,
      showDimensions,
    }
    try {
      window.localStorage.setItem(APP_UI_STATE_KEY, JSON.stringify(payload))
    } catch {
      // ignore storage write failures
    }
  }, [levaVisible, selectedMaterial, showDimensions])
  
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.key) return
      if (e.key.toLowerCase() !== 'p') return
      const active = document.activeElement
      const tag = active?.tagName || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable) return
      setLevaVisible(v => !v)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100dvh', background: 'var(--background-color)' }}>
      <LoadingOverlay visible={!isInitialObjectVisible} />
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={dprRange}
        camera={{ position: [0.35, 0.2, 0.35] }}
        near={0.002}
        far={10}
      >
        <SceneSync /> 
        <Suspense fallback={null}>
          {/* Stage handles professional lighting and shadows automatically */}
            {/* PERPECTIVE CAMERA & ORBIT CONTROLS handled in Experience */}
            <Stage 
                intensity={1}
                preset="rembrandt"
                shadows={{ type:'contact',  color:'black', blur: 2.5, opacity: 1, offset:0, bias:-0.0001, normalBias:0, size:2048}}
                adjustCamera={0}
                environment={null}
                >
              <Experience
                selectedMaterialKey={selectedMaterial}
                publicShowDimensions={showDimensions}
                onInitialObjectVisible={() => setIsInitialObjectVisible(true)}
              />
            </Stage>
          <Environment 
            files='monochrome_studio_02_1k.hdr' 
            blur={0.6} // Blurs the background so focus stays on the furniture
            // background
          />
        </Suspense>
          {/* <EffectComposer>
            <DepthOfField 
              focusDistance={0.02} 
              focalLength={0.02} remove
              bokehScale={2} 
              height={2000}
              width={2000}
            />
          </EffectComposer> */}
      </Canvas>
      <PublicControls
        selectedMaterial={selectedMaterial}
        onMaterialChange={setSelectedMaterial}
        showDimensions={showDimensions}
        onToggleDimensions={() => setShowDimensions((value) => !value)}
      />
      <Leva hidden={levaVisible} />
    </div>
  )}  
export default App