import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "QR codes" };

export default function QrPage() {
  return (
    <div className="stack">
      <h1>QR codes and posters</h1>
      <p>These are for the counter or a message to a customer. Do not put the gate code on a poster.</p>
      <section className="card stack">
        <h2 className="text-xl">Revolut payment</h2>
        <img src="/qr/revolut-pay-qr.svg" alt="Revolut payment QR code" className="w-56 bg-white" />
        <a className="btn btn-quiet" href="/qr/revolut-pay-qr.png" download>
          Download PNG
        </a>
        <a className="btn btn-quiet" href="/qr/revolut-pay-qr.svg" download>
          Download SVG
        </a>
        <a className="btn btn-quiet" href="/qr/revolut-pay-poster.pdf" download>
          Download payment poster PDF
        </a>
      </section>
      <Link className="btn btn-primary" href="/admin/poster">
        Open a printable poster
      </Link>
    </div>
  );
}
