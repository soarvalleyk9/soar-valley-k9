import { getSession } from "@/lib/auth";
import { tryServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.profile.role !== "owner") {
    return NextResponse.json({ error: "Owners only" }, { status: 403 });
  }
  const service = tryServiceClient();
  if (!service) return NextResponse.json({ error: "Not switched on" }, { status: 503 });
  const body = (await request.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
  }
  const { error } = await service.from("push_subscriptions").upsert(
    {
      user_id: session.userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
