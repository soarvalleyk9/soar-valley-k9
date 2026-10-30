import Link from "next/link";
import { formatGbp, formatHours } from "@/lib/format";
import { loadPublicSettings } from "@/lib/settings";
import { SITE } from "@/lib/site";

export default async function HomePage() {
  const settings = await loadPublicSettings();
  return (
    <div className="stack-lg">
      <section className="card stack items-start">
        <img
          src="/brand/logo-header.png"
          srcSet="/brand/logo-header.png 1x, /brand/logo-header@2x.png 2x"
          alt=""
          width={600}
          height={343}
          className="h-auto w-full max-w-md"
        />
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Secure Paddocks UK</p>
        <h1>A private field, just for your dogs</h1>
        <p className="text-lg">{SITE.tagline}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="btn btn-primary" href="/book">
            Book now
          </Link>
          <Link className="btn btn-secondary" href="/prices">
            Prices & rules
          </Link>
        </div>
        <p>
          <a href={settings.reviews_url}>
            {settings.reviews_rating} ★ from {settings.reviews_count} Google reviews
          </a>
        </p>
      </section>

      <section className="stack">
        <h2>How booking works</h2>
        <ol className="grid gap-3">
          {[
            "Create an account and upload a photo of your dogs' vaccination cards. We check them before you can book.",
            "Pick a time. The field is only ever booked by one group, so you won't meet other dogs at the gate.",
            "Pay by Revolut and put your booking reference in the note.",
            "When we've confirmed the payment, we email the gate code and a check-in code. They are not sent before that.",
          ].map((step, index) => (
            <li key={step} className="card flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary font-semibold text-white">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="stack">
        <h2>Prices</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <article className="card">
            <h3 className="text-xl">1–2 dogs</h3>
            <p className="text-2xl font-semibold text-heading">{formatGbp(settings.price_1_2_60_pence)}</p>
            <p>60 minutes</p>
            <p className="mt-2 text-lg font-semibold text-heading">{formatGbp(settings.price_1_2_30_pence)}</p>
            <p>30 minutes</p>
          </article>
          <article className="card">
            <h3 className="text-xl">3–6 dogs</h3>
            <p className="text-2xl font-semibold text-heading">{formatGbp(settings.price_3_6_60_pence)}</p>
            <p>60 minutes only</p>
          </article>
          <article className="card">
            <h3 className="text-xl">7 or more</h3>
            <p>Tell us what you need and we'll quote a time and a price.</p>
            <Link className="btn btn-quiet mt-3" href="/special-request">
              Special request
            </Link>
          </article>
        </div>
        <p className="muted">Open {formatHours(settings.open_hour, settings.close_hour)}, every day. Prices can be updated by the field.</p>
      </section>

      <section className="card stack">
        <h2>Find the field</h2>
        <p>{SITE.addressLines.join(", ")}</p>
        <p>
          what3words{" "}
          <a href={SITE.w3wUrl}>///{SITE.what3words}</a>
        </p>
        <p>{SITE.parking}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <a className="btn btn-primary" href={SITE.directionsUrl}>
            Directions
          </a>
          <Link className="btn btn-quiet" href="/find-us">
            Map and parking
          </Link>
        </div>
      </section>
    </div>
  );
}
