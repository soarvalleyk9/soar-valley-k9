import type { Metadata } from "next";
import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Flash, OpeningSoon } from "@/components/ui";
import { isBookingLive } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isBookingLive()) return <OpeningSoon />;
  const params = await searchParams;
  return (
    <section className="card stack mx-auto max-w-lg">
      <h1>Create an account</h1>
      <p>You’ll need to confirm your email, then upload vaccination records, before you can book.</p>
      <Flash error={params.error} />
      <form action={registerAction} className="stack">
        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label className="stack">
          <span className="label">First name</span>
          <input className="input" name="first_name" autoComplete="given-name" required />
        </label>
        <label className="stack">
          <span className="label">Surname</span>
          <input className="input" name="surname" autoComplete="family-name" required />
        </label>
        <label className="stack">
          <span className="label">Email</span>
          <input className="input" name="email" type="email" autoComplete="email" required />
        </label>
        <label className="stack">
          <span className="label">Mobile</span>
          <input className="input" name="mobile" type="tel" autoComplete="tel" inputMode="tel" required />
        </label>
        <label className="stack">
          <span className="label">Password</span>
          <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label className="stack">
          <span className="label">Confirm password</span>
          <input className="input" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label className="check">
          <input name="terms" type="checkbox" required />
          <span>
            I agree to the <Link href="/terms">terms and conditions</Link> (updated 30 October 2026).
          </span>
        </label>
        <SubmitButton>Create account</SubmitButton>
      </form>
      <p>
        Already registered? <Link href="/login">Log in</Link>
      </p>
    </section>
  );
}
