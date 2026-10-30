import Link from "next/link";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-8 bg-tint-green">
      <div className="mx-auto grid max-w-page gap-3 px-4 py-8 text-sm">
        <p className="font-semibold text-heading">
          {SITE.brand}
          <span className="font-normal text-ink"> · {SITE.venue}</span>
        </p>
        <p>{SITE.addressLines.join(", ")}</p>
        <p>
          <a href={`tel:${SITE.phoneTel}`}>{SITE.phoneDisplay}</a>
          {" · "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        </p>
        <p className="flex flex-wrap gap-4">
          <Link href="/prices">Prices & rules</Link>
          <Link href="/find-us">Find us</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </p>
      </div>
    </footer>
  );
}
