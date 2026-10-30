-- Soar Valley K9 / Secure Paddocks UK
-- Paste this whole file into the Supabase SQL editor and press Run.
-- Run it once on a new, empty project. If you see "already exists", it has
-- already been applied — do not run it a second time.
--
-- Pricing, deadlines and cancellation amounts match the TypeScript in lib/domain.
-- The gate code is in gate_config, not in settings, so the public site cannot read it.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('customer', 'owner');

create type public.vaccination_status as enum ('none', 'pending', 'verified', 'rejected');

create type public.booking_status as enum (
  'awaiting_payment',
  'payment_claimed',
  'awaiting_balance',
  'needs_review',
  'authorized',
  'cancelled',
  'late_cancelled',
  'expired'
);

create type public.payment_method as enum ('revolut', 'cash', 'credit', 'mixed');

create type public.credit_reason as enum (
  'cancellation',
  'venue_cancellation',
  'overpayment',
  'goodwill',
  'applied_to_booking',
  'restored',
  'adjustment'
);

create type public.special_request_status as enum ('open', 'quoted', 'closed');

create type public.reminder_kind as enum (
  'short_notice_20',
  'short_notice_40',
  'pre_slot',
  'expiry_customer',
  'needs_review_owner'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  first_name text not null default '',
  surname text not null default '',
  mobile text not null default '',
  role public.user_role not null default 'customer',
  vaccination_status public.vaccination_status not null default 'none',
  vaccination_expiry date,
  vaccination_reject_reason text,
  vaccination_expiry_reminded_on date,
  blocked boolean not null default false,
  is_regular boolean not null default false,
  owner_notes text not null default '',
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_unique on public.profiles (lower(email)) where email <> '';

create table public.settings (
  id integer primary key default 1 check (id = 1),
  -- Final rates: 1–2 dogs £12/hour or £6.50/30 min; 3–6 dogs £18/hour only; 7+ is a manual quote.
  price_1_2_30_pence integer not null default 650 check (price_1_2_30_pence >= 0),
  price_1_2_60_pence integer not null default 1200 check (price_1_2_60_pence >= 0),
  price_3_6_60_pence integer not null default 1800 check (price_3_6_60_pence >= 0),
  open_hour integer not null default 7 check (open_hour between 0 and 22),
  close_hour integer not null default 19 check (close_hour between 1 and 23),
  short_notice_enabled boolean not null default true,
  reviews_rating text not null default '4.6',
  reviews_count integer not null default 22 check (reviews_count >= 0),
  reviews_url text not null default 'https://www.google.com/maps/search/?api=1&query=Soar+Valley+K9+Secluded+Retreat',
  revolut_payment_url text not null default 'https://checkout.revolut.com/pay/cd5da613-5bdf-49d1-927b-5eb1389e3e30',
  terms_version text not null default '2026-10-30',
  last_digest_on date,
  updated_at timestamptz not null default now(),
  check (close_hour > open_hour)
);

-- Gate code is separate so customers and the public API cannot select it.
create table public.gate_config (
  id integer primary key default 1 check (id = 1),
  gate_code text not null default 'CHANGE-ME',
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references public.profiles (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes in (30, 60)),
  dog_count integer not null check (dog_count between 1 and 6),
  dogs_know_each_other boolean not null,
  terms_accepted boolean not null,
  terms_version text not null,
  status public.booking_status not null default 'awaiting_payment',
  price_pence integer not null check (price_pence >= 0),
  credit_applied_pence integer not null default 0 check (credit_applied_pence >= 0),
  amount_paid_pence integer not null default 0 check (amount_paid_pence >= 0),
  amount_due_pence integer not null check (amount_due_pence >= 0),
  payment_method public.payment_method,
  payment_deadline timestamptz not null,
  booked_at timestamptz not null default now(),
  payment_claimed_at timestamptz,
  authorized_at timestamptz,
  authorized_by uuid references public.profiles (id),
  check_in_code text unique,
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  is_short_notice boolean not null default false,
  is_late_cancel boolean not null default false,
  owner_note text not null default '',
  during tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (credit_applied_pence + amount_paid_pence + amount_due_pence = price_pence),
  check (dogs_know_each_other),
  check (terms_accepted)
);

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (during with &&)
  where (status in (
    'awaiting_payment',
    'payment_claimed',
    'awaiting_balance',
    'needs_review',
    'authorized'
  ));

create index bookings_user_idx on public.bookings (user_id);
create index bookings_starts_idx on public.bookings (starts_at);
create index bookings_deadline_idx on public.bookings (payment_deadline)
  where status in ('awaiting_payment', 'payment_claimed', 'awaiting_balance');

create table public.credits_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  booking_id uuid references public.bookings (id),
  amount_pence integer not null,
  reason public.credit_reason not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

create index credits_user_idx on public.credits_ledger (user_id);

create table public.vaccination_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  status public.vaccination_status not null default 'pending',
  reject_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index vaccination_user_idx on public.vaccination_documents (user_id, created_at desc);

create table public.special_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  dog_count integer not null check (dog_count >= 7),
  preferred_dates text not null default '',
  message text not null default '',
  status public.special_request_status not null default 'open',
  owner_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  context text not null default 'signup'
);

