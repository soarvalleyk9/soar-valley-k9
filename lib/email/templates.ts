import { formatGbp, formatSlot, formatWhen } from "../format";
import { isPlaceholderGateCode } from "../domain/codes";
import { SITE, siteUrl } from "../site";
import { bigCode, button, emailShell, esc, lines } from "./render";

export type Email = { subject: string; html: string; text: string };

type Visit = {
  reference: string;
  startsAt: Date | string;
  endsAt: Date | string;
  durationMinutes: number;
  dogCount: number;
  pricePence: number;
  amountDuePence: number;
  customerName: string;
};

function visitRows(visit: Visit): Array<[string, string]> {
  return [
    ["When", formatSlot(visit.startsAt, visit.endsAt)],
    ["Length", `${visit.durationMinutes} minutes`],
    ["Dogs", String(visit.dogCount)],
    ["Price", formatGbp(visit.pricePence)],
    ["Reference", visit.reference],
  ];
}

export function paymentRequestEmail(input: {
  visit: Visit;
  revolutUrl: string;
  payPath: string;
  site?: string;
}): Email {
  const base = input.site ?? siteUrl();
  const payUrl = `${base}${input.payPath}`;
  const due = input.visit.amountDuePence;
  const heading = "Soar Valley K9";
  const intro =
    due > 0
      ? "Please pay for your booking. We will email you once the payment is confirmed."
      : "Your account credit covers this booking. We will email you once it is confirmed.";

  const paymentBlock =
    due > 0
      ? `${lines([
          ["To pay", formatGbp(due)],
          ["Reference", input.visit.reference],
        ])}
        <p style="margin:0 0 8px;font-size:16px;line-height:1.5;">Put your booking reference <strong>${esc(input.visit.reference)}</strong> in the Revolut note so we can match your payment.</p>
        ${button(input.revolutUrl, "Pay with Revolut")}
        <p style="margin:0 0 12px;"><a href="${esc(input.revolutUrl)}" style="color:#2F5D7B;">${esc(input.revolutUrl)}</a></p>
        <img src="${esc(base)}/qr/revolut-pay-qr-email.png" alt="Revolut payment QR code" width="220" style="display:block;width:220px;height:auto;margin:8px 0 16px;">
        <p style="margin:0;font-size:16px;line-height:1.5;">You can also open your payment page: <a href="${esc(payUrl)}" style="color:#2F5D7B;">${esc(payUrl)}</a></p>`
      : `${lines([["To pay", formatGbp(0)], ["Reference", input.visit.reference]])}
        <p style="margin:0;font-size:16px;line-height:1.5;">No bank payment is needed. Open your booking page if you still need to tell us it is ready to confirm: <a href="${esc(payUrl)}" style="color:#2F5D7B;">${esc(payUrl)}</a></p>`;

  const shell = emailShell({
    heading,
    intro,
    site: base,
    bodyHtml: `${lines(visitRows(input.visit))}${paymentBlock}`,
  });
  const text = [
    heading,
    "",
    intro,
    `When: ${formatSlot(input.visit.startsAt, input.visit.endsAt)}`,
    `Length: ${input.visit.durationMinutes} minutes`,
    `Dogs: ${input.visit.dogCount}`,
    `Price: ${formatGbp(input.visit.pricePence)}`,
    `Reference: ${input.visit.reference}`,
    `To pay: ${formatGbp(due)}`,
    due > 0 ? `Pay with Revolut: ${input.revolutUrl}` : "No bank payment is needed.",
    due > 0 ? `Put ${input.visit.reference} in the Revolut note.` : "",
    `Your page: ${payUrl}`,
    shell.textFooter,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    subject: `Pay for your Soar Valley K9 booking ${input.visit.reference}`,
    html: shell.html,
    text,
  };
}

export function balanceDueEmail(input: {
  visit: Visit;
  balancePence: number;
  revolutUrl: string;
  payPath: string;
  site?: string;
}): Email {
  const base = input.site ?? siteUrl();
  const payUrl = `${base}${input.payPath}`;
  const shell = emailShell({
    heading: "Soar Valley K9",
    intro: "We received part of the payment. Please pay the remaining balance.",
    site: base,
    bodyHtml: `${lines([
      ["Still to pay", formatGbp(input.balancePence)],
      ["Reference", input.visit.reference],
      ["When", formatSlot(input.visit.startsAt, input.visit.endsAt)],
    ])}
    <p style="margin:0 0 8px;font-size:16px;">Put <strong>${esc(input.visit.reference)}</strong> in the Revolut note.</p>
    ${button(input.revolutUrl, "Pay the balance")}
    <p><a href="${esc(payUrl)}" style="color:#2F5D7B;">${esc(payUrl)}</a></p>`,
  });
  return {
    subject: `Balance due for ${input.visit.reference}`,
    html: shell.html,
    text: `Soar Valley K9\n\nStill to pay: ${formatGbp(input.balancePence)}\nReference: ${input.visit.reference}\nPay: ${input.revolutUrl}\n${payUrl}${shell.textFooter}`,
  };
}

