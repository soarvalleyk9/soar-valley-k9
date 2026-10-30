import { DEFAULT_PRICES } from "./domain/pricing";
import { SITE } from "./site";
import { tryAnonClient, tryServiceClient } from "./supabase/admin";
import type { PublicSettings } from "./types";

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  price_1_2_30_pence: DEFAULT_PRICES.price12x30,
  price_1_2_60_pence: DEFAULT_PRICES.price12x60,
  price_3_6_60_pence: DEFAULT_PRICES.price36x60,
  open_hour: 7,
  close_hour: 19,
  short_notice_enabled: true,
  reviews_rating: SITE.reviewsRating,
  reviews_count: SITE.reviewsCount,
  reviews_url: SITE.mapsUrl,
  revolut_payment_url: SITE.revolutUrl,
  terms_version: SITE.termsVersion,
};

export function toPriceList(settings: PublicSettings) {
  return {
    price12x30: settings.price_1_2_30_pence,
    price12x60: settings.price_1_2_60_pence,
    price36x60: settings.price_3_6_60_pence,
  };
}

function mapSettings(data: PublicSettings): PublicSettings {
  return {
    price_1_2_30_pence: data.price_1_2_30_pence,
    price_1_2_60_pence: data.price_1_2_60_pence,
    price_3_6_60_pence: data.price_3_6_60_pence,
    open_hour: data.open_hour,
    close_hour: data.close_hour,
    short_notice_enabled: data.short_notice_enabled,
    reviews_rating: data.reviews_rating,
    reviews_count: data.reviews_count,
    reviews_url: data.reviews_url,
    revolut_payment_url: data.revolut_payment_url,
    terms_version: data.terms_version,
  };
}

export async function loadPublicSettings(): Promise<PublicSettings> {
  const client = tryAnonClient();
  if (!client) return DEFAULT_PUBLIC_SETTINGS;
  try {
    const { data, error } = await client.from("settings").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return DEFAULT_PUBLIC_SETTINGS;
    return mapSettings(data as PublicSettings);
  } catch {
    return DEFAULT_PUBLIC_SETTINGS;
  }
}

export async function loadGateCode(): Promise<string> {
  const service = tryServiceClient();
  if (!service) return "CHANGE-ME";
  const { data } = await service.from("gate_config").select("gate_code").eq("id", 1).maybeSingle();
  return data?.gate_code || "CHANGE-ME";
}
