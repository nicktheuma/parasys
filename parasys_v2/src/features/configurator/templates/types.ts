import type { JSX } from 'react'
import type {
  ConfiguratorPropsSettings,
  MaterialShaderSpec,
  SurfaceUvMapping,
  TemplateParametricPreset,
} from '@shared/types'
import type { PropLibraryItem } from '@/features/configurator/props/types'

export type TemplateProps = {
  wm: number
  hm: number
  dm: number
  materialSpec: MaterialShaderSpec
  materialId: string | null
  templateParamOverrides?: Record<string, TemplateParametricPreset> | null
  uvMappings?: Record<string, SurfaceUvMapping> | null
  templateKey: string
  propsConfig?: ConfiguratorPropsSettings | null
  propLibrary?: PropLibraryItem[] | null
}

export type TemplateRenderer = (props: TemplateProps) => JSX.Element
