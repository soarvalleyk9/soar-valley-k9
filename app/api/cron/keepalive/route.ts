import { runKeepalive } from "@/lib/jobs/keepalive";
import { NextResponse } from "next/server";

function allowed(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!allowed(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runKeepalive());
}
