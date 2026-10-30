import { randomInt } from "crypto";

/**
 * Lookalike-proof alphabet.
 * Dropped: 0 O, 1 I L, B (8), S (5), Z (2), U (V), 6 (G).
 * 8, 5 and 2 stay because their letter twins are gone.
 */
export const CODE_ALPHABET = "ACDEFGHJKMNPQRTVWXY2345789";

const FORBIDDEN = /[0O1ILBSUZ6]/;

export function generateCode(
  length = 6,
  rng: (exclusiveMax: number) => number = (max) => randomInt(0, max),
): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[rng(CODE_ALPHABET.length)];
  }
  return out;
}

export function generateBookingReference(
  rng?: (exclusiveMax: number) => number,
): string {
  return `SV${generateCode(6, rng)}`;
}

export function normalizeCode(input: string): string {
  return input.replace(/[\s-]+/g, "").toUpperCase();
}

export function isLookalikeFree(code: string): boolean {
  if (!code) return false;
  if (FORBIDDEN.test(code)) return false;
  return [...code].every((char) => CODE_ALPHABET.includes(char));
}

/** Placeholder stored until the owner saves the real gate code. Never email it. */
export function isPlaceholderGateCode(code: string | null | undefined): boolean {
  const value = (code ?? "").trim().toUpperCase();
  return value.length === 0 || value === "CHANGE-ME" || value === "0000";
}
