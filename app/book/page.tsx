import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { addLondonDays, generateSlots, zonedDateTime } from "@/lib/domain/slots";
import { PriceList } from "@/components/price-list";
import { formatTime, londonTodayISO } from "@/lib/format";
import { loadPublicSettings } from "@/lib/settings";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/site";
import { isBookingLive, tryServiceClient } from "@/lib/supabase/admin";
import { Flash, OpeningSoon } from "@/components/ui";

export const metadata: Metadata = { title: "Book a visit" };

function href(params: { dogs: number; duration: number; date: string }) {
  return `/book?dogs=${params.dogs}&duration=${params.duration}&date=${params.date}`;
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ dogs?: string; duration?: string; date?: string; error?: string }>;
}) {
  if (!isBookingLive()) return <OpeningSoon />;
  const session = await getSession();
  const params = await searchParams;
  const settings = await loadPublicSettings();
  const today = londonTodayISO();
  const dogs = [1, 2, 3, 4, 5, 6].includes(Number(params.dogs)) ? Number(params.dogs) : 1;
  let duration: 30 | 60 = params.duration === "30" ? 30 : 60;
  if (dogs >= 3) duration = 60;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date || "") ? params.date! : today;
  const maxDate = addLondonDays(today, 90);
  const safeDate = date < today ? today : date > maxDate ? maxDate : date;

  let slots: Awaited<ReturnType<typeof generateSlots>> = [];
  if (session) {
    const service = tryServiceClient();
    const { data } = await service!
      .from("bookings")
      .select("starts_at, ends_at")
      .in("status", [...ACTIVE_BOOKING_STATUSES])
      .lt("starts_at", zonedDateTime(addLondonDays(safeDate, 1), 0, 0).toISOString())
      .gt("ends_at", zonedDateTime(safeDate, 0, 0).toISOString());
    slots = generateSlots({
      dateISO: safeDate,
      durationMinutes: duration,
      openHour: settings.open_hour,
      closeHour: settings.close_hour,
      busy: (data ?? []).map((row) => ({ startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) })),
      shortNoticeEnabled: settings.short_notice_enabled,
    });
  }

  const days = Array.from({ length: 21 }, (_, index) => addLondonDays(today, index));

  return (
    <div className="stack-lg">
      <div>
        <h1>Book a visit</h1>
        <p>One group at a time. Choose how many dogs, then a time.</p>
      </div>
      <PriceList settings={settings} linked />
      <Flash error={params.error} />
      {!session ? (
        <section className="card stack">
          <p>Log in to see free times and book. New customers need an account.</p>
          <Link className="btn btn-primary" href={`/login?next=${encodeURIComponent(href({ dogs, duration, date: safeDate }))}`}>
            Log in
          </Link>
          <Link className="btn btn-quiet" href="/register">
            Create an account
          </Link>
        </section>
      ) : null}
      <section className="stack">
        <h2 className="text-xl">How many dogs?</h2>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((count) => (
            <Link key={count} className={`choice ${count === dogs ? "is-on" : ""}`} href={href({ dogs: count, duration: count >= 3 ? 60 : duration, date: safeDate })}>
              {count}
            </Link>
          ))}
        </div>
        <Link href="/special-request">7 or more dogs — ask us</Link>
      </section>
      <section className="stack">
        <h2 className="text-xl">How long?</h2>
        <div className="grid grid-cols-2 gap-2">
          {dogs <= 2 ? (
            <Link className={`choice ${duration === 30 ? "is-on" : ""}`} href={href({ dogs, duration: 30, date: safeDate })}>
              30 min
            </Link>
          ) : (
            <p className="choice opacity-60">30 min not available for 3–6 dogs</p>
          )}
          <Link className={`choice ${duration === 60 ? "is-on" : ""}`} href={href({ dogs, duration: 60, date: safeDate })}>
            60 min
          </Link>
        </div>
      </section>
      <section className="stack">
        <h2 className="text-xl">Which day?</h2>
        <div className="day-scroll">
          {days.map((day) => (
            <Link key={day} className={`choice min-w-24 px-3 ${day === safeDate ? "is-on" : ""}`} href={href({ dogs, duration, date: day })}>
              {new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" }).format(new Date(`${day}T12:00:00Z`))}
            </Link>
          ))}
        </div>
        <form action="/book" className="grid grid-cols-[1fr_auto] gap-2">
          <input type="hidden" name="dogs" value={dogs} />
          <input type="hidden" name="duration" value={duration} />
          <label className="stack">
            <span className="label">Another day in the next 90 days</span>
            <input className="input" type="date" name="date" min={today} max={maxDate} defaultValue={safeDate} />
          </label>
          <button className="btn btn-quiet self-end" type="submit">
            Show
          </button>
        </form>
      </section>
      {session ? (
        <section className="stack">
          <h2 className="text-xl">Free times</h2>
          {!settings.short_notice_enabled ? <p className="muted">Bookings that start within the next hour are turned off.</p> : null}
          {session.profile.vaccination_status !== "verified" ? (
            <p className="card">
              You can look at times now. To book, upload vaccination records on your{" "}
              <Link href="/account">account</Link> and wait until we’ve checked them.
            </p>
          ) : null}
          {session.profile.blocked ? <p className="card">This account cannot make bookings. Please call us.</p> : null}
          {slots.length === 0 ? <p>Nothing left on this day. Try another date.</p> : null}
          <div className="grid gap-2">
            {slots.map((slot) =>
              slot.available ? (
                <Link
                  key={slot.startsAt.toISOString()}
                  className="choice justify-between px-4"
                  href={`/book/confirm?starts=${encodeURIComponent(slot.startsAt.toISOString())}&duration=${duration}&dogs=${dogs}`}
                >
                  <span>
                    {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)}
                  </span>
                  <span className="text-sm font-normal">{slot.shortNotice ? "Short notice" : "Book"}</span>
                </Link>
              ) : (
                <p key={slot.startsAt.toISOString()} className="choice justify-between px-4 opacity-50">
                  <span>
                    {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)}
                  </span>
                  <span className="text-sm">Booked</span>
                </p>
              ),
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
