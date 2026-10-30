import type { Metadata } from "next";
import Link from "next/link";
import { createBookingAction } from "@/app/actions/booking";
import { SubmitButton } from "@/components/submit-button";
import { Flash, OpeningSoon } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { applyCredit, quotePrice } from "@/lib/domain/pricing";
import { formatGbp, formatSlot } from "@/lib/format";
import { loadPublicSettings, toPriceList } from "@/lib/settings";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Confirm booking" };

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ starts?: string; duration?: string; dogs?: string; error?: string }>;
}) {
  if (!isBookingLive()) return <OpeningSoon />;
  const session = await getSession();
  if (!session) return <OpeningSoon />;
  const params = await searchParams;
  const starts = new Date(params.starts || "");
  const duration = Number(params.duration);
  const dogs = Number(params.dogs);
  const settings = await loadPublicSettings();
  const quote = quotePrice(dogs, duration, toPriceList(settings));
  if (!quote.ok || Number.isNaN(starts.getTime())) {
    return (
      <section className="card stack">
        <h1>Choose a slot again</h1>
        <Link className="btn btn-primary" href="/book">
          Back to times
        </Link>
      </section>
    );
  }
  const service = tryServiceClient();
  const { data: credits } = await service!.from("credits_ledger").select("amount_pence").eq("user_id", session.userId);
  const balance = (credits ?? []).reduce((sum, row) => sum + row.amount_pence, 0);
  const money = applyCredit(quote.pricePence, balance);
  return (
    <section className="card stack mx-auto max-w-lg">
      <h1>Confirm this visit</h1>
      <Flash error={params.error} />
      <p className="text-xl font-semibold text-heading">{formatSlot(starts, new Date(starts.getTime() + duration * 60 * 1000))}</p>
      <p>
        {dogs} {dogs === 1 ? "dog" : "dogs"} · {duration} minutes
      </p>
      <p>Price {formatGbp(quote.pricePence)}</p>
      {money.creditAppliedPence > 0 ? <p>Account credit used {formatGbp(money.creditAppliedPence)}</p> : null}
      <p className="text-2xl font-semibold text-heading">To pay {formatGbp(money.amountDuePence)}</p>
      {money.amountDuePence === 0 ? <p>Your credit covers this visit. We still confirm it before emailing the gate code.</p> : null}
      <form action={createBookingAction} className="stack">
        <input type="hidden" name="startsAt" value={starts.toISOString()} />
        <input type="hidden" name="duration" value={duration} />
        <input type="hidden" name="dogs" value={dogs} />
        <label className="check">
          <input name="know" type="checkbox" required />
          <span>All the dogs in this booking already know each other.</span>
        </label>
        <label className="check">
          <input name="terms" type="checkbox" required />
          <span>
            I agree to the <Link href="/terms">terms and conditions</Link>.
          </span>
        </label>
        <SubmitButton>{money.amountDuePence === 0 ? "Request confirmation" : "Hold this slot"}</SubmitButton>
      </form>
    </section>
  );
}
