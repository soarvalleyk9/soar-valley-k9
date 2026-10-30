"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/errors";
import { loadPublicSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";
import { isBookingLive } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function cleanMobile(value: string): string | null {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return trimmed;
}

export async function registerAction(formData: FormData) {
  if (!isBookingLive()) redirect("/register");
  if (String(formData.get("website") || "")) redirect("/verify-email");
  const settings = await loadPublicSettings();
  const parsed = z
    .object({
      first_name: z.string().trim().min(1).max(80),
      surname: z.string().trim().min(1).max(80),
      email: z.string().trim().email().max(200),
      password: z.string().min(8).max(72),
      confirm: z.string(),
    })
    .safeParse({
      first_name: formData.get("first_name"),
      surname: formData.get("surname"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });
  const mobile = cleanMobile(String(formData.get("mobile") || ""));
  if (!parsed.success || !mobile) {
    redirect("/register?error=" + encodeURIComponent("Check your name, mobile, email and password. Passwords need at least 8 characters."));
  }
  if (parsed.data.password !== parsed.data.confirm) {
    redirect("/register?error=" + encodeURIComponent("The two passwords don't match."));
  }
  if (formData.get("terms") !== "on") {
    redirect("/register?error=" + encodeURIComponent("Please accept the terms and conditions."));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/account`,
      data: {
        first_name: parsed.data.first_name,
        surname: parsed.data.surname,
        mobile,
        terms_version: settings.terms_version,
      },
    },
  });
  if (error) {
    redirect("/register?error=" + encodeURIComponent("We couldn't create the account. If you already registered, try logging in."));
  }
  redirect("/verify-email?email=" + encodeURIComponent(parsed.data.email));
}

export async function loginAction(formData: FormData) {
  if (!isBookingLive()) redirect("/login");
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = safeNextPath(String(formData.get("next") || "/book"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const message = /confirm/i.test(error.message)
      ? "Please confirm your email first. Check your inbox for the link."
      : "That email or password is not right.";
    redirect(`/login?next=${encodeURIComponent(next)}&error=` + encodeURIComponent(message));
  }
  redirect(next);
}

export async function logoutAction() {
  if (isBookingLive()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function forgotAction(formData: FormData) {
  if (!isBookingLive()) redirect("/forgot-password");
  const email = String(formData.get("email") || "").trim();
  if (email) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
    });
  }
  redirect("/forgot-password?ok=" + encodeURIComponent("If we know that email, we've sent a reset link."));
}

export async function resendVerificationAction(formData: FormData) {
  if (!isBookingLive()) redirect("/verify-email");
  const email = String(formData.get("email") || "").trim();
  if (email) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/account` },
    });
  }
  redirect("/verify-email?email=" + encodeURIComponent(email) + "&ok=" + encodeURIComponent("If the account is waiting, we've sent another email."));
}

export async function resetPasswordAction(formData: FormData) {
  if (!isBookingLive()) redirect("/reset-password");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 8 || password !== confirm) {
    redirect("/reset-password?error=" + encodeURIComponent("Use at least 8 characters, and enter the same password twice."));
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/forgot-password?error=" + encodeURIComponent("That reset link has expired. Ask for a new one."));
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect("/reset-password?error=" + encodeURIComponent("We couldn't save the new password. Ask for a fresh reset link."));
  }
  redirect("/account?ok=" + encodeURIComponent("Your password has been updated."));
}

export async function updateProfileAction(formData: FormData) {
  if (!isBookingLive()) redirect("/account");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/account");
  const first = String(formData.get("first_name") || "").trim();
  const surname = String(formData.get("surname") || "").trim();
  const mobile = cleanMobile(String(formData.get("mobile") || ""));
  if (!first || !surname || !mobile) {
    redirect("/account?error=" + encodeURIComponent("Please add your name and a mobile number."));
  }
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: first, surname, mobile })
    .eq("id", data.user.id);
  if (error) redirect("/account?error=" + encodeURIComponent("We couldn't save those details."));
  redirect("/account?ok=" + encodeURIComponent("Your details are saved."));
}
