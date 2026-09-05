/** Currency-aware money formatting shared across dashboard pages. */
export const moneySymbol = (currency) => (currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "UGX ");

export const formatMoney = (amount, currency = "UGX") =>
  currency === "UGX"
    ? `UGX ${Number(amount || 0).toLocaleString()}`
    : `${moneySymbol(currency)}${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;