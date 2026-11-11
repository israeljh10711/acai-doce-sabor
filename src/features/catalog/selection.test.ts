import { describe, expect, it } from 'vitest'
import { MAX_PAID_UNITS, PRODUCTS, TOPPINGS } from './menu.ts'
import {
  EMPTY_SELECTION,
  type Selection,
  addBlocker,
  addTopping,
  chooseFlavor,
  chooseSize,
  freeLimit,
  freeUsed,
  missingChoices,
  priceOf,
  quantityOf,
  removeTopping,
  selectedByGroup,
} from './selection.ts'

const tradicional = PRODUCTS['acai-tradicional']
const oca = PRODUCTS['acai-oca']
const milkShake = PRODUCTS['milk-shake']

/** Monta uma seleção com um tamanho e vários ingredientes, na ordem dada. */
function build(product: typeof tradicional, sizeId: string, toppingIds: string[] = []): Selection {
  let selection = chooseSize(product, EMPTY_SELECTION, sizeId).selection
  for (const id of toppingIds) selection = addTopping(product, selection, id)
  return selection
}

const idsOf = (group: string) => TOPPINGS.filter((t) => t.group === group).map((t) => t.id)

describe('limite de adicionais gratuitos', () => {
  it('depende do tamanho escolhido', () => {
    const limits = (product: typeof tradicional) =>
      product.sizes.map((size) => freeLimit(product, build(product, size.id)))

    expect(limits(tradicional)).toEqual([2, 2, 2, 4, 3, 3, 4, 5, 6, 7])
    expect(limits(oca)).toEqual([2, 4, 3, 3, 4, 5, 6, 7])
  })

  it('é zero enquanto nenhum tamanho foi escolhido', () => {
    expect(freeLimit(tradicional, EMPTY_SELECTION)).toBe(0)
  })

  it('aceita adicionais até o limite e bloqueia o seguinte', () => {
    const full = build(tradicional, 'copo-500', ['granola', 'pacoca', 'amendoim'])

    expect(freeUsed(full)).toBe(3)
    expect(addBlocker(tradicional, full, 'leite-em-po')).toBe('free-limit')
    expect(addTopping(tradicional, full, 'leite-em-po')).toBe(full)
  })

  it('conta cada unidade quando o mesmo adicional é repetido', () => {
    const selection = build(tradicional, 'copo-500', ['leite-em-po', 'leite-em-po'])

    expect(quantityOf(selection, 'leite-em-po')).toBe(2)
    expect(freeUsed(selection)).toBe(2)
    expect(addBlocker(tradicional, selection, 'leite-em-po')).toBeNull()
    expect(addBlocker(tradicional, addTopping(tradicional, selection, 'granola'), 'granola')).toBe(
      'free-limit',
    )
  })

  it('libera espaço quando um adicional é removido', () => {
    const full = build(tradicional, 'pote-200', ['granola', 'pacoca'])
    const afterRemoval = removeTopping(full, 'granola')

    expect(freeUsed(afterRemoval)).toBe(1)
    expect(addBlocker(tradicional, afterRemoval, 'amendoim')).toBeNull()
  })
})

describe('frutas e coberturas', () => {
  it('não consomem o limite: todas podem ser escolhidas com o limite cheio', () => {
    let selection = build(tradicional, 'pote-200', ['granola', 'pacoca'])
    for (const id of [...idsOf('fruit'), ...idsOf('syrup')]) {
      expect(addBlocker(tradicional, selection, id)).toBeNull()
      selection = addTopping(tradicional, selection, id)
    }

    expect(freeUsed(selection)).toBe(2)
    expect(selectedByGroup(tradicional, selection, 'fruit')).toHaveLength(3)
    expect(selectedByGroup(tradicional, selection, 'syrup')).toHaveLength(7)
  })

  it('entram uma vez só cada', () => {
    const selection = build(tradicional, 'pote-200', ['banana'])

    expect(addBlocker(tradicional, selection, 'banana')).toBe('item-max')
    expect(quantityOf(addTopping(tradicional, selection, 'banana'), 'banana')).toBe(1)
  })

  it('não mudam o preço', () => {
    const selection = build(tradicional, 'copo-400', ['banana', 'kiwi', 'calda-chocolate'])

    expect(priceOf(tradicional, selection)?.totalCents).toBe(1000)
  })
})

