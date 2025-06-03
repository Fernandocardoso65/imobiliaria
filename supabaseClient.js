// supabaseClient.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const supabaseUrl = 'https://kqariedbejpopsfldbpy.supabase.co'; // Já estava certo
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxYXJpZWRiZWpwb3BzZmxkYnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NDgxNDYsImV4cCI6MjA2NDUyNDE0Nn0.wANxo_WZ_Zjddp1rY3pEP3QhAQROICaVLy5MWFgkh7k'; // <<-- AGORA COM ASPAS SIMPLES

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const auth = supabase.auth;
export const storage = supabase.storage;
export const db = supabase;
