import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Missing authorization token' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'The admin-users function is missing Supabase server configuration' }, 500);
  }
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userData, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Invalid or expired session' }, 401);
    const callerId = userData.user.id;

    const { data: profile, error: profileError } = await adminClient
      .from('profiles').select('id,role,active').eq('id', callerId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== 'admin' || profile.active !== true) {
      return json({ error: 'Administrator access required' }, 403);
    }

    const { data: workspace, error: workspaceError } = await adminClient
      .from('workspaces').select('id').eq('owner_id', callerId).maybeSingle();
    if (workspaceError) throw workspaceError;
    if (!workspace?.id) return json({ error: 'No administrator workspace found' }, 400);

    const body = await req.json().catch(() => ({}));
    if (body.action && body.action !== 'create') return json({ error: 'Invalid staff account action' }, 400);
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.full_name || '').trim();
    const password = String(body.password || '');
    const permissions = (body.permissions && typeof body.permissions === 'object') ? body.permissions : { view_data: true, add_entries: true };

    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Enter a valid staff email address' }, 400);
    if (password.length < 8) return json({ error: 'Staff password must be at least 8 characters' }, 400);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, account_type: 'staff' },
      app_metadata: { account_type: 'staff', staff_workspace_id: workspace.id },
    });
    if (createError) return json({ error: createError.message }, 400);

    const staffId = created.user?.id;
    if (!staffId) return json({ error: 'Staff user was not created' }, 500);

    // The auth trigger normally creates these rows. Upsert as a safety net so the
    // staff account is immediately usable even if an older database trigger exists.
    const { error: profileUpsertError } = await adminClient.from('profiles').upsert({
      id: staffId, email, full_name: fullName, role: 'staff', active: true, updated_at: new Date().toISOString()
    });
    if (profileUpsertError) throw profileUpsertError;

    const { error: memberError } = await adminClient.from('workspace_members').upsert({
      workspace_id: workspace.id, user_id: staffId, permissions, active: true, updated_at: new Date().toISOString()
    });
    if (memberError) throw memberError;

    return json({ ok: true, user_id: staffId, email });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Could not create staff account' }, 500);
  }
});
