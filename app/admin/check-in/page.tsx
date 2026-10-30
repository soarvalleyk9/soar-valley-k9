import type { Metadata } from "next";
import { CheckInForm } from "@/components/check-in-form";
import { Flash } from "@/components/ui";
import { profilesFor } from "@/lib/admin-data";
import { formatSlot } from "@/lib/format";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";
import type { BookingRow } from "@/lib/types";
import { customerName } from "@/lib/types";

export const metadata: Metadata = { title: "Check-in" };

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  let success: { booking: BookingRow; name: string } | null = null;
  if (query.ok && isBookingLive()) {
    const service = tryServiceClient()!;
    const { data } = await service.from("bookings").select("*").eq("reference", query.ok).maybeSingle();
    if (data) {
      const people = await profilesFor([data.user_id]);
      const person = people.get(data.user_id);
      success = { booking: data as BookingRow, name: person ? customerName(person) : "Customer" };
    }
  }
  return (
    <div className="stack">
      <h1>Check-in</h1>
      <p>You can check someone in from 30 minutes before their slot until it ends.</p>
      <Flash error={query.error} />
      {success ? (
        <section className="card stack">
          <p className="text-2xl font-semibold text-moss">Checked in</p>
          <p className="text-xl">{success.name}</p>
          <p>
            {success.booking.dog_count} dogs · {formatSlot(success.booking.starts_at, success.booking.ends_at)}
          </p>
          <p>{success.booking.reference}</p>
        </section>
      ) : null}
      <section className="card">
        <CheckInForm />
      </section>
    </div>
  );
}
