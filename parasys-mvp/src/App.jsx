import { Canvas } from '@react-three/fiber'
import { Stage, OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei'
import { Suspense, useEffect, useState } from 'react'
import { Experience } from './Experience'
import { useThree } from '@react-three/fiber';
import { downloadScene } from './SceneDownloader';
import { useSceneStore } from './useSceneStore';
import { Leva } from 'leva'
import './App.css'

// Component to sync scene to store
const SceneSync = () => {
  const { scene } = useThree();
  const setScene = useSceneStore((state) => state.setScene);
  
  useEffect(() => {
    setScene(scene);
  }, [scene, setScene]);
  
  return null;
};

// Button rendered outside Canvas
const DownloadButton = () => {
  const scene = useSceneStore((state) => state.scene);

  return (
    <button 
      onClick={() => downloadScene(scene)}
      className="button"
    >
      Download 3D Model
    </button>
  );
};

function App() {
  const [levaVisible, setLevaVisible] = useState(true)

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
    <div style={{ width: '100vw', height: '100vh', background: '#ebebeb' }}>
      <Canvas shadows gl={{ antialias: true }} dpr={[1, 1]}>
        <SceneSync />
        <Suspense fallback={null}>
          <PerspectiveCamera fov={45} />
          {/* Stage handles professional lighting and shadows automatically */}
          <Stage 
              intensity={1}
              preset="rembrandt"
              shadows={{ type: 'contact',  color:'black', blur: 2.5, opacity: 1, offset:0, bias:-0.0001, normalBias:0, size:2048}}
              adjustCamera={1}
              environment={null}>
             <Experience />
          </Stage>
          <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
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
      <DownloadButton />
      <Leva hidden={levaVisible} />
    </div>
  )}  
export default App