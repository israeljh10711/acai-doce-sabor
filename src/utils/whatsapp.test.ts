import { describe, expect, it } from 'vitest'
import { buildWhatsAppUrl, toWhatsAppNumber } from './whatsapp.ts'

describe('toWhatsAppNumber', () => {
  it('remove a formatação e acrescenta o código do país', () => {
    expect(toWhatsAppNumber('(83) 99699-9980')).toBe('5583996999980')
  })

  it('aceita número que já vem com o código do país', () => {
    expect(toWhatsAppNumber('+55 83 99699-9980')).toBe('5583996999980')
    expect(toWhatsAppNumber('5583996999980')).toBe('5583996999980')
  })

  it('não confunde o DDD 55 com o código do país', () => {
    expect(toWhatsAppNumber('(55) 90000-0000')).toBe('5555900000000')
  })

  it('aceita telefone fixo, com 10 dígitos', () => {
    expect(toWhatsAppNumber('(83) 0000-0000')).toBe('558300000000')
  })

  it('recusa números incompletos', () => {
    expect(() => toWhatsAppNumber('99699-9980')).toThrow(RangeError)
    expect(() => toWhatsAppNumber('')).toThrow(RangeError)
  })
})

describe('buildWhatsAppUrl', () => {
  it('monta o link da conversa quando não há mensagem', () => {
    expect(buildWhatsAppUrl('(83) 99699-9980')).toBe('https://wa.me/5583996999980')
  })

  it('leva a mensagem inteira no link, com acentos, quebras de linha e símbolos', () => {
    const message = 'Olá!\nPedido: açaí 500 ml & granola\nTotal: R$ 12,00'
    const url = new URL(buildWhatsAppUrl('(83) 99699-9980', message))

    expect(url.origin + url.pathname).toBe('https://wa.me/5583996999980')
    expect([...url.searchParams.keys()]).toEqual(['text'])
    expect(url.searchParams.get('text')).toBe(message)
  })

  it('não deixa espaços nem quebras de linha crus no link', () => {
    expect(buildWhatsAppUrl('(83) 99699-9980', 'uma linha\noutra linha')).not.toMatch(/\s/)
  })
})
