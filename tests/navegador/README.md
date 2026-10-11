# Testes no navegador e no banco

Testes de ponta a ponta. Abrem o `dist/etograma.html` num Chrome sem janela (headless) e clicam
pelo app como uma pessoa faria. Usam um **Supabase falso** (`fake-supabase.js`), então não
mexem no banco de verdade.

Precisam do Google Chrome em `C:/Program Files/Google/Chrome/Application/chrome.exe` e do Node 22 ou mais novo.
Rode `npm run build` antes. A pasta de saída recebe as capturas de tela (use uma pasta temporária).

```sh
B=dist/etograma.html; OUT=/tmp/etograma-testes; T=tests/navegador
node $T/smoke.js        $B $OUT 1366            # todas as telas, animais, saída, erros de gravação, migrações
node $T/smoke-acesso.js $B $OUT $T/fake-supabase.js 1366   # login obrigatório + lista de acessos
node $T/smoke-lp.js     $B $OUT $T/fake-supabase.js 1366   # apresentação com rolagem no login
node $T/smoke-tab.js    $B $OUT $T/fake-supabase.js 1366   # Entrar/Criar conta com o mesmo tamanho (VH=768 muda a altura)
node $T/smoke-adapt.js  $B $OUT 1366            # fase de adaptação (etapas, Dieta agora, só dieta final)
node $T/smoke-esp.js    $B $OUT 1366            # espécies (científico, nova espécie, migração Vaca→Bovino)
node $T/smoke-obs.js    $B $OUT 1366            # tela Observar vazia
node $T/smoke-peso.js   $B $OUT 1366            # pesagem antes e depois (opção, Início, inicial/final, análise)
```

O último número é a largura da tela: use **390** para celular e **1366** para computador. Cada linha
mostra `OK` ou `FALHOU`; no fim aparece "sem erros no console".

## Banco (SQL)

`banco.mjs` roda o `supabase/schema.sql` num Postgres de verdade (PGlite, em WebAssembly), simulando
o login do Supabase. Ele confere as regras de acesso, a lista de acessos, as visões `vw_*` e as etapas.

```sh
mkdir -p /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite && cd -
node tests/navegador/banco.mjs supabase/schema.sql /tmp/pg
```
