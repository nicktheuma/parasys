import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Stage, OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei'
import { Suspense, useEffect, useLayoutEffect, useState } from 'react'
// import { EffectComposer, DepthOfField } from "@react-three/postprocessing";
import { Experience } from './Experience'
import { downloadScene } from './SceneDownloader';
import { useSceneStore } from './useSceneStore';
import { Leva } from 'leva'
import './App.css'
import { CrossMarker } from './CrossMarker'

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

// Component to log and use scene & camera
function SceneInspector() {
  const { scene, camera, gl } = useThree();

  useEffect(() => {
    // console.log('Scene:', scene);
    // console.log('Camera:', camera);
    // console.log('Renderer:', gl);

    // Example: Change background color
    // scene.background = new THREE.Color(0x000000);

    // Adjust camera position
    camera.position.set(-0.09, -0.5, 0.3); //X(LEFT&RIGHT), Y(UP&DOWN), Z(FORWARD&BACKWARD)
    camera.lookAt(0, 0, 0);
  }, [scene, camera, gl]);

  return null; // This component doesn't render anything
}

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
    <div style={{ width: '100vw', height: '100vh', background: 'var(--background-color)' }}>
      <Canvas shadows gl={{ antialias: true }} dpr={[1, 1]}>
        <SceneSync /> 
        <Suspense fallback={null}>
          {/* Stage handles professional lighting and shadows automatically */}
            <Stage 
                intensity={1}
                preset="rembrandt"
                shadows={{ type:'contact',  color:'black', blur: 2.5, opacity: 1, offset:0, bias:-0.0001, normalBias:0, size:2048}}
                adjustCamera={0}
                environment={null}>
              <Experience />
              <SceneInspector />
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
      <DownloadButton />
      <Leva hidden={levaVisible} />
    </div>
  )}  
export default App