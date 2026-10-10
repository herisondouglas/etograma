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
console.log("Estatística: todos os testes passaram.");
