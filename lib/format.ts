import { formatInTimeZone } from "date-fns-tz";
import { enGB } from "date-fns/locale";
import { LONDON } from "./domain/slots";

export function formatGbp(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function asDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

export function formatWhen(value: Date | string): string {
  return formatInTimeZone(asDate(value), LONDON, "EEE d MMM yyyy, HH:mm", { locale: enGB });
}

export function formatDay(value: Date | string): string {
  return formatInTimeZone(asDate(value), LONDON, "EEE d MMM", { locale: enGB });
}

export function formatTime(value: Date | string): string {
  return formatInTimeZone(asDate(value), LONDON, "HH:mm", { locale: enGB });
}

export function formatSlot(starts: Date | string, ends: Date | string): string {
  return `${formatWhen(starts)}–${formatTime(ends)}`;
}

export function londonHour(date = new Date()): number {
  return Number(formatInTimeZone(date, LONDON, "H"));
}

export function londonTodayISO(date = new Date()): string {
  return formatInTimeZone(date, LONDON, "yyyy-MM-dd");
}

export function formatHours(openHour: number, closeHour: number): string {
  const label = (hour: number) => {
    const suffix = hour >= 12 ? "pm" : "am";
    const clock = hour % 12 || 12;
    return `${clock}${suffix}`;
  };
  return `${label(openHour)}–${label(closeHour)}`;
}
