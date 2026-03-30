import { hexForColorInput } from '@/lib/hexColor'
import styles from './colorSwatchInput.module.css'

type Props = {
  value: string
  onChange: (hex: string) => void
  id?: string
  'aria-label'?: string
}

export function ColorSwatchInput({ value, onChange, id, 'aria-label': ariaLabel }: Props) {
  const safe = hexForColorInput(value)
  return (
    <div className={styles.wrap}>
      <input
        id={id}
        type="color"
        className={styles.swatch}
        value={safe}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
      <code className={styles.hex}>{safe}</code>
    </div>
  )
}
