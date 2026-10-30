import { tryServiceClient } from "../supabase/admin";

export async function runKeepalive() {
  const service = tryServiceClient();
  if (!service) return { skipped: true as const, reason: "not_configured" };
  const { error } = await service.from("settings").select("id").eq("id", 1).limit(1);
  if (error) {
    console.error("keepalive", error.message);
    return { ok: false as const };
  }
  return { ok: true as const };
}
