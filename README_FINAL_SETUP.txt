HISAB KHATA — SINGLE ADMIN + STAFF

This version is intentionally a SINGLE-ADMIN website. There is exactly one administrator account. No second-admin signup, no admin invite, and no public staff signup.

ADMIN FIRST SETUP
1. Create the single administrator account from Supabase Authentication or your private admin SQL/process.
2. Run SUPABASE_SETUP.sql so the administrator profile, workspace and protections are in place.
3. Return to Hisab Khata and sign in with the administrator email and password.
4. The public website has no admin account creation screen.

STAFF
1. Admin -> Settings -> Staff & Roles.
2. Enter staff name, email and password.
3. Save the permissions for that staff member.
4. Staff logs in directly with the email and password set by the admin.

EDGE FUNCTION
The browser cannot securely create another auth user with a password. The included admin-users Edge Function performs staff creation using the Supabase service role. Deploy it once:
  supabase login
  supabase link --project-ref jjryefzywugocusmsqvq
  supabase functions deploy admin-users --no-verify-jwt
\EMAIL VERIFICATION
Supabase Dashboard -> Authentication -> Providers -> Email -> enable Confirm email.
Then Authentication -> URL Configuration -> set your website URL and add it to Redirect URLs.
\DATABASE
Run SUPABASE_SETUP.sql in the Supabase SQL Editor. It enforces the one-admin rule and removes the public staff invite/signup-code flow.
\AFTER DEPLOYMENT
Upload the webapp folder files and hard refresh with Ctrl+F5.
