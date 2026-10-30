# Secure Paddocks UK

Booking site for Soar Valley K9 Secluded Retreat, a private secure dog field on Sileby Road.

Customers make an account, upload vaccination records, and book a single slot. They pay with a Revolut link. The gate code and a check-in code are emailed **only after** the owner taps Authorise.

The site is a Next.js app and deploys on Netlify. Accounts, bookings and vaccination photos live in Supabase. Email is sent with Resend.

Public pages (home, prices, find us, terms, privacy) work before any accounts are connected. Booking, account and admin pages show “Online booking opening soon” until the environment variables are set and the site is rebuilt.

Setup, in the order you should do it, is in [SETUP.md](SETUP.md).

```bash
npm test
npm run build
```
