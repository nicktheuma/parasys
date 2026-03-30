import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls, Stage } from '@react-three/drei'
import { TemplateProduct } from '@/features/configurator/TemplateProduct'
import { defaultMaterialSpec } from '@/lib/defaultMaterialSpec'
import { DIM_MM } from '@/lib/configuratorDimensions'

type Props = {
  templateKey: string
  defaultDims?: { widthMm?: number; depthMm?: number; heightMm?: number }
}

export function ConfiguratorThumbnail({ templateKey, defaultDims }: Props) {
  const w = defaultDims?.widthMm ?? DIM_MM.width.default
  const d = defaultDims?.depthMm ?? DIM_MM.depth.default
  const h = defaultDims?.heightMm ?? DIM_MM.height.default
  const matSpec = useMemo(() => defaultMaterialSpec('#c4a882'), [])

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      camera={{ position: [0.35, 0.2, 0.35], near: 0.002, far: 10 }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <Stage
          intensity={1}
          preset="rembrandt"
          adjustCamera={1.3}
          environment={null}
        >
          <TemplateProduct
            templateKey={templateKey}
            widthMm={w}
            depthMm={d}
            heightMm={h}
            materialSpec={matSpec}
          />
        </Stage>
        <Environment files="/monochrome_studio_02_1k.hdr" />
        <OrbitControls
          autoRotate
          autoRotateSpeed={2}
          enableZoom
          enablePan={false}
          minPolarAngle={0.4}
          maxPolarAngle={Math.PI / 2 - 0.1}
        />
      </Suspense>
    </Canvas>
  )
}
