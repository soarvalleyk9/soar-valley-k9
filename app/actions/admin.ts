"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { evaluateCheckIn } from "@/lib/domain/checkin";
import { normalizeCode } from "@/lib/domain/codes";
import { poundsToPence } from "@/lib/domain/pricing";
import { publicDbError } from "@/lib/errors";
import {
  notifyAuthorized,
  notifyBalanceDue,
  notifyCancellation,
  notifyGateCodeUpdated,
  notifyVaccinationRejected,
  notifyVaccinationVerified,
} from "@/lib/email/notify";
import { runDigest } from "@/lib/jobs/digest";
import { runMaintenance } from "@/lib/jobs/reminders";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";
import type { BookingRow, ProfileRow } from "@/lib/types";

async function requireOwner() {
  if (!isBookingLive()) redirect("/admin");
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.profile.role !== "owner") redirect("/");
  return session;
}

async function profileFor(userId: string) {
  const service = tryServiceClient();
  const { data } = await service!.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data as ProfileRow | null;
}

function back(reference: string, message: string) {
  redirect(`/admin/bookings/${reference}?error=` + encodeURIComponent(message));
}

export async function authorizeAction(formData: FormData) {
  const session = await requireOwner();
  const id = String(formData.get("booking_id") || "");
  const reference = String(formData.get("reference") || "");
  const method = String(formData.get("method") || "revolut");
  const service = tryServiceClient()!;
  const { data, error } = await service.rpc("authorize_booking", {
    p_actor: session.userId,
    p_booking_id: id,
    p_method: method === "cash" ? "cash" : "revolut",
  });
  if (error || !data) back(reference, publicDbError(error));
  const payload = data as { booking: BookingRow; gate_code: string; check_in_code: string; already: boolean };
  payload.booking.check_in_code = payload.check_in_code;
  if (!payload.already) {
    const profile = await profileFor(payload.booking.user_id);
    if (profile) await notifyAuthorized(payload.booking, profile, payload.gate_code || "");
  }
  redirect(`/admin/bookings/${reference}?ok=` + encodeURIComponent("Authorised. The customer has been emailed."));
}

export async function recordPaymentAction(formData: FormData) {
  const session = await requireOwner();
  const id = String(formData.get("booking_id") || "");
  const reference = String(formData.get("reference") || "");
  const method = String(formData.get("method") || "revolut");
  const received = poundsToPence(String(formData.get("received") || ""));
  if (received === null || received <= 0) back(reference, "Enter the amount you received, for example 12 or 6.50.");
  const service = tryServiceClient()!;
  const { data, error } = await service.rpc("record_payment", {
    p_actor: session.userId,
    p_booking_id: id,
    p_received_pence: received,
    p_method: method === "cash" ? "cash" : "revolut",
  });
  if (error || !data) back(reference, publicDbError(error));
  const payload = data as {
    outcome?: string;
    booking: BookingRow;
    gate_code?: string;
    check_in_code?: string;
    already?: boolean;
    balance_due_pence?: number;
  };
  const profile = await profileFor(payload.booking.user_id);
  if (payload.outcome === "balance_due" && profile) {
    await notifyBalanceDue(payload.booking, profile);
    redirect(`/admin/bookings/${reference}?ok=` + encodeURIComponent("Balance requested. The slot is still held."));
  }
  if (profile && payload.check_in_code && !payload.already) {
    payload.booking.check_in_code = payload.check_in_code;
    await notifyAuthorized(payload.booking, profile, payload.gate_code || "");
  }
  redirect(`/admin/bookings/${reference}?ok=` + encodeURIComponent("Payment recorded and the visit is authorised."));
}

export async function releaseAction(formData: FormData) {
  const session = await requireOwner();
  const id = String(formData.get("booking_id") || "");
  const reference = String(formData.get("reference") || "");
  const service = tryServiceClient()!;
  const { data, error } = await service.rpc("release_booking", { p_actor: session.userId, p_booking_id: id });
  if (error || !data) back(reference, publicDbError(error));
  const payload = data as { booking: BookingRow; credit_pence: number };
  const profile = await profileFor(payload.booking.user_id);
  if (profile) await notifyCancellation(payload.booking, profile, false, payload.credit_pence);
  redirect(`/admin/bookings/${reference}?ok=` + encodeURIComponent("Slot released."));
}

export async function venueCancelAction(formData: FormData) {
  const session = await requireOwner();
  const id = String(formData.get("booking_id") || "");
  const reference = String(formData.get("reference") || "");
  const service = tryServiceClient()!;
  const { data, error } = await service.rpc("venue_cancel", { p_actor: session.userId, p_booking_id: id });
  if (error || !data) back(reference, publicDbError(error));
  const payload = data as { booking: BookingRow; credit_pence: number };
  const profile = await profileFor(payload.booking.user_id);
  if (profile) await notifyCancellation(payload.booking, profile, false, payload.credit_pence);
  redirect(`/admin/bookings/${reference}?ok=` + encodeURIComponent("Cancelled and the full price was added as credit."));
}

