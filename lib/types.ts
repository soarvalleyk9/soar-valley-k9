export type ProfileRow = {
  id: string;
  email: string;
  first_name: string;
  surname: string;
  mobile: string;
  role: "customer" | "owner";
  vaccination_status: "none" | "pending" | "verified" | "rejected";
  vaccination_expiry: string | null;
  vaccination_reject_reason: string | null;
  vaccination_expiry_reminded_on: string | null;
  blocked: boolean;
  is_regular: boolean;
  owner_notes: string;
  terms_version: string | null;
  terms_accepted_at: string | null;
};

export type PublicSettings = {
  price_1_2_30_pence: number;
  price_1_2_60_pence: number;
  price_3_6_60_pence: number;
  open_hour: number;
  close_hour: number;
  short_notice_enabled: boolean;
  reviews_rating: string;
  reviews_count: number;
  reviews_url: string;
  revolut_payment_url: string;
  terms_version: string;
};

export type BookingRow = {
  id: string;
  reference: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  dog_count: number;
  dogs_know_each_other: boolean;
  terms_accepted: boolean;
  terms_version: string;
  status: string;
  price_pence: number;
  credit_applied_pence: number;
  amount_paid_pence: number;
  amount_due_pence: number;
  payment_method: string | null;
  payment_deadline: string;
  booked_at: string;
  payment_claimed_at: string | null;
  authorized_at: string | null;
  check_in_code: string | null;
  checked_in_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  is_short_notice: boolean;
  is_late_cancel: boolean;
  owner_note: string;
};

export type VaccinationDoc = {
  id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  status: string;
  reject_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type SpecialRequestRow = {
  id: string;
  user_id: string;
  dog_count: number;
  preferred_dates: string;
  message: string;
  status: string;
  owner_notes: string;
  created_at: string;
};

export function customerName(profile: Pick<ProfileRow, "first_name" | "surname">): string {
  return `${profile.first_name} ${profile.surname}`.trim() || "Customer";
}
