# Khatabook V4 — Cloud Delete/Realtime Fix

This build fixes stale Supabase realtime events restoring deleted records after a successful delete.

## Changes
- Delete entry uses entry ID, not object identity.
- Cloud mutations temporarily block realtime state replacement.
- Verified Supabase save result remains authoritative after add/edit/delete/restore/clear.
- Prevents an older realtime event from reloading a deleted entry or supplier.
- Business data remains Supabase-only; no localStorage/sessionStorage.
