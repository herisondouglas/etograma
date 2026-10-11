// Confere desempenho, comportamento (min/dia) e ida e volta do CSV.
const assert = require("assert");
const D = require("../js/data.js");
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);

const comp = [{ id: "c1", nome: "Comendo", tipo: "comum" }, { id: "c2", nome: "Ruminando", tipo: "comum" }, { id: "c3", nome: "Esperneando", tipo: "raro" }];
const exp = {
  id: "e1", especie: "Vaca",
  grupos: [{ id: "g1", nome: "Dieta A", gmdMeta: 1.0 }],
  animais: [{ id: "a1", brinco: "07", grupoId: "g1" }, { id: "a2", brinco: "08", grupoId: "g1" }],
  pesagens: [
    { id: "p1", data: "2026-01-01", pesos: { a1: 300, a2: 300 } },
    { id: "p2", data: "2026-01-11", pesos: { a1: 310, a2: 305 } },
    { id: "p3", data: "2026-01-21", pesos: { a1: 320 } }
  ],
  consumo: [{ id: "k1", data: "2026-01-11", valores: { a1: 8, a2: 7 } }, { id: "k2", data: "2026-01-21", valores: { a1: 10 } }]
};

// GMD: regressão. a1 é linear (1 kg/dia); a2 tem só 2 pesagens (0,5 kg/dia).
const P = D.performance(exp);
near(P[0].gmd, 1); near(P[0].cms, 9); near(P[0].ca, 9); assert.strictEqual(P[0].status, "ok");
near(P[1].gmd, 0.5); assert.strictEqual(P[1].status, "abaixo");
// Regressão ≠ (final − inicial)/dias quando há um ponto fora da reta
// (pesagens nos dias 0, 5 e 20: (320 − 300)/20 = 1, mas a reta dá 10/13)
near(D.gmdOf([{ d: "2026-01-01", w: 300 }, { d: "2026-01-06", w: 320 }, { d: "2026-01-21", w: 320 }], "2026-01-01"), 10 / 13);

// Comportamento: 4 horários marcados, 3 comendo → 3/4 × 1440 = 1080 min/dia
const s = {
  id: "s1", expId: "e1", nome: "Etograma", especie: "Vaca", observador: "Ana", comp,
  animais: ["07"], animalIds: ["a1"], inicio: new Date(2026, 0, 5, 7, 0).getTime(), intervalo: 5, duracao: 1,
  marks: { 0: { 0: ["c1"], 1: ["c1"], 2: ["c1", "c3"], 3: ["c2"] } }, obs: { 0: { 2: "=chutou o cocho; saiu" } }
};
const BV = D.behaviorVars(exp, [s]);
near(BV.by.a1["b:comendo"], 1080); near(BV.by.a1["b:ruminando"], 360); near(BV.by.a1["b:esperneando"], 360);
// Animal referenciado por id que não existe mais cai no casamento pelo brinco
assert.strictEqual(D.sessionAnimalId(exp, { animais: ["Vaca 08"], animalIds: ["sumiu"] }, 0), "a2");

// CSV: exportar e importar de volta devolve as mesmas marcações
const csv = D.sessionCSV(s);
assert.ok(csv.includes("'=chutou"), "observação começando com = deve ser protegida contra fórmula");
const [back] = D.sessionsFromCSV(csv, { species: [{ nome: "Vaca", comp }], exp });
assert.strictEqual(back.inicio, s.inicio); assert.strictEqual(back.intervalo, 5); assert.deepStrictEqual(back.animalIds, ["a1"]);
const nm = (ss, i) => (ss.marks[0][i] || []).map(id => ss.comp.find(c => c.id === id).nome).sort();
for (let i = 0; i < 12; i++) assert.deepStrictEqual(nm(back, i), nm(s, i), "horário " + i);
assert.strictEqual(back.obs[0][2], "=chutou o cocho; saiu");
assert.strictEqual(back.comp.find(c => c.nome === "Esperneando").tipo, "raro");
assert.strictEqual(D.sessionSignature(back), D.sessionSignature(s));

