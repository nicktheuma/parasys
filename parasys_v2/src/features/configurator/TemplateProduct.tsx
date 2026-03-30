import { mmToM } from '@/lib/configuratorDimensions'
import type { MaterialShaderSpec, SurfaceUvMapping, TemplateParametricPreset } from '@shared/types'
import { getTemplateRenderer } from './templates/registry'

type Props = {
  templateKey: string
  widthMm: number
  depthMm: number
  heightMm: number
  materialSpec: MaterialShaderSpec
  templateParamOverrides?: Record<string, TemplateParametricPreset> | null
  uvMappings?: Record<string, SurfaceUvMapping> | null
}

export function TemplateProduct({
  templateKey,
  widthMm,
  depthMm,
  heightMm,
  materialSpec,
  templateParamOverrides,
  uvMappings,
}: Props) {
  const wm = mmToM(widthMm)
  const hm = mmToM(heightMm)
  const dm = mmToM(depthMm)
  const Renderer = getTemplateRenderer(templateKey)
  return (
    <Renderer
      wm={wm}
      hm={hm}
      dm={dm}
      materialSpec={materialSpec}
      templateParamOverrides={templateParamOverrides}
      uvMappings={uvMappings}
      templateKey={templateKey}
    />
  )
}
