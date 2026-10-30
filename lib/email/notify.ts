import QRCode from "qrcode";
import { isPlaceholderGateCode } from "../domain/codes";
import type { BookingRow, ProfileRow } from "../types";
import { customerName } from "../types";
import { loadGateCode, loadPublicSettings, toPriceList } from "../settings";
import { ownerEmail } from "../site";
import { pushOwners } from "../push";
import { sendEmail } from "./send";
import {
  balanceDueEmail,
  bookingExpiredEmail,
  cancellationEmail,
  confirmationEmail,
  ownerNeedsReviewEmail,
  ownerNewBookingEmail,
  ownerPaymentClaimedEmail,
  ownerReminderEmail,
  paymentRequestEmail,
  preSlotReminderEmail,
  vaccinationExpiryEmail,
  vaccinationRejectedEmail,
  vaccinationVerifiedEmail,
  gateCodeUpdatedEmail,
  type Email,
} from "./templates";
import { emailShell } from "./render";

export function toVisit(booking: BookingRow, profile: Pick<ProfileRow, "first_name" | "surname">) {
  return {
    reference: booking.reference,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    durationMinutes: booking.duration_minutes,
    dogCount: booking.dog_count,
    pricePence: booking.price_pence,
    amountDuePence: booking.amount_due_pence,
    customerName: customerName(profile),
  };
}

