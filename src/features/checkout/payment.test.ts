import { describe, expect, it } from 'vitest'
import {
  EMPTY_PAYMENT,
  PAYMENT_METHODS,
  changeDueCents,
  checkPayment,
  liveChangeProblem,
  parseReais,
  paymentProblemText,
  reaisText,
} from './payment.ts'

const cash = (changeFor: string, exact = false) => ({ method: 'dinheiro' as const, changeFor, exact })

describe('formas de pagamento', () => {
  it('são as quatro pedidas, nesta ordem', () => {
    expect(PAYMENT_METHODS.map((method) => method.label)).toEqual(['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro'])
  })
})

describe('valor digitado em reais', () => {
  it('lê os jeitos comuns de escrever', () => {
    expect(parseReais('50')).toBe(5000)
    expect(parseReais('50,00')).toBe(5000)
    expect(parseReais('50,5')).toBe(5050)
    expect(parseReais('50,')).toBe(5000)
    expect(parseReais('50.00')).toBe(5000)
    expect(parseReais('R$ 48,90')).toBe(4890)
    expect(parseReais(' 100 ')).toBe(10000)
    expect(parseReais('1.000')).toBe(100000)
    expect(parseReais('1.000,00')).toBe(100000)
  })

  it('recusa o que não é valor', () => {
    for (const text of ['', 'cinquenta', '50,000', '-10', '5,0,0', '1.00.0', '12abc']) {
      expect(parseReais(text), text).toBeNull()
    }
  })

  it('escreve centavos como o campo mostra', () => {
    expect(reaisText(5000)).toBe('50,00')
    expect(reaisText(123456)).toBe('1.234,56')
  })
})

describe('conferência antes do envio', () => {
  it('exige uma forma de pagamento', () => {
    expect(checkPayment(EMPTY_PAYMENT, 4800)).toEqual({ ok: false, problem: 'no-method' })
    expect(paymentProblemText('no-method', 4800)).toBe('Selecione uma forma de pagamento para continuar')
  })

  it('Pix e cartões não pedem mais nada', () => {
    for (const method of ['pix', 'credito', 'debito'] as const) {
      expect(checkPayment({ ...EMPTY_PAYMENT, method }, 4800)).toEqual({ ok: true, payment: { method } })
    }
  })

  it('dinheiro: troco para 50,00 num pedido de 48,00', () => {
    expect(checkPayment(cash('50,00'), 4800)).toEqual({ ok: true, payment: { method: 'dinheiro', changeForCents: 5000 } })
    expect(changeDueCents(cash('50,00'), 4800)).toBe(200)
  })

  it('dinheiro: valor igual ao total vale, com troco zero', () => {
    expect(checkPayment(cash('48'), 4800).ok).toBe(true)
    expect(changeDueCents(cash('48'), 4800)).toBe(0)
  })

  it('dinheiro: valor menor que o total bloqueia, com aviso já na digitação', () => {
    expect(checkPayment(cash('40,00'), 4800)).toEqual({ ok: false, problem: 'change-too-low' })
    expect(liveChangeProblem(cash('40,00'), 4800)).toBe('change-too-low')
    expect(changeDueCents(cash('40,00'), 4800)).toBeNull()
    expect(paymentProblemText('change-too-low', 4800)).toBe('O valor informado é menor que o total do pedido (R$ 48,00)')
  })

  it('dinheiro: sem valor e sem "não preciso de troco" bloqueia', () => {
    expect(checkPayment(cash(''), 4800)).toEqual({ ok: false, problem: 'change-missing' })
    expect(liveChangeProblem(cash(''), 4800)).toBeNull()
  })

  it('dinheiro: valor ilegível bloqueia', () => {
    expect(checkPayment(cash('abc'), 4800)).toEqual({ ok: false, problem: 'change-invalid' })
    expect(liveChangeProblem(cash('abc'), 4800)).toBe('change-invalid')
  })

  it('dinheiro: "não preciso de troco" dispensa o valor, mesmo com algo digitado', () => {
    expect(checkPayment(cash('', true), 4800)).toEqual({ ok: true, payment: { method: 'dinheiro', changeForCents: null } })
    expect(checkPayment(cash('10', true), 4800).ok).toBe(true)
    expect(liveChangeProblem(cash('10', true), 4800)).toBeNull()
    expect(changeDueCents(cash('100', true), 4800)).toBeNull()
  })
})
