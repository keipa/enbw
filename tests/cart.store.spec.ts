import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCartStore } from '../stores/cart'

const hoodie = { id: '2', title: 'Classic Red Pullover Hoodie', price: 10, image: null }
const sweatshirt = { id: '4', title: 'Classic Grey Hooded Sweatshirt', price: 90, image: null }

describe('cart store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds a product as a single line with quantity one', () => {
    const cart = useCartStore()
    cart.add(hoodie)

    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]).toMatchObject({ id: '2', quantity: 1 })
    expect(cart.totalItems).toBe(1)
  })

  it('merges quantity instead of duplicating when the same product is added twice', () => {
    const cart = useCartStore()
    cart.add(hoodie)
    cart.add(hoodie)

    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].quantity).toBe(2)
    expect(cart.totalItems).toBe(2)
  })

  it('removes a line by id', () => {
    const cart = useCartStore()
    cart.add(hoodie)
    cart.add(sweatshirt)
    cart.remove('2')

    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].id).toBe('4')
  })

  it('totals price across lines and quantities', () => {
    const cart = useCartStore()
    cart.add(hoodie, 3)
    cart.add(sweatshirt)

    expect(cart.totalPrice).toBe(120)
  })

  it('removes the line when quantity is set below one', () => {
    const cart = useCartStore()
    cart.add(hoodie)
    cart.setQuantity('2', 0)

    expect(cart.items).toHaveLength(0)
  })

  it('clears every line', () => {
    const cart = useCartStore()
    cart.add(hoodie)
    cart.add(sweatshirt)
    cart.clear()

    expect(cart.items).toHaveLength(0)
    expect(cart.totalPrice).toBe(0)
  })
})
