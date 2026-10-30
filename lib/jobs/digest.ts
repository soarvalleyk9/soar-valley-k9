import { addDays, format, parseISO } from "date-fns";
import { formatSlot, formatWhen, londonHour, londonTodayISO } from "../format";
import { dailyDigestEmail } from "../email/templates";
import { notifyVaccinationExpiry } from "../email/notify";
import { sendEmail } from "../email/send";
import { isPlaceholderGateCode } from "../domain/codes";
import { loadGateCode } from "../settings";
import { ownerEmail } from "../site";
import { STATUS_LABEL } from "../site";
import { tryServiceClient } from "../supabase/admin";
import type { BookingRow, ProfileRow } from "../types";
import { customerName } from "../types";
import { fromZonedTime } from "date-fns-tz";
import { LONDON } from "../domain/slots";

export async function runDigest(options: { force?: boolean } = {}) {
  const service = tryServiceClient();
  if (!service) return { skipped: true as const, reason: "not_configured" };
  if (!options.force && londonHour() !== 6) {
    return { skipped: true as const, reason: "not_6am_london" };
  }

  const today = londonTodayISO();
  if (!options.force) {
    const { data: claimed } = await service
      .from("settings")
      .update({ last_digest_on: today })
      .eq("id", 1)
      .or(`last_digest_on.is.null,last_digest_on.lt.${today}`)
      .select("id");
    if (!claimed?.length) return { skipped: true as const, reason: "already_sent" };
  } else {
    await service.from("settings").update({ last_digest_on: today }).eq("id", 1);
  }

  try {
    const dayStart = fromZonedTime(`${today} 00:00:00`, LONDON).toISOString();
    const dayEnd = fromZonedTime(`${today} 23:59:59`, LONDON).toISOString();
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const horizon = addDays(parseISO(today), 30);
    const soon = format(addDays(parseISO(today), 14), "yyyy-MM-dd");

    const [{ data: openBookings }, { data: todayBookings }, { data: pendingProfiles }, { data: expiring }, { data: requests }] =
      await Promise.all([
        service
          .from("bookings")
          .select("*")
          .in("status", ["awaiting_payment", "payment_claimed", "awaiting_balance", "needs_review"])
          .gte("starts_at", recent)
          .order("starts_at")
          .limit(50),
        service.from("bookings").select("*").gte("starts_at", dayStart).lte("starts_at", dayEnd).order("starts_at"),
        service.from("profiles").select("*").eq("vaccination_status", "pending").limit(50),
        service
          .from("profiles")
          .select("*")
          .eq("vaccination_status", "verified")
          .not("vaccination_expiry", "is", null)
          .lte("vaccination_expiry", format(horizon, "yyyy-MM-dd"))
          .limit(50),
        service.from("special_requests").select("id, dog_count, preferred_dates, status").eq("status", "open").limit(20),
      ]);

    const ids = [
      ...new Set([
        ...(openBookings ?? []).map((row) => row.user_id),
        ...(todayBookings ?? []).map((row) => row.user_id),
      ]),
    ];
    const { data: profiles } = ids.length
      ? await service.from("profiles").select("*").in("id", ids)
      : { data: [] as ProfileRow[] };
    const people = new Map((profiles ?? []).map((row) => [row.id, row as ProfileRow]));

    const lineFor = (booking: BookingRow) => {
      const person = people.get(booking.user_id);
      const name = person ? customerName(person) : "Customer";
      const extra = booking.check_in_code ? ` · check-in ${booking.check_in_code}` : "";
      return `${formatSlot(booking.starts_at, booking.ends_at)} · ${name} · ${booking.dog_count} dogs · ${booking.reference} · ${STATUS_LABEL[booking.status] || booking.status}${extra}`;
    };

    const gateCode = await loadGateCode();
    const email = dailyDigestEmail({
      gateCode,
      sections: [
        { title: "Today", rows: ((todayBookings ?? []) as BookingRow[]).map(lineFor) },
        {
          title: "Waiting on payment or a decision",
          rows: ((openBookings ?? []) as BookingRow[]).map(
            (booking) =>
              `${booking.reference} · ${people.get(booking.user_id) ? customerName(people.get(booking.user_id)!) : "Customer"} · ${formatWhen(booking.starts_at)} · ${STATUS_LABEL[booking.status] || booking.status}`,
          ),
        },
        {
          title: "Vaccinations to check",
          rows: ((pendingProfiles ?? []) as ProfileRow[]).map(
            (profile) => `${customerName(profile)} · ${profile.email} · ${profile.mobile}`,
          ),
        },
        {
          title: "Vaccinations expiring within 30 days",
          rows: ((expiring ?? []) as ProfileRow[]).map(
            (profile) => `${customerName(profile)} · ${profile.email} · ${profile.vaccination_expiry}`,
          ),
        },
        {
          title: "Special requests still open",
          rows: (requests ?? []).map(
            (request) => `${request.dog_count} dogs · ${request.preferred_dates || "dates not given"}`,
          ),
        },
      ],
    });

    const result = await sendEmail({ ...email, to: ownerEmail(), template: "daily_digest" });
    if (!result.sent && !options.force) {
      await service.from("settings").update({ last_digest_on: null }).eq("id", 1);
    }

    for (const profile of (expiring ?? []) as ProfileRow[]) {
      if (!profile.vaccination_expiry) continue;
      if (profile.vaccination_expiry > soon) continue;
      if (profile.vaccination_expiry_reminded_on) continue;
      await notifyVaccinationExpiry(profile, profile.vaccination_expiry);
      await service
        .from("profiles")
        .update({ vaccination_expiry_reminded_on: today })
        .eq("id", profile.id);
    }

    return {
      ok: true as const,
      sent: result.sent,
      placeholderGate: isPlaceholderGateCode(gateCode),
    };
  } catch (err) {
    console.error("digest", err);
    if (!options.force) {
      await service.from("settings").update({ last_digest_on: null }).eq("id", 1);
    }
    return { ok: false as const };
  }
}
