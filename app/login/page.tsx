import type { Metadata } from "next";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Flash, OpeningSoon } from "@/components/ui";
import { safeNextPath } from "@/lib/errors";
import { isBookingLive } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; ok?: string }>;
}) {
  if (!isBookingLive()) return <OpeningSoon />;
  const params = await searchParams;
  const next = safeNextPath(params.next, "/book");
  return (
    <section className="card stack mx-auto max-w-lg">
      <h1>Log in</h1>
      <Flash error={params.error} ok={params.ok} />
      <form action={loginAction} className="stack">
        <input type="hidden" name="next" value={next} />
        <label className="stack">
          <span className="label">Email</span>
          <input className="input" name="email" type="email" autoComplete="email" required />
        </label>
        <label className="stack">
          <span className="label">Password</span>
          <input className="input" name="password" type="password" autoComplete="current-password" required />
        </label>
        <SubmitButton>Log in</SubmitButton>
      </form>
      <p>
        <Link href="/forgot-password">Forgot your password?</Link>
      </p>
      <p>
        New here? <Link href="/register">Create an account</Link>
      </p>
    </section>
  );
}
