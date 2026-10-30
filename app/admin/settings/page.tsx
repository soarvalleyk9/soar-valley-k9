import type { Metadata } from "next";
import { resendGateCodesAction, runJobsAction, saveSettingsAction } from "@/app/actions/admin";
import { PushToggle } from "@/components/push-toggle";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "@/components/ui";
import { vapidPublicKey } from "@/lib/push";
import { loadGateCode, loadPublicSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };

function pounds(pence: number) {
  return (pence / 100).toFixed(2);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const settings = await loadPublicSettings();
  const gate = await loadGateCode();
  const pushKey = vapidPublicKey();
  return (
    <div className="stack">
      <h1>Settings</h1>
      <Flash error={query.error} ok={query.ok} />
      <form action={saveSettingsAction} className="card stack">
        <label className="stack">
          <span className="label">Gate code</span>
          <input className="input text-2xl tracking-widest" name="gate_code" defaultValue={gate} required />
        </label>
        <p className="muted">
          This is emailed only after you authorise a booking, and again if you change it. It is not shown on the
          public site or on the payment email.
        </p>
        <label className="stack">
          <span className="label">1–2 dogs, 30 minutes (£)</span>
          <input className="input" name="price_30" defaultValue={pounds(settings.price_1_2_30_pence)} required />
        </label>
        <label className="stack">
          <span className="label">1–2 dogs, 60 minutes (£)</span>
          <input className="input" name="price_60" defaultValue={pounds(settings.price_1_2_60_pence)} required />
        </label>
        <label className="stack">
          <span className="label">3–6 dogs, 60 minutes (£)</span>
          <input className="input" name="price_36" defaultValue={pounds(settings.price_3_6_60_pence)} required />
        </label>
        <label className="stack">
          <span className="label">Opens (hour, 0–22)</span>
          <input className="input" name="open_hour" type="number" min={0} max={22} defaultValue={settings.open_hour} />
        </label>
        <label className="stack">
          <span className="label">Closes (hour, 1–23)</span>
          <input className="input" name="close_hour" type="number" min={1} max={23} defaultValue={settings.close_hour} />
        </label>
        <label className="check">
          <input name="short_notice_enabled" type="checkbox" defaultChecked={settings.short_notice_enabled} />
          <span>Allow bookings that start within the next hour</span>
        </label>
        <label className="stack">
          <span className="label">Google rating</span>
          <input className="input" name="reviews_rating" defaultValue={settings.reviews_rating} />
        </label>
        <label className="stack">
          <span className="label">Number of Google reviews</span>
          <input className="input" name="reviews_count" type="number" min={0} defaultValue={settings.reviews_count} />
        </label>
        <label className="stack">
          <span className="label">Reviews link</span>
          <input className="input" name="reviews_url" defaultValue={settings.reviews_url} />
        </label>
        <label className="stack">
          <span className="label">Revolut payment link</span>
          <input className="input" name="revolut_payment_url" defaultValue={settings.revolut_payment_url} />
        </label>
        <label className="stack">
          <span className="label">Terms version</span>
          <input className="input" name="terms_version" defaultValue={settings.terms_version} />
        </label>
        <SubmitButton>Save settings</SubmitButton>
      </form>
      <form action={resendGateCodesAction}>
        <SubmitButton variant="secondary">Email the current gate code to upcoming visits</SubmitButton>
      </form>
      <section className="card stack">
        <h2 className="text-xl">Phone alerts</h2>
        <p>New bookings and “customer says paid” always come by email. Phone alerts are optional.</p>
        {pushKey ? <PushToggle publicKey={pushKey} /> : <p>Phone alerts are not switched on. Email is enough.</p>}
      </section>
      <section className="card stack">
        <h2 className="text-xl">Checks</h2>
        <form action={runJobsAction}>
          <input type="hidden" name="job" value="maintenance" />
          <SubmitButton variant="quiet">Run the payment check now</SubmitButton>
        </form>
        <form action={runJobsAction}>
          <input type="hidden" name="job" value="digest" />
          <SubmitButton variant="quiet">Email me today’s digest now</SubmitButton>
        </form>
      </section>
    </div>
  );
}
