// Confere as funções estatísticas contra valores de referência (tabelas t e F).
const assert = require("assert");
const S = require("../js/stats.js");
const near = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);

near(S.pT(1.826, 10), 0.0978);        // t bicaudal
near(S.pT(2.228, 10), 0.05);
near(S.pF(4.26, 2, 9), 0.05);         // F
near(S.pF(5.12, 1, 9), 0.05);
const an = S.anova([{ nome: "a", vals: [1, 2, 3] }, { nome: "b", vals: [4, 5, 6] }, { nome: "c", vals: [7, 8, 9] }]);
near(an.F, 27); near(an.p, 0.001);
const c = S.pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
near(c.r, 0.7746); near(c.p, 0.124); near(c.b, 0.6); near(c.a, 2.2);
// Benjamini-Hochberg (mesmo resultado de p.adjust(method = "BH") no R)
const q = S.bh([0.01, 0.04, 0.03, NaN, 0.005]);
near(q[0], 0.02); near(q[1], 0.04); near(q[2], 0.04); assert.ok(isNaN(q[3])); near(q[4], 0.02);
// t pareado (mesmo resultado de t.test(depois, antes, paired = TRUE) no R)
const tp = S.pairedT([10, 12, 14, 16, NaN], [11, 14, 15, 19, 20]);
assert.strictEqual(tp.n, 4); near(tp.dif, 1.75); near(tp.t, 3.6556); near(tp.p, 0.03535); assert.strictEqual(tp.df, 3);
assert.ok(isNaN(S.pairedT([1], [2]).p));
console.log("Estatística: todos os testes passaram.");
