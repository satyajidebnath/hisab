HISAB KHATA — EASY MULTI-USER SETUP

1. Upload the webapp folder to your hosting (or open webapp/index.html for testing).
2. Open webapp/supabase-client.js and confirm your Supabase URL + Publishable key.
3. In Supabase Dashboard -> SQL Editor, run SUPABASE_SETUP.sql ONCE.
4. Open the website and click "Create account".
5. Choose Administrator to create a private workspace.
6. To add staff: Administrator -> Settings -> Staff & roles -> Create signup code.
   Send the displayed code to the staff member.
7. Staff clicks Create account -> Staff, enters the code, email and password.
8. Admin can then set individual staff permissions. Admin accounts always have full access.

IMPORTANT:
- No Supabase Edge Function is required in this version.
- Do NOT put the Supabase service-role key in the website.
- The SQL uses Row Level Security and workspace IDs so each admin only sees their own data.
- Staff signup codes expire after 7 days and are single-use.
