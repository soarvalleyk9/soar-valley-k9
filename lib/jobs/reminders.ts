import { expiryOutcome } from "../domain/deadline";
import {
  notifyExpired,
  notifyNeedsReview,
  notifyOwnerReminder,
  notifyPreSlot,
} from "../email/notify";
import { tryServiceClient } from "../supabase/admin";
import type { BookingRow, ProfileRow } from "../types";

const ACTIVE_REMIND = ["awaiting_payment", "payment_claimed", "awaiting_balance", "needs_review"];

async function profilesById(ids: string[]): Promise<Map<string, ProfileRow>> {
  const service = tryServiceClient();
  const map = new Map<string, ProfileRow>();
  if (!service || ids.length === 0) return map;
  const { data } = await service.from("profiles").select("*").in("id", ids);
  for (const row of data ?? []) map.set(row.id, row as ProfileRow);
  return map;
}

async function claimReminder(bookingId: string, kind: string): Promise<boolean> {
  const service = tryServiceClient();
  if (!service) return false;
  const { error } = await service.from("booking_reminders").insert({ booking_id: bookingId, kind });
  if (error) return false;
  return true;
}

async function releaseReminder(bookingId: string, kind: string) {
  const service = tryServiceClient();
  if (!service) return;
  await service.from("booking_reminders").delete().eq("booking_id", bookingId).eq("kind", kind);
}

export async function runMaintenance() {
  const service = tryServiceClient();
  if (!service) return { skipped: true as const, reason: "not_configured" };
  const now = new Date();
  const counts = { expired: 0, needsReview: 0, reminders: 0, preSlot: 0 };

  try {
    const { data: due, error } = await service
      .from("bookings")
      .select("*")
      .in("status", ["awaiting_payment", "payment_claimed", "awaiting_balance"])
      .lte("payment_deadline", now.toISOString())
      .limit(100);
    if (error) throw error;

    const people = await profilesById((due ?? []).map((row) => row.user_id));
    for (const booking of (due ?? []) as BookingRow[]) {
      const outcome = expiryOutcome(booking.status, now, new Date(booking.payment_deadline));
      const profile = people.get(booking.user_id);
      if (!profile || outcome === "none") continue;
      if (outcome === "expire") {
        const { data: updated } = await service
          .from("bookings")
          .update({ status: "expired", expired_at: now.toISOString() })
          .eq("id", booking.id)
          .eq("status", "awaiting_payment")
          .select("*")
          .maybeSingle();
        if (!updated) continue;
        counts.expired += 1;
        if (await claimReminder(booking.id, "expiry_customer")) {
          try {
            await notifyExpired(updated as BookingRow, profile);
          } catch {
            await releaseReminder(booking.id, "expiry_customer");
          }
        }
      } else {
        const { data: updated } = await service
          .from("bookings")
          .update({ status: "needs_review" })
          .eq("id", booking.id)
          .in("status", ["payment_claimed", "awaiting_balance"])
          .select("*")
          .maybeSingle();
        if (!updated) continue;
        counts.needsReview += 1;
        if (await claimReminder(booking.id, "needs_review_owner")) {
          try {
            await notifyNeedsReview(updated as BookingRow, profile);
          } catch {
            await releaseReminder(booking.id, "needs_review_owner");
          }
        }
      }
    }

    const { data: shortRows } = await service
      .from("bookings")
      .select("*")
      .eq("is_short_notice", true)
      .in("status", ACTIVE_REMIND)
      .gt("starts_at", now.toISOString())
      .limit(100);
    const shortPeople = await profilesById((shortRows ?? []).map((row) => row.user_id));
    for (const booking of (shortRows ?? []) as BookingRow[]) {
      const profile = shortPeople.get(booking.user_id);
      if (!profile) continue;
      const booked = new Date(booking.booked_at).getTime();
      const checks: Array<[20 | 40, string]> = [
        [20, "short_notice_20"],
        [40, "short_notice_40"],
      ];
      for (const [minutes, kind] of checks) {
        if (now.getTime() < booked + minutes * 60 * 1000) continue;
        if (!(await claimReminder(booking.id, kind))) continue;
        try {
          await notifyOwnerReminder(booking, profile, minutes);
          counts.reminders += 1;
        } catch {
          await releaseReminder(booking.id, kind);
        }
      }
    }

    const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const { data: upcoming } = await service
      .from("bookings")
      .select("*")
      .eq("status", "authorized")
      .gt("starts_at", now.toISOString())
      .lte("starts_at", soon)
      .limit(100);
    const upcomingPeople = await profilesById((upcoming ?? []).map((row) => row.user_id));
    for (const booking of (upcoming ?? []) as BookingRow[]) {
      const profile = upcomingPeople.get(booking.user_id);
      if (!profile || !booking.authorized_at) continue;
      const authorizedAt = new Date(booking.authorized_at).getTime();
      const startsAt = new Date(booking.starts_at).getTime();
      if (startsAt - authorizedAt <= 2 * 60 * 60 * 1000) continue;
      if (!(await claimReminder(booking.id, "pre_slot"))) continue;
      try {
        await notifyPreSlot(booking, profile);
        counts.preSlot += 1;
      } catch {
        await releaseReminder(booking.id, "pre_slot");
      }
    }
  } catch (err) {
    console.error("maintenance", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "failed" };
  }

  return { ok: true as const, ...counts };
}
