# Set up online booking

Do these steps in order. You can do them on your phone, but a laptop is easier for the DNS records.

You do not need to change the Netlify build command. That is already in the project.

Until you finish, the website still opens. Booking pages say “Online booking opening soon”.

## 1. Create the Supabase project

Supabase holds the accounts, bookings and vaccination photos.

1. Go to [https://supabase.com](https://supabase.com) and create a free account.
2. Click **New project**.
3. Name it `Soar Valley K9`.
4. Set a database password and save it somewhere safe (Notes app is fine).
5. For the region, choose **West Europe (London)**. You cannot change this later.
6. Wait until the project says it is ready.

## 2. Create the tables

1. In the left menu, open **SQL Editor**.
2. Click **New query**.
3. On your computer, open the file `supabase/migrations/20261030120000_init.sql` from this project. Select all of it and copy it.
4. Paste it into the SQL editor.
5. Click **Run**.
6. You should see **Success**. If you see “already exists”, it has already been run. Do not run it again.

This creates the bookings, the prices, the private vaccination-photo folder, and the rule that two bookings cannot overlap.

The gate code is stored as `CHANGE-ME` until you set the real one in step 10. It is not on the public website.

## 3. Tell Supabase which website may log people in

1. Open **Authentication**, then **URL Configuration**.
2. Set **Site URL** to `https://www.securepaddocksuk.co.uk`
3. Add these **Redirect URLs**, one at a time:
   - `https://www.securepaddocksuk.co.uk/auth/callback`
   - `https://securepaddocksuk.co.uk/auth/callback`
4. Save.
5. Open **Authentication → Sign In / Providers → Email**.
6. Leave **Confirm email** switched on.

Come back for the email sender in step 6, after Resend is verified. Confirmation emails will not be reliable until then.

## 4. Create the Resend account

Resend sends the booking emails from your domain.

1. Go to [https://resend.com](https://resend.com) and create a free account.
2. Open **Domains** and click **Add domain**.
3. Enter `securepaddocksuk.co.uk`.
4. Choose the region closest to the UK (Ireland / eu-west-1 if you are offered it).
5. Leave open and click tracking **off** for this domain. These are booking emails, not newsletters.
6. Resend then shows a **Records** list. Leave that page open. You will copy those records into 123 Reg.

Resend’s list is the one that counts. Copy every record it shows. Newer accounts are given **CNAME** records. Older instructions used a **TXT** and an **MX**. Use whatever is on your screen.

## 5. Add the DNS records at 123 Reg

1. Log in to [123 Reg](https://www.123-reg.co.uk).
2. Open the control panel for `securepaddocksuk.co.uk`.
3. Open **DNS** or **Manage DNS**.
4. For each row Resend shows, click **Add record**.

How to fill in 123 Reg:

- **Type**: the same as Resend (TXT, MX or CNAME).
- **Host / name**: Resend may show `resend._domainkey.securepaddocksuk.co.uk`. In 123 Reg, type only `resend._domainkey`. 123 Reg adds the rest of the domain for you. If the record is for `send`, the host is `send`. If it is for `rsend`, the host is `rsend`.
- **Value**: paste the whole value from Resend. Do not add quotes. Do not chop a long value in half.
- If it is an **MX** record, priority is usually `10`. If 123 Reg adds your domain onto the end of the value, put a dot at the end of the value, for example `feedback-smtp.eu-west-1.amazonses.com.`

The records are usually:

| What it is | Type | Host in 123 Reg | Value |
| --- | --- | --- | --- |
| DKIM | TXT | `resend._domainkey` | Paste the long value from Resend. It starts with `p=`. |
| Sending (older Resend) | MX | `send` | The host Resend shows, priority 10. Often ends in `amazonses.com`. |
| Sending (older Resend) | TXT | `send` | `v=spf1 include:amazonses.com ~all` — only if Resend shows this. |
| Sending (newer Resend) | CNAME | `send` | The target Resend shows. |
| Sending (newer Resend) | CNAME | `rsend` | The target Resend shows, if there is a second CNAME. |

Add a DMARC record as well, if you do not already have one:

| Type | Host | Value |
| --- | --- | --- |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:soarvalley.k9@outlook.com` |

5. Save the records.
6. Back in Resend, click **Verify** or **Restart verification**.
7. Wait. It often turns green within 15 minutes. It can take a few hours. Do not continue to the Netlify keys until the domain says **Verified**.

## 6. Send Supabase login emails through Resend

This is the “confirm your email” and “reset your password” mail.

1. In Resend, open **API Keys** and create a key. Copy it. You will paste it in Netlify as well.
2. In Supabase, open **Authentication → Emails → SMTP Settings**.
3. Switch **Enable custom SMTP** on.
4. Host: `smtp.resend.com`
5. Port: `465`
6. Username: `resend`
7. Password: the Resend API key.
8. Sender email: `noreply@securepaddocksuk.co.uk`
9. Sender name: `Soar Valley K9`
10. Save.

## 7. Add the keys in Netlify

1. Open your site in Netlify.
2. Go to **Site configuration → Environment variables** (on older screens this is **Site settings → Environment variables**).
3. Add each of these. Leave a row blank if you are not using it yet.

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Project Settings → API** → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The `anon` `public` key on that same page |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role` key. This is secret. Never put it in an email or in the website code. |
| `RESEND_API_KEY` | The Resend API key |
| `EMAIL_FROM` | `Soar Valley K9 <noreply@securepaddocksuk.co.uk>` |
| `EMAIL_REPLY_TO` | `soarvalley.k9@outlook.com` |
| `OWNER_EMAIL` | `soarvalley.k9@outlook.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.securepaddocksuk.co.uk` |
| `CRON_SECRET` | Leave blank unless you use the backup timer in step 13 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Leave blank unless you want phone alerts (step 14) |
| `VAPID_PRIVATE_KEY` | Leave blank unless you want phone alerts |
| `VAPID_SUBJECT` | `mailto:soarvalley.k9@outlook.com` |

The full list of names is also in `.env.example`.

## 8. Redeploy

Adding the variables is not enough on its own. Netlify has to build the site again.

1. Open **Deploys**.
2. Click **Trigger deploy**, then **Clear cache and deploy site**.
3. Wait until the deploy says **Published**.

The public pages should look the same. **Log in** should now show a real form, not “opening soon”.

## 9. Make your account the owner

1. On the website, create an account with `soarvalley.k9@outlook.com`.
2. Open the confirmation email and tap the link. Check junk mail if it is missing.
3. In Supabase, open **SQL Editor** and run:

```sql
update public.profiles
set role = 'owner'
where email = 'soarvalley.k9@outlook.com';
```

4. Log out of the website and log in again.
5. You should see **Admin** in the menu.

## 10. Set the real gate code before any real booking

1. Open **Admin → Settings**.
2. Replace `CHANGE-ME` with the real gate code.
3. Check the prices. They should all be listed together: 1–2 dogs £12/hour or £6.50/30 minutes; 3–6 dogs £18/hour only (no 30-minute option); 7+ dogs special request with a manual quote. Change them here if that is wrong. You do not need a new deploy.
4. Save.

If you authorise a booking while the code is still `CHANGE-ME`, the customer is told to phone you instead of being sent a fake code.

## 11. Test it once

Use a second email address for the customer (or ask someone you trust). Do not use a real customer’s money for the first test: you can tap Authorise without paying, then cancel the test booking.

1. On your phone, open the home page. Check the logo, prices and Find us.
2. Create the test customer account and confirm the email.
3. Upload a photo of a vaccination card.
4. In **Admin → Vaccinations**, open the photo and tap **Verify**.
5. As the customer, book a slot a few days ahead.
6. Check the customer email. It should show the amount, the booking reference and the Revolut link. It must **not** contain the gate code.
7. Check `soarvalley.k9@outlook.com` for the new-booking alert.
8. On the payment page, tap **I’ve paid**.
9. Check your email for “Customer says paid”.
10. In **Admin → Authorise**, tap **Authorise**.
11. Check the customer email. It should now have the gate code, a 6-character check-in code, and a QR code.
12. In **Admin → Check-in**, type that code. You should see the booking.
13. In **Settings**, change the gate code and save. The confirmed test booking should get an email with the new code. Change it back afterwards.
14. Cancel the test booking from the customer account (it is more than 24 hours away). The price should show as credit on the account. Nothing is refunded to a bank.

## 12. What runs by itself

After the production deploy, Netlify runs three jobs. You should see them under **Functions**. They only run on the published site, not on a preview.

- Every 5 minutes: release unpaid bookings when the payment time runs out. If the customer already said they paid, the slot is kept and you are emailed to review it. Short-notice bookings also email you at 20 minutes and 40 minutes if you have not authorised them. Confirmed visits get a reminder, with the gate code, about 2 hours before.
- 6am UK time: a digest of today’s bookings, unpaid bookings, vaccination checks and special requests. It also warns customers whose vaccination date is inside 14 days.
- Once a day around midday UK time: a tiny database check so the free Supabase project is not paused for inactivity.

A normal booking made days ahead must be paid within 24 hours, and never later than the slot start. A booking made when the slot is inside the next 60 minutes must be paid before the slot starts. You can turn those short-notice bookings off in **Settings**.

## 13. Only if the jobs do not appear

Wait a day and look at **Functions** on the published deploy. If the three scheduled jobs are missing, use Supabase as the timer instead.

1. Invent a long password and save it in Netlify as `CRON_SECRET`. Redeploy.
2. In Supabase, open **Database → Extensions** and enable `pg_cron` and `pg_net`.
3. Open `supabase/cron.sql`. Replace `YOUR_SITE` and `YOUR_CRON_SECRET`, then paste it into the SQL editor and run it.

You only need one timer. The site will not send the same reminder twice if both run.

## 14. Optional phone alerts

Email is enough. If you also want a notification on the admin home-screen icon:

1. On a computer, in this project folder, run `npx web-push generate-vapid-keys`.
2. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY`.
3. Redeploy.
4. On your phone, open **Admin → Settings** and tap **Turn on phone alerts**. Allow notifications.

To put Admin on your home screen: open an admin page in the phone browser, then use **Add to Home Screen**.
