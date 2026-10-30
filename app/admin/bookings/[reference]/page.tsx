import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  authorizeAction,
  moveBookingAction,
  recordPaymentAction,
  releaseAction,
  venueCancelAction,
} from "@/app/actions/admin";
import { profilesFor } from "@/lib/admin-data";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "@/components/ui";
import { isPlaceholderGateCode } from "@/lib/domain/codes";
import { nextFreeSlots } from "@/lib/domain/slots";
import { formatGbp, formatSlot, formatWhen } from "@/lib/format";
import { loadGateCode, loadPublicSettings } from "@/lib/settings";
import { ACTIVE_BOOKING_STATUSES, STATUS_LABEL } from "@/lib/site";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";
import type { BookingRow } from "@/lib/types";
import { customerName } from "@/lib/types";

export const metadata: Metadata = { title: "Booking" };

export default async function AdminBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { reference } = await params;
  const query = await searchParams;
  if (!isBookingLive()) return null;
  const service = tryServiceClient()!;
  const { data } = await service.from("bookings").select("*").eq("reference", reference).maybeSingle();
  if (!data) notFound();
  const booking = data as BookingRow;
  const people = await profilesFor([booking.user_id]);
  const person = people.get(booking.user_id);
  const gate = await loadGateCode();
  const settings = await loadPublicSettings();
  const now = new Date();
  const until = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: busyRows } = await service
    .from("bookings")
    .select("starts_at, ends_at, id")
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .neq("id", booking.id)
    .lt("starts_at", until)
    .gt("ends_at", now.toISOString());
  const moves = nextFreeSlots({
    from: now,
    durationMinutes: booking.duration_minutes === 30 ? 30 : 60,
    openHour: settings.open_hour,
    closeHour: settings.close_hour,
    shortNoticeEnabled: settings.short_notice_enabled,
    busy: (busyRows ?? []).map((row) => ({ startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) })),
  });
  const open = ["awaiting_payment", "payment_claimed", "awaiting_balance", "needs_review"].includes(booking.status);
  const due = (booking.amount_due_pence / 100).toFixed(2);
  return (
    <div className="stack">
      <h1>{booking.reference}</h1>
      <Flash error={query.error} ok={query.ok} />
      <section className="card stack">
        <p className="text-3xl font-semibold text-heading">{formatGbp(booking.amount_due_pence)} due</p>
        <p className="pill w-fit">{STATUS_LABEL[booking.status] || booking.status}</p>
        <p>{formatSlot(booking.starts_at, booking.ends_at)}</p>
        <p>
          {person ? customerName(person) : "Customer"}
          {person ? ` · ${person.mobile} · ${person.email}` : ""}
        </p>
        <p>
          {booking.dog_count} dogs · {booking.duration_minutes} minutes · price {formatGbp(booking.price_pence)}
        </p>
        <p>
          Paid {formatGbp(booking.amount_paid_pence)} · credit used {formatGbp(booking.credit_applied_pence)}
        </p>
        <p>Pay by {formatWhen(booking.payment_deadline)}</p>
        {booking.check_in_code ? <p>Check-in code {booking.check_in_code}</p> : null}
        {booking.checked_in_at ? <p>Checked in {formatWhen(booking.checked_in_at)}</p> : null}
        <p>
          Gate code on file:{" "}
          <strong>{isPlaceholderGateCode(gate) ? "not set yet" : gate}</strong>
        </p>
      </section>
      {open ? (
        <section className="card stack">
          <h2 className="text-xl">Authorise</h2>
          <form action={authorizeAction}>
            <input type="hidden" name="booking_id" value={booking.id} />
            <input type="hidden" name="reference" value={booking.reference} />
            <input type="hidden" name="method" value="revolut" />
            <SubmitButton>Authorise Revolut payment</SubmitButton>
          </form>
          <form action={authorizeAction} className="stack">
            <input type="hidden" name="booking_id" value={booking.id} />
            <input type="hidden" name="reference" value={booking.reference} />
            <input type="hidden" name="method" value="cash" />
            <SubmitButton variant="secondary">Paid cash — authorise</SubmitButton>
          </form>
          <form action={recordPaymentAction} className="stack">
            <input type="hidden" name="booking_id" value={booking.id} />
            <input type="hidden" name="reference" value={booking.reference} />
            <input type="hidden" name="method" value="revolut" />
            <label className="stack">
              <span className="label">Amount you actually received (£)</span>
              <input className="input" name="received" inputMode="decimal" defaultValue={due} />
            </label>
            <SubmitButton variant="quiet">Record this amount</SubmitButton>
            <p className="muted">Less than the amount due asks them for the balance. More adds the difference as credit and authorises the visit.</p>
          </form>
        </section>
      ) : null}
      <section className="card stack">
        <h2 className="text-xl">Move to another time</h2>
        {moves.length === 0 ? <p>No free slots in the next two weeks.</p> : null}
        {moves.map((slot) => (
          <form key={slot.startsAt.toISOString()} action={moveBookingAction} className="grid gap-2">
            <input type="hidden" name="booking_id" value={booking.id} />
            <input type="hidden" name="reference" value={booking.reference} />
            <input type="hidden" name="startsAt" value={slot.startsAt.toISOString()} />
            <input type="hidden" name="authorize" value={booking.status === "authorized" ? "yes" : "no"} />
            <button className="btn btn-quiet" type="submit">
              {formatSlot(slot.startsAt, slot.endsAt)}
              {booking.status === "authorized" ? " · move and keep confirmed" : " · move"}
            </button>
          </form>
        ))}
      </section>
      <section className="card stack">
        <h2 className="text-xl">Cancel</h2>
        {booking.status !== "authorized" && booking.amount_paid_pence === 0 ? (
          <form action={releaseAction}>
            <input type="hidden" name="booking_id" value={booking.id} />
            <input type="hidden" name="reference" value={booking.reference} />
            <SubmitButton variant="quiet">Release the slot</SubmitButton>
          </form>
        ) : null}
        <form action={venueCancelAction}>
          <input type="hidden" name="booking_id" value={booking.id} />
          <input type="hidden" name="reference" value={booking.reference} />
          <SubmitButton variant="quiet">Cancel and credit the full price ({formatGbp(booking.price_pence)})</SubmitButton>
        </form>
        <p className="muted">Use the full-price credit if you are cancelling the visit or you received the money. It is account credit, not a bank refund.</p>
      </section>
    </div>
  );
}
