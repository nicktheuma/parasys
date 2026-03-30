import { ParametricPanelProduct } from '@/features/parametric/mvp1/ParametricPanelProduct'
import { mergeTemplateParametricPreset } from '@/features/parametric/mvp1/templateParametricPresets'
import type { TemplateProps } from './types'

export function PanelTemplate({ wm, hm, dm, materialSpec, materialId, templateParamOverrides, uvMappings, templateKey }: TemplateProps) {
  const preset = mergeTemplateParametricPreset(templateKey, templateParamOverrides?.[templateKey] ?? null)
  return (
    <ParametricPanelProduct
      widthM={wm}
      heightM={hm}
      depthM={dm}
      materialSpec={materialSpec}
      materialId={materialId}
      uvMappings={uvMappings}
      dividers={preset?.dividers}
      shelves={preset?.shelves}
      edgeOffset={preset?.edgeOffset}
      slotOffsetFactor={preset?.slotOffsetFactor}
      interlockEnabled={preset?.interlockEnabled}
      interlockClearanceFactor={preset?.interlockClearanceFactor}
      interlockLengthFactor={preset?.interlockLengthFactor}
      panelThickness={preset?.panelThickness}
    />
  )
}