export function ownerNewBookingEmail(input: { visit: Visit; mobile: string; email: string; adminPath: string; site?: string }): Email {
  const base = input.site ?? siteUrl();
  const url = `${base}${input.adminPath}`;
  const shell = emailShell({
    heading: "New booking",
    intro: `${input.visit.customerName} has booked and the slot is held.`,
    site: base,
    bodyHtml: `${lines([
      ...visitRows(input.visit),
      ["To pay", formatGbp(input.visit.amountDuePence)],
      ["Mobile", input.mobile],
      ["Email", input.email],
    ])}${button(url, "Open in admin")}`,
  });
  return {
    subject: `New booking ${input.visit.reference} — ${formatWhen(input.visit.startsAt)}`,
    html: shell.html,
    text: `New booking ${input.visit.reference}\n${input.visit.customerName}\n${formatSlot(input.visit.startsAt, input.visit.endsAt)}\n${input.visit.dogCount} dogs\nTo pay ${formatGbp(input.visit.amountDuePence)}\n${input.mobile}\n${input.email}\n${url}${shell.textFooter}`,
  };
}

export function ownerPaymentClaimedEmail(input: { visit: Visit; adminPath: string; site?: string }): Email {
  const base = input.site ?? siteUrl();
  const url = `${base}${input.adminPath}`;
  const shell = emailShell({
    heading: "Customer says paid",
    intro: `${input.visit.customerName} says they have paid. Check Revolut, then tap Authorise. The gate code is not sent until you do.`,
    site: base,
    bodyHtml: `${lines([
      ["Amount", formatGbp(input.visit.amountDuePence)],
      ["Reference", input.visit.reference],
      ["When", formatSlot(input.visit.startsAt, input.visit.endsAt)],
      ["Customer", input.visit.customerName],
    ])}${button(url, "Authorise")}`,
  });
  return {
    subject: `Customer says paid — ${input.visit.reference} — ${formatGbp(input.visit.amountDuePence)}`,
    html: shell.html,
    text: `Customer says paid\n${input.visit.reference}\n${formatGbp(input.visit.amountDuePence)}\n${input.visit.customerName}\n${formatSlot(input.visit.startsAt, input.visit.endsAt)}\nAuthorise: ${url}${shell.textFooter}`,
  };
}

export function ownerReminderEmail(input: {
  visit: Visit;
  minutes: 20 | 40;
  adminPath: string;
  site?: string;
}): Email {
  const base = input.site ?? siteUrl();
  const url = `${base}${input.adminPath}`;
  const shell = emailShell({
    heading: "Short-notice booking still open",
    intro: `This booking was made ${input.minutes} minutes ago and is still not authorised.`,
    site: base,
    bodyHtml: `${lines([
      ["Reference", input.visit.reference],
      ["Customer", input.visit.customerName],
      ["When", formatSlot(input.visit.startsAt, input.visit.endsAt)],
      ["To pay", formatGbp(input.visit.amountDuePence)],
    ])}${button(url, "Open booking")}`,
  });
  return {
    subject: `Reminder: ${input.visit.reference} still needs authorising`,
    html: shell.html,
    text: `Short-notice reminder (${input.minutes} min)\n${input.visit.reference}\n${input.visit.customerName}\n${formatSlot(input.visit.startsAt, input.visit.endsAt)}\n${url}${shell.textFooter}`,
  };
}

export function ownerNeedsReviewEmail(input: { visit: Visit; adminPath: string; site?: string }): Email {
  const base = input.site ?? siteUrl();
  const url = `${base}${input.adminPath}`;
  const shell = emailShell({
    heading: "Payment needs a look",
    intro: "The payment deadline has passed. The customer said they paid, so the slot is still held and the gate code has not been sent.",
    site: base,
    bodyHtml: `${lines([
      ["Reference", input.visit.reference],
      ["Customer", input.visit.customerName],
      ["When", formatSlot(input.visit.startsAt, input.visit.endsAt)],
    ])}${button(url, "Review booking")}`,
  });
  return {
    subject: `Needs review — ${input.visit.reference}`,
    html: shell.html,
    text: `Needs review ${input.visit.reference}\n${input.visit.customerName}\n${url}${shell.textFooter}`,
  };
}

function gateBlock(gateCode: string): { html: string; text: string } {
  if (isPlaceholderGateCode(gateCode)) {
    return {
      html: `<p style="margin:16px 0;font-size:16px;line-height:1.5;">The gate code is not ready to send yet. Please call ${esc(SITE.phoneDisplay)} before you travel and we will give it to you.</p>`,
      text: `The gate code is not ready to send yet. Please call ${SITE.phoneDisplay} before you travel.`,
    };
  }
  return {
    html: bigCode("Gate code", gateCode),
    text: `Gate code: ${gateCode}`,
  };
}

