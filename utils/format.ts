const formatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
})

export function formatPrice(value: number): string {
  return formatter.format(value)
}
