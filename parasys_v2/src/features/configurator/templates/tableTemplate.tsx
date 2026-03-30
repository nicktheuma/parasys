import { LayeredShaderMaterial } from '../LayeredShaderMaterial'
import type { TemplateProps } from './types'

export function TableTemplate({ wm, hm, dm, materialSpec }: TemplateProps) {
  const legW = wm * 0.06
  const legD = dm * 0.06
  const topT = Math.min(0.04, hm * 0.08)
  const legH = hm - topT
  const ox = wm / 2 - legW * 1.2
  const oz = dm / 2 - legD * 1.2
  return (
    <group>
      <mesh position={[0, hm / 2 - topT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wm, topT, dm]} />
        <LayeredShaderMaterial spec={materialSpec} />
      </mesh>
      {(
        [
          [-ox, -oz],
          [ox, -oz],
          [-ox, oz],
          [ox, oz],
        ] as const
      ).map(([x, z], i) => (
        <mesh key={i} position={[x, -legH / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[legW, legH, legD]} />
          <LayeredShaderMaterial spec={materialSpec} />
        </mesh>
      ))}
    </group>
  )
}
