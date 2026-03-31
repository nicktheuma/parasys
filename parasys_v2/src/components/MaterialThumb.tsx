import { Suspense, useMemo } from 'react'

function fnv1a(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}
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

  const canvasKey = useMemo(() => {
    const sig = shader != null ? JSON.stringify(shader) : ''
    return `${colorHex}:${fnv1a(sig)}`
  }, [shader, colorHex])

  return (
    <Canvas
      key={canvasKey}
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
