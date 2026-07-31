import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Frühzeitiger, klarer Hinweis statt kryptischer Fetch-Fehler zur Laufzeit
  console.error(
    'Supabase-Umgebungsvariablen fehlen. Bitte VITE_SUPABASE_URL und ' +
      'VITE_SUPABASE_ANON_KEY in der .env-Datei (lokal) bzw. in den ' +
      'Netlify-Umgebungsvariablen (Deploy) setzen.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