export function confirmationEmail(input: {
  visit: Visit;
  gateCode: string;
  checkInCode: string;
  site?: string;
}): Email {
  const gate = gateBlock(input.gateCode);
  const shell = emailShell({
    heading: "Soar Valley K9",
    intro: "Your visit is confirmed. Bring this email with you.",
    site: input.site,
    bodyHtml: `${lines(visitRows(input.visit))}
      ${gate.html}
      ${bigCode("Check-in code", input.checkInCode)}
      <img src="cid:checkin-qr" alt="QR code for your check-in code" width="220" style="display:block;width:220px;height:auto;margin:8px 0 16px;">
      <p style="margin:0;font-size:16px;line-height:1.5;">Arrive at the start time. Please do not arrive more than 5 minutes early. Leave the field and the car park, with the gate locked, by the finish time. The gate code is only in this email and in your reminder.</p>`,
  });
  return {
    subject: `Confirmed: Soar Valley K9 — ${formatSlot(input.visit.startsAt, input.visit.endsAt)}`,
    html: shell.html,
    text: `Your visit is confirmed\n${formatSlot(input.visit.startsAt, input.visit.endsAt)}\n${input.visit.durationMinutes} minutes, ${input.visit.dogCount} dogs\nPrice ${formatGbp(input.visit.pricePence)}\nReference ${input.visit.reference}\n${gate.text}\nCheck-in code: ${input.checkInCode}\n${shell.textFooter}`,
  };
}

export function preSlotReminderEmail(input: {
  visit: Visit;
  gateCode: string;
  checkInCode: string;
  site?: string;
}): Email {
  const gate = gateBlock(input.gateCode);
  const shell = emailShell({
    heading: "Your visit is coming up",
    intro: "This reminder has the current gate code.",
    site: input.site,
    bodyHtml: `${lines([
      ["When", formatSlot(input.visit.startsAt, input.visit.endsAt)],
      ["Dogs", String(input.visit.dogCount)],
      ["Reference", input.visit.reference],
    ])}
    ${gate.html}
    ${bigCode("Check-in code", input.checkInCode)}
    <img src="cid:checkin-qr" alt="QR code for your check-in code" width="220" style="display:block;width:220px;height:auto;">`,
  });
  return {
    subject: `Reminder: Soar Valley K9 ${formatWhen(input.visit.startsAt)}`,
    html: shell.html,
    text: `Your visit is coming up\n${formatSlot(input.visit.startsAt, input.visit.endsAt)}\n${gate.text}\nCheck-in code: ${input.checkInCode}${shell.textFooter}`,
  };
}

export function gateCodeUpdatedEmail(input: {
  visit: Visit;
  gateCode: string;
  checkInCode: string;
  site?: string;
}): Email {
  const gate = gateBlock(input.gateCode);
  const shell = emailShell({
    heading: "Your gate code has changed",
    intro: "Use this code for your upcoming visit. Your check-in code is the same.",
    site: input.site,
    bodyHtml: `${lines([
      ["When", formatSlot(input.visit.startsAt, input.visit.endsAt)],
      ["Reference", input.visit.reference],
    ])}
    ${gate.html}
    ${bigCode("Check-in code", input.checkInCode)}`,
  });
  return {
    subject: `Updated gate code for ${formatWhen(input.visit.startsAt)}`,
    html: shell.html,
    text: `Your gate code has changed\n${formatSlot(input.visit.startsAt, input.visit.endsAt)}\n${gate.text}\nCheck-in code: ${input.checkInCode}${shell.textFooter}`,
  };
}

export function bookingExpiredEmail(input: { visit: Visit; bookPath?: string; site?: string }): Email {
  const base = input.site ?? siteUrl();
  const url = `${base}${input.bookPath ?? "/book"}`;
  const shell = emailShell({
    heading: "Booking expired",
    intro: "We didn't receive payment in time, so the slot has been released.",
    site: base,
    bodyHtml: `${lines([
      ["Reference", input.visit.reference],
      ["When", formatSlot(input.visit.startsAt, input.visit.endsAt)],
    ])}
    <p style="margin:0 0 8px;font-size:16px;">You can book another time whenever you are ready.</p>
    ${button(url, "Book another time")}`,
  });
  return {
    subject: `Booking ${input.visit.reference} has expired`,
    html: shell.html,
    text: `Booking ${input.visit.reference} has expired\n${formatSlot(input.visit.startsAt, input.visit.endsAt)}\nBook another time: ${url}${shell.textFooter}`,
  };
}

