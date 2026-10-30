-- Optional fallback if scheduled functions do not appear in Netlify.
-- The Netlify functions in netlify/functions are the normal way. Use this only
-- if those jobs are missing after a day.
--
-- 1. In Supabase: Database → Extensions → enable pg_cron and pg_net.
-- 2. Replace the two values below, then paste this into the SQL editor.
-- 3. Do not enable this and also rely on a second copy — it is safe if you do
--    (reminders are sent once), but one scheduler is enough.

-- YOUR_SITE example: https://www.securepaddocksuk.co.uk
-- YOUR_CRON_SECRET: the same CRON_SECRET you saved in Netlify.

select cron.schedule(
  'svk9-maintenance',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_SITE/api/cron/maintenance',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'svk9-digest',
  '0 5,6 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_SITE/api/cron/digest',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'svk9-keepalive',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_SITE/api/cron/keepalive',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
