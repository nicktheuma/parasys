import { ParametricPanelProduct } from '@/features/parametric/mvp1/ParametricPanelProduct'
import { PropInstances } from '@/features/configurator/props/PropInstances'
import { mergeTemplateParametricPreset } from '@/features/parametric/mvp1/templateParametricPresets'
import type { TemplateProps } from './types'

export function PanelTemplate({
  wm,
  hm,
  dm,
  materialSpec,
  materialId,
  templateParamOverrides,
  uvMappings,
  templateKey,
  propsConfig,
  propLibrary,
}: TemplateProps) {
  const preset = mergeTemplateParametricPreset(templateKey, templateParamOverrides?.[templateKey] ?? null)
  const widthMm = wm * 1000
  const heightMm = hm * 1000
  const depthMm = dm * 1000
  return (
    <>
      <ParametricPanelProduct
        widthM={wm}
        heightM={hm}
        depthM={dm}
        materialSpec={materialSpec}
        materialId={materialId}
        uvMappings={uvMappings}
        dividers={preset?.dividers}
        shelves={preset?.shelves}
        showBackPanel={preset?.showBackPanel}
        showVerticalPanels={preset?.showVerticalPanels}
        showShelfPanels={preset?.showShelfPanels}
        edgeOffset={preset?.edgeOffset}
        slotOffsetFactor={preset?.slotOffsetFactor}
        interlockEnabled={preset?.interlockEnabled}
        interlockClearanceFactor={preset?.interlockClearanceFactor}
        interlockLengthFactor={preset?.interlockLengthFactor}
        panelThickness={preset?.panelThickness}
      />
      <PropInstances
        templateKey={templateKey}
        widthMm={widthMm}
        depthMm={depthMm}
        heightMm={heightMm}
        templateParamOverrides={templateParamOverrides ?? null}
        propsConfig={propsConfig}
        propLibrary={propLibrary ?? []}
      />
    </>
  )
}
