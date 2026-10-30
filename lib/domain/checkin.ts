import { normalizeCode } from "./codes";

const EARLY_MS = 30 * 60 * 1000;

export type CheckInDecision =
  | { ok: true }
  | { ok: false; reason: string };

export function evaluateCheckIn(input: {
  code: string;
  bookingCode: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date;
  checkedInAt: Date | null;
  now: Date;
}): CheckInDecision {
  const entered = normalizeCode(input.code);
  const expected = input.bookingCode ? normalizeCode(input.bookingCode) : "";
  if (!expected || entered !== expected) {
    return { ok: false, reason: "That code isn't valid." };
  }
  if (input.checkedInAt) {
    return { ok: false, reason: "This code has already been used." };
  }
  if (input.status !== "authorized") {
    return {
      ok: false,
      reason: "This booking is not confirmed, so the code cannot be used yet.",
    };
  }
  const start = input.startsAt.getTime();
  const end = input.endsAt.getTime();
  const now = input.now.getTime();
  if (now < start - EARLY_MS) {
    return { ok: false, reason: "Too early. Check-in opens 30 minutes before the slot." };
  }
  if (now > end) {
    return { ok: false, reason: "This visit has finished." };
  }
  return { ok: true };
}
