import { Component, type ReactNode } from 'react'

type Props = { fallback: ReactNode; onError: () => void; children: ReactNode }

/** Se a cena 3D falhar (WebGL recusado, modelo que não carregou), mostra a alternativa. */
export class SceneErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('Visualização 3D indisponível; mostrando a prévia ilustrada.', error)
    this.props.onError()
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
