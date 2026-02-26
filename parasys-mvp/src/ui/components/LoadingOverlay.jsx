export const LoadingOverlay = ({ visible }) => {
  if (!visible) return null

  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-card">
        <div className="loading-spinner" />
        <p>Building...</p>
      </div>
    </div>
  )
}
