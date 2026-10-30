import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash, OpeningSoon } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { formatGbp, formatSlot } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/site";
import { isBookingLive } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingRow } from "@/lib/types";

export const metadata: Metadata = { title: "Booking", robots: { index: false } };

const CAN_CANCEL = new Set(["awaiting_payment", "payment_claimed", "awaiting_balance", "needs_review", "authorized"]);

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
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
  const pay = booking.status === "awaiting_payment" || booking.status === "awaiting_balance" || booking.status === "payment_claimed";
  return (
    <section className="card stack">
      <h1>{booking.reference}</h1>
      <Flash error={query.error} ok={query.ok} />
      <p className="pill w-fit">{STATUS_LABEL[booking.status] || booking.status}</p>
      <p className="text-xl font-semibold">{formatSlot(booking.starts_at, booking.ends_at)}</p>
      <p>
        {booking.dog_count} dogs · {booking.duration_minutes} minutes · {formatGbp(booking.price_pence)}
      </p>
      {booking.status === "authorized" && booking.check_in_code ? (
        <p>
          Check-in code <strong className="text-2xl tracking-widest">{booking.check_in_code}</strong>
          <br />
          <span className="muted">The gate code is in your confirmation email.</span>
        </p>
      ) : null}
      {pay ? (
        <Link className="btn btn-primary" href={`/pay/${booking.reference}`}>
          {booking.status === "payment_claimed" ? "Payment page" : "Pay"}
        </Link>
      ) : null}
      {CAN_CANCEL.has(booking.status) ? (
        <Link className="btn btn-quiet" href={`/bookings/${booking.reference}/cancel`}>
          Cancel booking
        </Link>
      ) : null}
    </section>
  );
}
