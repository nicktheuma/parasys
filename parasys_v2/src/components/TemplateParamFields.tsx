import styles from '@/routes/adminDashboard.module.css'

export type TplFieldValues = {
  dividers: string
  shelves: string
  showBackPanel: boolean
  showVerticalPanels: boolean
  showShelfPanels: boolean
  edgeOffset: string
  slotOffsetFactor: string
  interlockEnabled: boolean
  interlockClearance: string
  interlockLength: string
}

export const EMPTY_TPL_FIELDS: TplFieldValues = {
  dividers: '',
  shelves: '',
  showBackPanel: true,
  showVerticalPanels: true,
  showShelfPanels: true,
  edgeOffset: '',
  slotOffsetFactor: '',
  interlockEnabled: true,
  interlockClearance: '',
  interlockLength: '',
}

type Props = {
  value: TplFieldValues
  onChange: (next: TplFieldValues) => void
}

export function TemplateParamFields({ value, onChange }: Props) {
  const set = <K extends keyof TplFieldValues>(k: K, v: TplFieldValues[K]) =>
    onChange({ ...value, [k]: v })

  return (
    <>
      <p className={styles.dimHint}>Template parametrics (override for selected template)</p>
      <div className={styles.row3}>
        <label className={styles.label}>
          Dividers
          <input
            className={styles.input}
            type="number"
            value={value.dividers}
            onChange={(e) => set('dividers', e.target.value)}
            min={0}
            max={12}
          />
        </label>
        <label className={styles.label}>
          Shelves
          <input
            className={styles.input}
            type="number"
            value={value.shelves}
            onChange={(e) => set('shelves', e.target.value)}
            min={0}
            max={12}
          />
        </label>
        <label className={styles.label}>
          Edge offset (mm)
          <input
            className={styles.input}
            type="number"
            value={value.edgeOffset}
            onChange={(e) => set('edgeOffset', e.target.value)}
            step="0.001"
            min={0}
          />
        </label>
      </div>
      <div className={styles.row3}>
        <label className={styles.label}>
          <span>Back panel</span>
          <input
            type="checkbox"
            checked={value.showBackPanel}
            onChange={(e) => set('showBackPanel', e.target.checked)}
          />
        </label>
        <label className={styles.label}>
          <span>Vertical panels</span>
          <input
            type="checkbox"
            checked={value.showVerticalPanels}
            onChange={(e) => set('showVerticalPanels', e.target.checked)}
          />
        </label>
        <label className={styles.label}>
          <span>Shelf panels</span>
          <input
            type="checkbox"
            checked={value.showShelfPanels}
            onChange={(e) => set('showShelfPanels', e.target.checked)}
          />
        </label>
      </div>
      <div className={styles.row3}>
        <label className={styles.label}>
          Slot offset factor
          <input
            className={styles.input}
            type="number"
            value={value.slotOffsetFactor}
            onChange={(e) => set('slotOffsetFactor', e.target.value)}
            step="0.05"
            min={0}
          />
        </label>
        <label className={styles.label}>
          Interlock clearance factor
          <input
            className={styles.input}
            type="number"
            value={value.interlockClearance}
            onChange={(e) => set('interlockClearance', e.target.value)}
            step="0.01"
            min={0}
          />
        </label>
        <label className={styles.label}>
          Interlock length factor
          <input
            className={styles.input}
            type="number"
            value={value.interlockLength}
            onChange={(e) => set('interlockLength', e.target.value)}
            step="0.05"
            min={1}
          />
        </label>
      </div>
      <label className={styles.label}>
        <span>Interlock enabled</span>
        <input
          type="checkbox"
          checked={value.interlockEnabled}
          onChange={(e) => set('interlockEnabled', e.target.checked)}
        />
      </label>
    </>
  )
}
