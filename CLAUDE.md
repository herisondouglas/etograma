# Etograma: contexto do projeto

Leia este arquivo antes de mexer no código. Ele resume tudo o que foi decidido na conversa em que o protótipo foi criado (10/10/2026).

## O que é

Plataforma (web, pensada para celular) para pesquisa de comportamento animal em curso de Zootecnia/Agrárias.
Hoje a faculdade faz tudo em papel: num confinamento com 12 vacas, 6 pessoas vigiam 2 animais cada,
por 24 h, marcando com X de 5 em 5 minutos o que o animal faz (comer, ruminar, beber água, defecar,
urinar, deitar, em pé, ócio, e coisas fora do comum como espernear e se coçar/esfregar).
Depois os dados vão para um programa de estatística para ver se o desempenho está dentro do esperado,
relacionando tempo de ruminação e consumo com a qualidade da dieta.
Fazem isso com vaca, cavalo, ovelha e galinha.

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

Além disso: **Início** (painel do experimento, alertas, gráfico "Orçamento de tempo 24 h") e **Ajustes**
(editar etogramas, juntar CSVs dos observadores, backup JSON, apagar exemplo).

## Arquitetura atual

- HTML/CSS/JS puro, sem framework e sem build. Abra `index.html` (ou use o Live Server do VS Code).
- `js/stats.js`: funções estatísticas puras (beta incompleta, p de t e F, Pearson, ANOVA, Benjamini-Hochberg, niceTicks). Testadas em `tests/stats.test.js`.
- `js/data.js`: cálculos puros de dados (desempenho/GMD por regressão, comportamento em min/dia, CSV de ida e volta, assinatura para não duplicar importação). Testados em `tests/data.test.js`. **Lógica nova de dados vai aqui, com teste**, não no `app.js`.
- `js/app.js`: telas, gráficos SVG feitos à mão, armazenamento e integração com o Claude.
  Roteador simples: `go({name:...})` → `VIEWS[name]()` desenha em `#app`.
- `styles.css`: design system em tokens CSS (claro/escuro).
- Dados em `localStorage` (chave `etograma.v2`). Migra a chave antiga `etograma.v1` do primeiro protótipo.
  - Se `etograma.v2` não puder ser lido, o conteúdo original é copiado para `etograma.ilegivel` antes de qualquer gravação (Ajustes oferece baixar/descartar).
  - Se `save()` falhar (memória cheia, aba anônima), aparece a barra vermelha `#saveErr` com botão de cópia. Nunca engolir erro de gravação em silêncio.
  - Outra aba que salva dispara o evento `storage` e esta aba recarrega o `db` (não sobrescreve o trabalho da outra).
- Na primeira abertura carrega um **experimento de exemplo** (dados simulados, marcados `exemplo: true`).
- `scripts/build-single.js` gera `dist/etograma.html` (arquivo único). É o formato usado para publicar como Artifact no Claude.

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
    grupos:  [{ id, nome, dieta, gmdMeta /* kg/dia */ }],
    animais: [{ id, brinco, grupoId }],
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

Animais têm `id` estável: o formulário do experimento edita brinco/tratamento por `id` (corrigir "7" → "07" não perde pesagens). Remover um animal com dados pede confirmação e apaga os pesos/consumo dele.

GMD = inclinação da regressão linear peso × dias com todas as pesagens (com 2 pesagens é igual a (final − inicial)/dias).

Comportamento → variável por animal: (nº de marcações do comportamento ÷ nº de horários marcados) × 1440 = min/dia.
Comportamentos são casados entre sessões pelo **nome normalizado** (sem acento/minúsculas).

CSV exportado por observação (separador `;`, BOM UTF-8 para o Excel):
`Experimento;Espécie;Observador;Animal;Data;Hora;Intervalo (min);<comportamentos 1/0...>;Observação`.
A importação em Ajustes lê esse mesmo formato (também aceita `,`/tab e datas ISO, caso o Excel tenha regravado) e ignora observações que já existem (mesmo observador + animais + início + intervalo). Texto que começa com `= + - @` é exportado com `'` na frente (proteção contra fórmula no Excel) e o `'` é removido na importação.

Visão IA: em cada horário vale só o primeiro quadro (varredura instantânea) e a marcação revisada **substitui** a do horário. Mapa de correlações: `*` usa p corrigido por Benjamini-Hochberg.

## Decisões de design

- Ferramenta de pesquisa, não site de marketing. Celular: abas embaixo (uso com uma mão no curral). Desktop: menu lateral.
- Fontes: Bricolage Grotesque (títulos), Figtree (texto), JetBrains Mono (números).
- Verde clorofila como cor principal; âmbar para "agora"; roxo para comportamentos fora do comum.
- Cores de status (verde/âmbar/vermelho) só para status, sempre com ícone + texto.
- Cor de cada tratamento é fixa em todos os gráficos (paleta categórica validada para daltonismo: azul, laranja, verde-água, amarelo).
- Sem `alert/confirm`: exclusões pedem um segundo toque ("Confirmar?").

## Pendências / ideias para continuar

- [ ] Sincronização online (todos os observadores no mesmo experimento em tempo real). Ex.: Supabase/Firebase + login.
- [ ] Backend para a IA (Visão IA e interpretação) fora do Claude.
- [ ] PWA (instalar no celular, funcionar 100% offline no curral, notificação a cada 5 min).
- [ ] Ajustar as colunas à planilha de papel que a faculdade já usa (foto ainda não enviada).
- [ ] Tukey no lugar de Bonferroni; modelos com medidas repetidas.
- [ ] Coleira com sensor (ideia 5).
- [ ] Separar `app.js` em módulos quando crescer (views/, charts/, data/).

## Comandos

- `npm test`: testa `stats.js` (valores de referência) e `data.js` (desempenho, min/dia, CSV).
- `npm run build`: gera `dist/etograma.html` (arquivo único).
- Rodar: abrir `index.html` no navegador ou usar a extensão Live Server.
