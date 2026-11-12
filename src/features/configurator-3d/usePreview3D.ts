import { useCallback, useState } from 'react'
import { canUseWebGL } from './webgl.ts'

/**
 * Estado da prévia:
 * - `loading`: a prévia 2D aparece enquanto o 3D carrega;
 * - `3d`: a cena 3D está pronta e substituiu a 2D;
 * - `unavailable`: sem WebGL, ou a cena falhou; fica a prévia 2D, com aviso.
 */
export type PreviewMode = 'loading' | '3d' | 'unavailable'

export function usePreview3D() {
  const [mode, setMode] = useState<PreviewMode>(() => (canUseWebGL() ? 'loading' : 'unavailable'))
  const onReady = useCallback(() => setMode((current) => (current === 'loading' ? '3d' : current)), [])
  const onError = useCallback(() => setMode('unavailable'), [])
  return { mode, onReady, onError }
}
