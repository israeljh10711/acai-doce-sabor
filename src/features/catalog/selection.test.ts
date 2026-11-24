import { describe, expect, it } from 'vitest'
import { MAX_PAID_UNITS, PRODUCTS, toppingsOf } from './menu.ts'
import {
  EMPTY_SELECTION,
  type Selection,
  addBlocker,
  addTopping,
  chooseFlavor,
  chooseSize,
  freeCap,
  freeLimit,
  freeLimitRange,
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

describe('limite de adicionais gratuitos', () => {
  it('depende do tamanho escolhido', () => {
    const limits = (product: typeof tradicional) =>
      product.sizes.map((size) => freeLimit(product, build(product, size.id)))

    expect(limits(tradicional)).toEqual(tradicional.sizes.map(() => Infinity))
    expect(limits(oca)).toEqual([2, 4, 3, 3, 4, 5, 6, 7])
  })

  it('é zero enquanto nenhum tamanho foi escolhido', () => {
    expect(freeLimit(oca, EMPTY_SELECTION)).toBe(0)
  })

  it('aceita adicionais até o limite e bloqueia o seguinte', () => {
    const full = build(oca, 'copo-500', ['granola', 'pacoca', 'amendoim'])

    expect(freeUsed(full)).toBe(3)
    expect(addBlocker(oca, full, 'leite-em-po')).toBe('free-limit')
    expect(addTopping(oca, full, 'leite-em-po')).toBe(full)
  })

  it('permite um de cada no Tradicional, inclusive sem Completo e no menor tamanho', () => {
    const ids = toppingsOf(tradicional, 'dry').map(topping => topping.id)
    const selection = build(tradicional, 'pote-150', [...ids, 'leite-em-po'])
    expect(freeUsed(selection)).toBe(ids.length)
    expect(quantityOf(selection, 'leite-em-po')).toBe(1)
    expect(addBlocker(tradicional, selection, 'leite-em-po')).toBe('item-max')
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
    const offered = (group: 'fruit' | 'syrup') => toppingsOf(tradicional, group).map((topping) => topping.id)
    for (const id of [...offered('fruit'), ...offered('syrup')]) {
      expect(addBlocker(tradicional, selection, id)).toBeNull()
      selection = addTopping(tradicional, selection, id)
    }

    expect(freeUsed(selection)).toBe(2)
    expect(selectedByGroup(tradicional, selection, 'fruit')).toHaveLength(3)
    expect(selectedByGroup(tradicional, selection, 'syrup')).toHaveLength(8)
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
      { toppingId: 'kit-kat', name: 'Kit Kat', quantity: 1, unitCents: 400, totalCents: 400 },
    ])
    expect(price?.paidCents).toBe(700)
    expect(price?.totalCents).toBe(1200 + 700)
  })

  it('param no limite técnico de unidades por item', () => {
    const many = build(milkShake, '500-ml', Array.from({ length: MAX_PAID_UNITS + 3 }, () => 'cereja'))

    expect(quantityOf(many, 'cereja')).toBe(MAX_PAID_UNITS)
    expect(addBlocker(milkShake, many, 'cereja')).toBe('item-max')
  })
})

describe('preço', () => {
  it('não existe antes de o tamanho ser escolhido', () => {
    expect(priceOf(tradicional, EMPTY_SELECTION)).toBeNull()
  })

  it('é o preço do tamanho quando só há itens gratuitos', () => {
    const selection = build(tradicional, 'isopor-gg', ['granola', 'banana', 'calda-morango'])

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
  it('reduz o Oca para a cota do novo tamanho na ordem das escolhas', () => {
    const big = build(oca, 'isopor-gg', ['granola', 'pacoca', 'amendoim'])
    const { selection, removed } = chooseSize(oca, big, 'pote-200')
    expect(selection.toppings).toEqual({ granola: 1, pacoca: 1 })
    expect(removed).toEqual([{ toppingId: 'amendoim', quantity: 1 }])
  })

  it('não mexe em frutas, coberturas e pagos', () => {
    const big = build(tradicional, 'isopor-p', ['granola', 'pacoca', 'amendoim', 'banana', 'calda-acai', 'kit-kat'])
    const { selection, removed } = chooseSize(tradicional, big, 'pote-150')

    expect(removed).toEqual([])
    expect(selection.toppings).toEqual({ granola: 1, pacoca: 1, amendoim: 1, banana: 1, 'calda-acai': 1, 'kit-kat': 1 })
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
      ['Granola', 1],
      ['Marshmallow', 1],
    ])
  })
})

