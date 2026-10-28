const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function formatMoney(amount: number): string {
  return currency.format(Number.isFinite(amount) ? amount : 0)
}

export function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}
