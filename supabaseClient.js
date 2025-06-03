// supabaseClient.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

// **SUBSTITUA ESTES VALORES PELOS SEUS REAIS DO SUPABASE**
// Você os encontra em seu painel do Supabase:
// Project Settings (Configurações do Projeto) > API Keys (Chaves de API)
const supabaseUrl = 'SUA_URL_DO_PROJETO_SUPABASE'; // Ex: 'https://abcdefghijklm.supabase.co'
const supabaseAnonKey = 'SUA_CHAVE_PUBLICA_ANON_AQUI'; // Ex: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiaXNzIjoic3VwYWJhc2UtaW5mcmEtcHJvZCIsImlhdCI6MTY3ODkzMDgwMCwiZXhwIjoxNjk1NTA4ODAwLCJzdWIiOiIyYjNlNGY1YS02Njc4LTQ1NjctYjkwYi0xMjM0NTY3ODkwYjMiLCJhdXRoZW5pY2F0b3IiOiJlbWFpbCIsInJvbGUiOiJhbm9uIn0.algum_hash_muito_longo_aqui'

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Exports convenientes para facilitar o uso nos outros arquivos
export const auth = supabase.auth;
export const storage = supabase.storage;
export const db = supabase; // Usaremos 'db' para interagir com o banco de dados (tabelas)