describe('ordem livre (pedido de 2026-11-14)', () => {
  it('dá para escolher ingredientes antes do tamanho', () => {
    let selection = EMPTY_SELECTION
    for (const id of ['granola', 'banana', 'calda-chocolate', 'kit-kat', 'creme-de-ninho']) {
      expect(addBlocker(tradicional, selection, id), id).toBeNull()
      selection = addTopping(tradicional, selection, id)
    }
    expect(Object.keys(selection.toppings)).toEqual(['granola', 'banana', 'calda-chocolate', 'kit-kat', 'creme-de-ninho'])
    // Sem tamanho ainda não há preço.
    expect(priceOf(tradicional, selection)).toBeNull()
  })

  it('sem tamanho, os grátis vão até o maior limite do produto (7)', () => {
    const seven = ['granola','bis','chocoball','leite-em-po','canudinho','sucrilhos','amendoim']
    let selection = EMPTY_SELECTION
    for (const id of seven) selection = addTopping(oca, selection, id)

    expect(freeCap(oca, selection)).toBe(7)
    expect(freeLimitRange(oca)).toEqual({ min: 2, max: 7 })
    expect(addBlocker(oca, selection, 'pacoca')).toBe('free-limit')
  })

  it('ao escolher o tamanho, o que passa do limite dele sai, com aviso', () => {
    let selection = EMPTY_SELECTION
    for (const id of ['granola', 'pacoca', 'amendoim', 'leite-em-po']) selection = addTopping(oca, selection, id)
    const { selection: next, removed } = chooseSize(oca, selection, 'pote-200')

    expect(freeUsed(next)).toBe(2)
    expect(removed).toEqual([
      { toppingId: 'leite-em-po', quantity: 1 },
      { toppingId: 'amendoim', quantity: 1 },
    ])
  })
})

describe('caldas e cremes (pedido de 2026-11-14)', () => {
  it('cada um entra uma vez só', () => {
    for (const id of ['creme-de-ninho', 'creme-de-avela', 'calda-frutas-vermelhas', 'calda-banana-caramelizada']) {
      const once = build(tradicional, 'copo-500', [id])
      expect(addBlocker(tradicional, once, id), id).toBe('item-max')
      expect(addTopping(tradicional, once, id), id).toBe(once)
    }
  })

  it('os cremes custam R$ 3,00; as caldas não custam nada', () => {
    const selection = build(tradicional, 'copo-500', ['creme-de-ninho', 'creme-de-avela', 'calda-chocolate', 'calda-acai'])
    const price = priceOf(tradicional, selection)

    expect(price?.paidLines.map((line) => [line.name, line.quantity, line.totalCents])).toEqual([
      ['Creme de ninho', 1, 300],
      ['Creme de avelã', 1, 300],
    ])
    expect(price?.totalCents).toBe(1200 + 600)
    expect(freeUsed(selection)).toBe(0)
  })

  it('o leite condensado agora é adicional: conta no limite grátis e não custa nada', () => {
    const selection = build(oca, 'copo-500', ['leite-condensado', 'granola', 'disquete'])

    expect(freeUsed(selection)).toBe(3)
    expect(addBlocker(oca, selection, 'farinha-lactea')).toBe('free-limit')
    expect(priceOf(oca, selection)?.totalCents).toBe(2000)
  })

  it('o açaí não oferece a cobertura de leite condensado; o milk-shake oferece', () => {
    expect(addBlocker(tradicional, build(tradicional, 'copo-500'), 'calda-leite-condensado')).toBe('not-in-product')
    const shake = chooseSize(milkShake, EMPTY_SELECTION, '400-ml').selection
    expect(addBlocker(milkShake, shake, 'calda-leite-condensado')).toBeNull()
  })
})
