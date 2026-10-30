import { tryServiceClient } from "./supabase/admin";
import type { ProfileRow } from "./types";

export async function profilesFor(ids: string[]): Promise<Map<string, ProfileRow>> {
  const map = new Map<string, ProfileRow>();
  const service = tryServiceClient();
  const unique = [...new Set(ids)];
  if (!service || unique.length === 0) return map;
  const { data } = await service.from("profiles").select("*").in("id", unique);
  for (const row of data ?? []) map.set(row.id, row as ProfileRow);
  return map;
}
