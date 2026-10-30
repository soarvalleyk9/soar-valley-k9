import { SITE } from "@/lib/site";

export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <p className={error ? "flash flash-bad" : "flash flash-ok"} role={error ? "alert" : "status"}>
      {error || ok}
    </p>
  );
}

export function OpeningSoon() {
  return (
    <section className="card stack">
      <h1>Online booking opening soon</h1>
      <p>
        The booking pages are not switched on yet. You can still read the prices, the rules, and how to find the
        field.
      </p>
      <p>To book a visit in the meantime, call or email us.</p>
      <p>
        <a className="text-xl font-semibold" href={`tel:${SITE.phoneTel}`}>
          {SITE.phoneDisplay}
        </a>
        <br />
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
      </p>
      <a className="btn btn-primary" href="/">
        Back to the home page
      </a>
    </section>
  );
}

export function PageIntro({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="stack">
      <h1>{title}</h1>
      {children}
    </div>
  );
}
