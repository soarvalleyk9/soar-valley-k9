import type { Metadata } from "next";
import { updateRequestAction } from "@/app/actions/admin";
import { profilesFor } from "@/lib/admin-data";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "@/components/ui";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";
import type { SpecialRequestRow } from "@/lib/types";
import { customerName } from "@/lib/types";

export const metadata: Metadata = { title: "Special requests" };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const query = await searchParams;
  if (!isBookingLive()) return null;
  const service = tryServiceClient()!;
  const { data } = await service.from("special_requests").select("*").order("created_at", { ascending: false }).limit(40);
  const rows = (data ?? []) as SpecialRequestRow[];
  const people = await profilesFor(rows.map((row) => row.user_id));
  return (
    <div className="stack">
      <h1>Special requests</h1>
      <Flash ok={query.ok} />
      {rows.length === 0 ? <p>None yet.</p> : null}
      {rows.map((request) => {
        const person = people.get(request.user_id);
        return (
          <article key={request.id} className="card stack">
            <h2 className="text-xl">{request.dog_count} dogs</h2>
            <p>{person ? `${customerName(person)} · ${person.mobile} · ${person.email}` : "Customer"}</p>
            <p>{request.preferred_dates}</p>
            <p>{request.message}</p>
            <form action={updateRequestAction} className="stack">
              <input type="hidden" name="id" value={request.id} />
              <label className="stack">
                <span className="label">Status</span>
                <select className="select" name="status" defaultValue={request.status}>
                  <option value="open">Open</option>
                  <option value="quoted">Quoted</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <label className="stack">
                <span className="label">Your notes</span>
                <textarea className="textarea" name="owner_notes" defaultValue={request.owner_notes} />
              </label>
              <SubmitButton variant="secondary">Save</SubmitButton>
            </form>
          </article>
        );
      })}
    </div>
  );
}
