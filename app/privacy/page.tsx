import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="card stack prose-legal">
      <p className="pill w-fit">Placeholder</p>
      <h1>Privacy notice</h1>
      <p>A full privacy notice will replace this page. Until then, this is what the booking site holds.</p>
      <h2>What we store</h2>
      <p>
        Your name, email, mobile number, booking times, how many dogs are coming, and whether you accepted the
        terms. Vaccination photos are stored privately. Other customers cannot see them. We use them only to check
        that the dogs can visit.
      </p>
      <h2>Payments</h2>
      <p>
        Payments are made on Revolut's own page. We store the booking amount and whether we've confirmed it. We
        don't take card numbers on this website.
      </p>
      <h2>Email</h2>
      <p>
        Booking emails come from noreply@securepaddocksuk.co.uk. You can reply and it comes to {SITE.email}. The
        gate code is only emailed after a booking is confirmed.
      </p>
      <h2>Ask us</h2>
      <p>
        To see or correct your details, email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or call{" "}
        <a href={`tel:${SITE.phoneTel}`}>{SITE.phoneDisplay}</a>.
      </p>
    </article>
  );
}