export async function moveBookingAction(formData: FormData) {
  const session = await requireOwner();
  const id = String(formData.get("booking_id") || "");
  const reference = String(formData.get("reference") || "");
  const startsAt = String(formData.get("startsAt") || "");
  const authorize = formData.get("authorize") === "yes";
  const service = tryServiceClient()!;
  const { data, error } = await service.rpc("move_booking", {
    p_actor: session.userId,
    p_booking_id: id,
    p_starts_at: startsAt,
    p_authorize: authorize,
  });
  if (error || !data) back(reference, publicDbError(error));
  const payload = data as { booking: BookingRow; gate_code?: string; check_in_code?: string; already?: boolean };
  if (authorize && payload.check_in_code && !payload.already) {
    payload.booking.check_in_code = payload.check_in_code;
    const profile = await profileFor(payload.booking.user_id);
    if (profile) await notifyAuthorized(payload.booking, profile, payload.gate_code || "");
  }
  redirect(`/admin/bookings/${reference}?ok=` + encodeURIComponent("Booking moved."));
}

export async function checkInAction(formData: FormData) {
  await requireOwner();
  const code = normalizeCode(String(formData.get("code") || ""));
  const service = tryServiceClient()!;
  const { data } = await service.from("bookings").select("*").eq("check_in_code", code).maybeSingle();
  if (!data) {
    redirect("/admin/check-in?error=" + encodeURIComponent("That code isn't valid."));
  }
  const booking = data as BookingRow;
  const decision = evaluateCheckIn({
    code,
    bookingCode: booking.check_in_code,
    status: booking.status,
    startsAt: new Date(booking.starts_at),
    endsAt: new Date(booking.ends_at),
    checkedInAt: booking.checked_in_at ? new Date(booking.checked_in_at) : null,
    now: new Date(),
  });
  if (!decision.ok) {
    redirect("/admin/check-in?error=" + encodeURIComponent(decision.reason) + `&ref=${booking.reference}`);
  }
  const { data: updated } = await service
    .from("bookings")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", booking.id)
    .is("checked_in_at", null)
    .select("reference")
    .maybeSingle();
  if (!updated) {
    redirect("/admin/check-in?error=" + encodeURIComponent("This code has already been used."));
  }
  redirect(`/admin/check-in?ok=${booking.reference}`);
}

export async function verifyVaccinationAction(formData: FormData) {
  const session = await requireOwner();
  const userId = String(formData.get("user_id") || "");
  const expiry = String(formData.get("expiry") || "").trim();
  const service = tryServiceClient()!;
  await service
    .from("vaccination_documents")
    .update({ status: "verified", reviewed_at: new Date().toISOString(), reviewed_by: session.userId })
    .eq("user_id", userId)
    .eq("status", "pending");
  await service
    .from("profiles")
    .update({
      vaccination_status: "verified",
      vaccination_expiry: expiry || null,
      vaccination_reject_reason: null,
      vaccination_expiry_reminded_on: null,
    })
    .eq("id", userId);
  const profile = await profileFor(userId);
  if (profile) await notifyVaccinationVerified(profile);
  redirect("/admin/vaccinations?ok=" + encodeURIComponent("Marked as verified. They can book now."));
}

export async function rejectVaccinationAction(formData: FormData) {
  const session = await requireOwner();
  const userId = String(formData.get("user_id") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (reason.length < 3) {
    redirect("/admin/vaccinations?error=" + encodeURIComponent("Add a short reason so the customer knows what to send."));
  }
  const service = tryServiceClient()!;
  await service
    .from("vaccination_documents")
    .update({
      status: "rejected",
      reject_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.userId,
    })
    .eq("user_id", userId)
    .eq("status", "pending");
  await service
    .from("profiles")
    .update({ vaccination_status: "rejected", vaccination_reject_reason: reason })
    .eq("id", userId);
  const profile = await profileFor(userId);
  if (profile) await notifyVaccinationRejected(profile, reason);
  redirect("/admin/vaccinations?ok=" + encodeURIComponent("Rejection emailed."));
}

export async function updateCustomerAction(formData: FormData) {
  await requireOwner();
  const userId = String(formData.get("user_id") || "");
  const service = tryServiceClient()!;
  const { error } = await service
    .from("profiles")
    .update({
      owner_notes: String(formData.get("owner_notes") || "").slice(0, 4000),
      blocked: formData.get("blocked") === "on",
      is_regular: formData.get("is_regular") === "on",
    })
    .eq("id", userId);
  if (error) redirect(`/admin/customers/${userId}?error=` + encodeURIComponent("Couldn't save."));
  redirect(`/admin/customers/${userId}?ok=` + encodeURIComponent("Saved."));
}

export async function updateRequestAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "open");
  const service = tryServiceClient()!;
  await service
    .from("special_requests")
    .update({
      status: ["open", "quoted", "closed"].includes(status) ? status : "open",
      owner_notes: String(formData.get("owner_notes") || "").slice(0, 4000),
    })
    .eq("id", id);
  redirect("/admin/requests?ok=" + encodeURIComponent("Request updated."));
}