describe('adicionais pagos', () => {
  it('podem ser somados com o limite gratuito cheio', () => {
    const full = build(tradicional, 'pote-200', ['granola', 'pacoca'])

    expect(addBlocker(tradicional, full, 'kit-kat')).toBeNull()
    expect(quantityOf(addTopping(tradicional, full, 'kit-kat'), 'kit-kat')).toBe(1)
    expect(freeUsed(addTopping(tradicional, full, 'kit-kat'))).toBe(2)
  })

  it('são cobrados por unidade', () => {
    const selection = build(tradicional, 'copo-500', ['kit-kat', 'kit-kat', 'creme-de-avela'])
    const price = priceOf(tradicional, selection)

    expect(price?.paidLines).toEqual([
      { toppingId: 'creme-de-avela', name: 'Creme de avelã', quantity: 1, unitCents: 300, totalCents: 300 },
      { toppingId: 'kit-kat', name: 'Kit Kat', quantity: 2, unitCents: 400, totalCents: 800 },
    ])
    expect(price?.paidCents).toBe(1100)
    expect(price?.totalCents).toBe(1200 + 1100)
  })

  it('param no limite técnico de unidades por item', () => {
    const many = build(tradicional, 'copo-500', Array.from({ length: MAX_PAID_UNITS + 3 }, () => 'cereja'))

    expect(quantityOf(many, 'cereja')).toBe(MAX_PAID_UNITS)
    expect(addBlocker(tradicional, many, 'cereja')).toBe('item-max')
  })
})

describe('preço', () => {
  it('não existe antes de o tamanho ser escolhido', () => {
    expect(priceOf(tradicional, EMPTY_SELECTION)).toBeNull()
  })

  it('é o preço do tamanho quando só há itens gratuitos', () => {
    const selection = build(tradicional, 'isopor-gg', ['granola', 'banana', 'calda-leite-condensado'])

    expect(priceOf(tradicional, selection)).toEqual({
      sizeCents: 2200,
      paidLines: [],
      paidCents: 0,
      totalCents: 2200,
    })
  })

  it('bate com o exemplo da referência: Oca no copo de 500 ml com um Kit Kat dá R$ 24,00', () => {
    const selection = build(oca, 'copo-500', ['granola', 'leite-em-po', 'morango', 'kit-kat'])

    expect(priceOf(oca, selection)?.totalCents).toBe(2400)
  })

  it('acompanha a troca de tamanho', () => {
    const small = build(oca, 'pote-200', ['cereja'])
    const large = chooseSize(oca, small, 'isopor-gg').selection

    expect(priceOf(oca, small)?.totalCents).toBe(1000 + 300)
    expect(priceOf(oca, large)?.totalCents).toBe(3800 + 300)
  })
})

describe('troca de tamanho', () => {
  it('tira os adicionais que passam do novo limite, começando pelos últimos escolhidos', () => {
    const big = build(tradicional, 'isopor-gg', [
      'granola',
      'granola',
      'granola',
      'pacoca',
      'pacoca',
      'amendoim',
      'amendoim',
    ])
    const { selection, removed } = chooseSize(tradicional, big, 'pote-200')

    expect(freeLimit(tradicional, selection)).toBe(2)
    expect(selection.toppings).toEqual({ granola: 2 })
    expect(removed).toEqual([
      { toppingId: 'amendoim', quantity: 2 },
      { toppingId: 'pacoca', quantity: 2 },
      { toppingId: 'granola', quantity: 1 },
    ])
  })

  it('não mexe em frutas, coberturas e pagos', () => {
    const big = build(tradicional, 'isopor-p', ['granola', 'pacoca', 'amendoim', 'banana', 'calda-acai', 'kit-kat'])
    const { selection, removed } = chooseSize(tradicional, big, 'pote-150')

    expect(removed).toEqual([{ toppingId: 'amendoim', quantity: 1 }])
    expect(selection.toppings).toEqual({ granola: 1, pacoca: 1, banana: 1, 'calda-acai': 1, 'kit-kat': 1 })
  })

  it('mantém tudo quando o novo tamanho comporta a escolha', () => {
    const small = build(tradicional, 'pote-200', ['granola', 'pacoca'])
    const { selection, removed } = chooseSize(tradicional, small, 'isopor-gg')

    expect(removed).toEqual([])
    expect(selection.toppings).toEqual(small.toppings)
    expect(selection.sizeId).toBe('isopor-gg')
  })

  it('ignora um tamanho que não é do produto', () => {
    const selection = build(oca, 'pote-200')

    expect(chooseSize(oca, selection, 'pote-150')).toEqual({ selection, removed: [] })
  })
})

