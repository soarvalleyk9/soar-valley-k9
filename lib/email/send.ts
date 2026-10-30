import { Resend } from "resend";
import { SITE } from "../site";
import { tryServiceClient } from "../supabase/admin";

type Attachment = {
  filename: string;
  content: Buffer;
  inlineContentId?: string;
};

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  bookingId?: string;
  attachments?: Attachment[];
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || `Soar Valley K9 <noreply@securepaddocksuk.co.uk>`;
  const replyTo = process.env.EMAIL_REPLY_TO || SITE.email;
  let errorText: string | null = null;
  let sent = false;

  if (!input.to) {
    errorText = "missing recipient";
  } else if (!apiKey) {
    errorText = "RESEND_API_KEY not set";
    console.warn(`email skipped (${input.template}): ${errorText}`);
  } else {
    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from,
        to: input.to,
        replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments,
      });
      if (error) {
        errorText = error.message;
        console.error("resend", input.template, error.message);
      } else {
        sent = true;
      }
    } catch (err) {
      errorText = err instanceof Error ? err.message : "send failed";
      console.error("resend", input.template, errorText);
    }
  }

  try {
    const service = tryServiceClient();
    if (service) {
      await service.from("email_log").insert({
        to_address: input.to || "missing",
        template: input.template,
        booking_id: input.bookingId ?? null,
        error: errorText,
      });
    }
  } catch {
    // Logging must not block the booking.
  }

  return { sent };
}
