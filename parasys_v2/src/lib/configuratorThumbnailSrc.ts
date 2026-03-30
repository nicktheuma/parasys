import type { ConfiguratorSettingsRow } from '@shared/types'

const DEFAULT = '/configurator-thumbnails/default.svg'

/** Static art per template when `settings.thumbnailSrc` is not set */
const TEMPLATE_THUMB_BASE: Record<string, string> = {
  tv_console: 'panel',
  media_unit: 'panel',
  open_shelf: 'panel',
  wardrobe: 'panel',
  sideboard: 'panel',
  kitchen_island: 'panel',

  dining_table: 'table',
  workbench: 'table',
  desk: 'table',
  bedside_table: 'table',

  sofa: 'sofa',

  jewelry: 'small',
  packaging: 'small',

  boat: 'boat',
}

export function getConfiguratorThumbnailSrc(
  templateKey: string,
  settings?: ConfiguratorSettingsRow | null,
): string {
  const custom = settings?.thumbnailSrc?.trim()
  if (custom) return custom
  const base = TEMPLATE_THUMB_BASE[templateKey] ?? 'default'
  return `/configurator-thumbnails/${base}.svg`
}

export const CONFIGURATOR_THUMBNAIL_FALLBACK = DEFAULT
