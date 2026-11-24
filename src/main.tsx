import '@fontsource-variable/inter'
import '@fontsource-variable/nunito'
import { LazyMotion, MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import { initCatalog, supabaseConfig } from './features/seller/sellerBackend.ts'
import { router } from './router.ts'

// Mudanças do modo vendedor (preços, fotos, itens novos) antes de desenhar o site.
const configured = import.meta.env.DEV || Boolean(supabaseConfig())
if (configured) initCatalog()

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
        {configured ? <RouterProvider router={router} /> : (
          <main className="mx-auto max-w-xl px-5 py-12">
            <h1 className="text-2xl font-bold">Loja temporariamente indisponível</h1>
            <p className="mt-2">Tente acessar novamente em alguns minutos.</p>
          </main>
        )}
      </LazyMotion>
    </MotionConfig>
  </StrictMode>,
)
