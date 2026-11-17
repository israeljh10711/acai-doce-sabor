import { useRef, useState } from 'react'
import { Download, LockOpen, Upload } from '../../components/ui/icons.tsx'
import { MIN_PASSWORD_LENGTH } from '../../services/sellerCatalogStore.ts'
import { SellerDialog } from './SellerDialog.tsx'
import { useSellerMode } from './sellerModeContext.ts'

const barButton =
  'inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white ring-1 ring-white/30 transition hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gold-400 sm:text-sm'

/**
 * Faixa do modo vendedor no topo de todas as páginas (pedido de 2026-11-16): o aviso de como
 * editar, onde as mudanças ficam salvas e os botões "Alterar senha", "Backup / Restaurar" e
 * "Sair do Modo Vendedor".
 */
export function SellerBar() {
  const seller = useSellerMode()
  const [open, setOpen] = useState<'password' | 'backup' | null>(null)

  return (
    <div data-seller-bar="" className="border-b-2 border-gold-400 bg-acai-800 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs sm:px-6 sm:text-sm">
        <p className="flex min-w-0 items-start gap-2">
          <LockOpen className="mt-0.5 size-4 text-gold-400" />
          <span>
            <strong className="font-extrabold">Modo Vendedor Ativo</strong> — Toque em "Editar" em qualquer item ou "+ Adicionar" em
            qualquer categoria.{' '}
            <span className={`font-bold ${seller.backendKind === 'supabase' ? 'text-gold-300' : 'text-gold-400'}`}>
              {seller.backendKind === 'supabase'
                ? 'Salvo na nuvem: vale para todos os clientes.'
                : 'Salvo só neste aparelho: os clientes ainda não veem.'}
            </span>
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={barButton} onClick={() => setOpen('password')}>
            Alterar senha
          </button>
          <button type="button" className={barButton} onClick={() => setOpen('backup')}>
            Backup / Restaurar
          </button>
          <button type="button" className={`${barButton} bg-white/10`} onClick={() => void seller.signOut()}>
            Sair do Modo Vendedor
          </button>
        </div>
      </div>
      {open === 'password' && <ChangePassword onClose={() => setOpen(null)} />}
      {open === 'backup' && <BackupRestore onClose={() => setOpen(null)} />}
    </div>
  )
}

const inputClass =
  'min-h-12 w-full rounded-xl bg-acai-50 px-4 text-base text-acai-950 ring-1 ring-line outline-none focus:bg-white focus:ring-2 focus:ring-acai-700'
const primaryButton =
  'btn-gold inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:cursor-not-allowed disabled:opacity-60'

function ChangePassword({ onClose }: { onClose: () => void }) {
  const seller = useSellerMode()
  const min = seller.backendKind === 'supabase' ? 6 : MIN_PASSWORD_LENGTH
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <SellerDialog title="Alterar senha" titleId="alterar-senha-titulo" description={`A senha nova precisa ter pelo menos ${min} caracteres.`} onClose={onClose}>
      <form
        className="flex flex-col gap-3 pb-2"
        onSubmit={async (event) => {
          event.preventDefault()
          if (next.trim().length < min) return setMessage({ ok: false, text: `Use pelo menos ${min} caracteres.` })
          if (next !== again) return setMessage({ ok: false, text: 'As duas senhas não são iguais.' })
          const ok = await seller.changePassword(next).catch(() => false)
          setMessage(ok ? { ok: true, text: 'Senha alterada.' } : { ok: false, text: 'Não foi possível alterar a senha. Tente de novo.' })
          if (ok) {
            setNext('')
            setAgain('')
          }
        }}
      >
        <label className="text-sm font-bold text-acai-950" htmlFor="senha-nova">
          Senha nova
        </label>
        <input id="senha-nova" type="password" autoComplete="new-password" className={inputClass} value={next} onChange={(event) => setNext(event.target.value)} />
        <label className="text-sm font-bold text-acai-950" htmlFor="senha-nova-de-novo">
          Repita a senha nova
        </label>
        <input id="senha-nova-de-novo" type="password" autoComplete="new-password" className={inputClass} value={again} onChange={(event) => setAgain(event.target.value)} />
        {message && (
          <p role="status" className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${message.ok ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>
            {message.text}
          </p>
        )}
        <button type="submit" className={primaryButton}>
          Salvar senha
        </button>
      </form>
    </SellerDialog>
  )
}

function BackupRestore({ onClose }: { onClose: () => void }) {
  const seller = useSellerMode()
  const file = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const json = await seller.exportBackup()
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `acai-doce-sabor-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setMessage({ ok: true, text: 'Backup baixado.' })
    } catch {
      setMessage({ ok: false, text: 'Não foi possível gerar o backup.' })
    }
    setBusy(false)
  }

  return (
    <SellerDialog
      title="Backup / Restaurar"
      titleId="backup-titulo"
      description="O backup guarda as mudanças do modo vendedor (preços, fotos, itens novos) num arquivo. Restaurar grava um backup de volta, neste aparelho ou em outro."
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 pb-2">
        <button type="button" disabled={busy} onClick={() => void download()} className={primaryButton}>
          <Download className="size-5" />
          Baixar backup
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Arquivo de backup"
          onChange={async (event) => {
            const chosen = event.target.files?.[0]
            event.target.value = ''
            if (!chosen) return
            setBusy(true)
            try {
              await seller.importBackup(await chosen.text())
              setMessage({ ok: true, text: 'Backup restaurado.' })
            } catch {
              setMessage({ ok: false, text: 'Arquivo de backup inválido.' })
            }
            setBusy(false)
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => file.current?.click()}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 font-bold text-acai-800 ring-1 ring-line transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:opacity-60"
        >
          <Upload className="size-5" />
          Restaurar backup
        </button>
        {message && (
          <p role="status" className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${message.ok ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>
            {message.text}
          </p>
        )}
      </div>
    </SellerDialog>
  )
}
