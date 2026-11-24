import { type Cart, type CartItem, MAX_CART_LINES, cartItemProblem, newItemId, parseCart } from './cart.ts'

function matchesPairs(original: unknown, current: Readonly<Record<string, string | number>>) {
  const pairs = original ?? []
  return Array.isArray(pairs) && pairs.length === Object.keys(current).length &&
    pairs.every((pair: unknown) => Array.isArray(pair) && pair.length === 2 && current[pair[0]] === pair[1])
}

/** Cada linha recebe um novo ID. A mesma montagem pode ter observações diferentes em cada pedido. */
export function repeatOrder(current: Cart, snapshots: readonly string[]) {
  const added: CartItem[] = []
  let skipped = false
  for (const snapshot of snapshots) {
    let raw
    try {
      raw = JSON.parse(snapshot)
    } catch {
      skipped = true
      continue
    }
    if (!Array.isArray(raw?.items)) {
      skipped = true
      continue
    }
    const restored = new Map(parseCart(snapshot).items.map(item => [item.id, item]))
    for (const entry of raw.items) {
      const item = restored.get(entry?.id)
      if (!item || cartItemProblem(item)) {
        skipped = true
        continue
      }
      const same = item.kind === 'extra'
        ? matchesPairs(entry.choices, item.choices)
        : (entry.sizeId ?? null) === item.selection.sizeId && (entry.flavorId ?? null) === item.selection.flavorId &&
          Boolean(entry.complete) === Boolean(item.selection.complete) && matchesPairs(entry.toppings, item.selection.toppings)
      if (!same || item.quantity !== entry.quantity) {
        skipped = true
        continue
      }
      added.push({ ...item, id: newItemId() })
    }
  }
  if (current.items.length + added.length > MAX_CART_LINES) {
    return { cart: current, quantity: 0, skipped, full: true }
  }
  return {
    cart: added.length ? { items: [...current.items, ...added] } : current,
    quantity: added.reduce((total, item) => total + item.quantity, 0),
    skipped,
    full: false,
  }
}
