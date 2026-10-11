# Banco de dados no Supabase: passo a passo

O app continua funcionando **sem internet**, salvando tudo no celular. Com o banco ligado, cada
observador entra com a própria conta e os dados vão para o Supabase quando há conexão. Todo mundo
no mesmo experimento vê as mudanças dos outros quase na hora.

## 1. Criar o projeto (uma vez, ~5 minutos)

1. Entre em <https://supabase.com>, crie uma conta e clique em **New project**.
2. Dê um nome (ex.: `etograma`), crie uma **senha do banco** (guarde, ela é usada no R) e escolha a
   região **South America (São Paulo)**.
3. Espere o projeto ficar pronto.

## 2. Criar as tabelas

1. No menu da esquerda, abra **SQL Editor** → **New query**.
2. Abra o arquivo [`supabase/schema.sql`](../supabase/schema.sql) deste projeto, copie **tudo**, cole e clique em **Run**.
3. Deve aparecer "Success". Pode rodar de novo no futuro (quando o app ganhar tabelas novas) sem perder dados.

## 2b. Lista de acessos (quem pode usar o app)

O app só funciona com login, e **só cria conta quem está na lista de acessos**. O banco recusa qualquer
outro e-mail, mesmo que a pessoa tente por fora do app. Retirar alguém da lista corta o acesso aos dados na hora.

- Na primeira vez que o `schema.sql` roda, quem **já tinha conta** entra na lista como membro (ninguém fica trancado).
- O **primeiro administrador** é definido uma vez, no SQL Editor (troque pelo seu e-mail):

  ```sql
  insert into public.acessos(email, papel) values (seu-email@exemplo.com, admin)
  on conflict (email) do update set papel = admin;
  ```

- Depois disso, o administrador gerencia tudo pelo app: **Ajustes → Acessos** → digita o e-mail →
  **Liberar acesso**. Para tirar, toque em **Retirar** duas vezes. Ninguém retira a si mesmo, para a lista nunca ficar sem administrador.
- Para liberar alguém: inclua o e-mail na lista **antes** de a pessoa criar a conta.

## 3. Ajustar o login

Em **Authentication → URL Configuration**:

- **Site URL**: `https://herisondouglas.github.io/etograma/` (endereço do app publicado).
- Em **Redirect URLs**, adicione `https://herisondouglas.github.io/etograma/` e `http://localhost:5173` (para testes no computador).

Em **Authentication → Sign In / Providers → Email**:

- **Confirm email** ligado (padrão): quem cria conta recebe um e-mail e precisa clicar no link antes de entrar.
- Para testar rápido, pode desligar e ligar de novo depois.

## 4. Conectar o app

Em **Project Settings → API** (ou **API Keys**), copie:

- **Project URL** (ex.: `https://abcdefgh.supabase.co`);
- a chave **pública**: `anon` / `publishable`.

> ⚠️ **Nunca** use a chave `service_role` / `secret`. Ela dá acesso total ao banco. O app recusa essa chave.

Depois, escolha **um** dos dois jeitos:

- **Cada um cola no app:** no app, abra **Ajustes → Banco de dados na nuvem**, cole o endereço e a chave e toque em **Conectar**.
- **Já vem conectado para todos:** cole os dois em [`js/config.js`](../js/config.js) e rode `npm run build`.

A chave pública pode ficar no app sem problema. Quem protege os dados são as regras de acesso do banco:
cada pessoa só vê os experimentos de que participa.

## 5. Usar

0. O administrador libera o e-mail de cada pessoa em **Ajustes → Acessos**.
1. **Responsável** (ex.: Raquel): na tela de entrar → **Criar conta** → entra. Os experimentos que já estavam
   no celular sobem para o banco (os dados de exemplo **não** sobem). No **Início** aparece o
   **código do experimento** (6 letras/números). Toque nele para copiar.
2. **Observadores**: cada um cria a própria conta no celular dele e vai em
   **Ajustes → Entrar em um experimento** → digita o código.
3. Pronto: baias, pesagens e observações de todos ficam juntas. No canto do menu aparece o estado:
   - 🟢 **Sincronizado às 14:32**
   - 🟠 **Sem internet · 3 alterações no aparelho**: estão guardadas no celular e sobem quando o sinal voltar;
   - 🔴 **Erro ao sincronizar**: toque para ver o motivo em Ajustes.

**O que só o responsável pode fazer:** apagar o experimento (para todos). Observadores podem lançar e corrigir dados.

**Sair da conta** tira do celular os dados que vieram do banco (eles continuam lá). Se houver
alterações ainda não enviadas, o app não deixa sair até sincronizar.

## 6. Usar os dados no R, SAS ou planilha

O banco tem quatro "visões" já organizadas em formato longo (uma linha por medida):

| Visão | Uma linha por |
|---|---|
| `vw_animais` | animal (baia, brinco, tratamento, raça, sexo, se saiu do experimento) |
| `vw_pesagens` | pesagem de um animal (data, peso em kg) |
| `vw_consumo` | consumo de um animal (data, kg MS/dia) |
| `vw_marcacoes` | X marcado na planilha do etograma (animal, horário, comportamento) |

- **Planilha:** no Supabase, **Table Editor** → escolha a visão → **Export → CSV**.
- **R:** em **Project Settings → Database** copie os dados de conexão e use:

```r
library(DBI)
con <- dbConnect(RPostgres::Postgres(),
  host = "COLE_O_HOST_AQUI", port = 5432, dbname = "postgres",
  user = "COLE_O_USUARIO_AQUI", password = "SENHA_DO_BANCO")
pesos <- dbGetQuery(con, "select * from vw_pesagens where experimento = 'Confinamento Nelore'")
marcas <- dbGetQuery(con, "select * from vw_marcacoes")
```

(Conectando assim, com a senha do banco, você vê todos os experimentos. Não compartilhe essa senha.)

## Observações

- O que fica **só no aparelho**, sem ir para o banco: os etogramas das espécies (Ajustes → Editar etogramas)
  e os dados de exemplo. Cada observação guarda a própria cópia da lista de comportamentos, então isso não atrapalha.
- O app está publicado em **https://herisondouglas.github.io/etograma/**. É esse endereço que os observadores abrem no celular.
- No plano gratuito do Supabase, projetos parados por muito tempo podem ser pausados. Confira as regras atuais no site.
