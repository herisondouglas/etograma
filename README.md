# Etograma

App para registrar a análise comportamental de animais (vaca, cavalo, ovelha, galinha) de 5 em 5 minutos,
acompanhar o desempenho (ganho de peso, consumo, conversão), rodar a estatística automaticamente
e marcar comportamentos a partir de vídeo com IA.

## Como abrir

1. Abra esta pasta no VS Code.
2. Abra `index.html` no navegador (ou clique com o botão direito → "Open with Live Server").

Não precisa instalar nada. Para os testes e o build é preciso ter o Node.js:

```bash
npm run dev     # abre em http://localhost:5173 (npm run dev -- --host para testar no celular)
npm test        # confere estatística, desempenho e CSV
npm run build   # gera dist/etograma.html (tudo num arquivo só)
```

## Estrutura

```
index.html            página
styles.css            visual (tokens de cor, claro/escuro)
js/stats.js           estatística (ANOVA, Pearson, valores de p)
js/data.js            cálculos de dados (GMD, min/dia, CSV)
js/app.js             o app (telas, gráficos, dados)
tests/                testes (npm test)
scripts/build-single.js
docs/conversa.md      resumo das ideias originais
CLAUDE.md             contexto completo para continuar com o Claude
```

## Observações

- Os dados ficam no navegador (localStorage). Use Ajustes → "Salvar cópia" para backup.
- A IA (Visão IA e "Interpretar com IA") só funciona quando o app roda dentro do Claude.
  Para rodar fora, é preciso um backend com a API da Anthropic (ver CLAUDE.md).
