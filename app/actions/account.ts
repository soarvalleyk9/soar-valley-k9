"use server";

import { getSession } from "@/lib/auth";
import { tryServiceClient, isBookingLive } from "@/lib/supabase/admin";

export async function registerVaccinationAction(formData: FormData): Promise<{ error?: string }> {
  if (!isBookingLive()) return { error: "Online booking is not switched on yet." };
  const session = await getSession();
  if (!session) return { error: "Please log in again." };
  const path = String(formData.get("path") || "");
  const fileName = String(formData.get("file_name") || "vaccination").slice(0, 180);
  const contentType = String(formData.get("content_type") || "").slice(0, 120);
  if (!path.startsWith(`${session.userId}/`) || path.includes("..")) {
    return { error: "That upload didn't look right. Please try again." };
  }
  const service = tryServiceClient();
  if (!service) return { error: "Online booking is not switched on yet." };
  const folder = session.userId;
  const name = path.slice(folder.length + 1);
  const { data: listed } = await service.storage.from("vaccination-records").list(folder, { search: name, limit: 20 });
  const found = (listed ?? []).some((file) => file.name === name);
  if (!found) return { error: "The photo didn't finish uploading. Please try again." };
  const { error } = await service.from("vaccination_documents").insert({
    user_id: session.userId,
    storage_path: path,
    file_name: fileName,
    content_type: contentType || null,
    status: "pending",
  });
  if (error) return { error: "We saved the photo but couldn't record it. Please try again." };
  if (session.profile.vaccination_status !== "verified") {
    await service.from("profiles").update({ vaccination_status: "pending", vaccination_reject_reason: null }).eq("id", session.userId);
  }
  return {};
}
