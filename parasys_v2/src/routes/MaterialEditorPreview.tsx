import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { Suspense } from 'react'
import { LayeredShaderMaterial } from '@/features/configurator/LayeredShaderMaterial'
import type { MaterialShaderSpec } from '@/lib/materialShader'
import styles from './materialEditorPreview.module.css'

export function MaterialEditorPreview({ spec }: { spec: MaterialShaderSpec }) {
  return (
    <div className={styles.wrap}>
      <Canvas
        className={styles.canvas}
        camera={{ position: [0, 0.1, 2.45], fov: 36 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }}
      >
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={0.42} />
        <directionalLight position={[2.2, 3.5, 2.4]} intensity={1.15} />
        <directionalLight position={[-2, 1, -1]} intensity={0.25} color="#a8c4ff" />
        <Suspense fallback={null}>
          <mesh castShadow>
            <sphereGeometry args={[0.92, 56, 56]} />
            <LayeredShaderMaterial spec={spec} />
          </mesh>
          <Environment files="/monochrome_studio_02_1k.hdr" />
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI - 0.2}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
