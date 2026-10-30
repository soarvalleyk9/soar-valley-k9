import type { Metadata } from "next";
import Link from "next/link";
import { formatGbp, formatHours } from "@/lib/format";
import { loadPublicSettings } from "@/lib/settings";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Prices & rules" };

export default async function PricesPage() {
  const settings = await loadPublicSettings();
  return (
    <div className="stack-lg">
      <div>
        <h1>Prices & rules</h1>
        <p className="mt-2">
          Open {formatHours(settings.open_hour, settings.close_hour)}, seven days a week, all year. Times are UK time.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="card">
          <h2 className="text-xl">1–2 dogs</h2>
          <p>{formatGbp(settings.price_1_2_60_pence)} for 60 minutes</p>
          <p>{formatGbp(settings.price_1_2_30_pence)} for 30 minutes</p>
        </article>
        <article className="card">
          <h2 className="text-xl">3–6 dogs</h2>
          <p>{formatGbp(settings.price_3_6_60_pence)} for 60 minutes</p>
          <p>30-minute slots are not available for this group size.</p>
        </article>
        <article className="card">
          <h2 className="text-xl">7 or more dogs</h2>
          <p>This is a special request. We'll reply with a price and a time.</p>
          <Link className="btn btn-secondary mt-3" href="/special-request">
            Ask us
          </Link>
        </article>
      </div>
      <section className="card stack">
        <h2>Before you come</h2>
        <ul className="grid list-disc gap-2 pl-5">
          <li>Slots are a full 30 or 60 minutes. Be out of the field and the car park, with the gate locked, by the finish time.</li>
          <li>Please don't arrive more than 5 minutes early. If someone is still inside, wait outside and do not open the gate.</li>
          <li>Only dogs who already know each other can use the field together.</li>
          <li>Every dog must be vaccinated or titre tested. Upload a photo of the cards on your account. You can browse before that, but you can't book until we've checked them.</li>
          <li>Pick up and take away all dog waste. Digging, smoking and vaping are not allowed.</li>
          <li>Children with you must be supervised. Dogs must not be left alone.</li>
        </ul>
      </section>
      <section className="card stack">
        <h2>Paying and cancelling</h2>
        <ul className="grid list-disc gap-2 pl-5">
          <li>Pay in advance by Revolut. Put your booking reference in the payment note. Cash is only by prior arrangement.</li>
          <li>The gate code is emailed after we confirm the payment. It is not on the payment email.</li>
          <li>Cancel 24 hours or more ahead and the amount is held as credit on your account for another visit. We don't refund to your bank.</li>
          <li>Cancel with less than 24 hours to go and the fee is not credited.</li>
          <li>If we have to cancel the field, the fee is held as credit too.</li>
          <li>There is no waitlist. If a time is free, you can book it.</li>
        </ul>
        <p>{SITE.parking}</p>
        <Link href="/terms">Read the full terms</Link>
      </section>
    </div>
  );
}
