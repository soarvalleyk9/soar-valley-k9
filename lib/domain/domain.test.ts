import { describe, expect, it } from "vitest";
import { cancellationTerms } from "./cancellation";
import { evaluateCheckIn } from "./checkin";
import {
  CODE_ALPHABET,
  generateBookingReference,
  generateCode,
  isLookalikeFree,
  isPlaceholderGateCode,
  normalizeCode,
} from "./codes";
import { expiryOutcome, isShortNotice, paymentDeadline } from "./deadline";
import { applyCredit, poundsToPence, priceTierLines, quotePrice } from "./pricing";
import { generateSlots, zonedDateTime } from "./slots";

const prices = { price12x30: 650, price12x60: 1200, price36x60: 1800 };
const hour = 60 * 60 * 1000;
const day = 24 * hour;

describe("pricing", () => {
  it("prices 1–2 dogs at 30 and 60 minutes", () => {
    expect(quotePrice(1, 60, prices)).toEqual({ ok: true, pricePence: 1200, durationMinutes: 60 });
    expect(quotePrice(2, 30, prices)).toEqual({ ok: true, pricePence: 650, durationMinutes: 30 });
    expect(quotePrice(2, 60, prices)).toEqual({ ok: true, pricePence: 1200, durationMinutes: 60 });
  });

  it("prices 3–6 dogs at 60 minutes only", () => {
    expect(quotePrice(3, 60, prices)).toEqual({ ok: true, pricePence: 1800, durationMinutes: 60 });
    expect(quotePrice(6, 60, prices)).toEqual({ ok: true, pricePence: 1800, durationMinutes: 60 });
    expect(quotePrice(3, 30, prices)).toEqual({ ok: false, reason: "duration_not_offered" });
    expect(quotePrice(6, 30, prices)).toEqual({ ok: false, reason: "duration_not_offered" });
  });

  it("sends 7 or more dogs to a special request", () => {
    expect(quotePrice(7, 60, prices)).toEqual({ ok: false, reason: "special_request" });
    expect(quotePrice(12, 30, prices)).toEqual({ ok: false, reason: "special_request" });
  });

  it("rejects empty or nonsense groups", () => {
    expect(quotePrice(0, 60, prices).ok).toBe(false);
    expect(quotePrice(1, 45, prices)).toEqual({ ok: false, reason: "invalid_duration" });
  });

  it("applies account credit without going past the price", () => {
    expect(applyCredit(1200, 500)).toEqual({ creditAppliedPence: 500, amountDuePence: 700 });
    expect(applyCredit(1200, 5000)).toEqual({ creditAppliedPence: 1200, amountDuePence: 0 });
    expect(applyCredit(1200, 0)).toEqual({ creditAppliedPence: 0, amountDuePence: 1200 });
    expect(applyCredit(1200, -100)).toEqual({ creditAppliedPence: 0, amountDuePence: 1200 });
  });

  it("lists every price tier together", () => {
    expect(priceTierLines()).toEqual([
      "1–2 dogs £12/hour or £6.50/30 minutes",
      "3–6 dogs £18/hour only (no 30-minute option)",
      "7+ dogs special request with a manual quote",
    ]);
  });

  it("turns pounds into pence", () => {
    expect(poundsToPence("6.50")).toBe(650);
    expect(poundsToPence("£12")).toBe(1200);
    expect(poundsToPence("18.1")).toBe(1810);
    expect(poundsToPence("12.345")).toBeNull();
    expect(poundsToPence("")).toBeNull();
  });
});

