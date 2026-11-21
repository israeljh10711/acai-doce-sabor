/**
 * Dados do painel do vendedor (cardápio dinâmico, 2026-11-21): o cardápio como o vendedor vê (com
 * o oculto; o arquivado fica de fora das listas) e a gravação com o estado de cada botão.
 */
import { useCallback, useEffect, useState } from 'react'
import { getCatalogRecords, useCatalogVersion } from '../catalog/catalogStore.ts'
import type { CatalogRecords } from '../catalog/records.ts'
import { catalogWrite, loadSellerRecords } from '../seller/sellerBackend.ts'
import type { CatalogWriter } from '../../services/catalogWriter.ts'
import { writeErrorText } from '../../services/catalogWriter.ts'
import type { SaveState } from './adminKit.ts'

export type AdminCatalog = { state: 'loading' } | { state: 'error' } | { state: 'ready'; records: CatalogRecords }

/** O cardápio do painel: lê como vendedor ao abrir e acompanha cada mudança. */
export function useAdminCatalog(): AdminCatalog & { reload(): void } {
  useCatalogVersion()
  const [state, setState] = useState<'loading' | 'error' | 'ready'>(() => (getCatalogRecords() ? 'ready' : 'loading'))
  const reload = useCallback(() => {
    loadSellerRecords()
      .then(() => setState('ready'))
      .catch(() => setState((current) => (getCatalogRecords() ? current : 'error')))
  }, [])
  useEffect(() => reload(), [reload])
  const records = getCatalogRecords()
  if (records && state !== 'error') return { state: 'ready', records, reload }
  return { state: state === 'error' ? 'error' : 'loading', reload }
}

/** Uma gravação com o estado do botão ("Salvando…", salvo, erro). */
export function useWrite(): [SaveState, (action: (writer: CatalogWriter) => Promise<void>) => Promise<boolean>, (next: SaveState) => void] {
  const [save, setSave] = useState<SaveState>({ state: 'idle' })
  const run = useCallback(async (action: (writer: CatalogWriter) => Promise<void>) => {
    setSave({ state: 'saving' })
    try {
      await catalogWrite(action)
      setSave({ state: 'saved' })
      return true
    } catch (error) {
      setSave({ state: 'error', message: writeErrorText(error) })
      return false
    }
  }, [])
  return [save, run, setSave]
}

/** Situação de um produto, para os selos da lista. */
export function productFlags(records: CatalogRecords, productId: string): { hidden: boolean; soldOut: boolean } {
  const product = records.products.find((candidate) => candidate.id === productId)
  const category = product && records.categories.find((candidate) => candidate.id === product.categoryId)
  return { hidden: !product?.visible || !category?.visible, soldOut: product?.available === false }
}

/** A hora de agora para as situações das ofertas, atualizada a cada minuto (sem ler o relógio ao desenhar). */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}
