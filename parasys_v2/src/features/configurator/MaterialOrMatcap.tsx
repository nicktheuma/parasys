import type { MaterialShaderSpec } from '@/lib/materialShader'
import type { SurfaceUvMapping } from '@shared/types'
import { LayeredShaderMaterial } from './LayeredShaderMaterial'
import { MatcapGreyMaterial } from './MatcapGreyMaterial'

type Props = {
  materialId: string | null
  materialSpec: MaterialShaderSpec
  materialHydrated?: boolean
  uvFaceMappings?: SurfaceUvMapping[]
  opacity?: number
}

/** Renders layered shader when a material is selected; otherwise grey matcap. */
export function MaterialOrMatcap({
  materialId,
  materialSpec,
  materialHydrated = true,
  uvFaceMappings,
  opacity = 1,
}: Props) {
  if (materialId == null || materialId === '') {
    return <MatcapGreyMaterial opacity={opacity} />
  }
  if (!materialHydrated) {
    return (
      <meshStandardMaterial
        color={materialSpec.baseColorHex}
        roughness={materialSpec.globalRoughness}
        metalness={materialSpec.globalMetalness}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    )
  }
  return <LayeredShaderMaterial spec={materialSpec} uvFaceMappings={uvFaceMappings} opacity={opacity} />
}
