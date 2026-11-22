import { useState } from 'react'
import { Eye, EyeOff, LockOpen } from '../../components/ui/icons.tsx'
import { SellerDialog } from './SellerDialog.tsx'
import { useSellerMode } from './sellerModeContext.ts'

/**
 * "Acesso do Vendedor / Dono" (pedido de 2026-11-16): a senha libera as ferramentas de edição em
 * todo o site. Senha errada mostra o aviso; a certa fecha a janela.
 */
export function SellerAuthModal({ onClose }: { onClose: () => void }) {
  const seller = useSellerMode()
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <SellerDialog
      title="Acesso do Vendedor / Dono"
      titleId="acesso-vendedor-titulo"
      description="Digite a senha para editar fotos, preços, combos e adicionar novos produtos ou complementos."
      onClose={onClose}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          // O formulário antes de esperar: depois do await o evento já não tem `currentTarget`.
          const form = event.currentTarget
          setBusy(true)
          const ok = await seller.signIn(password).catch(() => false)
          setBusy(false)
          if (ok) {
            form.closest('dialog')?.close()
            return
          }
          setWrong(true)
          setPassword('')
        }}
        className="flex flex-col gap-3 pb-2"
      >
        <label htmlFor="senha-vendedor" className="text-sm font-bold text-acai-950">
          Senha
        </label>
        <div className="relative">
          <input
            id="senha-vendedor"
            type={visible ? 'text' : 'password'}
            value={password}
            autoFocus
            autoComplete="current-password"
            aria-invalid={wrong || undefined}
            aria-describedby={wrong ? 'senha-vendedor-erro' : undefined}
            onChange={(event) => {
              setPassword(event.target.value)
              setWrong(false)
            }}
            className="min-h-12 w-full rounded-xl bg-acai-50 pr-14 pl-4 text-base text-acai-950 ring-1 ring-line outline-none focus:bg-white focus:ring-2 focus:ring-acai-700"
          />
          <button
            type="button"
            aria-label={visible ? 'Esconder a senha' : 'Mostrar a senha'}
            aria-pressed={visible}
            onClick={() => setVisible((value) => !value)}
            className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-xl text-acai-800 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-acai-800"
          >
            {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        {wrong && (
          <p id="senha-vendedor-erro" role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            Senha incorreta. Tente novamente.
          </p>
        )}
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="btn-primary mt-1 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LockOpen className="size-5" />
          {busy ? 'Conferindo…' : 'Entrar'}
        </button>
      </form>
    </SellerDialog>
  )
}
