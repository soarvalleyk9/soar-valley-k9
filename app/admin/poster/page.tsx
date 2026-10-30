import type { Metadata } from "next";
import QRCode from "qrcode";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Poster" };

export default async function PosterPage() {
  const url = siteUrl();
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 360 });
  return (
    <article className="card stack bg-white text-center">
      <img src="/brand/logo-header.png" alt="Soar Valley K9 Secluded Retreat" className="mx-auto w-full max-w-sm" />
      <p className="text-sm font-semibold uppercase tracking-wide text-moss">Secure Paddocks UK</p>
      <h1>Book the field</h1>
      <p>A private secure dog field. One booking at a time.</p>
      <img src={qr} alt="QR code linking to the booking website" className="mx-auto w-56" />
      <p className="text-xl font-semibold text-heading">{url.replace(/^https:\/\//, "")}</p>
      <p>Open 7am–7pm, every day.</p>
      <p className="no-print muted">Use your browser’s print menu to save this as a PDF.</p>
    </article>
  );
}
