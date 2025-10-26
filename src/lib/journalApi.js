// File: src/lib/journalApi.js
import { supabase } from './supabaseClient';

/** Kreiranje nove beleške */
export async function createEntry({ user_id, content, title, feelings, recent_events, lang }) {
  const { data, error } = await supabase
    .from('journal_entries')
    .insert([{ user_id, content, title, feelings, recent_events, lang }])
    .select()
    .single();
  return { data, error };
}

/** Ažuriranje postojeće beleške */
export async function updateEntry(id, patch) {
  const { data, error } = await supabase
    .from('journal_entries')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

/** Brisanje */
export async function deleteEntry(id) {
  const { error } = await supabase.from('journal_entries').delete().eq('id', id);
  return { error };
}

/** Čitanje jedne beleške */
export async function getEntry(id) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
}

/** Listanje: filter = 'interpreted' | 'notes' | 'all' */
export async function listEntries(filter = 'all') {
  let q = supabase.from('journal_entries').select('*').order('created_at', { ascending: false });
  if (filter === 'interpreted') q = q.not('analysis_at', 'is', null);
  if (filter === 'notes')       q = q.is('analysis_at', null);
  const { data, error } = await q;
  return { data, error };
}

/** (opciono) Upis interpretacije — ako želiš da pozivaš direktno iz Result-a */
export async function attachInterpretation({ id, method, analysis_text, analysis_json, client_req_id }) {
  const patch = {
    analysis_method: method,
    analysis_text: analysis_text ?? null,
    analysis_json: analysis_json ?? null,
    analysis_at: new Date().toISOString(),
    client_req_id: client_req_id ?? null,
  };
  const { data, error } = await supabase
    .from('journal_entries')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}