export function cancellationEmail(input: {
  visit: Visit;
  late: boolean;
  creditPence: number;
  site?: string;
}): Email {
  const base = input.site ?? siteUrl();
  const intro = input.late
    ? "This was cancelled less than 24 hours before the visit, so nothing has been added to your account credit."
    : input.creditPence > 0
      ? `${formatGbp(input.creditPence)} has been added to your account credit for a future visit. We don't refund to your bank.`
      : "The slot has been released. Nothing was taken, so there is no credit to add.";
  const shell = emailShell({
    heading: input.late ? "Late cancellation" : "Booking cancelled",
    intro,
    site: base,
    bodyHtml: `${lines([
      ["Reference", input.visit.reference],
      ["When", formatSlot(input.visit.startsAt, input.visit.endsAt)],
      ["Credit added", formatGbp(input.creditPence)],
    ])}${button(`${base}/book`, "Book another time")}`,
  });
  return {
    subject: input.late
      ? `Late cancellation ${input.visit.reference}`
      : `Cancelled ${input.visit.reference}`,
    html: shell.html,
    text: `${intro}\n${input.visit.reference}\nCredit added: ${formatGbp(input.creditPence)}${shell.textFooter}`,
  };
}

export function vaccinationVerifiedEmail(input: { name: string; site?: string }): Email {
  const base = input.site ?? siteUrl();
  const shell = emailShell({
    heading: "Vaccinations checked",
    intro: `Thanks ${input.name}. Your vaccination records are verified, so you can book a visit.`,
    site: base,
    bodyHtml: button(`${base}/book`, "Book a visit"),
  });
  return {
    subject: "You can book Soar Valley K9",
    html: shell.html,
    text: `Your vaccination records are verified. Book a visit: ${base}/book${shell.textFooter}`,
  };
}

export function vaccinationRejectedEmail(input: { name: string; reason: string; site?: string }): Email {
  const base = input.site ?? siteUrl();
  const shell = emailShell({
    heading: "Please send your vaccinations again",
    intro: `Thanks ${input.name}. We couldn't verify the records this time.`,
    site: base,
    bodyHtml: `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;"><strong>Reason:</strong> ${esc(input.reason)}</p>
      <p style="margin:0 0 8px;font-size:16px;">Upload a new photo from your account page. You can book once the records are verified.</p>
      ${button(`${base}/account`, "Upload again")}`,
  });
  return {
    subject: "Vaccination records need another look",
    html: shell.html,
    text: `We couldn't verify your vaccination records.\nReason: ${input.reason}\nUpload again: ${base}/account${shell.textFooter}`,
  };
}

export function vaccinationExpiryEmail(input: { name: string; expiry: string; site?: string }): Email {
  const base = input.site ?? siteUrl();
  const shell = emailShell({
    heading: "Vaccination records expiring",
    intro: `${input.name}, the vaccination date we hold runs out on ${input.expiry}. Please upload a newer card so you can keep booking.`,
    site: base,
    bodyHtml: button(`${base}/account`, "Upload a newer card"),
  });
  return {
    subject: "Please update your vaccination records",
    html: shell.html,
    text: `Your vaccination date runs out on ${input.expiry}. Upload a newer card: ${base}/account${shell.textFooter}`,
  };
}

export type DigestSection = { title: string; rows: string[] };

export function dailyDigestEmail(input: {
  sections: DigestSection[];
  gateCode: string;
  site?: string;
}): Email {
  const base = input.site ?? siteUrl();
  const body = input.sections
    .map((section) => {
      const items = section.rows.length
        ? `<ul style="margin:0 0 16px;padding-left:18px;font-size:16px;line-height:1.5;">${section.rows
            .map((row) => `<li>${esc(row)}</li>`)
            .join("")}</ul>`
        : `<p style="margin:0 0 16px;font-size:16px;">None.</p>`;
      return `<h2 style="margin:16px 0 8px;font-size:18px;color:#2F5D7B;">${esc(section.title)}</h2>${items}`;
    })
    .join("");
  const gateLine = isPlaceholderGateCode(input.gateCode)
    ? "Gate code is not set yet. Set it in admin before you authorise a visit."
    : `Current gate code: ${input.gateCode}`;
  const shell = emailShell({
    heading: "Today at Soar Valley K9",
    intro: gateLine,
    site: base,
    bodyHtml: `${body}${button(`${base}/admin`, "Open admin")}`,
  });
  const text = [
    "Today at Soar Valley K9",
    gateLine,
    ...input.sections.flatMap((section) => [
      "",
      section.title,
      ...(section.rows.length ? section.rows.map((row) => `- ${row}`) : ["- None"]),
    ]),
    "",
    `${base}/admin`,
    shell.textFooter,
  ].join("\n");
  return { subject: "Soar Valley K9 daily digest", html: shell.html, text };
}
