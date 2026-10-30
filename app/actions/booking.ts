"use server";

import { redirect } from "next/navigation";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/site";
import { getSession } from "@/lib/auth";
import { addLondonDays, generateSlots, londonDateISO, zonedDateTime } from "@/lib/domain/slots";
import { londonTodayISO } from "@/lib/format";
import { publicDbError } from "@/lib/errors";
import { notifyBookingCreated, notifyCancellation, notifyPaymentClaimed } from "@/lib/email/notify";
import { loadPublicSettings } from "@/lib/settings";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";
import type { BookingRow } from "@/lib/types";

async function requireCustomer() {
  if (!isBookingLive()) redirect("/book");
  const session = await getSession();
  if (!session) redirect("/login?next=/book");
  if (!session.emailConfirmed) redirect("/verify-email?error=" + encodeURIComponent("Confirm your email before booking."));
  return session;
}

async function busyForDate(dateISO: string) {
  const service = tryServiceClient();
  if (!service) return [];
  const start = zonedDateTime(dateISO, 0, 0).toISOString();
  const end = zonedDateTime(addLondonDays(dateISO, 1), 0, 0).toISOString();
  const { data } = await service
    .from("bookings")
    .select("starts_at, ends_at")
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .lt("starts_at", end)
    .gt("ends_at", start);
  return (data ?? []).map((row) => ({
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
  }));
}

export async function createBookingAction(formData: FormData) {
  const session = await requireCustomer();
  const startsAt = new Date(String(formData.get("startsAt") || ""));
  const duration = Number(formData.get("duration"));
  const dogs = Number(formData.get("dogs"));
  const back = `/book/confirm?starts=${encodeURIComponent(startsAt.toISOString())}&duration=${duration}&dogs=${dogs}`;
  if (session.profile.blocked) {
    redirect(back + "&error=" + encodeURIComponent("This account cannot make bookings. Please call us."));
  }
  if (session.profile.vaccination_status !== "verified") {
    redirect("/account?error=" + encodeURIComponent("Upload your vaccination records and wait until we have checked them."));
  }
  if (formData.get("know") !== "on") {
    redirect(back + "&error=" + encodeURIComponent("Only dogs who already know each other can book the field together."));
  }
  if (formData.get("terms") !== "on") {
    redirect(back + "&error=" + encodeURIComponent("Please accept the terms and conditions."));
  }
  if (![30, 60].includes(duration) || !Number.isInteger(dogs) || Number.isNaN(startsAt.getTime())) {
    redirect("/book?error=" + encodeURIComponent("Choose a slot from the list."));
  }

  const settings = await loadPublicSettings();
  const dateISO = londonDateISO(startsAt);
  const today = londonTodayISO();
  if (dateISO < today || dateISO > addLondonDays(today, 90)) {
    redirect("/book?error=" + encodeURIComponent("Choose a date in the next 90 days."));
  }
  const slots = generateSlots({
    dateISO,
    durationMinutes: duration as 30 | 60,
    openHour: settings.open_hour,
    closeHour: settings.close_hour,
    busy: await busyForDate(dateISO),
    shortNoticeEnabled: settings.short_notice_enabled,
  });
  const offered = slots.some((slot) => slot.available && slot.startsAt.getTime() === startsAt.getTime());
  if (!offered) {
    redirect("/book?error=" + encodeURIComponent("That slot is no longer available. Please choose another."));
  }

  const service = tryServiceClient();
  if (!service) redirect("/book");
  const { data, error } = await service.rpc("create_booking", {
    p_user_id: session.userId,
    p_starts_at: startsAt.toISOString(),
    p_duration_minutes: duration,
    p_dog_count: dogs,
    p_dogs_know_each_other: true,
    p_terms_accepted: true,
  });
  if (error || !data) {
    redirect(back + "&error=" + encodeURIComponent(publicDbError(error)));
  }
  const booking = data as BookingRow;
  try {
    await notifyBookingCreated(booking, session.profile);
  } catch (err) {
    console.error(err);
  }
  redirect(`/pay/${booking.reference}?new=1`);
}

export async function claimPaymentAction(formData: FormData) {
  const session = await requireCustomer();
  const reference = String(formData.get("reference") || "");
  const service = tryServiceClient();
  if (!service) redirect(`/pay/${reference}`);
  const { data, error } = await service.rpc("claim_payment", {
    p_user_id: session.userId,
    p_reference: reference,
  });
  if (error || !data) {
    redirect(`/pay/${reference}?error=` + encodeURIComponent(publicDbError(error)));
  }
  const payload = data as { booking: BookingRow; already: boolean };
  if (!payload.already) {
    try {
      await notifyPaymentClaimed(payload.booking, session.profile);
    } catch (err) {
      console.error(err);
    }
  }
  redirect(`/pay/${reference}?ok=` + encodeURIComponent("Thanks. We'll check the payment and email you when the booking is confirmed."));
}

export async function cancelBookingAction(formData: FormData) {
  const session = await requireCustomer();
  const reference = String(formData.get("reference") || "");
  const service = tryServiceClient();
  if (!service) redirect(`/bookings/${reference}`);
  const { data, error } = await service.rpc("cancel_booking", {
    p_user_id: session.userId,
    p_reference: reference,
  });
  if (error || !data) {
    redirect(`/bookings/${reference}/cancel?error=` + encodeURIComponent(publicDbError(error)));
  }
  const payload = data as { booking: BookingRow; late: boolean; credit_pence: number };
  try {
    await notifyCancellation(payload.booking, session.profile, payload.late, payload.credit_pence);
  } catch (err) {
    console.error(err);
  }
  redirect(`/bookings/${reference}?ok=` + encodeURIComponent(payload.late ? "The booking is cancelled. It was inside 24 hours, so no credit was added." : "The booking is cancelled."));
}

export async function specialRequestAction(formData: FormData) {
  const session = await requireCustomer();
  const dogs = Number(formData.get("dog_count"));
  const preferred = String(formData.get("preferred_dates") || "").trim().slice(0, 300);
  const message = String(formData.get("message") || "").trim().slice(0, 2000);
  if (!Number.isInteger(dogs) || dogs < 7 || message.length < 5) {
    redirect("/special-request?error=" + encodeURIComponent("Tell us how many dogs (7 or more) and a short message."));
  }
  const service = tryServiceClient();
  if (!service) redirect("/special-request");
  const { error } = await service.from("special_requests").insert({
    user_id: session.userId,
    dog_count: dogs,
    preferred_dates: preferred,
    message,
  });
  if (error) redirect("/special-request?error=" + encodeURIComponent("We couldn't send that. Please call us."));
  redirect("/special-request?ok=" + encodeURIComponent("Sent. We'll reply by email with a price and a time."));
}
