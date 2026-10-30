import type { Metadata } from "next";
import { resetPasswordAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Flash, OpeningSoon } from "@/components/ui";
import { isBookingLive } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isBookingLive()) return <OpeningSoon />;
  const params = await searchParams;
  return (
    <section className="card stack mx-auto max-w-lg">
      <h1>Choose a new password</h1>
      <Flash error={params.error} />
      <form action={resetPasswordAction} className="stack">
        <label className="stack">
          <span className="label">New password</span>
          <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label className="stack">
          <span className="label">Confirm password</span>
          <input className="input" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <SubmitButton>Save password</SubmitButton>
      </form>
    </section>
  );
}
