import type { JSX } from 'react'
import type { MaterialShaderSpec, SurfaceUvMapping, TemplateParametricPreset } from '@shared/types'

export type TemplateProps = {
  wm: number
  hm: number
  dm: number
  materialSpec: MaterialShaderSpec
  templateParamOverrides?: Record<string, TemplateParametricPreset> | null
  uvMappings?: Record<string, SurfaceUvMapping> | null
  templateKey: string
}

export type TemplateRenderer = (props: TemplateProps) => JSX.Element
