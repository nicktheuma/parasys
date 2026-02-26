import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Stage, Environment } from '@react-three/drei'
import { Suspense, useEffect, useState } from 'react'
// import { EffectComposer, DepthOfField } from "@react-three/postprocessing";
import { Experience } from './Experience'
import { Leva } from 'leva'
import { SceneSync } from './ui/components/SceneSync'
import { LoadingOverlay } from './ui/components/LoadingOverlay'
import { PublicControls } from './ui/components/PublicControls'
import { MATERIAL_OPTIONS } from './ui/constants/materialOptions'
import { useAppUiStore } from './ui/state/useAppUiStore'
import './App.css'

function App() {
  const levaVisible = useAppUiStore((state) => state.levaVisible)
  const selectedMaterial = useAppUiStore((state) => state.selectedMaterial)
  const showDimensions = useAppUiStore((state) => state.showDimensions)
  const setSelectedMaterial = useAppUiStore((state) => state.setSelectedMaterial)
  const toggleShowDimensions = useAppUiStore((state) => state.toggleShowDimensions)
  const toggleLevaVisible = useAppUiStore((state) => state.toggleLevaVisible)
  const [isInitialObjectVisible, setIsInitialObjectVisible] = useState(false)
  const [showDevTools, setShowDevTools] = useState(false)
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  const dprRange = isMobile ? [1, 1.5] : [1, 2]

  useEffect(() => {
    if (showDevTools) return
    const selectedOption = MATERIAL_OPTIONS.find((option) => option.key === selectedMaterial)
    if (selectedOption?.devtoolsOnly) {
      setSelectedMaterial('Painted')
    }
  }, [showDevTools, selectedMaterial])
  
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.key) return
      if (e.key.toLowerCase() !== 'p') return
      const active = document.activeElement
      const tag = active?.tagName || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable) return
      toggleLevaVisible()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleLevaVisible])

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
                onDevToolsVisibilityChange={setShowDevTools}
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
        showDevTools={showDevTools}
        onToggleDimensions={toggleShowDimensions}
      />
      <Leva hidden={levaVisible} />
    </div>
  )}  
export default App