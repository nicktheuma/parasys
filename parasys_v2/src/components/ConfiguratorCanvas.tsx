import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { Suspense } from 'react'
import * as THREE from 'three'
import { useConfiguratorStore } from '@/stores/configuratorStore'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'
import { ConfiguratorStageContent } from './ConfiguratorStageContent'
import styles from '@/routes/configuratorPublic.module.css'

export function ConfiguratorCanvas({ adminMode }: { adminMode?: boolean }) {
  const { templateKey, driven, materialSpec, materialId, templateParamOverrides, uvMappings } =
    useConfiguratorStore()

  const stageKey = adminMode ? templateKey : `${templateKey}-${materialId ?? 'none'}`

  return (
    <div className={`${styles.canvasWrap} ${adminMode ? styles.canvasWrapAdmin : ''}`}>
      <CanvasErrorBoundary>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]}
        camera={{ position: [0.35, 0.2, 0.35], near: 0.002, far: 10 }}
      >
        <Suspense fallback={null}>
          <ConfiguratorStageContent
            stageKey={stageKey}
            adminMode={adminMode}
            templateKey={templateKey}
            widthMm={driven.widthMm}
            depthMm={driven.depthMm}
            heightMm={driven.heightMm}
            materialSpec={materialSpec}
            materialId={materialId}
            templateParamOverrides={templateParamOverrides}
            uvMappings={uvMappings}
          />

          {/* Three-point studio lighting */}
          <directionalLight
            castShadow
            position={[3, 4, 2]}
            intensity={1.8}
            color="#fff5e6"
            shadow-mapSize={[1024, 1024]}
            shadow-camera-near={0.1}
            shadow-camera-far={10}
            shadow-bias={-0.0005}
          />
          <directionalLight
            position={[-2, 2, 3]}
            intensity={0.6}
            color="#e6f0ff"
          />
          <directionalLight
            position={[0, 3, -3]}
            intensity={0.8}
            color="#ffffff"
          />

          <Environment
            files="/monochrome_studio_02_1k.hdr"
            blur={0.6}
          />

          <OrbitControls
            makeDefault
            minDistance={0.01}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2 - 0.05}
          />
        </Suspense>
      </Canvas>
      </CanvasErrorBoundary>
    </div>
  )
}