create table public.booking_reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind public.reminder_kind not null,
  sent_at timestamptz not null default now(),
  unique (booking_id, kind)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_address text not null,
  template text not null,
  booking_id uuid references public.bookings (id),
  error text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

create trigger special_requests_set_updated_at
before update on public.special_requests
for each row execute function public.set_updated_at();

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- Customers cannot change their role, block flag, notes, or vaccination state.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role and SQL editor have no user id. Customers always do.
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null or public.is_owner() then
    return new;
  end if;
  new.role = old.role;
  new.blocked = old.blocked;
  new.is_regular = old.is_regular;
  new.owner_notes = old.owner_notes;
  new.vaccination_status = old.vaccination_status;
  new.vaccination_expiry = old.vaccination_expiry;
  new.vaccination_reject_reason = old.vaccination_reject_reason;
  new.vaccination_expiry_reminded_on = old.vaccination_expiry_reminded_on;
  new.email = old.email;
  new.terms_version = old.terms_version;
  new.terms_accepted_at = old.terms_accepted_at;
  return new;
end;
$$;

create trigger profiles_protect_columns
before update on public.profiles
for each row execute function public.protect_profile_columns();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, first_name, surname, mobile, terms_version, terms_accepted_at
  ) values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'surname', ''),
    coalesce(new.raw_user_meta_data->>'mobile', ''),
    new.raw_user_meta_data->>'terms_version',
    case
      when new.raw_user_meta_data->>'terms_version' is null then null
      else now()
    end
  );
  if new.raw_user_meta_data->>'terms_version' is not null then
    insert into public.terms_acceptances (user_id, terms_version, context)
    values (new.id, new.raw_user_meta_data->>'terms_version', 'signup');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Vaccination must be verified, and the account must not be blocked.
-- Runs for every insert, including the service role.
create or replace function public.enforce_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles;
begin
  select * into prof from public.profiles where id = new.user_id;
  if not found then
    raise exception 'Account not found';
  end if;
  if prof.blocked then
    raise exception 'This account cannot make bookings';
  end if;
  if prof.vaccination_status is distinct from 'verified' then
    raise exception 'Vaccination records must be checked before you can book';
  end if;
  if new.dogs_know_each_other is not true then
    raise exception 'All dogs in a booking must know each other';
  end if;
  if new.terms_accepted is not true then
    raise exception 'Please accept the terms and conditions';
  end if;
  if new.status <> 'awaiting_payment' then
    raise exception 'New bookings start as awaiting payment';
  end if;
  if new.dog_count >= 3 and new.duration_minutes <> 60 then
    raise exception 'Groups of 3 to 6 dogs can only book 60 minutes';
  end if;
  return new;
end;
$$;

create trigger bookings_enforce_insert
before insert on public.bookings
for each row execute function public.enforce_booking_insert();

create or replace function public.random_code(len integer)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet text := 'ACDEFGHJKMNPQRTVWXY2345789';
  out text := '';
  i integer;
  n integer;
