import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { LayeredShaderMaterial } from '@/features/configurator/LayeredShaderMaterial'
import type { MaterialShaderSpec } from '@/lib/materialShader'
import { defaultMaterialShader } from '@shared/materialDefaults'

type Props = {
  shader: MaterialShaderSpec | null
  colorHex: string
  size?: number
  interactive?: boolean
}

export function MaterialThumb({ shader, colorHex, size = 48, interactive = false }: Props) {
  const spec = useMemo(
    () => shader ?? defaultMaterialShader(colorHex),
    [shader, colorHex],
  )

  return (
    <Canvas
      frameloop={interactive ? 'always' : 'demand'}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 2.4], fov: 26 }}
      style={{
        width: size,
        height: size,
        display: 'block',
        flexShrink: 0,
        borderRadius: 6,
        cursor: interactive ? 'grab' : 'default',
      }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[2, 3, 2]} intensity={1.5} />
      <Suspense fallback={null}>
        <mesh>
          <sphereGeometry args={[0.92, 48, 48]} />
          <LayeredShaderMaterial spec={spec} />
        </mesh>
        <Environment files="/monochrome_studio_02_1k.hdr" />
        {interactive ? <OrbitControls enableZoom={false} enablePan={false} /> : null}
      </Suspense>
    </Canvas>
  )
}
