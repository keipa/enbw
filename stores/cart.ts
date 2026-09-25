import { defineStore } from 'pinia'

export interface CartAddition {
  id: string
  title: string
  price: number
  image: string | null
}

export interface CartLine extends CartAddition {
  quantity: number
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartLine[],
  }),
  getters: {
    totalItems: (state): number =>
      state.items.reduce((sum, line) => sum + line.quantity, 0),
    totalPrice: (state): number =>
      state.items.reduce((sum, line) => sum + line.price * line.quantity, 0),
  },
  actions: {
    add(product: CartAddition, quantity = 1) {
      const existing = this.items.find((line) => line.id === product.id)
      if (existing) {
        existing.quantity += quantity
        return
      }
      this.items.push({ ...product, quantity })
    },
    remove(id: string) {
      this.items = this.items.filter((line) => line.id !== id)
    },
    setQuantity(id: string, quantity: number) {
      const line = this.items.find((item) => item.id === id)
      if (!line) return
      if (quantity < 1) {
        this.remove(id)
        return
      }
      line.quantity = quantity
    },
    clear() {
      this.items = []
    },
  },
})
