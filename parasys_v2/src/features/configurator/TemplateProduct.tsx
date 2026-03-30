import { mmToM } from '@/lib/configuratorDimensions'
import type { MaterialShaderSpec, SurfaceUvMapping, TemplateParametricPreset } from '@shared/types'
import { getTemplateRenderer } from './templates/registry'

type Props = {
  templateKey: string
  widthMm: number
  depthMm: number
  heightMm: number
  materialSpec: MaterialShaderSpec
  materialId: string | null
  templateParamOverrides?: Record<string, TemplateParametricPreset> | null
  uvMappings?: Record<string, SurfaceUvMapping> | null
}

export function TemplateProduct({
  templateKey,
  widthMm,
  depthMm,
  heightMm,
  materialSpec,
  materialId,
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
      materialId={materialId}
      templateParamOverrides={templateParamOverrides}
      uvMappings={uvMappings}
      templateKey={templateKey}
    />
  )
}
