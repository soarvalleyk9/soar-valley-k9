import type { Metadata } from "next";
import Link from "next/link";
import { specialRequestAction } from "@/app/actions/booking";
import { PriceList } from "@/components/price-list";
import { SubmitButton } from "@/components/submit-button";
import { Flash, OpeningSoon } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { loadPublicSettings } from "@/lib/settings";
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
  const settings = await loadPublicSettings();
  if (!session) {
    return (
      <section className="card stack">
        <h1>7 or more dogs</h1>
        <PriceList settings={settings} />
        <p>Log in and tell us what you need. We’ll reply with a time and a quote. Groups of 7 or more are not a fixed price.</p>
        <Link className="btn btn-primary" href="/login?next=/special-request">
          Log in
        </Link>
      </section>
    );
  }
  return (
    <section className="card stack mx-auto max-w-lg">
      <h1>Special request</h1>
      <PriceList settings={settings} />
      <p>For 7 or more dogs there is no fixed price. Tell us what you need and we will quote a time and a price.</p>
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
