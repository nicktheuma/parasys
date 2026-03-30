import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls, Stage } from '@react-three/drei'
import { Suspense } from 'react'
import * as THREE from 'three'
import { TemplateProduct } from '@/features/configurator/TemplateProduct'
import { useConfiguratorStore } from '@/stores/configuratorStore'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'
import { DimensionsOverlay3D } from './DimensionsOverlay3D'
import styles from '@/routes/configuratorPublic.module.css'

const CONTACT_SHADOW_POS: [number, number, number] = [0.086, -0.15, 0]

export function ConfiguratorCanvas() {
  const { templateKey, driven, materialSpec, materialId, templateParamOverrides } =
    useConfiguratorStore()

  const stageKey = `${templateKey}-${materialId ?? 'none'}`

  return (
    <div className={styles.canvasWrap}>
      <CanvasErrorBoundary>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]}
        camera={{ position: [0.35, 0.2, 0.35], near: 0.002, far: 10 }}
      >
        <Suspense fallback={null}>
          <Stage
            key={stageKey}
            intensity={1.2}
            preset="rembrandt"
            shadows={{
              type: 'contact',
              color: 'black',
              blur: 2.5,
              opacity: 1,
              offset: 0,
              bias: -0.0001,
              normalBias: 0,
              size: 2048,
            }}
            adjustCamera={1.1}
            environment={null}
          >
            <TemplateProduct
              templateKey={templateKey}
              widthMm={driven.widthMm}
              depthMm={driven.depthMm}
              heightMm={driven.heightMm}
              materialSpec={materialSpec}
              templateParamOverrides={templateParamOverrides}
            />
            <DimensionsOverlay3D />
          </Stage>

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

          <ContactShadows
            position={CONTACT_SHADOW_POS}
            opacity={0.2}
            scale={1}
            blur={3}
            far={10}
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
