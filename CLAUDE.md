# Etograma: contexto do projeto

Leia este arquivo antes de mexer no código. Ele resume tudo o que foi decidido na conversa em que o protótipo foi criado (10/10/2026).

## O que é

Plataforma (web, pensada para celular) para pesquisa de comportamento animal em curso de Zootecnia/Agrárias.
Hoje a faculdade faz tudo em papel: num confinamento com 12 vacas, 6 pessoas vigiam 2 animais cada,
por 24 h, marcando com X de 5 em 5 minutos o que o animal faz (comer, ruminar, beber água, defecar,
urinar, deitar, em pé, ócio, e coisas fora do comum como espernear e se coçar/esfregar).
Depois os dados vão para um programa de estatística para ver se o desempenho está dentro do esperado,
relacionando tempo de ruminação e consumo com a qualidade da dieta.
Fazem isso com vaca, cavalo, ovelha, galinha e porco.

**Baias (confirmado pelo usuário):** curral dividido em baias individuais, **um animal por baia**; a baia só separa um animal do outro (não tem a ver com espécie). A espécie é escolhida no experimento e todas as baias dele são dessa espécie (ex.: vaca → baias 1–12 só de vaca). Precisa dar para adicionar mais baias. Ainda NÃO confirmado: como as dietas foram sorteadas entre as baias (DIC ou blocos), se os animais trocam de dieta entre períodos, .

**Divisão das dietas no curral (confirmada):** azul / Dieta 40% = baias 1, 4, 5, 8, 10, 11; vermelho / Dieta 80% = baias 2, 3, 6, 7, 9, 12 (`ORDEM_CURRAL="AVVAAVVAVAAV"` em app.js). **Da baia 13 em diante não há regra: quem cria escolhe** (pedido do usuário). É a 1ª opção ao criar experimento ("Ordem do curral") e a divisão do exemplo.

Objetivo: primeiro testar com o pessoal da faculdade (ex.: experimento da Raquel); se der certo, vender a ideia.

## Módulos (as "ideias 1–4" da conversa)

1. **Observar**: etograma digital. Escolhe espécie/experimento, os animais que vai vigiar, intervalo (5 min) e duração (24 h).
   Tela de marcação com botões grandes do horário atual + planilha completa (horários × comportamentos) para marcar X.
   Cronômetro até a próxima marcação, vibração ao virar o horário, tela não apaga (wake lock).
2. **Desempenho**: pesagens e consumo por animal → GMD, CMS, CMS %PV, conversão alimentar.
   Compara com a meta de GMD de cada tratamento: ≥110% "Acima", ≥90% "No esperado", <90% "Abaixo" (alerta).
3. **Estatística**: monta a tabela por animal (peso, GMD, CMS, CA + cada comportamento em min/dia)
   e roda ANOVA de um fator (+ par a par com Bonferroni), correlação de Pearson com regressão e mapa de correlações.
   Textos explicando o resultado em português simples. Exporta CSV para SAS/R. Botão "Interpretar com IA".
4. **Visão IA**: envia vídeo/foto, extrai quadros a cada N segundos (canvas), manda para o Claude com a lista
   de comportamentos do etograma, recebe JSON, o usuário revisa e aplica na planilha da observação.
5. (Não feito) Coleira com acelerômetro/ESP32 medindo ruminação. Precisa de hardware.

**Entrar** (`VIEWS.login`, tela cheia sem menu: painel escuro com "etograma vivo" animado + relógio da próxima marcação; formulário Entrar/Criar conta/Esqueci a senha/nova senha; abre sozinha ao iniciar sem conta, "Continuar sem conta" é lembrado em `etograma.semconta`; respeita movimento reduzido), Além disso: **Animais** (cadastro: baia, brinco, tratamento, raça, sexo, nascimento, observações; cadastro rápido por faixa; exportar lista), **Início** (painel do experimento, alertas, gráfico "Orçamento de tempo 24 h") e **Ajustes**
(editar etogramas, juntar CSVs dos observadores, backup JSON, apagar exemplo).

