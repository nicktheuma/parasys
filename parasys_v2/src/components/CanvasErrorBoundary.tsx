import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '2rem',
            color: '#c44',
            background: '#1a1a1a',
            textAlign: 'center',
          }}
          role="alert"
        >
          <div>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              3D preview failed to render
            </p>
            <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              style={{
                marginTop: '1rem',
                padding: '0.4rem 1rem',
                border: '1px solid #c44',
                borderRadius: '4px',
                background: 'transparent',
                color: '#c44',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