// CSV salvo pelo Excel com vírgula e data ISO
const alt = "Animal,Data,Hora,Comendo,Ruminando\n07,2026-01-05,07:00,1,0\n07,2026-01-05,07:05,x,\n";
const [b2] = D.sessionsFromCSV(alt, { species: [], exp: null });
assert.strictEqual(b2.intervalo, 5); assert.strictEqual(Object.keys(b2.marks[0]).length, 2);
assert.throws(() => D.sessionsFromCSV("Animal;Data;Hora\n07;ontem;07:00", {}));

// Animais: identificação por baia ou brinco
const eb = { id: "eb", rotulo: "Baia", grupos: [], animais: [{ id: "b1", baia: "1", brinco: "BR-1023" }, { id: "b11", baia: "11", brinco: "1" }], pesagens: [], consumo: [] };
assert.strictEqual(D.ident(eb, eb.animais[0]), "1");
assert.strictEqual(D.ident({ rotulo: "Animal" }, eb.animais[0]), "BR-1023");
assert.strictEqual(D.ident(eb, { brinco: "07" }), "07"); // sem baia, usa o brinco
// "Baia 1" é a baia 1, não o animal de brinco "1" (que está na baia 11)
assert.strictEqual(D.sessionAnimalId(eb, { animais: ["Baia 1"] }, 0), "b1");
assert.strictEqual(D.sessionAnimalId(eb, { animais: ["Baia 11"] }, 0), "b11");
assert.strictEqual(D.sessionAnimalId(eb, { animais: ["BR-1023"] }, 0), "b1");
assert.deepStrictEqual(D.parseIds("1-4, 7; 10 a 12"), ["1", "2", "3", "4", "7", "10", "11", "12"]);
assert.deepStrictEqual(D.parseIds("01-03, BR-9"), ["01", "02", "03", "BR-9"]);
assert.deepStrictEqual(D.parseIds("5-2"), ["5-2"]); // intervalo invertido fica como texto
// Migração: em experimento por baia, o número que estava em "brinco" vai para "baia"
const old = { experiments: [{ rotulo: "Baia", animais: [{ id: "x", brinco: "3" }] }, { animais: [{ id: "y", brinco: "07" }] }] };
D.migrate(old);
assert.deepStrictEqual(old.experiments[0].animais[0], { id: "x", baia: "3", brinco: "" });
assert.deepStrictEqual(old.experiments[1].animais[0], { id: "y", brinco: "07" });
assert.strictEqual(D.ageMonths("2024-10-10", new Date(2026, 9, 10)), 24);
assert.strictEqual(D.ageMonths("2024-10-11", new Date(2026, 9, 10)), 23);
assert.ok(isNaN(D.ageMonths("")));

// Saída do experimento: status "saiu", fora da estatística; baia reocupada aponta para o animal ativo
const es = JSON.parse(JSON.stringify(exp));
es.animais[1].saida = { data: "2026-01-15", motivo: "Morte" };
const Ps = D.performance(es);
assert.strictEqual(Ps[1].status, "saiu"); assert.strictEqual(Ps[0].status, "ok");
const DS = D.dataset(es, []);
assert.deepStrictEqual(DS.rows.map(r => r.id), ["a1"]); assert.strictEqual(DS.saidas, 1);
const er = { rotulo: "Baia", animais: [{ id: "velho", baia: "3", saida: { data: "2026-01-01", motivo: "Morte" } }, { id: "novo", baia: "3" }] };
assert.strictEqual(D.sessionAnimalId(er, { animais: ["Baia 3"] }, 0), "novo");
assert.ok(!D.ativo(er.animais[0]) && D.ativo(er.animais[1]));

