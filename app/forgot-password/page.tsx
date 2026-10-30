import type { Metadata } from "next";
import { forgotAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Flash, OpeningSoon } from "@/components/ui";
import { isBookingLive } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  if (!isBookingLive()) return <OpeningSoon />;
  const params = await searchParams;
  return (
    <section className="card stack mx-auto max-w-lg">
      <h1>Reset your password</h1>
      <Flash error={params.error} ok={params.ok} />
      <form action={forgotAction} className="stack">
        <label className="stack">
          <span className="label">Email</span>
          <input className="input" name="email" type="email" autoComplete="email" required />
        </label>
        <SubmitButton>Email me a link</SubmitButton>
      </form>
    </section>
  );
}
