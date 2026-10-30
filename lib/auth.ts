import { createSupabaseServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/admin";
import type { ProfileRow } from "./types";

export type Session = {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  profile: ProfileRow;
};

export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profile) return null;
    return {
      userId: data.user.id,
      email: data.user.email || profile.email,
      emailConfirmed: Boolean(data.user.email_confirmed_at),
      profile: profile as ProfileRow,
    };
  } catch {
    return null;
  }
}
