import type { Metadata } from "next";
import Link from "next/link";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";
import type { ProfileRow } from "@/lib/types";
import { customerName } from "@/lib/types";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const clean = q.replace(/[%_,]/g, "").trim().slice(0, 60);
  if (!isBookingLive()) return null;
  const service = tryServiceClient()!;
  let query = service.from("profiles").select("*").order("created_at", { ascending: false }).limit(80);
  if (clean) {
    query = query.or(`first_name.ilike.%${clean}%,surname.ilike.%${clean}%,email.ilike.%${clean}%,mobile.ilike.%${clean}%`);
  }
  const { data } = await query;
  const rows = (data ?? []) as ProfileRow[];
  return (
    <div className="stack">
      <h1>Customers</h1>
      <form className="grid grid-cols-[1fr_auto] gap-2">
        <label className="stack">
          <span className="sr-only">Search</span>
          <input className="input" name="q" defaultValue={clean} placeholder="Name, email or mobile" />
        </label>
        <button className="btn btn-quiet self-end" type="submit">
          Search
        </button>
      </form>
      {rows.map((profile) => (
        <Link key={profile.id} href={`/admin/customers/${profile.id}`} className="card grid gap-1 no-underline">
          <span className="font-semibold text-ink">
            {customerName(profile)}
            {profile.blocked ? " · paused" : ""}
            {profile.is_regular ? " · regular" : ""}
          </span>
          <span>
            {profile.email} · {profile.mobile}
          </span>
          <span className="pill w-fit">{profile.vaccination_status}</span>
        </Link>
      ))}
    </div>
  );
}
