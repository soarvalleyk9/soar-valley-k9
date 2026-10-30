import type { Metadata } from "next";
import { rejectVaccinationAction, verifyVaccinationAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "@/components/ui";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";
import type { ProfileRow, VaccinationDoc } from "@/lib/types";
import { customerName } from "@/lib/types";

export const metadata: Metadata = { title: "Vaccinations" };

export default async function VaccinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  if (!isBookingLive()) return null;
  const service = tryServiceClient()!;
  const { data: profiles } = await service
    .from("profiles")
    .select("*")
    .in("vaccination_status", ["pending", "rejected"])
    .order("updated_at", { ascending: false })
    .limit(50);
  const { data: pendingDocs } = await service
    .from("vaccination_documents")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  const extraIds = (pendingDocs ?? []).map((doc) => doc.user_id);
  const { data: extraProfiles } = extraIds.length
    ? await service.from("profiles").select("*").in("id", extraIds)
    : { data: [] as ProfileRow[] };
  const people = new Map<string, ProfileRow>();
  for (const profile of [...(profiles ?? []), ...(extraProfiles ?? [])] as ProfileRow[]) {
    people.set(profile.id, profile);
  }
  const docsByUser = new Map<string, VaccinationDoc[]>();
  for (const doc of (pendingDocs ?? []) as VaccinationDoc[]) {
    const list = docsByUser.get(doc.user_id) ?? [];
    list.push(doc);
    docsByUser.set(doc.user_id, list);
  }
  const signed = new Map<string, string>();
  for (const doc of (pendingDocs ?? []) as VaccinationDoc[]) {
    const { data } = await service.storage.from("vaccination-records").createSignedUrl(doc.storage_path, 60 * 60);
    if (data?.signedUrl) signed.set(doc.id, data.signedUrl);
  }
  return (
    <div className="stack">
      <h1>Vaccinations</h1>
      <Flash error={query.error} ok={query.ok} />
      {people.size === 0 ? <p>Nothing waiting.</p> : null}
      {[...people.values()].map((profile) => (
        <article key={profile.id} className="card stack">
          <h2 className="text-xl">{customerName(profile)}</h2>
          <p>
            {profile.email} · {profile.mobile}
          </p>
          <p className="pill w-fit">{profile.vaccination_status}</p>
          <ul className="grid gap-2">
            {(docsByUser.get(profile.id) ?? []).map((doc) => (
              <li key={doc.id}>
                {signed.get(doc.id) ? (
                  <a href={signed.get(doc.id)}>{doc.file_name}</a>
                ) : (
                  doc.file_name
                )}
              </li>
            ))}
          </ul>
          <form action={verifyVaccinationAction} className="stack">
            <input type="hidden" name="user_id" value={profile.id} />
            <label className="stack">
              <span className="label">Expiry date (optional)</span>
              <input className="input" type="date" name="expiry" defaultValue={profile.vaccination_expiry ?? ""} />
            </label>
            <SubmitButton>Verify — they can book</SubmitButton>
          </form>
          <form action={rejectVaccinationAction} className="stack">
            <input type="hidden" name="user_id" value={profile.id} />
            <label className="stack">
              <span className="label">Reason if you reject</span>
              <textarea className="textarea" name="reason" />
            </label>
            <SubmitButton variant="quiet">Reject and email them</SubmitButton>
          </form>
        </article>
      ))}
    </div>
  );
}