describe('milk-shake', () => {
  it('pede tamanho e sabor', () => {
    expect(missingChoices(milkShake, EMPTY_SELECTION)).toEqual(['size', 'flavor'])

    const withSize = chooseSize(milkShake, EMPTY_SELECTION, '400-ml').selection
    expect(missingChoices(milkShake, withSize)).toEqual(['flavor'])

    const complete = chooseFlavor(milkShake, withSize, 'morango')
    expect(complete.flavorId).toBe('morango')
    expect(missingChoices(milkShake, complete)).toEqual([])
  })

  it('ignora um sabor que não existe', () => {
    expect(chooseFlavor(milkShake, EMPTY_SELECTION, 'pizza')).toBe(EMPTY_SELECTION)
  })

  it('não aceita adicionais nem frutas', () => {
    const selection = build(milkShake, '500-ml')

    expect(addBlocker(milkShake, selection, 'granola')).toBe('not-in-product')
    expect(addBlocker(milkShake, selection, 'banana')).toBe('not-in-product')
    expect(addTopping(milkShake, selection, 'granola')).toBe(selection)
  })

  it('aceita coberturas, sem custo, e adicionais pagos, cobrados por unidade', () => {
    const selection = build(milkShake, '500-ml', ['calda-chocolate', 'kit-kat', 'kit-kat'])

    expect(priceOf(milkShake, selection)?.totalCents).toBe(1200 + 800)
  })
})

describe('açaí', () => {
  it('pede só o tamanho', () => {
    expect(missingChoices(tradicional, EMPTY_SELECTION)).toEqual(['size'])
    expect(missingChoices(tradicional, build(tradicional, 'copo-400'))).toEqual([])
  })

  it('não tem sabor para escolher', () => {
    const selection = build(tradicional, 'copo-400')

    expect(chooseFlavor(tradicional, selection, 'morango')).toBe(selection)
  })
})

describe('proteções', () => {
  it('nada é adicionado antes de o tamanho ser escolhido', () => {
    expect(addBlocker(tradicional, EMPTY_SELECTION, 'granola')).toBe('no-size')
    expect(addBlocker(tradicional, EMPTY_SELECTION, 'kit-kat')).toBe('no-size')
    expect(addTopping(tradicional, EMPTY_SELECTION, 'granola')).toBe(EMPTY_SELECTION)
  })

  it('um ingrediente desconhecido é recusado', () => {
    const selection = build(tradicional, 'copo-400')

    expect(addBlocker(tradicional, selection, 'pizza')).toBe('not-in-product')
  })

  it('remover o que não foi escolhido não muda nada', () => {
    const selection = build(tradicional, 'copo-400', ['granola'])

    expect(removeTopping(selection, 'pacoca')).toBe(selection)
  })

  it('remover a última unidade tira o ingrediente da seleção', () => {
    const selection = build(tradicional, 'copo-400', ['granola'])

    expect(removeTopping(selection, 'granola').toppings).toEqual({})
  })

  it('as funções não alteram a seleção recebida', () => {
    const original = build(tradicional, 'isopor-gg', ['granola', 'kit-kat'])
    const snapshot = JSON.stringify(original)
    Object.freeze(original)
    Object.freeze(original.toppings)

    addTopping(tradicional, original, 'pacoca')
    removeTopping(original, 'granola')
    chooseSize(tradicional, original, 'pote-150')

    expect(JSON.stringify(original)).toBe(snapshot)
  })

  it('lista os escolhidos de um grupo na ordem do cardápio', () => {
    const selection = build(tradicional, 'isopor-gg', ['marshmallow', 'granola', 'granola', 'leite-em-po'])

    expect(
      selectedByGroup(tradicional, selection, 'dry').map(({ topping, quantity }) => [topping.name, quantity]),
    ).toEqual([
      ['Leite em pó', 1],
      ['Granola', 2],
      ['Marshmallow', 1],
    ])
  })
})
