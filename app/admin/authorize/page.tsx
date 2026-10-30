import type { Metadata } from "next";
import Link from "next/link";
import { authorizeAction } from "@/app/actions/admin";
import { profilesFor } from "@/lib/admin-data";
import { SubmitButton } from "@/components/submit-button";
import { formatGbp, formatSlot } from "@/lib/format";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";
import type { BookingRow } from "@/lib/types";
import { customerName } from "@/lib/types";

export const metadata: Metadata = { title: "Authorise" };

export default async function AuthorizePage() {
  if (!isBookingLive()) return null;
  const service = tryServiceClient()!;
  const { data } = await service
    .from("bookings")
    .select("*")
    .in("status", ["payment_claimed", "awaiting_balance", "needs_review", "awaiting_payment"])
    .order("starts_at")
    .limit(40);
  const rows = (data ?? []) as BookingRow[];
  const people = await profilesFor(rows.map((row) => row.user_id));
  const queue = rows.filter((row) => row.status !== "awaiting_payment" || row.is_short_notice);
  return (
    <div className="stack">
      <h1>Authorise</h1>
      <p>The gate code is emailed only after you tap Authorise.</p>
      {queue.length === 0 ? <p>Nothing is waiting.</p> : null}
      {queue.map((booking) => {
        const person = people.get(booking.user_id);
        return (
          <article key={booking.id} className="card stack">
            <p className="text-3xl font-semibold text-heading">{formatGbp(booking.amount_due_pence)}</p>
            <p className="text-2xl font-semibold tracking-wide">{booking.reference}</p>
            <p>{formatSlot(booking.starts_at, booking.ends_at)}</p>
            <p>
              {person ? customerName(person) : "Customer"}
              {person ? ` · ${person.mobile}` : ""} · {booking.dog_count} dogs
            </p>
            <p className="pill w-fit">{booking.status.replace(/_/g, " ")}</p>
            <form action={authorizeAction}>
              <input type="hidden" name="booking_id" value={booking.id} />
              <input type="hidden" name="reference" value={booking.reference} />
              <input type="hidden" name="method" value="revolut" />
              <SubmitButton>Authorise</SubmitButton>
            </form>
            <Link className="btn btn-quiet" href={`/admin/bookings/${booking.reference}`}>
              Underpaid, cash, or more
            </Link>
          </article>
        );
      })}
    </div>
  );
}
