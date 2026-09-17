# Bahikhata — Supabase production setup

This build replaces the old browser-only login with **Supabase Auth** and adds:

- Supabase email/password authentication with persistent sessions.
- First-account administrator setup.
- Admin-only Staff & Roles screen.
- Staff invitations by email through a Supabase Edge Function.
- Admin/staff role changes with a database RPC and last-admin protection.
- Active/inactive access control through RLS.
- Shared cloud ledger for all active staff/admin users.
- Private bill storage instead of a public bucket.
- Separate **Photos** and **PDF bills** viewer.
- Clear **Invoice ID** and **Purchase date** metadata on ledger entries.
- Signed URLs for private attachments.
- Realtime ledger refresh.
- Existing backup/restore and reporting features preserved.

## 1. Run the database setup

In Supabase Dashboard → SQL Editor, run the complete `SUPABASE_SETUP.sql` file.

The SQL creates:

- `profiles`
- Supabase Auth → profile trigger
- first-admin bootstrap RPC
- admin-only role-management RPC
- protected `bahikhata_state`
- private `bill-attachments` storage bucket
- RLS policies
- realtime publication for `bahikhata_state`

## 2. Authentication settings

In Supabase Dashboard → Authentication → Providers → Email:

- Enable Email provider.
- For a simple internal deployment, you can disable **Confirm email** if you do not need email verification.
- If confirmation is enabled, the first administrator must confirm the email before signing in.

Configure your Site URL and redirect URLs for the deployed website under Authentication → URL Configuration.

## 3. Deploy the admin user Edge Function

The Staff & Roles page needs the `supabase/functions/admin-users/index.ts` Edge Function because creating/inviting Auth users requires the server-side Supabase Admin API.

Install/login to the Supabase CLI, then from this project directory:

```bash
supabase link --project-ref jjryefzywugocusmsqvq
supabase functions deploy admin-users --no-verify-jwt
```

The function uses the platform-provided Supabase secrets. Do **not** put the service-role key into the website.


### If the website says “Failed to send a request to the Edge Function”

That message normally means the `admin-users` function is not deployed/reachable, rather than a problem with the Staff screen. From the project root run:

```bash
supabase login
supabase link --project-ref jjryefzywugocusmsqvq
supabase functions deploy admin-users --no-verify-jwt
supabase functions list
```

The function source now returns explicit JSON errors for missing server configuration, authentication, authorization, and invalid requests. If deployment succeeds but the browser still reports a network/request failure, check the function logs in Supabase Dashboard → Edge Functions → `admin-users` → Logs.

Do **not** add `SUPABASE_SERVICE_ROLE_KEY` to `webapp/supabase-client.js`.

## 4. First login

Create the single administrator Auth user through Supabase Dashboard or your private admin provisioning process, then run `SUPABASE_SETUP.sql`.

The public website does not include an admin account creation screen. Only the one administrator profile/workspace created by your private setup should exist.

Sign in with the administrator email/password.

## 5. Add staff

Admin -> Settings -> **Staff & roles** -> enter the staff member's email/name/password -> **Create Staff Account**.

The staff member signs in directly with the email and password set by the administrator. Their default role is `staff`.

The administrator can then save staff permissions from the same screen. Removing a user disables workspace access.

## 6. Supabase key safety

The website may contain the Supabase **publishable/anon key**. That key is designed for browser use when RLS is configured correctly.

**Never put `service_role` or another secret key in `supabase-client.js`.**

## 7. Attachments

Photos and PDFs are stored in the private `bill-attachments` bucket under the authenticated user's folder. The application generates temporary signed URLs when attachments are opened.

The attachment viewer separates:

- Photos — thumbnail grid → full-screen viewer
- PDF bills — dedicated PDF cards → browser PDF viewer

## 8. Existing data

The old browser-only local data is still read as a migration source when a signed-in session has no cloud data. Once saved, the cloud ledger becomes the source of truth.

Before production migration, make a backup from Settings → Back up data now.

## 9. Production checklist

- Run `SUPABASE_SETUP.sql`.
- Deploy `admin-users`.
- Configure Authentication URLs.
- Create the first admin.
- Invite at least one staff account and test role restrictions.
- Test add/edit/delete purchase and payment.
- Test photo and PDF upload/view/download.
- Test login, logout and password reset.
- Test on a second browser/device to confirm realtime shared data.
- Keep regular JSON backups.

## Production data-safety behavior
- Logout flushes the latest ledger to Supabase before ending the session.
- Logout no longer clears the in-memory/local ledger snapshot.
- Automatic empty cloud snapshots are blocked so a transient empty response cannot erase a populated ledger.
- The explicit "Clear all data" action is the only normal path allowed to write an empty ledger.
- PDF viewing is contained inside the app in a full-screen viewer and does not alter ledger state.
