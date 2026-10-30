import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateCustomerAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "@/components/ui";
import { formatGbp, formatSlot } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/site";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";
import type { BookingRow, ProfileRow } from "@/lib/types";
import { customerName } from "@/lib/types";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!isBookingLive()) return null;
  const service = tryServiceClient()!;
  const { data } = await service.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const profile = data as ProfileRow;
  const [{ data: bookings }, { data: credits }] = await Promise.all([
    service.from("bookings").select("*").eq("user_id", id).order("starts_at", { ascending: false }).limit(20),
    service.from("credits_ledger").select("amount_pence").eq("user_id", id),
  ]);
  const balance = (credits ?? []).reduce((sum, row) => sum + row.amount_pence, 0);
  return (
    <div className="stack">
      <h1>{customerName(profile)}</h1>
      <Flash error={query.error} ok={query.ok} />
      <section className="card stack">
        <p>{profile.email}</p>
        <p>{profile.mobile}</p>
        <p>Vaccinations: {profile.vaccination_status}</p>
        <p>Credit {formatGbp(balance)}</p>
        <form action={updateCustomerAction} className="stack">
          <input type="hidden" name="user_id" value={profile.id} />
          <label className="check">
            <input name="blocked" type="checkbox" defaultChecked={profile.blocked} />
            <span>Pause this account so they cannot book</span>
          </label>
          <label className="check">
            <input name="is_regular" type="checkbox" defaultChecked={profile.is_regular} />
            <span>Regular customer</span>
          </label>
          <label className="stack">
            <span className="label">Private notes</span>
            <textarea className="textarea" name="owner_notes" defaultValue={profile.owner_notes} />
          </label>
          <SubmitButton>Save</SubmitButton>
        </form>
      </section>
      <h2 className="text-xl">Bookings</h2>
      {((bookings ?? []) as BookingRow[]).map((booking) => (
        <a key={booking.id} href={`/admin/bookings/${booking.reference}`} className="card grid gap-1 no-underline">
          <span className="font-semibold text-ink">{formatSlot(booking.starts_at, booking.ends_at)}</span>
          <span>
            {booking.reference} · {STATUS_LABEL[booking.status] || booking.status}
          </span>
        </a>
      ))}
    </div>
  );
}