// Fase de adaptação: 50 → 60 → 70 → 80% de concentrado, uma etapa por semana
const E80 = D.gerarEtapas({ inicio: "2026-09-01", ini: 50, fim: 80, passo: 10, dias: 7 });
assert.deepStrictEqual(E80.map(x => x.inicio + ":" + x.conc), ["2026-09-01:50", "2026-09-08:60", "2026-09-15:70", "2026-09-22:80"]);
assert.deepStrictEqual(D.gerarEtapas({ inicio: "2026-09-01", ini: 50, fim: 40, passo: 10, dias: 7 }).map(x => x.conc), [50, 40], "abaixo do início: desce");
assert.deepStrictEqual(D.gerarEtapas({ inicio: "2026-09-01", ini: 50, fim: 40, passo: 10, dias: 7, abaixo: "direto" }).map(x => x.conc), [40], "ou já começa na final");
assert.deepStrictEqual(D.gerarEtapas({ inicio: "2026-09-01", ini: 50, fim: 75, passo: 10, dias: 5 }).map(x => x.inicio + ":" + x.conc), ["2026-09-01:50", "2026-09-06:60", "2026-09-11:70", "2026-09-16:75"], "passo que não fecha certinho");
assert.strictEqual(D.gerarEtapas({ inicio: "2026-09-01", ini: 80, fim: 80, passo: 10, dias: 7 }).length, 1, "sem adaptação");
assert.strictEqual(D.gerarEtapas({ inicio: "2026-10-28", ini: 50, fim: 60, passo: 10, dias: 7 })[1].inicio, "2026-11-04", "vira o mês");
const gA = { etapas: E80 };
assert.strictEqual(D.etapaEm(gA, "2026-08-31"), null);
assert.deepStrictEqual(D.etapaEm(gA, "2026-09-10"), { i: 1, n: 4, conc: 60, vol: 40, final: false, inicio: "2026-09-08", proxima: "2026-09-15" });
assert.ok(D.etapaEm(gA, "2026-12-01").final && D.etapaEm(gA, "2026-12-01").proxima === null);
assert.strictEqual(D.inicioFinal(gA), "2026-09-22"); assert.strictEqual(D.inicioFinal({ etapas: [{ inicio: "2026-09-01", conc: 40 }] }), null);
// etapas fora de ordem (editadas à mão) são ordenadas pela data
assert.strictEqual(D.etapaEm({ etapas: [E80[3], E80[0], E80[2], E80[1]] }, "2026-09-16").conc, 70);

// Análise só com a dieta final: GMD, consumo e comportamento começam no dia da dieta final do tratamento
const ad = { id: "ad", rotulo: "Baia", grupos: [{ id: "g8", nome: "Dieta 80%", gmdMeta: 1.5, etapas: E80 }, { id: "g4", nome: "Dieta 40%", gmdMeta: 1, etapas: [{ inicio: "2026-09-01", conc: 40 }] }],
  animais: [{ id: "b1", baia: "1", grupoId: "g8" }, { id: "b2", baia: "2", grupoId: "g4" }],
  pesagens: [{ data: "2026-09-01", pesos: { b1: 300, b2: 300 } }, { data: "2026-09-22", pesos: { b1: 310, b2: 321 } }, { data: "2026-10-22", pesos: { b1: 355, b2: 351 } }],
  consumo: [{ data: "2026-09-10", valores: { b1: 5, b2: 7 } }, { data: "2026-10-01", valores: { b1: 9, b2: 8 } }] };
assert.ok(D.temAdaptacao(ad));
const todo = D.performance(ad), fin = D.performance(ad, { soFinal: true });
assert.strictEqual(fin[0].desde, "2026-09-22"); assert.strictEqual(fin[0].p0, 310); assert.ok(Math.abs(fin[0].gmd - 1.5) < 1e-9, "GMD só da dieta final");
assert.ok(Math.abs(todo[0].gmd - 1.5) > 0.1, "com a adaptação o GMD muda"); assert.strictEqual(fin[0].cms, 9); assert.strictEqual(todo[0].cms, 7);
assert.strictEqual(fin[1].desde, null); assert.strictEqual(fin[1].gmd, todo[1].gmd, "tratamento sem adaptação não muda");
const sAd = { expId: "ad", animais: ["Baia 1"], animalIds: ["b1"], comp: [{ id: "r", nome: "Ruminando" }, { id: "o", nome: "Ócio" }], intervalo: 5,
  inicio: D.parseDay("2026-09-21").getTime() + 23 * 3600e3 + 55 * 60e3, // 23:55 do último dia de adaptação
  marks: { 0: { 0: ["o"], 1: ["r"], 2: ["r"] } } }; // 23:55 (adaptação), 00:00 e 00:05 (dieta final)
assert.strictEqual(D.behaviorVars(ad, [sAd]).by.b1["b:ruminando"], 2 / 3 * 1440);
assert.strictEqual(D.behaviorVars(ad, [sAd], { soFinal: true }).by.b1["b:ruminando"], 1440, "marcação da adaptação fica de fora");

console.log("Dados: todos os testes passaram.");
