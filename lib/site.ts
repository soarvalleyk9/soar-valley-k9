export const SITE = {
  brand: "Secure Paddocks UK",
  venue: "Soar Valley K9 Secluded Retreat",
  shortVenue: "Soar Valley K9",
  tagline: "A private secure dog field. One booking at a time, so the field is yours.",
  email: "soarvalley.k9@outlook.com",
  phoneDisplay: "07921 136975",
  phoneTel: "+447921136975",
  addressLines: [
    "Sileby Road",
    "Mountsorrel",
    "Barrow upon Soar",
    "Loughborough",
    "LE12 7BB",
  ],
  postcode: "LE12 7BB",
  lat: 52.733477,
  lng: -1.134686,
  gpsLabel: "52°44'00.1\"N 1°08'05.2\"W",
  what3words: "parting.dried.renamed",
  parking:
    "There is adequate space outside the gate to park while you open it, and you can then drive into the field on hard standing and lock the gate behind you.",
  revolutUrl:
    "https://checkout.revolut.com/pay/cd5da613-5bdf-49d1-927b-5eb1389e3e30",
  termsVersion: "2026-10-30",
  termsUpdatedLabel: "30 October 2026",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Soar+Valley+K9+Secluded+Retreat",
  directionsUrl:
    "https://www.google.com/maps/dir/?api=1&destination=52.733477,-1.134686",
  w3wUrl: "https://what3words.com/parting.dried.renamed",
  reviewsRating: "4.6",
  reviewsCount: 22,
} as const;

export const ACTIVE_BOOKING_STATUSES = [
  "awaiting_payment",
  "payment_claimed",
  "awaiting_balance",
  "needs_review",
  "authorized",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  payment_claimed: "Payment sent — waiting for us to confirm",
  awaiting_balance: "Balance due",
  needs_review: "With us to check",
  authorized: "Confirmed",
  cancelled: "Cancelled",
  late_cancelled: "Cancelled late",
  expired: "Expired",
};

export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.URL ||
    "https://www.securepaddocksuk.co.uk";
  return raw.replace(/\/$/, "");
}

export function ownerEmail(): string {
  return process.env.OWNER_EMAIL || SITE.email;
}
