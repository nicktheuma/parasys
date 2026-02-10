import { Canvas } from '@react-three/fiber'
import { Stage, OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei'
import { Suspense } from 'react'
import { Experience } from './Experience'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#efefef' }}>
      <Canvas shadows gl={{ antialias: false }} dpr={[1, 1]}>
        <Suspense fallback={null}>
          <PerspectiveCamera fov={30} />
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
            files='monochrome_studio_02_4k.hdr' 
            blur={0.6} // Blurs the background so focus stays on the furniture
            background
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
export default App