export async function saveSettingsAction(formData: FormData) {
  await requireOwner();
  const price30 = poundsToPence(String(formData.get("price_30") || ""));
  const price60 = poundsToPence(String(formData.get("price_60") || ""));
  const price36 = poundsToPence(String(formData.get("price_36") || ""));
  const openHour = Number(formData.get("open_hour"));
  const closeHour = Number(formData.get("close_hour"));
  const gateCode = String(formData.get("gate_code") || "").trim();
  const reviewsRating = String(formData.get("reviews_rating") || "").trim().slice(0, 10);
  const reviewsCount = Number(formData.get("reviews_count"));
  const reviewsUrl = String(formData.get("reviews_url") || "").trim();
  const revolut = String(formData.get("revolut_payment_url") || "").trim();
  const termsVersion = String(formData.get("terms_version") || "").trim().slice(0, 40);
  if (price30 === null || price60 === null || price36 === null) {
    redirect("/admin/settings?error=" + encodeURIComponent("Enter prices in pounds, such as 6.50 or 12."));
  }
  if (!Number.isInteger(openHour) || !Number.isInteger(closeHour) || closeHour <= openHour || openHour < 0 || closeHour > 23) {
    redirect("/admin/settings?error=" + encodeURIComponent("Closing time has to be after opening time, on the hour."));
  }
  if (gateCode.length < 3 || gateCode.length > 40) {
    redirect("/admin/settings?error=" + encodeURIComponent("Enter a gate code between 3 and 40 characters."));
  }
  if (!reviewsUrl.startsWith("https://") || !revolut.startsWith("https://")) {
    redirect("/admin/settings?error=" + encodeURIComponent("Reviews and payment links need to start with https://"));
  }
  const service = tryServiceClient()!;
  const { data: previous } = await service.from("gate_config").select("gate_code").eq("id", 1).maybeSingle();
  const { error } = await service
    .from("settings")
    .update({
      price_1_2_30_pence: price30,
      price_1_2_60_pence: price60,
      price_3_6_60_pence: price36,
      open_hour: openHour,
      close_hour: closeHour,
      short_notice_enabled: formData.get("short_notice_enabled") === "on",
      reviews_rating: reviewsRating || "4.6",
      reviews_count: Number.isInteger(reviewsCount) && reviewsCount >= 0 ? reviewsCount : 0,
      reviews_url: reviewsUrl,
      revolut_payment_url: revolut,
      terms_version: termsVersion || "2026-10-30",
    })
    .eq("id", 1);
  if (error) redirect("/admin/settings?error=" + encodeURIComponent("Couldn't save settings."));
  await service.from("gate_config").update({ gate_code: gateCode, updated_at: new Date().toISOString() }).eq("id", 1);
  if (previous && previous.gate_code !== gateCode) {
    const { data: upcoming } = await service
      .from("bookings")
      .select("*")
      .eq("status", "authorized")
      .gt("starts_at", new Date().toISOString());
    for (const booking of (upcoming ?? []) as BookingRow[]) {
      const profile = await profileFor(booking.user_id);
      if (profile) await notifyGateCodeUpdated(booking, profile, gateCode);
    }
  }
  redirect("/admin/settings?ok=" + encodeURIComponent("Settings saved."));
}

export async function resendGateCodesAction() {
  await requireOwner();
  const service = tryServiceClient()!;
  const { data: gate } = await service.from("gate_config").select("gate_code").eq("id", 1).maybeSingle();
  const code = gate?.gate_code || "";
  const { data: upcoming } = await service
    .from("bookings")
    .select("*")
    .eq("status", "authorized")
    .gt("starts_at", new Date().toISOString());
  let count = 0;
  for (const booking of (upcoming ?? []) as BookingRow[]) {
    const profile = await profileFor(booking.user_id);
    if (!profile) continue;
    await notifyGateCodeUpdated(booking, profile, code);
    count += 1;
  }
  redirect("/admin/settings?ok=" + encodeURIComponent(`Emailed the current gate code to ${count} upcoming visit${count === 1 ? "" : "s"}.`));
}

export async function runJobsAction(formData: FormData) {
  await requireOwner();
  const job = String(formData.get("job") || "");
  if (job === "digest") await runDigest({ force: true });
  else await runMaintenance();
  redirect("/admin/settings?ok=" + encodeURIComponent(job === "digest" ? "Digest sent." : "Payment check finished."));
}
