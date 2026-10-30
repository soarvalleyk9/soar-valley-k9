import type { Metadata } from "next";
import { termsSections } from "@/content/terms";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms and conditions" };

export default function TermsPage() {
  return (
    <article className="card prose-legal">
      <p className="text-sm font-semibold text-moss">Secure Paddocks UK</p>
      <h1>Terms and conditions of use</h1>
      <p className="muted">Soar Valley K9 Secluded Retreat. Last updated {SITE.termsUpdatedLabel}. Version {SITE.termsVersion}.</p>
      <p>
        <a href="/legal/SVK9-Terms-and-Conditions-revised-2026-10-30.pdf">Download the terms (PDF)</a>
      </p>
      {termsSections.map((section) => (
        <section key={section.title ?? section.paragraphs[0].slice(0, 24)}>
          {section.title ? <h2>{section.title}</h2> : null}
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 48)}>{paragraph}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
