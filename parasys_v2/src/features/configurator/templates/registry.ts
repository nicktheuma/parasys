import type { TemplateRenderer } from './types'
import { PanelTemplate } from './panelTemplate'
import { TableTemplate } from './tableTemplate'
import { SofaTemplate } from './sofaTemplate'
import { BoatTemplate, JewelryTemplate, PackagingTemplate } from './simpleTemplates'
import { FallbackTemplate } from './fallbackTemplate'

/** Templates that use panel geometry + shelf anchors for props */
export const PANEL_TEMPLATE_KEYS = new Set<string>([
  'open_shelf',
  'wardrobe',
  'media_unit',
  'tv_console',
  'sideboard',
  'kitchen_island',
  'bedside_table',
])

const REGISTRY = new Map<string, TemplateRenderer>([
  ['open_shelf', PanelTemplate],
  ['wardrobe', PanelTemplate],
  ['media_unit', PanelTemplate],
  ['tv_console', PanelTemplate],
  ['sideboard', PanelTemplate],
  ['kitchen_island', PanelTemplate],
  ['bedside_table', PanelTemplate],

  ['dining_table', TableTemplate],
  ['desk', TableTemplate],
  ['workbench', TableTemplate],

  ['sofa', SofaTemplate],

  ['boat', BoatTemplate],
  ['packaging', PackagingTemplate],
  ['jewelry', JewelryTemplate],
])

export function getTemplateRenderer(key: string): TemplateRenderer {
  return REGISTRY.get(key) ?? FallbackTemplate
}

export function registerTemplate(key: string, renderer: TemplateRenderer): void {
  REGISTRY.set(key, renderer)
}
