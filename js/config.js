// Conexão com o banco de dados (Supabase). Veja docs/SUPABASE.md.
// Pode deixar em branco: aí cada pessoa cola o endereço e a chave em Ajustes → Banco de dados.
// Preenchendo aqui, todo mundo que abrir o app já fica conectado ao mesmo projeto.
//
// Use SÓ a chave pública ("anon" ou "publishable"). Ela pode ficar no app: quem protege os dados
// são as regras de acesso do banco (supabase/schema.sql). NUNCA coloque aqui a chave service_role / secret.
window.ETOGRAMA_SUPABASE = {
  url: "",      // ex.: "https://abcdefgh.supabase.co"
  anonKey: ""   // ex.: "eyJhbGciOi..." ou "sb_publishable_..."
};
