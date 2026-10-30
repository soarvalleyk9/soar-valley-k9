import type { Metadata } from "next";
import { resendVerificationAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Flash, OpeningSoon } from "@/components/ui";
import { isBookingLive } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; ok?: string }>;
}) {
  if (!isBookingLive()) return <OpeningSoon />;
  const params = await searchParams;
  return (
    <section className="card stack mx-auto max-w-lg">
      <h1>Confirm your email</h1>
      <p>Open the message we sent and tap the link. Check junk mail if it isn’t in your inbox.</p>
      <Flash error={params.error} ok={params.ok} />
      <form action={resendVerificationAction} className="stack">
        <label className="stack">
          <span className="label">Email</span>
          <input className="input" name="email" type="email" defaultValue={params.email || ""} required />
        </label>
        <SubmitButton variant="secondary">Send the email again</SubmitButton>
      </form>
    </section>
  );
}
