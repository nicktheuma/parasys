import { LayeredShaderMaterial } from '../LayeredShaderMaterial'
import type { TemplateProps } from './types'

export function BoatTemplate({ wm, hm, dm, materialSpec }: TemplateProps) {
  return (
    <mesh castShadow receiveShadow scale={[1, 0.55, 2.2]}>
      <boxGeometry args={[wm, hm, dm]} />
      <LayeredShaderMaterial spec={materialSpec} />
    </mesh>
  )
}

export function PackagingTemplate({ wm, hm, dm, materialSpec }: TemplateProps) {
  return (
    <mesh castShadow receiveShadow rotation={[Math.PI * 0.08, 0, 0]}>
      <boxGeometry args={[wm, hm * 0.35, dm]} />
      <LayeredShaderMaterial spec={materialSpec} />
    </mesh>
  )
}

export function JewelryTemplate({ wm, hm, dm, materialSpec }: TemplateProps) {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[wm * 0.85, hm * 0.85, dm * 0.85]} />
      <LayeredShaderMaterial spec={materialSpec} />
    </mesh>
  )
}