## Arquitetura atual

- HTML/CSS/JS puro, sem framework e sem build. Abra `index.html` (ou use o Live Server do VS Code).
- `js/stats.js`: funções estatísticas puras (beta incompleta, p de t e F, Pearson, ANOVA, Benjamini-Hochberg, niceTicks). Testadas em `tests/stats.test.js`.
- `js/data.js`: cálculos puros de dados (desempenho/GMD por regressão, comportamento em min/dia, CSV de ida e volta, assinatura para não duplicar importação). Testados em `tests/data.test.js`. **Lógica nova de dados vai aqui, com teste**, não no `app.js`.
- `js/sync.js`: sincronização com o Supabase (toRows/applyRows, push/pull com "sombra" do que já está no banco). Puro, cliente injetado; testado em `tests/sync.test.js` com banco falso.
- `js/config.js`: URL e chave **pública** do Supabase (opcional; também dá para colar em Ajustes).
- `supabase/schema.sql`: tabelas, RLS, convite por código, gatilhos e visões `vw_*` para R/SAS. Idempotente. Passo a passo em `docs/SUPABASE.md`.
- `js/app.js`: telas, gráficos SVG feitos à mão, armazenamento local, nuvem (seção NUVEM) e integração com o Claude.
  Roteador simples: `go({name:...})` → `VIEWS[name]()` desenha em `#app`.
- `styles.css`: design system em tokens CSS (claro/escuro).
- Dados em `localStorage` (chave `etograma.v2`). Migra a chave antiga `etograma.v1` do primeiro protótipo.
  - Se `etograma.v2` não puder ser lido, o conteúdo original é copiado para `etograma.ilegivel` antes de qualquer gravação (Ajustes oferece baixar/descartar).
  - Se `save()` falhar (memória cheia, aba anônima), aparece a barra vermelha `#saveErr` com botão de cópia. Nunca engolir erro de gravação em silêncio.
  - Outra aba que salva dispara o evento `storage` e esta aba recarrega o `db` (não sobrescreve o trabalho da outra).
- Na primeira abertura carrega um **experimento de exemplo** (dados simulados, marcados `exemplo: true`).
- `scripts/build-single.js` gera `dist/etograma.html` (arquivo único). É o formato usado para publicar como Artifact no Claude.

### Banco de dados (Supabase): offline-first
- Fonte da verdade da tela = `db` no localStorage. `save()` = `saveLocal()` + `cloudChanged()` (agenda envio em 1,5 s).
- `syncNow()`: push (só linhas cuja forma canônica difere da sombra em `etograma.sync`) → refaz pull do que o banco recusou → pull incremental (`updated_at > lastPull − 15 s`). Alteração local pendente nunca é sobrescrita pelo pull.
- Exclusão = `deleted = true` (chega aos outros aparelhos). Apagar experimento só envia o experimento (filhos não). Só o responsável apaga (gatilho no banco).
- Tempo real (postgres_changes) + reserva a cada 60 s + ao voltar a internet/aba.
- Exemplo (`exemplo: true`) e etogramas das espécies **não** sobem.
- Login e-mail/senha; quem cria vira `responsavel`; observadores entram com `join_experiment(código)`. Código aparece no Início e em Editar experimento.
- Sair da conta: bloqueado se houver pendências; depois remove do aparelho o que veio do banco (`Sync.forget`). Outra conta no mesmo aparelho também limpa.
- Restaurar cópia / Apagar tudo com login: zera a sombra (vira mesclagem; nada é apagado no banco).
- supabase-js 2.45.4 carregado do jsDelivr só quando há configuração.
- Testes do SQL: rodados com PGlite (Postgres em WASM) simulando `auth.uid()`; o roteiro não está no repo (precisa de `npm i @electric-sql/pglite`).

