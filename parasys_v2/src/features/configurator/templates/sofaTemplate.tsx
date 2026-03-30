import { LayeredShaderMaterial } from '../LayeredShaderMaterial'
import type { TemplateProps } from './types'

export function SofaTemplate({ wm, hm, dm, materialSpec }: TemplateProps) {
  const seatH = hm * 0.38
  const backH = hm - seatH
  return (
    <group>
      <mesh position={[0, -hm / 2 + seatH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wm * 0.98, seatH, dm * 0.98]} />
        <LayeredShaderMaterial spec={materialSpec} />
      </mesh>
      <mesh position={[0, seatH / 2 + backH / 2, -dm / 2 + backH * 0.35]} castShadow receiveShadow>
        <boxGeometry args={[wm * 0.98, backH, dm * 0.35]} />
        <LayeredShaderMaterial spec={materialSpec} />
      </mesh>
    </group>
  )
}
