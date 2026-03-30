import { RoundedBox } from '@react-three/drei'
import { LayeredShaderMaterial } from '../LayeredShaderMaterial'
import type { TemplateProps } from './types'

export function FallbackTemplate({ wm, hm, dm, materialSpec }: TemplateProps) {
  const s = Math.min(wm, dm, hm)
  const r = Math.min(0.012, s * 0.04)
  return (
    <RoundedBox args={[wm, hm, dm]} radius={r} smoothness={3} castShadow receiveShadow>
      <LayeredShaderMaterial spec={materialSpec} />
    </RoundedBox>
  )
}
