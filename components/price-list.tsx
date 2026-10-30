import Link from "next/link";
import { priceTierLines, type PriceList } from "@/lib/domain/pricing";
import { toPriceList } from "@/lib/settings";
import type { PublicSettings } from "@/lib/types";

export function PriceList({
  settings,
  linked = false,
}: {
  settings: PublicSettings | PriceList;
  linked?: boolean;
}) {
  const lines = priceTierLines("price12x30" in settings ? settings : toPriceList(settings));
  return (
    <ul className="grid gap-2">
      {lines.map((line) => (
        <li key={line} className="card font-semibold text-heading">
          {line}
          {linked && line.startsWith("7+") ? (
            <>
              {" "}
              <Link href="/special-request">Ask us</Link>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
