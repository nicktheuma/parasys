import type { MaterialShaderSpec } from '@shared/types'

/** Public / admin catalog row for decorative props */
export type PropLibraryItem = {
  id: string
  name: string
  slug: string
  kind: 'placeholder_cube' | 'glb'
  glbUrl: string | null
  placeholderDimsMm: [number, number, number]
  defaultShader: MaterialShaderSpec | null
  /** Admin list only; public catalog omits disabled rows */
  enabled?: boolean
}
