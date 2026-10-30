import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { claimPaymentAction } from "@/app/actions/booking";
import { PriceList } from "@/components/price-list";
import { SubmitButton } from "@/components/submit-button";
import { Flash, OpeningSoon } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { formatGbp, formatSlot, formatWhen } from "@/lib/format";
import { loadPublicSettings } from "@/lib/settings";
import { STATUS_LABEL } from "@/lib/site";
import { isBookingLive } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingRow } from "@/lib/types";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Pay", robots: { index: false } };

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ error?: string; ok?: string; new?: string }>;
}) {
  if (!isBookingLive()) return <OpeningSoon />;
  const session = await getSession();
  if (!session) return <OpeningSoon />;
  const { reference } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("bookings").select("*").eq("reference", reference).maybeSingle();
  if (!data) notFound();
  const booking = data as BookingRow;
  const settings = await loadPublicSettings();
  const canClaim = booking.status === "awaiting_payment" || booking.status === "awaiting_balance";
  const checkInQr =
    booking.status === "authorized" && booking.check_in_code
      ? await QRCode.toDataURL(booking.check_in_code, { margin: 1, width: 280 })
      : null;

  return (
    <section className="card stack mx-auto max-w-lg">
      <h1>Soar Valley K9</h1>
      <p className="pill w-fit">{STATUS_LABEL[booking.status] || booking.status}</p>
      <Flash error={query.error} ok={query.ok} />
      {query.new ? <p>The time is held. Please pay, then tell us you’ve paid.</p> : null}
      <p className="text-xl font-semibold">{formatSlot(booking.starts_at, booking.ends_at)}</p>
      <p>
        {booking.dog_count} dogs · {booking.duration_minutes} minutes
      </p>
      <PriceList settings={settings} />
      <p>
        This visit {formatGbp(booking.price_pence)}
        {booking.credit_applied_pence > 0 ? ` · credit ${formatGbp(booking.credit_applied_pence)}` : ""}
      </p>
      <p className="text-3xl font-semibold text-heading">To pay {formatGbp(booking.amount_due_pence)}</p>
      <p>
        Booking reference <strong className="text-2xl tracking-wide">{booking.reference}</strong>
      </p>
      {canClaim && booking.amount_due_pence > 0 ? (
        <>
          <p>Pay with Revolut. In the Revolut note, put your booking reference so we can match it.</p>
          <a className="btn btn-primary" href={settings.revolut_payment_url}>
            Pay with Revolut
          </a>
          <p className="break-all text-sm">
            <a href={settings.revolut_payment_url}>{settings.revolut_payment_url}</a>
          </p>
          <img src="/qr/revolut-pay-qr.svg" alt="Revolut payment QR code" width={280} height={280} className="w-56" />
          <p className="muted">Please pay before {formatWhen(booking.payment_deadline)}.</p>
        </>
      ) : null}
      {canClaim && booking.amount_due_pence === 0 ? (
        <p>Your account credit covers this visit. Tap below and we’ll confirm it. The gate code is emailed after that.</p>
      ) : null}
      {canClaim ? (
        <form action={claimPaymentAction}>
          <input type="hidden" name="reference" value={booking.reference} />
          <SubmitButton variant="secondary">{booking.amount_due_pence === 0 ? "Ask us to confirm" : "I’ve paid"}</SubmitButton>
        </form>
      ) : null}
      {booking.status === "payment_claimed" ? (
        <p>Thanks. We’ll check the payment and email you when the booking is confirmed.</p>
      ) : null}
      {booking.status === "needs_review" ? (
        <p>The payment window has closed. We’re checking this booking. The gate code is not sent until we confirm it.</p>
      ) : null}
      {booking.status === "authorized" && booking.check_in_code ? (
        <>
          <p>This visit is confirmed. The gate code is in your email. Your check-in code is below.</p>
          <p className="text-3xl font-semibold tracking-[0.2em]">{booking.check_in_code}</p>
          {checkInQr ? <img src={checkInQr} alt="QR code for your check-in code" width={280} height={280} /> : null}
        </>
      ) : null}
      {booking.status === "expired" ? <p>This booking expired because payment wasn’t completed in time. The slot is free again.</p> : null}
      <Link href={`/bookings/${booking.reference}`}>Booking details</Link>
    </section>
  );
}
