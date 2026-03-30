import type { MaterialShaderSpec } from '@/lib/materialShader'
import type { SurfaceUvMapping } from '@shared/types'
import { LayeredShaderMaterial } from './LayeredShaderMaterial'
import { MatcapGreyMaterial } from './MatcapGreyMaterial'

type Props = {
  materialId: string | null
  materialSpec: MaterialShaderSpec
  uvFaceMappings?: SurfaceUvMapping[]
}

/** Renders layered shader when a material is selected; otherwise grey matcap. */
export function MaterialOrMatcap({ materialId, materialSpec, uvFaceMappings }: Props) {
  if (materialId == null || materialId === '') {
    return <MatcapGreyMaterial />
  }
  return <LayeredShaderMaterial spec={materialSpec} uvFaceMappings={uvFaceMappings} />
}
