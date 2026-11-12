import '@fontsource-variable/inter'
import '@fontsource-variable/montserrat'
import { LazyMotion, MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import { router } from './router.ts'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Elemento #root não encontrado em index.html')
}

// Animações: só o pacote leve (domAnimation), carregado à parte, com `m.*` nos componentes.
// reducedMotion="user": quem pediu menos movimento no aparelho vê as mudanças sem deslocamento.
const loadMotionFeatures = () => import('./motion-features.ts').then((module) => module.default)

createRoot(rootElement).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
        <RouterProvider router={router} />
      </LazyMotion>
    </MotionConfig>
  </StrictMode>,
)
