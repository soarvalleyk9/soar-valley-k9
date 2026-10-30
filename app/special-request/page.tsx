import type { Metadata } from "next";
import Link from "next/link";
import { specialRequestAction } from "@/app/actions/booking";
import { SubmitButton } from "@/components/submit-button";
import { Flash, OpeningSoon } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { isBookingLive } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Special request" };

export default async function SpecialRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  if (!isBookingLive()) return <OpeningSoon />;
  const session = await getSession();
  const params = await searchParams;
  if (!session) {
    return (
      <section className="card stack">
        <h1>7 or more dogs</h1>
        <p>Log in and tell us what you need. We’ll reply with a price and a time.</p>
        <Link className="btn btn-primary" href="/login?next=/special-request">
          Log in
        </Link>
      </section>
    );
  }
  return (
    <section className="card stack mx-auto max-w-lg">
      <h1>Special request</h1>
      <p>For 7 or more dogs. There isn’t an online price for this — we’ll email you.</p>
      <Flash error={params.error} ok={params.ok} />
      <form action={specialRequestAction} className="stack">
        <label className="stack">
          <span className="label">Number of dogs</span>
          <input className="input" name="dog_count" type="number" min={7} max={40} required />
        </label>
        <label className="stack">
          <span className="label">Preferred dates and times</span>
          <input className="input" name="preferred_dates" />
        </label>
        <label className="stack">
          <span className="label">Message</span>
          <textarea className="textarea" name="message" required minLength={5} />
        </label>
        <SubmitButton>Send request</SubmitButton>
      </form>
    </section>
  );
}
