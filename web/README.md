# Eat Sooner web app

The real Eat Sooner app: restaurants and couriers each sign in on their own phone.

- **Restaurants** sign up, add their restaurant and pickup address, request a courier (the fee is set by the database: $5.25 short, $5.75 standard, $6.75 long), watch the courier's progress live, and can cancel before pickup.
- **Couriers** sign up with their own account and send an application (area, how they deliver, languages, and an optional note if another app turned them away). Nobody asks about a car or a driving record. Once an Eat Sooner admin approves them, they go online, see offers in their area, accept or decline, then mark each job picked up and delivered. They can hold up to 3 jobs at once, and hand one back before pickup.
- **Admins** (Eat Sooner staff) review courier applications, approve or pause couriers, and see every delivery for the day.

Built with Next.js 14 and Supabase, like the other HQ apps.

## How it keeps people's data apart

All of this is enforced by the database (`supabase/schema.sql`), not just the screens:

- Each restaurant sees only its own deliveries. Couriers see open offers, but the customer's phone number only appears after they accept, and disappears after delivery.
- Prices are set by the database. The app can't send its own price.
- A courier can't approve themself, go online before approval, or take a job another courier already took.
- Nobody can make themself an admin from the app.

`supabase/tests/run_tests.sh` checks all of this (55 checks) against a local Postgres.

## Setting it up

Someone with access to Supabase and Vercel does this once. It's free on both services' free plans.

1. **Supabase:** create a new project. Open the SQL editor, paste all of `supabase/schema.sql`, and run it.
2. **Supabase login settings:** under Authentication → URL Configuration, set the Site URL to the app's web address and add `https://YOUR-ADDRESS/auth/callback` to the redirect URLs. Email confirmation can stay on.
3. **Vercel:** create a new project from this GitHub repository and set the **Root Directory to `web`**. Add these environment variables (from Supabase → Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (the app's web address, for example `https://eatsooner.vercel.app`)
4. **Make the first admin:** sign up in the app as a restaurant with the admin's email, confirm the email, then run this in the Supabase SQL editor:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'ADMIN-EMAIL-HERE');
   ```

5. **Try it:** sign up one restaurant and one courier (two different emails), approve the courier on `/admin`, go online as the courier, request a courier as the restaurant, and accept, pick up and deliver it.

To run it on a laptop instead: copy `.env.example` to `.env.local`, fill it in, then `npm install` and `npm run dev` in this folder.

## Not built yet

- **Payments:** no billing for restaurants and no payouts to couriers. Fees are recorded, not charged.
- **Courier pay:** not decided, so the app shows only "plus 100% of tips". NYC's delivery-worker minimum pay rules will apply.
- **ID and work-eligibility checks:** the app records the courier's confirmation and puts them in a review queue; staff check the ID themselves. No ID numbers are stored.
- **Maps and distance:** the restaurant picks the trip distance. There is no map, routing or address check.
- **Tips, ratings, push notifications, text messages, and password reset.**
- **Customer tracking link.** Customers aren't sent anything yet.

These are the next pieces to build, along with a lawyer's review of how NYC's courier rules apply.
