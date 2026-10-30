import { describe, expect, it } from "vitest";
import {
  balanceDueEmail,
  bookingExpiredEmail,
  cancellationEmail,
  confirmationEmail,
  ownerNewBookingEmail,
  ownerPaymentClaimedEmail,
  paymentRequestEmail,
  preSlotReminderEmail,
} from "./templates";

const visit = {
  reference: "SVACDE23",
  startsAt: new Date("2026-11-10T09:00:00.000Z"),
  endsAt: new Date("2026-11-10T10:00:00.000Z"),
  durationMinutes: 60,
  dogCount: 2,
  pricePence: 1200,
  amountDuePence: 1200,
  customerName: "Ada Lovelace",
};

const FORBIDDEN_PAYEE = "Soar Valley Canine";

describe("payment emails", () => {
  it("asks for payment with the reference and Revolut link, and nothing else sensitive", () => {
    const email = paymentRequestEmail({
      visit,
      revolutUrl: "https://checkout.revolut.com/pay/example",
      payPath: "/pay/SVACDE23",
      site: "https://www.securepaddocksuk.co.uk",
    });
    const blob = `${email.subject}\n${email.html}\n${email.text}`;
    expect(email.html).toContain("Soar Valley K9");
    expect(blob).toContain("£12.00");
    expect(blob).toContain("1–2 dogs £12/hour or £6.50/30 minutes");
    expect(blob).toContain("3–6 dogs £18/hour only (no 30-minute option)");
    expect(blob).toContain("7+ dogs special request with a manual quote");
    expect(blob).toContain("SVACDE23");
    expect(blob).toContain("https://checkout.revolut.com/pay/example");
    expect(blob).toContain("revolut-pay-qr-email.png");
    expect(blob.toLowerCase()).not.toContain("gate");
    expect(blob).not.toContain(FORBIDDEN_PAYEE);
    expect(blob.toLowerCase()).not.toContain("payee");
  });

  it("keeps the balance email free of the gate code", () => {
    const email = balanceDueEmail({
      visit,
      balancePence: 400,
      revolutUrl: "https://checkout.revolut.com/pay/example",
      payPath: "/pay/SVACDE23",
      site: "https://www.securepaddocksuk.co.uk",
    });
    const blob = `${email.html}\n${email.text}`;
    expect(blob).toContain("£4.00");
    expect(blob.toLowerCase()).not.toContain("gate");
    expect(blob).not.toContain(FORBIDDEN_PAYEE);
  });
});

describe("confirmation emails", () => {
  it("includes the gate code and check-in code only after authorise", () => {
    const email = confirmationEmail({
      visit,
      gateCode: "4821",
      checkInCode: "ACDE23",
      site: "https://www.securepaddocksuk.co.uk",
    });
    expect(email.html).toContain("4821");
    expect(email.text).toContain("ACDE23");
    expect(email.html).toContain("cid:checkin-qr");
    expect(`${email.html}${email.text}`).not.toContain(FORBIDDEN_PAYEE);
  });

  it("does not send the placeholder gate code", () => {
    const email = confirmationEmail({
      visit,
      gateCode: "CHANGE-ME",
      checkInCode: "ACDE23",
      site: "https://www.securepaddocksuk.co.uk",
    });
    expect(email.html).not.toContain("CHANGE-ME");
    expect(email.text).toContain("not ready");
    expect(email.text).toContain("ACDE23");
  });

  it("puts the current gate code in the pre-slot reminder", () => {
    const email = preSlotReminderEmail({
      visit,
      gateCode: "9981",
      checkInCode: "ACDE23",
      site: "https://www.securepaddocksuk.co.uk",
    });
    expect(email.text).toContain("9981");
    expect(email.text).toContain("ACDE23");
  });
});

describe("other customer emails stay clear of the gate", () => {
  it("covers expiry and cancellation", () => {
    const expired = bookingExpiredEmail({ visit, site: "https://www.securepaddocksuk.co.uk" });
    const cancelled = cancellationEmail({
      visit,
      late: false,
      creditPence: 1200,
      site: "https://www.securepaddocksuk.co.uk",
    });
    expect(`${expired.text} ${cancelled.text}`.toLowerCase()).not.toContain("gate");
    expect(cancelled.text).toContain("£12.00");
    expect(cancelled.text).not.toContain(FORBIDDEN_PAYEE);
  });
});

describe("owner alerts", () => {
  it("tells the owner about a new booking and a payment claim", () => {
    const created = ownerNewBookingEmail({
      visit,
      mobile: "07921136975",
      email: "ada@example.com",
      adminPath: "/admin/bookings/SVACDE23",
      site: "https://www.securepaddocksuk.co.uk",
    });
    const claimed = ownerPaymentClaimedEmail({
      visit,
      adminPath: "/admin/authorize",
      site: "https://www.securepaddocksuk.co.uk",
    });
    expect(created.text).toContain("Ada Lovelace");
    expect(claimed.subject).toContain("Customer says paid");
    expect(claimed.text.toLowerCase()).toContain("authorise");
  });
});
