Khatabook V8 — Supplier Cloud-First Fix

This version specifically fixes supplier Add/Edit, including City / Location.

Supplier edits no longer mutate the browser's supplier object before saving.
When Save is clicked, the app reads the newest supplier data from Supabase,
applies the exact form values (Name, Mobile, City / note, Group, Opening balance,
Due cycle, and Bank details) to that fresh cloud record, writes it to Supabase,
reads back and verifies the saved state, and only then replaces the UI state.

Supplier Add uses the same cloud-first path.

No business data is stored in localStorage or sessionStorage. IndexedDB is used
only for the optional authentication session persistence.
