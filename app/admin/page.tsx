import type { Metadata } from "next";
import Link from "next/link";
import { profilesFor } from "@/lib/admin-data";
import { formatSlot, londonTodayISO } from "@/lib/format";
import { isPlaceholderGateCode } from "@/lib/domain/codes";
import { loadGateCode } from "@/lib/settings";
import { STATUS_LABEL } from "@/lib/site";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";
import type { BookingRow } from "@/lib/types";
import { customerName } from "@/lib/types";
import { fromZonedTime } from "date-fns-tz";
import { LONDON, addLondonDays } from "@/lib/domain/slots";

export const metadata: Metadata = { title: "Today" };

export default async function AdminHomePage() {
  if (!isBookingLive()) return null;
  const service = tryServiceClient()!;
  const today = londonTodayISO();
  const start = fromZonedTime(`${today} 00:00:00`, LONDON).toISOString();
  const end = fromZonedTime(`${addLondonDays(today, 8)} 00:00:00`, LONDON).toISOString();
  const [{ data: upcoming }, { count: pendingVax }, { count: openRequests }, gate] = await Promise.all([
    service.from("bookings").select("*").gte("starts_at", start).lt("starts_at", end).order("starts_at").limit(80),
    service.from("profiles").select("id", { count: "exact", head: true }).eq("vaccination_status", "pending"),
    service.from("special_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    loadGateCode(),
  ]);
  const rows = (upcoming ?? []) as BookingRow[];
  const people = await profilesFor(rows.map((row) => row.user_id));
  const waiting = rows.filter((row) => ["payment_claimed", "awaiting_balance", "needs_review"].includes(row.status));
  return (
    <div className="stack">
      {isPlaceholderGateCode(gate) ? (
        <p className="card">
          The gate code is still the placeholder. Set the real one in{" "}
          <Link href="/admin/settings">settings</Link> before you authorise a visit.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link className="card no-underline" href="/admin/authorize">
          <p className="text-3xl font-semibold text-heading">{waiting.length}</p>
          <p>Need a decision</p>
        </Link>
        <Link className="card no-underline" href="/admin/vaccinations">
          <p className="text-3xl font-semibold text-heading">{pendingVax ?? 0}</p>
          <p>Vaccinations to check</p>
        </Link>
        <Link className="card no-underline" href="/admin/requests">
          <p className="text-3xl font-semibold text-heading">{openRequests ?? 0}</p>
          <p>Special requests</p>
        </Link>
      </div>
      <h2 className="text-xl">Next 7 days</h2>
      {rows.length === 0 ? <p>No bookings in the next week.</p> : null}
      {rows.map((booking) => {
        const person = people.get(booking.user_id);
        return (
          <Link key={booking.id} href={`/admin/bookings/${booking.reference}`} className="card grid gap-1 no-underline">
            <span className="font-semibold text-ink">{formatSlot(booking.starts_at, booking.ends_at)}</span>
            <span>
              {person ? customerName(person) : "Customer"} · {booking.dog_count} dogs · {booking.reference}
            </span>
            <span className="pill w-fit">{STATUS_LABEL[booking.status] || booking.status}</span>
          </Link>
        );
      })}
    </div>
  );
}
