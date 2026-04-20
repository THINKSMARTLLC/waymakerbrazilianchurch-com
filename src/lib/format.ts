// USD formatting utility — applied across financial displays.
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatUSD = (value: number | string | null | undefined): string => {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return usdFormatter.format(isFinite(n) ? n : 0);
};

// Title-case a person's name: "harley   sobrinho" -> "Harley Sobrinho".
// Preserves hyphens and apostrophes (e.g., "mary-jane" -> "Mary-Jane", "o'connor" -> "O'Connor").
export const toTitleCase = (value: string | null | undefined): string => {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/([\p{L}\p{N}]+)/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1));
};
