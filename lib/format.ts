export function formatCompact(value: number, currency: string): string {
  if (currency === "INR") {
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)}Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(2)}L`;
    if (value >= 1e3) return `₹${(value / 1e3).toFixed(0)}K`;
    return `₹${value.toFixed(0)}`;
  }
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
  if (value >= 1e9) return `${sym}${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${sym}${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${sym}${(value / 1e3).toFixed(0)}K`;
  return `${sym}${value.toFixed(0)}`;
}

export function formatAxisValue(value: number, currency: string): string {
  if (currency === "INR") {
    if (value >= 1e7) return `${(value / 1e7).toFixed(1)}Cr`;
    if (value >= 1e5) return `${(value / 1e5).toFixed(0)}L`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return `${value.toFixed(0)}`;
  }
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return `${value.toFixed(0)}`;
}
