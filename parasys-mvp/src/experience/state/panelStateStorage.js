import { PANEL_STATE_KEY } from './constants'

const isSerializableControlValue = (value) => (
  typeof value === 'number' ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  Array.isArray(value)
)

export const readStoredPanelState = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PANEL_STATE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const persistPanelState = (controls) => {
  if (typeof window === 'undefined') return

  const serializableControls = Object.fromEntries(
    Object.entries(controls).filter(([, value]) => isSerializableControlValue(value)),
  )

  try {
    window.localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(serializableControls))
  } catch {
    // ignore storage write failures
  }
}
