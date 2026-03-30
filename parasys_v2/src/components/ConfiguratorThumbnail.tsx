import { useEffect, useState } from 'react'
import type { ConfiguratorSettingsRow } from '@shared/types'
import {
  CONFIGURATOR_THUMBNAIL_FALLBACK,
  getConfiguratorThumbnailSrc,
} from '@/lib/configuratorThumbnailSrc'
import styles from './configuratorThumbnail.module.css'

type Props = {
  templateKey: string
  settings?: ConfiguratorSettingsRow | null
}

export function ConfiguratorThumbnail({ templateKey, settings }: Props) {
  const preferred = getConfiguratorThumbnailSrc(templateKey, settings)
  const [src, setSrc] = useState(preferred)

  useEffect(() => {
    setSrc(preferred)
  }, [preferred])

  return (
    <img
      className={styles.img}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() =>
        setSrc((current) =>
          current === CONFIGURATOR_THUMBNAIL_FALLBACK ? current : CONFIGURATOR_THUMBNAIL_FALLBACK,
        )
      }
    />
  )
}
