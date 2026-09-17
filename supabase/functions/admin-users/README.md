# admin-users

Creates staff accounts securely from an authenticated administrator session.

Deploy with:
`supabase functions deploy admin-users --no-verify-jwt`

The function uses Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY` automatically. Never place that key in the website.
