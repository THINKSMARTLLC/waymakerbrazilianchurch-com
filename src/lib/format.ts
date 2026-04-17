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
