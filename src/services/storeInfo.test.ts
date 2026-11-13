import { describe, expect, it } from 'vitest'
import { buildWhatsAppUrl } from '../utils/whatsapp.ts'
import { storeInfo } from './storeInfo.ts'

describe('dados oficiais da loja (briefing de 2026-11-12)', () => {
  it('Instagram @acaiidocesabor, com o endereço exato', () => {
    expect(storeInfo.instagramHandle).toBe('acaiidocesabor')
    expect(storeInfo.instagramUrl).toBe('https://www.instagram.com/acaiidocesabor/')
  })

  it('WhatsApp oficial abre em wa.me/5583996999980', () => {
    expect(storeInfo.whatsapp).toBe('(83) 99699-9980')
    expect(buildWhatsAppUrl(storeInfo.whatsapp)).toBe('https://wa.me/5583996999980')
  })

  it('endereço em Teixeira, PB', () => {
    expect(storeInfo.address).toEqual({ street: 'Rua Francisco Tota, 12', city: 'Teixeira', state: 'Paraíba' })
  })
})
