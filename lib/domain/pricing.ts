import { formatRate } from "../format";

export type PriceList = {
  price12x30: number;
  price12x60: number;
  price36x60: number;
};

export const DEFAULT_PRICES: PriceList = {
  price12x30: 650,
  price12x60: 1200,
  price36x60: 1800,
};

/** All three tiers, in order. Never return a single rate on its own. */
export function priceTierLines(prices: PriceList = DEFAULT_PRICES): [string, string, string] {
  return [
    `1–2 dogs ${formatRate(prices.price12x60)}/hour or ${formatRate(prices.price12x30)}/30 min`,
    `3–6 dogs ${formatRate(prices.price36x60)}/hour only (no 30-minute option)`,
    "7+ dogs custom price by manual quote",
  ];
}

export type Quote =
  | { ok: true; pricePence: number; durationMinutes: 30 | 60 }
  | {
      ok: false;
      reason: "special_request" | "invalid_dogs" | "invalid_duration" | "duration_not_offered";
    };

export function quotePrice(
  dogs: number,
  durationMinutes: number,
  prices: PriceList = DEFAULT_PRICES,
): Quote {
  if (!Number.isInteger(dogs) || dogs < 1) {
    return { ok: false, reason: "invalid_dogs" };
  }
  if (dogs >= 7) return { ok: false, reason: "special_request" };
  if (durationMinutes !== 30 && durationMinutes !== 60) {
    return { ok: false, reason: "invalid_duration" };
  }
  if (dogs >= 3) {
    if (durationMinutes !== 60) return { ok: false, reason: "duration_not_offered" };
    return { ok: true, pricePence: prices.price36x60, durationMinutes: 60 };
  }
  if (durationMinutes === 30) {
    return { ok: true, pricePence: prices.price12x30, durationMinutes: 30 };
  }
  return { ok: true, pricePence: prices.price12x60, durationMinutes: 60 };
}

export function applyCredit(
  pricePence: number,
  balancePence: number,
): { creditAppliedPence: number; amountDuePence: number } {
  const price = Math.max(0, pricePence);
  const balance = Math.max(0, Math.floor(balancePence));
  const creditAppliedPence = Math.min(balance, price);
  return { creditAppliedPence, amountDuePence: price - creditAppliedPence };
}

/** Parse a pounds string ("6.50", "£12") into pence without binary float drift. */
export function poundsToPence(value: string): number | null {
  const trimmed = value.trim().replace(/^£/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const pence = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(pence) || pence > 100_000) return null;
  return pence;
}