async function qrAttachment(code: string) {
  const content = await QRCode.toBuffer(code, {
    type: "png",
    width: 280,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  return [{ filename: "check-in-code.png", content, inlineContentId: "checkin-qr" }];
}

export async function notifyBookingCreated(booking: BookingRow, profile: ProfileRow) {
  const settings = await loadPublicSettings();
  const visit = toVisit(booking, profile);
  const prices = toPriceList(settings);
  const customer = paymentRequestEmail({
    visit,
    revolutUrl: settings.revolut_payment_url,
    payPath: `/pay/${booking.reference}`,
    prices,
  });
  const owner = ownerNewBookingEmail({
    visit,
    mobile: profile.mobile,
    email: profile.email,
    adminPath: `/admin/bookings/${booking.reference}`,
    prices,
  });
  await Promise.all([
    sendEmail({ ...customer, to: profile.email, template: "payment_request", bookingId: booking.id }),
    sendEmail({ ...owner, to: ownerEmail(), template: "owner_new_booking", bookingId: booking.id }),
    pushOwners(
      "New booking",
      `${visit.customerName} · ${visit.reference}`,
      `/admin/bookings/${booking.reference}`,
    ),
  ]);
}

export async function notifyPaymentClaimed(booking: BookingRow, profile: ProfileRow) {
  const visit = toVisit(booking, profile);
  const prices = toPriceList(await loadPublicSettings());
  const owner = ownerPaymentClaimedEmail({ visit, adminPath: `/admin/authorize`, prices });
  await Promise.all([
    sendEmail({ ...owner, to: ownerEmail(), template: "owner_payment_claimed", bookingId: booking.id }),
    pushOwners("Customer says paid", `${visit.reference} is waiting to authorise`, "/admin/authorize"),
  ]);
}

export async function notifyAuthorized(booking: BookingRow, profile: ProfileRow, gateCode: string) {
  const visit = toVisit(booking, profile);
  const code = booking.check_in_code || "";
  const email = confirmationEmail({
    visit,
    gateCode,
    checkInCode: code,
    prices: toPriceList(await loadPublicSettings()),
  });
  const attachments = code ? await qrAttachment(code) : undefined;
  await sendEmail({
    ...email,
    to: profile.email,
    template: "confirmation",
    bookingId: booking.id,
    attachments,
  });
  if (isPlaceholderGateCode(gateCode)) {
    const shell = emailShell({
      heading: "Gate code not set",
      intro: `${visit.customerName} was confirmed for ${visit.reference}, but the gate code is still the placeholder so it was not included.`,
      bodyHtml: `<p style="font-size:16px;">Set the real gate code in admin. Upcoming confirmed visits are emailed when you save it.</p>`,
    });
    await sendEmail({
      to: ownerEmail(),
      subject: `Set the gate code — ${visit.reference} is confirmed`,
      html: shell.html,
      text: `Set the gate code. ${visit.reference} is confirmed and the customer was not given a code.\n${shell.textFooter}`,
      template: "owner_gate_missing",
      bookingId: booking.id,
    });
  }
}

export async function notifyBalanceDue(booking: BookingRow, profile: ProfileRow) {
  const settings = await loadPublicSettings();
  const email = balanceDueEmail({
    visit: toVisit(booking, profile),
    balancePence: booking.amount_due_pence,
    revolutUrl: settings.revolut_payment_url,
    payPath: `/pay/${booking.reference}`,
    prices: toPriceList(settings),
  });
  await sendEmail({ ...email, to: profile.email, template: "balance_due", bookingId: booking.id });
}

export async function notifyExpired(booking: BookingRow, profile: ProfileRow) {
  const email = bookingExpiredEmail({ visit: toVisit(booking, profile) });
  await sendEmail({ ...email, to: profile.email, template: "booking_expired", bookingId: booking.id });
}

export async function notifyNeedsReview(booking: BookingRow, profile: ProfileRow) {
  const email = ownerNeedsReviewEmail({
    visit: toVisit(booking, profile),
    adminPath: `/admin/bookings/${booking.reference}`,
  });
  await sendEmail({ ...email, to: ownerEmail(), template: "owner_needs_review", bookingId: booking.id });
}

export async function notifyOwnerReminder(booking: BookingRow, profile: ProfileRow, minutes: 20 | 40) {
  const email = ownerReminderEmail({
    visit: toVisit(booking, profile),
    minutes,
    adminPath: `/admin/bookings/${booking.reference}`,
    prices: toPriceList(await loadPublicSettings()),
  });
  await sendEmail({ ...email, to: ownerEmail(), template: `owner_reminder_${minutes}`, bookingId: booking.id });
}

export async function notifyPreSlot(booking: BookingRow, profile: ProfileRow) {
  const gateCode = await loadGateCode();
  const code = booking.check_in_code || "";
  const email = preSlotReminderEmail({
    visit: toVisit(booking, profile),
    gateCode,
    checkInCode: code,
  });
  const attachments = code ? await qrAttachment(code) : undefined;
  await sendEmail({
    ...email,
    to: profile.email,
    template: "pre_slot",
    bookingId: booking.id,
    attachments,
  });
}

export async function notifyGateCodeUpdated(booking: BookingRow, profile: ProfileRow, gateCode: string) {
  const email = gateCodeUpdatedEmail({
    visit: toVisit(booking, profile),
    gateCode,
    checkInCode: booking.check_in_code || "",
  });
  await sendEmail({ ...email, to: profile.email, template: "gate_code_updated", bookingId: booking.id });
}

export async function notifyCancellation(
  booking: BookingRow,
  profile: ProfileRow,
  late: boolean,
  creditPence: number,
) {
  const email = cancellationEmail({
    visit: toVisit(booking, profile),
    late,
    creditPence,
    prices: toPriceList(await loadPublicSettings()),
  });
  await sendEmail({ ...email, to: profile.email, template: "cancellation", bookingId: booking.id });
  await sendEmail({
    to: ownerEmail(),
    subject: `${late ? "Late cancellation" : "Cancellation"} ${booking.reference}`,
    html: email.html,
    text: email.text,
    template: "owner_cancellation",
    bookingId: booking.id,
  });
}

export async function notifyVaccinationVerified(profile: ProfileRow) {
  const email = vaccinationVerifiedEmail({ name: profile.first_name || "there" });
  await sendEmail({ ...email, to: profile.email, template: "vaccination_verified" });
}

export async function notifyVaccinationRejected(profile: ProfileRow, reason: string) {
  const email = vaccinationRejectedEmail({ name: profile.first_name || "there", reason });
  await sendEmail({ ...email, to: profile.email, template: "vaccination_rejected" });
}

export async function notifyVaccinationExpiry(profile: ProfileRow, expiry: string) {
  const email = vaccinationExpiryEmail({ name: profile.first_name || "there", expiry });
  await sendEmail({ ...email, to: profile.email, template: "vaccination_expiry" });
}

export async function sendPrepared(to: string, email: Email, template: string) {
  return sendEmail({ ...email, to, template });
}
