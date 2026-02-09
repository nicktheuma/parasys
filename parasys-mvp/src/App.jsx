import { Canvas } from '@react-three/fiber'
import { Stage, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Suspense } from 'react'
import { Experience } from './Experience'
import { Environment } from '@react-three/drei'
import { EffectComposer, DepthOfField } from '@react-three/postprocessing'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#efefef' }}>
      <Canvas shadows dpr={[1, 2]} alpha='true'>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 1.5, 4]} fov={60} />
          {/* Stage handles professional lighting and shadows automatically */}
          <Stage intensity={0.5} environment="studio" shadows="contact" adjustCamera={true} contactShadow={{ blur: 2, opacity: 0.1, far: 10, scale:20, position:[0,0,0] }}>
              <Environment 
                files='public/monochrome_studio_02_1k.hdr' 
                blur={0.8} // Blurs the background so focus stays on the furniture
              />
            <Experience />
          </Stage>
          <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
        </Suspense>
          {/* <EffectComposer>
            <DepthOfField 
              focusDistance={0.02} 
              focalLength={0.02} 
              bokehScale={2} 
              height={2000}
              width={2000}
            />
          </EffectComposer> */}
      </Canvas>
    </div>
  )
}
export default App