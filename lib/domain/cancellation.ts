const DAY_MS = 24 * 60 * 60 * 1000;

const CANCELLABLE = new Set([
  "awaiting_payment",
  "payment_claimed",
  "awaiting_balance",
  "needs_review",
  "authorized",
]);

export type CancellationResult = {
  allowed: boolean;
  late: boolean;
  creditPence: number;
  nextStatus: "cancelled" | "late_cancelled";
};

/**
 * Customer cancellation.
 * 24 hours or more before the slot: authorised visits credit the full price.
 * Unconfirmed visits only return credit that was already taken off the price.
 * Under 24 hours: late cancel, no credit, including credit already applied.
 * Exactly 24 hours still counts as in time.
 */
export function cancellationTerms(input: {
  status: string;
  startsAt: Date;
  now: Date;
  pricePence: number;
  creditAppliedPence: number;
}): CancellationResult {
  if (!CANCELLABLE.has(input.status)) {
    return { allowed: false, late: false, creditPence: 0, nextStatus: "cancelled" };
  }
  const late = input.startsAt.getTime() - input.now.getTime() < DAY_MS;
  if (late) {
    return { allowed: true, late: true, creditPence: 0, nextStatus: "late_cancelled" };
  }
  if (input.status === "authorized") {
    return {
      allowed: true,
      late: false,
      creditPence: input.pricePence,
      nextStatus: "cancelled",
    };
  }
  return {
    allowed: true,
    late: false,
    creditPence: Math.max(0, input.creditAppliedPence),
    nextStatus: "cancelled",
  };
}
