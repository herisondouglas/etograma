// Conexão com o banco de dados (Supabase). Veja docs/SUPABASE.md.
// Pode deixar em branco: aí cada pessoa cola o endereço e a chave em Ajustes → Banco de dados.
// Preenchendo aqui, todo mundo que abrir o app já fica conectado ao mesmo projeto.
//
// Use SÓ a chave pública ("anon" ou "publishable"). Ela pode ficar no app: quem protege os dados
// são as regras de acesso do banco (supabase/schema.sql). NUNCA coloque aqui a chave service_role / secret.
window.ETOGRAMA_SUPABASE = {
  url: "https://mzsafqmrorepalkxvdhw.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16c2FmcW1yb3JlcGFsa3h2ZGh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2Mzg2MzMsImV4cCI6MjEwNzIxNDYzM30.zvQM88HbtNsmY0DTIJL-B-CNRyB5RdcjhvvZkf08Gl4"   // chave pública (anon)
};
