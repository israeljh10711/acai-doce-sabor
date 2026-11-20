/**
 * Função `pedido` do Supabase (Edge Function, Deno), pedido de 2026-11-17, opção A.
 *
 * Este arquivo vira `supabase/functions/pedido/index.ts` por `npm run build:pedido` (um arquivo só,
 * com o cardápio e as regras do site dentro). É esse arquivo que se cola no editor de funções do
 * painel do Supabase. A chave de servidor vem do ambiente da função, que o Supabase preenche
 * sozinho; ela nunca vai para o site.
 */
import { createOrderHandler, sha256Hex } from './orderHttp.ts'
import { createOrderStore } from './orderStore.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): unknown
}

/** A chave de servidor: a nova (SUPABASE_SECRET_KEYS) ou a antiga (service_role). */
function serverKey(): string | undefined {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, unknown>
    if (typeof keys.default === 'string' && keys.default) return keys.default
  } catch {
    // Projeto só com as chaves antigas.
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || undefined
}

Deno.serve(
  createOrderHandler(
    () => {
      const url = Deno.env.get('SUPABASE_URL')
      const key = serverKey()
      if (!url || !key) throw new Error('SUPABASE_URL ou a chave de servidor não estão no ambiente da função.')
      return { ...createOrderStore({ url, key }, fetch), now: () => Date.now(), sha256: sha256Hex }
    },
    (message) => console.error(message),
  ),
)
