import type { JSX } from 'react'
import type { MaterialShaderSpec, TemplateParametricPreset } from '@shared/types'

export type TemplateProps = {
  wm: number
  hm: number
  dm: number
  materialSpec: MaterialShaderSpec
  templateParamOverrides?: Record<string, TemplateParametricPreset> | null
  templateKey: string
}

export type TemplateRenderer = (props: TemplateProps) => JSX.Element