### Integrações que só existem dentro do Claude (Artifact)
`window.claude.use("sample")` (IA: interpretar estatística e Visão IA) e `window.claude.use("downloads")`.
Fora do Claude elas não existem: o app detecta, esconde/desativa a IA e baixa arquivos pelo navegador.
**Próximo passo para a IA funcionar fora do Claude:** criar um backend pequeno (ex.: Node/Express ou função serverless)
que chame a API da Anthropic. **Nunca** colocar a chave de API no front-end.

## Modelo de dados (`db`)

```js
{
  v: 2,
  active: "<id do experimento ativo>",
  species: [{ id, nome, comp: [{ id, nome, tipo: "comum" | "raro" }] }],
  experiments: [{
    id, nome, especieId, especie, responsavel, inicio: "AAAA-MM-DD", exemplo?,
    rotulo: "Baia" | "Animal",   // como os animais são identificados: "Baia 7" (número da baia) ou "Animal 07" (brinco)
    grupos:  [{ id, nome, dieta, gmdMeta /* kg/dia */, cor: "azul"|"vermelho"|"laranja"|"verde"|"amarelo" }],
    animais: [{ id, baia, brinco, grupoId, raca?, sexo? /* Macho|Fêmea|Macho castrado */, nascimento? /* AAAA-MM-DD */, obs?,
                saida?: { data, motivo /* Morte|Descarte|Doença / tratamento|Venda|Outro */, obs? } }],
    // identificação principal = Data.ident(e,a): baia se rotulo "Baia", senão brinco (cai na outra se faltar)
    pesagens:[{ id, data, pesos:   { [animalId]: kg } }],
    consumo: [{ id, data, valores: { [animalId]: kgMS_dia } }]
  }],
  sessions: [{            // uma observação (etograma) de um observador
    id, expId | null, nome, especie, observador,
    comp: [...],          // CÓPIA do etograma no momento da criação (editar a espécie não quebra sessões antigas)
    animais: ["07","12"], animalIds: ["a7","a12"] | null,
    inicio: timestampMs, intervalo: minutos, duracao: horas,
    marks: { [indiceAnimal]: { [indiceHorario]: [compId, ...] } },
    obs:   { [indiceAnimal]: { [indiceHorario]: "texto" } }
  }]
}
```

Ao criar um experimento por baia, o app já cria Baia 1…N (padrão 12) e mostra a grade "Dieta de cada baia": a divisão escolhida (ordem do curral — padrão —, alternando ou em sequência) só preenche; tocar numa baia troca a dieta; baias sem regra ficam "escolher" e o experimento não é criado enquanto houver baia sem dieta. Na aba Animais há um botão por dieta ("+ Baia 13 · Dieta 40%", "+ Baia 13 · Dieta 80%"). Animais têm `id` estável e são cadastrados na aba **Animais** (`VIEWS.animals` / `VIEWS.animalForm`), não no formulário do experimento. Corrigir baia/brinco/tratamento mantém pesagens, consumo e observações (e atualiza o nome do animal nas observações). Cadastro rápido aceita faixas (`1-12, 15` → `Data.parseIds`). Baia/brinco repetidos são recusados. Remover pede confirmação e apaga pesos/consumo dele. **Saída do experimento** (`a.saida`, `Data.ativo`): o animal fica no histórico (pesagens, observações, tabela de desempenho com status "Saiu", CSVs com coluna Situação), mas sai de médias, alertas, KPIs, gráficos por tratamento, nova observação, lançamento de pesagem (salvo se já tem valor nele) e da estatística (`Data.dataset` filtra; a tela avisa quantos ficaram de fora). A baia de quem saiu pode ser reocupada; desfazer a saída é bloqueado se a baia estiver ocupada. `Data.migrate` converte dados antigos (em experimentos por baia, o número ficava em `brinco`).

GMD = inclinação da regressão linear peso × dias com todas as pesagens (com 2 pesagens é igual a (final − inicial)/dias).

Comportamento → variável por animal: (nº de marcações do comportamento ÷ nº de horários marcados) × 1440 = min/dia.
Comportamentos são casados entre sessões pelo **nome normalizado** (sem acento/minúsculas).

