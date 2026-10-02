# Supabase setup

1. Create a Supabase project and open **Project Settings → API**.
2. Copy the Project URL and the public `anon` / publishable key into a new
   `.env.local` file at the project root:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-OR-PUBLISHABLE-KEY
   ```

   These are public client values. Never put a `service_role` or secret key in
   a `VITE_` variable or frontend code.
3. In the Supabase SQL Editor, run
   `supabase/migrations/202609290001_profiles.sql`.
4. Then run `supabase/migrations/202609290002_services_bookings.sql`. This
   creates and seeds the salon services, adds the bookings table, and applies
   row-level policies. The services page reads active rows from Supabase after
   this migration; if the project is not configured, the same seed menu is
   provided by the local data adapter.
5. Run `supabase/migrations/202609290003_booking_availability.sql`. It adds
   the availability RPCs and revokes direct client inserts so appointment
   creation goes through the atomic conflict check.
6. In **Authentication → URL Configuration**, set the Site URL to the local
   Vite URL while developing (usually `http://localhost:5173`) and add it to
   the redirect URL allow list. Add your production URL before deployment.
7. Restart the Vite server after creating or changing `.env.local`.

## Create the first admin

1. In **Authentication → Users**, choose **Add user**, enter the admin's email
   and a strong password, and mark the email confirmed for a trusted staff
   account.
2. In the SQL Editor, promote that exact account after confirming it exists:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'admin@example.com';
   ```

3. Confirm exactly one row was updated. The admin signs in at `/admin/login`.
   New public signups always receive the `customer` role; role is not accepted
   from signup form metadata.

The regular Supabase Auth email/password provider must be enabled. If email
confirmation is enabled, a new customer must confirm their email before a
session is established and can open the customer dashboard.
