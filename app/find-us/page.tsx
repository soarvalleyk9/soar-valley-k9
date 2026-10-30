import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Find us" };

const bbox = "-1.148,-1.122,52.726,52.741";

export default function FindUsPage() {
  return (
    <div className="stack-lg">
      <div className="stack">
        <h1>Find us</h1>
        <p className="text-lg">{SITE.venue}</p>
        <p>
          {SITE.addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      </div>
      <iframe
        title="Map of Soar Valley K9 Secluded Retreat"
        className="h-72 w-full rounded-2xl border-0 bg-white"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${SITE.lat}%2C${SITE.lng}`}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <a className="btn btn-primary" href={SITE.directionsUrl}>
          Google Maps directions
        </a>
        <a className="btn btn-secondary" href={SITE.w3wUrl}>
          ///{SITE.what3words}
        </a>
      </div>
      <section className="card stack">
        <h2>Parking and the gate</h2>
        <p>{SITE.parking}</p>
        <p>
          GPS {SITE.gpsLabel} ({SITE.lat}, {SITE.lng}). For an emergency, the address to give is Sileby Road,
          Loughborough, Leicestershire, {SITE.postcode}.
        </p>
        <p>
          If you arrive and the gate is unlocked, or someone is still in the field, stay outside and call{" "}
          <a href={`tel:${SITE.phoneTel}`}>{SITE.phoneDisplay}</a>. Do not open the gate.
        </p>
      </section>
    </div>
  );
}
