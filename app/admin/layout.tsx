import { AdminNav } from "@/components/admin-nav";
import { OpeningSoon } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { isBookingLive } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isBookingLive()) return <OpeningSoon />;
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.profile.role !== "owner") redirect("/");
  return (
    <div className="stack">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Admin</p>
        <p className="muted">
          To keep this on your phone, open the browser menu and choose Add to Home Screen while you are on an admin
          page.
        </p>
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
