import type { Metadata } from "next";
import Link from "next/link";
import { updateProfileAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Flash, OpeningSoon } from "@/components/ui";
import { VaccinationUpload } from "@/components/vaccination-upload";
import { getSession } from "@/lib/auth";
import { formatGbp } from "@/lib/format";
import { isBookingLive } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

const VAX: Record<string, string> = {
  none: "Not sent yet",
  pending: "With us to check",
  verified: "Checked — you can book",
  rejected: "Please send them again",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  if (!isBookingLive()) return <OpeningSoon />;
  const session = await getSession();
  if (!session) {
    return (
      <section className="card stack">
        <h1>Account</h1>
        <Link className="btn btn-primary" href="/login?next=/account">
          Log in
        </Link>
      </section>
    );
  }
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: credits }, { data: docs }] = await Promise.all([
    supabase.from("credits_ledger").select("amount_pence").eq("user_id", session.userId),
    supabase.from("vaccination_documents").select("file_name, status, created_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(10),
  ]);
  const balance = (credits ?? []).reduce((sum, row) => sum + row.amount_pence, 0);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return (
    <div className="stack-lg">
      <div>
        <h1>Your account</h1>
        <Flash error={query.error} ok={query.ok} />
      </div>
      {session.profile.blocked ? <p className="card">This account is paused. Please call us before you travel.</p> : null}
      {!session.emailConfirmed ? (
        <p className="card">
          Please confirm your email before booking. <Link href="/verify-email">Send the link again</Link>
        </p>
      ) : null}
      <section className="card stack">
        <h2 className="text-xl">Credit</h2>
        <p className="text-3xl font-semibold text-heading">{formatGbp(balance)}</p>
        <p className="muted">Credit is used automatically on your next booking. It isn’t paid back to your bank.</p>
        <Link href="/bookings">My bookings</Link>
      </section>
      <section className="card stack">
        <h2 className="text-xl">Vaccinations</h2>
        <p className="pill w-fit">{VAX[session.profile.vaccination_status] || session.profile.vaccination_status}</p>
        {session.profile.vaccination_status === "rejected" && session.profile.vaccination_reject_reason ? (
          <p>Reason: {session.profile.vaccination_reject_reason}</p>
        ) : null}
        {session.profile.vaccination_expiry ? <p>Date we hold: {session.profile.vaccination_expiry}</p> : null}
        {session.profile.vaccination_status === "verified" ? (
          <p className="muted">A new upload is checked as well. You can keep booking while we look at it.</p>
        ) : null}
        <VaccinationUpload url={url} anonKey={anon} userId={session.userId} />
        <ul className="grid gap-1">
          {(docs ?? []).map((doc) => (
            <li key={doc.created_at + doc.file_name}>
              {doc.file_name} · {doc.status}
            </li>
          ))}
        </ul>
      </section>
      <section className="card stack">
        <h2 className="text-xl">Your details</h2>
        <form action={updateProfileAction} className="stack">
          <label className="stack">
            <span className="label">First name</span>
            <input className="input" name="first_name" defaultValue={session.profile.first_name} required />
          </label>
          <label className="stack">
            <span className="label">Surname</span>
            <input className="input" name="surname" defaultValue={session.profile.surname} required />
          </label>
          <label className="stack">
            <span className="label">Mobile</span>
            <input className="input" name="mobile" type="tel" defaultValue={session.profile.mobile} required />
          </label>
          <p className="muted">{session.email}</p>
          <SubmitButton>Save details</SubmitButton>
        </form>
      </section>
    </div>
  );
}
