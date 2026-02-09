import { Canvas } from '@react-three/fiber'
import { Stage, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Suspense } from 'react'
import { Experience } from './Experience'
import { Environment } from '@react-three/drei'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#efefef' }}>
      <Canvas shadows dpr={[1, 2]}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 1.5, 4]} fov={45} />
          {/* Stage handles professional lighting and shadows automatically */}
          <Stage intensity={0.5} environment="studio" shadows="contact" adjustCamera={false} contactShadow={{ blur: 2, opacity: 0 }}>
             <Experience />
          </Stage>
          <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
          <Environment 
            files='public/monochrome_studio_02_1k.hdr' 
            blur={0.8} // Blurs the background so focus stays on the furniture
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
export default App