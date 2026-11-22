import { Check, RotateCcw, Sparkles } from '../../components/ui/icons.tsx'
import type { ConfiguratorApi } from './useConfigurator.ts'

/**
 * Barra "Quer rechear tudo de uma vez?" (pedido de 2026-11-16), acima dos ingredientes da Barca,
 * do Pote 1 L Montado, do Açaí Oca e do Açaí Tradicional:
 * - "Completo" marca os adicionais e as frutas sem custo (1 de cada) pelo preço do tamanho, e o
 *   cliente continua aqui para tirar o que não quiser; caldas, cremes e pagos somam à parte;
 * - depois de tirar algo, o botão vira "Marcar tudo novamente";
 * - "Limpar" tira tudo e volta ao modo normal, com a cota de sempre.
 */
export function CompleteBar({ cfg }: { cfg: ConfiguratorApi }) {
  const active = Boolean(cfg.selection.complete)
  const label = !active ? 'Completo' : cfg.completeFull ? 'Completo aplicado' : 'Marcar tudo novamente'

  return (
    <section
      aria-labelledby="completo-titulo"
      data-complete-bar=""
      className="rounded-2xl border border-acai-800/15 bg-acai-800/[0.04] p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-56">
          <h2 id="completo-titulo" className="text-sm font-extrabold text-acai-800 sm:text-base">
            Quer rechear tudo de uma vez?
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft sm:text-sm">
            {active
              ? 'Adicionais e frutas no preço do tamanho; caldas, cremes e itens pagos somam à parte.'
              : 'Toque em Completo para marcar tudo e depois tire o que não quiser.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={cfg.complete}
            disabled={cfg.completeFull}
            className="btn-primary inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-4 text-sm font-extrabold whitespace-nowrap focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:cursor-default disabled:translate-y-0 disabled:shadow-none"
          >
            {cfg.completeFull ? <Check className="size-4" /> : <Sparkles className="size-4" />}
            {label}
          </button>
          {cfg.selectedCount > 0 && (
            <button
              type="button"
              onClick={cfg.clear}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink-soft transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
            >
              <RotateCcw className="size-4" />
              Limpar
            </button>
          )}
        </div>
      </div>
      {active && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-acai-950 ring-1 ring-orchid-400">
          <Check className="mt-0.5 size-4 text-acai-700" />
          <span>
            Modo Completo ativado! Se não quiser algum item (ex.: Farinha Láctea), basta tocar nele ou no botão - para
            tirar.
          </span>
        </p>
      )}
    </section>
  )
}