describe("payment deadlines", () => {
  const booked = new Date("2026-11-02T10:00:00.000Z");

  it("holds a booking made days ahead for 24 hours", () => {
    const slot = new Date(booked.getTime() + 3 * day);
    expect(isShortNotice(booked, slot)).toBe(false);
    expect(paymentDeadline(booked, slot).toISOString()).toBe(
      new Date(booked.getTime() + day).toISOString(),
    );
  });

  it("never holds a slot past its start time", () => {
    const slot = new Date(booked.getTime() + 10 * hour);
    expect(isShortNotice(booked, slot)).toBe(false);
    expect(paymentDeadline(booked, slot).toISOString()).toBe(slot.toISOString());
  });

  it("treats a slot within 60 minutes as short-notice", () => {
    const in30 = new Date(booked.getTime() + 30 * 60 * 1000);
    const in60 = new Date(booked.getTime() + hour);
    const in90 = new Date(booked.getTime() + 90 * 60 * 1000);
    expect(isShortNotice(booked, in30)).toBe(true);
    expect(isShortNotice(booked, in60)).toBe(true);
    expect(isShortNotice(booked, in90)).toBe(false);
    expect(paymentDeadline(booked, in30).toISOString()).toBe(in30.toISOString());
    expect(paymentDeadline(booked, in60).toISOString()).toBe(in60.toISOString());
    expect(paymentDeadline(booked, in90).toISOString()).toBe(in90.toISOString());
  });

  it("expires unpaid bookings and keeps claimed ones for review", () => {
    const deadline = new Date("2026-11-03T10:00:00.000Z");
    const before = new Date(deadline.getTime() - 1);
    const at = new Date(deadline.getTime());
    expect(expiryOutcome("awaiting_payment", before, deadline)).toBe("none");
    expect(expiryOutcome("awaiting_payment", at, deadline)).toBe("expire");
    expect(expiryOutcome("payment_claimed", at, deadline)).toBe("needs_review");
    expect(expiryOutcome("awaiting_balance", at, deadline)).toBe("needs_review");
    expect(expiryOutcome("authorized", at, deadline)).toBe("none");
    expect(expiryOutcome("needs_review", at, deadline)).toBe("none");
  });
});

describe("check-in codes", () => {
  it("builds a 6-character lookalike-proof code", () => {
    let n = 0;
    const rng = (max: number) => {
      n += 1;
      return (n * 7) % max;
    };
    const code = generateCode(6, rng);
    expect(code).toHaveLength(6);
    expect(isLookalikeFree(code)).toBe(true);
    expect(code).toMatch(new RegExp(`^[${CODE_ALPHABET}]+$`));
  });

  it("never emits dropped characters across the whole alphabet", () => {
    for (const char of CODE_ALPHABET) {
      expect(isLookalikeFree(char.repeat(6))).toBe(true);
    }
    for (const char of "0O1ILBSUZ6") {
      expect(isLookalikeFree(`ACDE2${char}`)).toBe(false);
    }
    expect(isPlaceholderGateCode("CHANGE-ME")).toBe(true);
    expect(isPlaceholderGateCode("4821")).toBe(false);
  });

  it("prefixes booking references and ignores spaces", () => {
    const ref = generateBookingReference(() => 0);
    expect(ref).toBe(`SV${CODE_ALPHABET[0].repeat(6)}`);
    expect(normalizeCode(" ac de-23 ")).toBe("ACDE23");
  });
});