CSV exportado por observação (separador `;`, BOM UTF-8 para o Excel):
`Experimento;Espécie;Observador;Animal;Data;Hora;Intervalo (min);<comportamentos 1/0...>;Observação`.
A importação em Ajustes lê esse mesmo formato (também aceita `,`/tab e datas ISO, caso o Excel tenha regravado) e ignora observações que já existem (mesmo observador + animais + início + intervalo). Texto que começa com `= + - @` é exportado com `'` na frente (proteção contra fórmula no Excel) e o `'` é removido na importação.

Visão IA: em cada horário vale só o primeiro quadro (varredura instantânea) e a marcação revisada **substitui** a do horário. Mapa de correlações: `*` usa p corrigido por Benjamini-Hochberg.

## Decisões de design

- Ferramenta de pesquisa, não site de marketing. Celular: abas embaixo (uso com uma mão no curral). Desktop: menu lateral.
- Linguagem visual de estúdio de produto (referência estética: Phenomenon Studio; **não** usar nome, logo ou o asterisco deles no app):
  tinta quase preta `#080D10` sobre branco, um único acento laranja `#FF7A00`, linhas finas (KPIs em grade com divisórias de 1px),
  topo/menu lateral/hero escuros (`--night`), títulos grandes e leves com espaçamento negativo, rótulos e botões em CAIXA ALTA espaçada, cantos 8–12px.
- Laranja só como **preenchimento** com texto escuro (`--accent-ink`); texto laranja usa `--accent-text` (contraste ≥ 4,5:1). Laranja = ação principal e "agora".
- Fontes: Bricolage Grotesque (títulos, rótulos, botões), Albert Sans (texto), JetBrains Mono (números).
- Roxo para comportamentos fora do comum; verde só como status "bom".
- Cores de status (verde/âmbar/vermelho) só para status, sempre com ícone + texto.
- Cor de cada tratamento é escolhida no experimento e fixa em todos os gráficos. No experimento real da faculdade: **baias 1–12, Dieta 40% = azul, Dieta 80% = vermelho** (é o código de cores que eles usam). Por isso "abaixo da meta" nunca é pintado de vermelho nos gráficos: aparece como seta ↓ + número em vermelho.
- Sem `alert/confirm`: exclusões pedem um segundo toque ("Confirmar?").

## Pendências / ideias para continuar

- [x] Sincronização online com Supabase + login + convite por código. Projeto Supabase `mzsafqmrorepalkxvdhw` (schema v2 aplicado).
- [x] Publicado: código em https://github.com/herisondouglas/etograma (ramo `main`), app em **https://herisondouglas.github.io/etograma/** (GitHub Pages, atualiza sozinho a cada push).
- [ ] Backend para a IA (Visão IA e interpretação) fora do Claude.
- [ ] PWA (instalar no celular, funcionar 100% offline no curral, notificação a cada 5 min).
- [ ] Ajustar as colunas à planilha de papel que a faculdade já usa (foto ainda não enviada).
- [ ] Tukey no lugar de Bonferroni; modelos com medidas repetidas.
- [ ] Coleira com sensor (ideia 5).
- [ ] Separar `app.js` em módulos quando crescer (views/, charts/, data/).

## Comandos

- Publicar: `git push` (o GitHub Pages republica em 1–2 min). No Supabase, Authentication → URL Configuration deve ter o endereço publicado (Site URL) e `http://localhost:5173` (Redirect URLs).

- `npm run dev`: servidor local sem dependências (`scripts/dev-server.js`) em http://localhost:5173; `npm run dev -- --host` abre na rede Wi-Fi para testar no celular.
- `npm test`: testa `stats.js` (valores de referência), `data.js` (desempenho, min/dia, CSV) e `sync.js` (sincronização com banco falso).
- `npm run build`: gera `dist/etograma.html` (arquivo único).
- Rodar: abrir `index.html` no navegador ou usar a extensão Live Server.
