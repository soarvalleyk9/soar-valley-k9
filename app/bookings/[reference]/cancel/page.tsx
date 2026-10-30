import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelBookingAction } from "@/app/actions/booking";
import { SubmitButton } from "@/components/submit-button";
import { Flash, OpeningSoon } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { cancellationTerms } from "@/lib/domain/cancellation";
import { formatGbp, formatSlot } from "@/lib/format";
import { isBookingLive } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingRow } from "@/lib/types";

export const metadata: Metadata = { title: "Cancel booking", robots: { index: false } };

export default async function CancelPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isBookingLive()) return <OpeningSoon />;
  const session = await getSession();
  if (!session) return <OpeningSoon />;
  const { reference } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("bookings").select("*").eq("reference", reference).maybeSingle();
  if (!data || data.user_id !== session.userId) notFound();
  const booking = data as BookingRow;
  const outcome = cancellationTerms({
    status: booking.status,
    startsAt: new Date(booking.starts_at),
    now: new Date(),
    pricePence: booking.price_pence,
    creditAppliedPence: booking.credit_applied_pence,
  });
  return (
    <section className="card stack">
      <h1>Cancel {booking.reference}?</h1>
      <Flash error={query.error} />
      <p>{formatSlot(booking.starts_at, booking.ends_at)}</p>
      {!outcome.allowed ? <p>This booking can no longer be cancelled here.</p> : null}
      {outcome.allowed && outcome.late ? (
        <p>This is less than 24 hours before the visit, so no credit will be added. We don’t refund to your bank.</p>
      ) : null}
      {outcome.allowed && !outcome.late && outcome.creditPence > 0 ? (
        <p>{formatGbp(outcome.creditPence)} will be added to your account credit for a future visit. We don’t refund to your bank.</p>
      ) : null}
      {outcome.allowed && !outcome.late && outcome.creditPence === 0 ? <p>The slot will be released. Nothing has been paid, so no credit is added.</p> : null}
      {outcome.allowed ? (
        <form action={cancelBookingAction}>
          <input type="hidden" name="reference" value={booking.reference} />
          <SubmitButton variant="secondary">Cancel this booking</SubmitButton>
        </form>
      ) : null}
      <Link href={`/bookings/${booking.reference}`}>Keep the booking</Link>
    </section>
  );
}