describe("slots", () => {
  it("builds a full 7am–7pm grid in London time", () => {
    const now = new Date("2026-01-14T12:00:00.000Z");
    const halfHours = generateSlots({
      dateISO: "2026-01-15",
      durationMinutes: 30,
      openHour: 7,
      closeHour: 19,
      now,
    });
    const hours = generateSlots({
      dateISO: "2026-01-15",
      durationMinutes: 60,
      openHour: 7,
      closeHour: 19,
      now,
    });
    expect(halfHours).toHaveLength(24);
    expect(hours).toHaveLength(23);
    expect(halfHours[0].startsAt.toISOString()).toBe(
      zonedDateTime("2026-01-15", 7, 0).toISOString(),
    );
    expect(halfHours[halfHours.length - 1].startsAt.toISOString()).toBe(
      zonedDateTime("2026-01-15", 18, 30).toISOString(),
    );
    expect(hours[hours.length - 1].endsAt.toISOString()).toBe(
      zonedDateTime("2026-01-15", 19, 0).toISOString(),
    );
  });

  it("uses UTC offsets for GMT and British Summer Time", () => {
    expect(zonedDateTime("2026-01-15", 7, 0).toISOString()).toBe("2026-01-15T07:00:00.000Z");
    expect(zonedDateTime("2026-07-15", 7, 0).toISOString()).toBe("2026-07-15T06:00:00.000Z");
  });

  it("blocks overlaps and still allows back-to-back slots", () => {
    const slots = generateSlots({
      dateISO: "2026-01-15",
      durationMinutes: 60,
      openHour: 7,
      closeHour: 19,
      now: new Date("2026-01-14T12:00:00.000Z"),
      busy: [
        {
          startsAt: zonedDateTime("2026-01-15", 9, 0),
          endsAt: zonedDateTime("2026-01-15", 10, 0),
        },
      ],
    });
    const byHour = (h: number, m: number) =>
      slots.find((slot) => slot.startsAt.getTime() === zonedDateTime("2026-01-15", h, m).getTime());
    expect(byHour(8, 30)?.available).toBe(false);
    expect(byHour(9, 0)?.available).toBe(false);
    expect(byHour(9, 30)?.available).toBe(false);
    expect(byHour(10, 0)?.available).toBe(true);
  });

  it("hides past slots and short-notice slots when that switch is off", () => {
    const now = zonedDateTime("2026-01-15", 6, 30);
    const open = generateSlots({
      dateISO: "2026-01-15",
      durationMinutes: 30,
      openHour: 7,
      closeHour: 19,
      now,
      shortNoticeEnabled: false,
    });
    expect(open.some((slot) => slot.shortNotice)).toBe(false);
    expect(open[0].startsAt.toISOString()).toBe(zonedDateTime("2026-01-15", 8, 0).toISOString());
  });
});

describe("cancellation", () => {
  const starts = new Date("2026-11-10T09:00:00.000Z");

  it("credits the full price when an authorised visit is cancelled in time", () => {
    const result = cancellationTerms({
      status: "authorized",
      startsAt: starts,
      now: new Date(starts.getTime() - day),
      pricePence: 1200,
      creditAppliedPence: 500,
    });
    expect(result).toMatchObject({ allowed: true, late: false, creditPence: 1200, nextStatus: "cancelled" });
  });

  it("flags a late cancel and gives no credit", () => {
    const result = cancellationTerms({
      status: "authorized",
      startsAt: starts,
      now: new Date(starts.getTime() - day + 1),
      pricePence: 1200,
      creditAppliedPence: 500,
    });
    expect(result).toMatchObject({ late: true, creditPence: 0, nextStatus: "late_cancelled" });
  });

  it("only returns held credit when payment is not confirmed yet", () => {
    const result = cancellationTerms({
      status: "payment_claimed",
      startsAt: starts,
      now: new Date(starts.getTime() - 2 * day),
      pricePence: 1200,
      creditAppliedPence: 500,
    });
    expect(result.creditPence).toBe(500);
  });
});

describe("check-in validation", () => {
  const starts = new Date("2026-11-10T09:00:00.000Z");
  const ends = new Date("2026-11-10T10:00:00.000Z");
  const base = {
    code: "acde23",
    bookingCode: "ACDE23",
    status: "authorized",
    startsAt: starts,
    endsAt: ends,
    checkedInAt: null,
    now: new Date("2026-11-10T08:50:00.000Z"),
  };

  it("accepts the code in the visit window", () => {
    expect(evaluateCheckIn(base).ok).toBe(true);
  });

  it("rejects a used, early, late, or unconfirmed code", () => {
    expect(evaluateCheckIn({ ...base, checkedInAt: starts }).ok).toBe(false);
    expect(evaluateCheckIn({ ...base, now: new Date(starts.getTime() - 31 * 60 * 1000) }).ok).toBe(false);
    expect(evaluateCheckIn({ ...base, now: new Date(ends.getTime() + 1000) }).ok).toBe(false);
    expect(evaluateCheckIn({ ...base, status: "awaiting_payment" }).ok).toBe(false);
    expect(evaluateCheckIn({ ...base, code: "ZZZZZZ" }).ok).toBe(false);
  });
});
