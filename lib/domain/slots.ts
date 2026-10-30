import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { SHORT_NOTICE_WINDOW_MS } from "./deadline";

export const LONDON = "Europe/London";

export type BusyInterval = { startsAt: Date; endsAt: Date };

export type Slot = {
  startsAt: Date;
  endsAt: Date;
  available: boolean;
  shortNotice: boolean;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function londonDateISO(date: Date): string {
  return formatInTimeZone(date, LONDON, "yyyy-MM-dd");
}

export function addLondonDays(dateISO: string, days: number): string {
  const noon = fromZonedTime(`${dateISO} 12:00:00`, LONDON);
  return formatInTimeZone(addDays(noon, days), LONDON, "yyyy-MM-dd");
}

export function zonedDateTime(dateISO: string, hour: number, minute: number): Date {
  return fromZonedTime(`${dateISO} ${pad(hour)}:${pad(minute)}:00`, LONDON);
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export function generateSlots(options: {
  dateISO: string;
  durationMinutes: 30 | 60;
  openHour: number;
  closeHour: number;
  now?: Date;
  busy?: BusyInterval[];
  shortNoticeEnabled?: boolean;
}): Slot[] {
  const now = options.now ?? new Date();
  const busy = options.busy ?? [];
  const shortNoticeEnabled = options.shortNoticeEnabled ?? true;
  const open = zonedDateTime(options.dateISO, options.openHour, 0);
  const close = zonedDateTime(options.dateISO, options.closeHour, 0);
  const step = 30 * 60 * 1000;
  const duration = options.durationMinutes * 60 * 1000;
  const slots: Slot[] = [];

  for (let time = open.getTime(); time + duration <= close.getTime(); time += step) {
    const startsAt = new Date(time);
    const endsAt = new Date(time + duration);
    if (startsAt.getTime() <= now.getTime()) continue;
    const shortNotice = startsAt.getTime() - now.getTime() <= SHORT_NOTICE_WINDOW_MS;
    if (shortNotice && !shortNoticeEnabled) continue;
    const available = !busy.some((item) =>
      rangesOverlap(startsAt, endsAt, item.startsAt, item.endsAt),
    );
    slots.push({ startsAt, endsAt, available, shortNotice });
  }

  return slots;
}

export function nextFreeSlots(options: {
  from: Date;
  durationMinutes: 30 | 60;
  openHour: number;
  closeHour: number;
  busy: BusyInterval[];
  days?: number;
  limit?: number;
  shortNoticeEnabled?: boolean;
}): Slot[] {
  const days = options.days ?? 14;
  const limit = options.limit ?? 5;
  const startDate = londonDateISO(options.from);
  const found: Slot[] = [];
  for (let day = 0; day < days && found.length < limit; day += 1) {
    const dateISO = addLondonDays(startDate, day);
    const slots = generateSlots({
      dateISO,
      durationMinutes: options.durationMinutes,
      openHour: options.openHour,
      closeHour: options.closeHour,
      now: options.from,
      busy: options.busy,
      shortNoticeEnabled: options.shortNoticeEnabled,
    });
    for (const slot of slots) {
      if (!slot.available) continue;
      found.push(slot);
      if (found.length >= limit) break;
    }
  }
  return found;
}
