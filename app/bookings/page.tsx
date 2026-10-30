import type { Metadata } from "next";
import Link from "next/link";
import { OpeningSoon } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { formatGbp, formatSlot } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/site";
import { isBookingLive } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingRow } from "@/lib/types";

export const metadata: Metadata = { title: "My bookings", robots: { index: false } };

export default async function BookingsPage() {
  if (!isBookingLive()) return <OpeningSoon />;
  const session = await getSession();
  if (!session) {
    return (
      <section className="card stack">
        <h1>My bookings</h1>
        <Link className="btn btn-primary" href="/login?next=/bookings">
          Log in
        </Link>
      </section>
    );
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("bookings").select("*").eq("user_id", session.userId).order("starts_at", { ascending: false }).limit(50);
  const bookings = (data ?? []) as BookingRow[];
  return (
    <div className="stack">
      <h1>My bookings</h1>
      {bookings.length === 0 ? <p>You haven’t booked yet.</p> : null}
      {bookings.map((booking) => (
        <article key={booking.id} className="card stack">
          <p className="text-lg font-semibold">{formatSlot(booking.starts_at, booking.ends_at)}</p>
          <p>
            {booking.reference} · {booking.dog_count} dogs · {formatGbp(booking.price_pence)}
          </p>
          <p className="pill w-fit">{STATUS_LABEL[booking.status] || booking.status}</p>
          <Link className="btn btn-quiet" href={`/bookings/${booking.reference}`}>
            Open
          </Link>
        </article>
      ))}
      <Link className="btn btn-primary" href="/book">
        Book a visit
      </Link>
    </div>
  );
}
