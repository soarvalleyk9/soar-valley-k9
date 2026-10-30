import webpush from "web-push";
import { tryServiceClient } from "./supabase/admin";

export function vapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

export async function pushOwners(title: string, body: string, url: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const service = tryServiceClient();
  if (!publicKey || !privateKey || !service) return;
  const { data } = await service.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (!data?.length) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:soarvalley.k9@outlook.com",
    publicKey,
    privateKey,
  );
  await Promise.all(
    data.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url }),
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await service.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  );
}