begin
  if len < 1 then
    raise exception 'Code length must be positive';
  end if;
  for i in 1..len loop
    n := 1 + (get_byte(decode(md5(gen_random_uuid()::text || i::text), 'hex'), 0) % length(alphabet));
    out := out || substr(alphabet, n, 1);
  end loop;
  return out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Booking operations (service role only — the website checks who is logged in)
-- ---------------------------------------------------------------------------

create or replace function public.create_booking(
  p_user_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_dog_count integer,
  p_dogs_know_each_other boolean,
  p_terms_accepted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles;
  st public.settings;
  price integer;
  balance integer;
  credit_applied integer;
  amount_due integer;
  ends_at timestamptz;
  booked timestamptz := now();
  short boolean;
  deadline timestamptz;
  ref text;
  row public.bookings;
  i integer;
  start_local timestamp;
  end_local timestamp;
begin
  if p_dogs_know_each_other is not true then
    raise exception 'All dogs in a booking must know each other';
  end if;
  if p_terms_accepted is not true then
    raise exception 'Please accept the terms and conditions';
  end if;
  if p_dog_count < 1 or p_dog_count > 6 then
    raise exception 'For 7 or more dogs, use the special request form';
  end if;
  if p_duration_minutes not in (30, 60) then
    raise exception 'Choose 30 or 60 minutes';
  end if;
  if p_dog_count >= 3 and p_duration_minutes <> 60 then
    raise exception 'Groups of 3 to 6 dogs can only book 60 minutes';
  end if;
  if p_starts_at <= booked then
    raise exception 'That time has already started';
  end if;

  select * into prof from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Account not found';
  end if;
  if prof.blocked then
    raise exception 'This account cannot make bookings';
  end if;
  if prof.vaccination_status is distinct from 'verified' then
    raise exception 'Vaccination records must be checked before you can book';
  end if;

  select * into st from public.settings where id = 1;
  if not found then
    raise exception 'Online booking is not fully switched on yet. Please call or email us.';
  end if;

  start_local := p_starts_at at time zone 'Europe/London';
  if extract(minute from start_local)::integer not in (0, 30)
     or date_trunc('minute', p_starts_at) <> p_starts_at then
    raise exception 'Please choose a slot from the list';
  end if;
  if start_local::time < make_time(st.open_hour, 0, 0) then
    raise exception 'That time is outside opening hours';
  end if;

  ends_at := p_starts_at + make_interval(mins => p_duration_minutes);
  end_local := ends_at at time zone 'Europe/London';
  if end_local::date <> start_local::date or end_local::time > make_time(st.close_hour, 0, 0) then
    raise exception 'That slot would run past closing time';
  end if;

  if p_dog_count <= 2 and p_duration_minutes = 30 then
    price := st.price_1_2_30_pence;
  elsif p_dog_count <= 2 then
    price := st.price_1_2_60_pence;
  else
    price := st.price_3_6_60_pence;
  end if;

  perform pg_advisory_xact_lock(hashtext('credit-' || p_user_id::text));

  select coalesce(sum(amount_pence), 0) into balance
  from public.credits_ledger
  where user_id = p_user_id;
  if balance < 0 then
    balance := 0;
  end if;
  credit_applied := least(balance, price);
  amount_due := price - credit_applied;

  short := (p_starts_at - booked) <= interval '60 minutes';
  if short and not st.short_notice_enabled then
    raise exception 'Short-notice bookings are turned off. Please choose a later time.';
  end if;
  if short then
    deadline := least(booked + interval '60 minutes', p_starts_at);
  else
    deadline := least(booked + interval '24 hours', p_starts_at);
  end if;

  for i in 1..5 loop
    ref := 'SV' || public.random_code(6);
    begin
      insert into public.bookings (
        reference, user_id, starts_at, ends_at, duration_minutes, dog_count,
        dogs_know_each_other, terms_accepted, terms_version, status,
        price_pence, credit_applied_pence, amount_paid_pence, amount_due_pence,
        payment_deadline, is_short_notice, booked_at
      ) values (
        ref, p_user_id, p_starts_at, ends_at, p_duration_minutes, p_dog_count,
        true, true, st.terms_version, 'awaiting_payment',
        price, credit_applied, 0, amount_due,
        deadline, short, booked
      )
      returning * into row;
      exit;
    exception
      when unique_violation then
        if i = 5 then
          raise exception 'Please try that booking again';
        end if;
    end;
  end loop;

  if credit_applied > 0 then
    insert into public.credits_ledger (user_id, booking_id, amount_pence, reason, note)
    values (
      p_user_id,
      row.id,
      -credit_applied,
      'applied_to_booking',
      'Credit used on ' || row.reference
    );
  end if;

  insert into public.terms_acceptances (user_id, terms_version, context)
  values (p_user_id, st.terms_version, 'booking');

  return to_jsonb(row);
exception
  when exclusion_violation then
    raise exception 'That time has just been booked. Please choose another slot.';
end;
$$;

create or replace function public.claim_payment(p_user_id uuid, p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.bookings;
begin
  select * into row
  from public.bookings
  where reference = p_reference and user_id = p_user_id
  for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if row.status = 'payment_claimed' then
    return jsonb_build_object('booking', to_jsonb(row), 'already', true);
  end if;
  if row.status = 'authorized' then
    raise exception 'This booking is already confirmed';
  end if;
  if row.status in ('expired', 'cancelled', 'late_cancelled') then
    raise exception 'This booking is no longer waiting for payment';
  end if;
  if row.status not in ('awaiting_payment', 'awaiting_balance') then
    raise exception 'This booking cannot be marked as paid';
  end if;

  update public.bookings
  set status = 'payment_claimed',
      payment_claimed_at = coalesce(payment_claimed_at, now())
  where id = row.id
  returning * into row;

  return jsonb_build_object('booking', to_jsonb(row), 'already', false);
end;
$$;

create or replace function public.cancel_booking(p_user_id uuid, p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.bookings;
  late boolean;
  credit_pence integer := 0;
  next_status public.booking_status;
begin
  perform pg_advisory_xact_lock(hashtext('credit-' || p_user_id::text));

  select * into row
  from public.bookings
  where reference = p_reference and user_id = p_user_id
  for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if row.status not in (
    'awaiting_payment', 'payment_claimed', 'awaiting_balance', 'needs_review', 'authorized'
  ) then
    raise exception 'This booking can no longer be cancelled';
  end if;

  late := row.starts_at - now() < interval '24 hours';
  if late then
    next_status := 'late_cancelled';
    credit_pence := 0;
  elsif row.status = 'authorized' then
    next_status := 'cancelled';
    credit_pence := row.price_pence;
  else
    next_status := 'cancelled';
    credit_pence := row.credit_applied_pence;
  end if;

  update public.bookings
  set status = next_status,
      cancelled_at = now(),
      is_late_cancel = late
  where id = row.id
  returning * into row;

  if credit_pence > 0 then
    insert into public.credits_ledger (user_id, booking_id, amount_pence, reason, note)
    values (
      p_user_id,
      row.id,
      credit_pence,
      'cancellation',
      case when late then 'Late cancellation' else 'Cancellation credit for ' || row.reference end
    );
  end if;

  return jsonb_build_object(
    'booking', to_jsonb(row),
    'late', late,
    'credit_pence', credit_pence
  );
end;
$$;

create or replace function public.authorize_booking(
  p_actor uuid,
  p_booking_id uuid,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.bookings;
  method public.payment_method;
  code text;
  i integer;
  gate text;
  already boolean := false;
begin
  if not exists (
    select 1 from public.profiles where id = p_actor and role = 'owner'
  ) then
    raise exception 'Owners only';
  end if;
  if p_method not in ('revolut', 'cash', 'credit') then
    raise exception 'Unknown payment method';
  end if;

  select * into row from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  select gate_code into gate from public.gate_config where id = 1;

  if row.status = 'authorized' then
    return jsonb_build_object(
      'booking', to_jsonb(row),
      'gate_code', gate,
      'check_in_code', row.check_in_code,
      'already', true
    );
  end if;

  if row.status not in ('awaiting_payment', 'payment_claimed', 'awaiting_balance', 'needs_review') then
    raise exception 'This booking can no longer be authorised';
  end if;

  if row.amount_due_pence = 0 and row.amount_paid_pence = 0 then
    method := 'credit';
  else
    method := p_method::public.payment_method;
  end if;

  if row.check_in_code is null then
    for i in 1..8 loop
      code := public.random_code(6);
      begin
        update public.bookings
        set status = 'authorized',
            authorized_at = coalesce(authorized_at, now()),
            authorized_by = p_actor,
            check_in_code = code,
            amount_paid_pence = amount_paid_pence + amount_due_pence,
            amount_due_pence = 0,
            payment_method = method
        where id = row.id
        returning * into row;
        exit;
      exception
        when unique_violation then
          if i = 8 then
            raise exception 'Could not generate a check-in code. Please try again.';
          end if;
      end;
    end loop;
  else
    update public.bookings
    set status = 'authorized',
        authorized_at = coalesce(authorized_at, now()),
        authorized_by = p_actor,
        amount_paid_pence = amount_paid_pence + amount_due_pence,
        amount_due_pence = 0,
        payment_method = method
    where id = row.id
    returning * into row;
  end if;

  return jsonb_build_object(
    'booking', to_jsonb(row),
    'gate_code', gate,
    'check_in_code', row.check_in_code,
    'already', already
  );
end;
$$;

create or replace function public.record_payment(
  p_actor uuid,
  p_booking_id uuid,
  p_received_pence integer,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.bookings;
  extra integer;
  result jsonb;
begin
  if not exists (
    select 1 from public.profiles where id = p_actor and role = 'owner'
  ) then
    raise exception 'Owners only';
  end if;
  if p_received_pence is null or p_received_pence <= 0 then
    raise exception 'Enter the amount you received';
  end if;

  select * into row from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if row.status not in ('awaiting_payment', 'payment_claimed', 'awaiting_balance', 'needs_review') then
    raise exception 'This booking can no longer take a payment';
  end if;

  perform pg_advisory_xact_lock(hashtext('credit-' || row.user_id::text));

  if p_received_pence < row.amount_due_pence then
    update public.bookings
    set amount_paid_pence = amount_paid_pence + p_received_pence,
        amount_due_pence = amount_due_pence - p_received_pence,
        status = 'awaiting_balance',
        payment_claimed_at = coalesce(payment_claimed_at, now()),
        payment_deadline = least(now() + interval '24 hours', starts_at)
    where id = row.id
    returning * into row;

    return jsonb_build_object(
      'outcome', 'balance_due',
      'booking', to_jsonb(row),
      'balance_due_pence', row.amount_due_pence,
      'credit_pence', 0
    );
  end if;

  extra := p_received_pence - row.amount_due_pence;
  result := public.authorize_booking(p_actor, p_booking_id, p_method);

  if extra > 0 then
    insert into public.credits_ledger (user_id, booking_id, amount_pence, reason, note, created_by)
    values (
      row.user_id,
      row.id,
      extra,
      'overpayment',
      'Overpayment on ' || row.reference,
      p_actor
    );
  end if;

  return result || jsonb_build_object(
    'outcome', 'authorized',
    'credit_pence', extra,
    'balance_due_pence', 0
  );
end;
$$;

create or replace function public.release_booking(p_actor uuid, p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.bookings;
  credit_pence integer := 0;
begin
  if not exists (
    select 1 from public.profiles where id = p_actor and role = 'owner'
  ) then
    raise exception 'Owners only';
  end if;

  select * into row from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if row.status in ('cancelled', 'late_cancelled') then
    return jsonb_build_object('booking', to_jsonb(row), 'credit_pence', 0);
  end if;
  if row.status = 'authorized' or row.amount_paid_pence > 0 then
    raise exception 'This booking has payment recorded. Cancel and credit the full price instead.';
  end if;

  credit_pence := row.credit_applied_pence;
  perform pg_advisory_xact_lock(hashtext('credit-' || row.user_id::text));

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      is_late_cancel = false
  where id = row.id
  returning * into row;

  if credit_pence > 0 then
    insert into public.credits_ledger (user_id, booking_id, amount_pence, reason, note, created_by)
    values (row.user_id, row.id, credit_pence, 'restored', 'Credit returned when the slot was released', p_actor);
  end if;

  return jsonb_build_object('booking', to_jsonb(row), 'credit_pence', credit_pence);
end;
$$;

create or replace function public.venue_cancel(p_actor uuid, p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.bookings;
begin
  if not exists (
    select 1 from public.profiles where id = p_actor and role = 'owner'
  ) then
    raise exception 'Owners only';
  end if;

  select * into row from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if row.status in ('cancelled', 'late_cancelled') then
    return jsonb_build_object('booking', to_jsonb(row), 'credit_pence', 0);
  end if;

  perform pg_advisory_xact_lock(hashtext('credit-' || row.user_id::text));

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      is_late_cancel = false
  where id = row.id
  returning * into row;

  insert into public.credits_ledger (user_id, booking_id, amount_pence, reason, note, created_by)
  values (
    row.user_id,
    row.id,
    row.price_pence,
    'venue_cancellation',
    'Venue credit for ' || row.reference,
    p_actor
  );

  return jsonb_build_object('booking', to_jsonb(row), 'credit_pence', row.price_pence);
end;
$$;

create or replace function public.move_booking(
  p_actor uuid,
  p_booking_id uuid,
  p_starts_at timestamptz,
  p_authorize boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.bookings;
  st public.settings;
  ends_at timestamptz;
  start_local timestamp;
  end_local timestamp;
  booked timestamptz := now();
  short boolean;
  deadline timestamptz;
begin
  if not exists (
    select 1 from public.profiles where id = p_actor and role = 'owner'
  ) then
    raise exception 'Owners only';
  end if;

  select * into row from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if row.status in ('cancelled', 'late_cancelled') then
    raise exception 'Cancelled bookings stay cancelled. Make a new booking instead.';
  end if;

  select * into st from public.settings where id = 1;
  start_local := p_starts_at at time zone 'Europe/London';
  if p_starts_at <= booked then
    raise exception 'Choose a time in the future';
  end if;
  if extract(minute from start_local)::integer not in (0, 30)
     or date_trunc('minute', p_starts_at) <> p_starts_at then
    raise exception 'Please choose a slot from the list';
  end if;
  ends_at := p_starts_at + make_interval(mins => row.duration_minutes);
  end_local := ends_at at time zone 'Europe/London';
  if start_local::time < make_time(st.open_hour, 0, 0)
     or end_local::date <> start_local::date
     or end_local::time > make_time(st.close_hour, 0, 0) then
    raise exception 'That slot is outside opening hours';
  end if;

  short := (p_starts_at - booked) <= interval '60 minutes';
  if short then
    deadline := least(booked + interval '60 minutes', p_starts_at);
  else
    deadline := least(booked + interval '24 hours', p_starts_at);
  end if;

  update public.bookings
  set starts_at = p_starts_at,
      ends_at = ends_at,
      is_short_notice = short,
      payment_deadline = deadline,
      checked_in_at = null,
      status = case
        when status = 'expired' then 'awaiting_payment'::public.booking_status
        else status
      end
  where id = row.id
  returning * into row;

  if p_authorize then
    return public.authorize_booking(p_actor, row.id, coalesce(row.payment_method::text, 'revolut'));
  end if;

  return jsonb_build_object('booking', to_jsonb(row), 'already', false);
exception
  when exclusion_violation then
    raise exception 'That time is already booked. Please choose another slot.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.gate_config enable row level security;
alter table public.bookings enable row level security;
alter table public.credits_ledger enable row level security;
alter table public.vaccination_documents enable row level security;
alter table public.special_requests enable row level security;
alter table public.terms_acceptances enable row level security;
alter table public.booking_reminders enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.email_log enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_owner());

create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_owner())
with check (id = auth.uid() or public.is_owner());

create policy settings_select on public.settings
for select to anon, authenticated
using (true);

create policy settings_update on public.settings
for update to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy gate_select on public.gate_config
for select to authenticated
using (public.is_owner());

create policy gate_update on public.gate_config
for update to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy bookings_select on public.bookings
for select to authenticated
using (user_id = auth.uid() or public.is_owner());

-- Direct inserts from the browser are allowed only for a verified, unblocked
-- customer booking themselves. The app uses the service role, and the insert
-- trigger checks vaccination as well.
create policy bookings_insert on public.bookings
for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'awaiting_payment'
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and vaccination_status = 'verified'
      and blocked = false
      and role = 'customer'
  )
);

create policy credits_select on public.credits_ledger
for select to authenticated
using (user_id = auth.uid() or public.is_owner());

create policy vaccination_select on public.vaccination_documents
for select to authenticated
using (user_id = auth.uid() or public.is_owner());

create policy vaccination_insert on public.vaccination_documents
for insert to authenticated
with check (user_id = auth.uid() and status = 'pending');

create policy requests_select on public.special_requests
for select to authenticated
using (user_id = auth.uid() or public.is_owner());

create policy requests_insert on public.special_requests
for insert to authenticated
with check (user_id = auth.uid() and status = 'open');

create policy requests_update on public.special_requests
for update to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy terms_select on public.terms_acceptances
for select to authenticated
using (user_id = auth.uid() or public.is_owner());

create policy terms_insert on public.terms_acceptances
for insert to authenticated
with check (user_id = auth.uid());

create policy push_select on public.push_subscriptions
for select to authenticated
using (user_id = auth.uid());

create policy push_insert on public.push_subscriptions
for insert to authenticated
with check (user_id = auth.uid());

create policy push_update on public.push_subscriptions
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy push_delete on public.push_subscriptions
for delete to authenticated
using (user_id = auth.uid());

-- booking_reminders and email_log have no policies: only the service role.

-- ---------------------------------------------------------------------------
-- Storage: private vaccination photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('vaccination-records', 'vaccination-records', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy vaccination_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'vaccination-records'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy vaccination_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'vaccination-records'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_owner()
  )
);

create policy vaccination_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'vaccination-records'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant select on public.settings to anon, authenticated;
grant update on public.settings to authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.gate_config to authenticated;
grant select on public.bookings to authenticated;
grant insert on public.bookings to authenticated;
grant select on public.credits_ledger to authenticated;
grant select, insert on public.vaccination_documents to authenticated;
grant select, insert on public.special_requests to authenticated;
grant update on public.special_requests to authenticated;
grant select, insert on public.terms_acceptances to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

grant all on all tables in schema public to service_role;

grant execute on function public.is_owner() to authenticated;

revoke all on function public.create_booking(uuid, timestamptz, integer, integer, boolean, boolean) from public, anon, authenticated;
revoke all on function public.claim_payment(uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_booking(uuid, text) from public, anon, authenticated;
revoke all on function public.authorize_booking(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.record_payment(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.release_booking(uuid, uuid) from public, anon, authenticated;
revoke all on function public.venue_cancel(uuid, uuid) from public, anon, authenticated;
revoke all on function public.move_booking(uuid, uuid, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.random_code(integer) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.enforce_booking_insert() from public, anon, authenticated;
revoke all on function public.protect_profile_columns() from public, anon, authenticated;

grant execute on function public.create_booking(uuid, timestamptz, integer, integer, boolean, boolean) to service_role;
grant execute on function public.claim_payment(uuid, text) to service_role;
grant execute on function public.cancel_booking(uuid, text) to service_role;
grant execute on function public.authorize_booking(uuid, uuid, text) to service_role;
grant execute on function public.record_payment(uuid, uuid, integer, text) to service_role;
grant execute on function public.release_booking(uuid, uuid) to service_role;
grant execute on function public.venue_cancel(uuid, uuid) to service_role;
grant execute on function public.move_booking(uuid, uuid, timestamptz, boolean) to service_role;
grant execute on function public.random_code(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------

insert into public.settings (id) values (1);
insert into public.gate_config (id) values (1);
