export const SHORT_NOTICE_WINDOW_MS = 60 * 60 * 1000;
export const STANDARD_HOLD_MS = 24 * 60 * 60 * 1000;
export const SHORT_NOTICE_HOLD_MS = 60 * 60 * 1000;

/** A booking is short-notice when the slot starts within 60 minutes of booking. */
export function isShortNotice(bookedAt: Date, slotStart: Date): boolean {
  return slotStart.getTime() - bookedAt.getTime() <= SHORT_NOTICE_WINDOW_MS;
}

/**
 * Payment deadline.
 * Ordinary bookings: earliest of booked_at + 24h and the slot start.
 * Short-notice (slot within 60 minutes): earliest of booked_at + 60 minutes and the slot start.
 */
export function paymentDeadline(bookedAt: Date, slotStart: Date): Date {
  const start = slotStart.getTime();
  const booked = bookedAt.getTime();
  if (isShortNotice(bookedAt, slotStart)) {
    return new Date(Math.min(booked + SHORT_NOTICE_HOLD_MS, start));
  }
  return new Date(Math.min(booked + STANDARD_HOLD_MS, start));
}

export type ExpiryOutcome = "none" | "expire" | "needs_review";

/**
 * At the deadline, a claimed or part-paid booking is kept for the owner to review.
 * Anything still unpaid is released.
 */
export function expiryOutcome(
  status: string,
  now: Date,
  deadline: Date,
): ExpiryOutcome {
  if (now.getTime() < deadline.getTime()) return "none";
  if (status === "awaiting_payment") return "expire";
  if (status === "payment_claimed" || status === "awaiting_balance") {
    return "needs_review";
  }
  return "none";
}
