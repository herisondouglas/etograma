// Confere a sincronização com um "Supabase" falso em memória (dois aparelhos, permissões, falta de internet).
const assert = require("assert");
const Sync = require("../js/sync.js");

/* ---------- banco falso: imita o pedaço do supabase-js que o app usa ---------- */
function fakeServer() {
  const tables = Object.fromEntries(Sync.TABLES.map(t => [t, new Map()]));
  let clock = 0; const ts = () => new Date(Date.UTC(2026, 9, 10, 12, 0, 0) + (++clock) * 1000).toISOString();
  const srv = { tables, offline: false, deny: new Set(), calls: 0 };
  srv.client = {
    from(t) {
      const q = { t, filters: [], op: "select" };
      const run = () => {
        srv.calls++;
        if (srv.offline) return { data: null, error: { message: "TypeError: Failed to fetch", code: "" } };
        const T = tables[t];
        if (q.op === "upsert") {
          if (q.rows.some(r => srv.deny.has(t + ":" + r.id))) return { error: { message: "new row violates row-level security policy", code: "42501" } };
          for (const r of q.rows) T.set(r.id, { deleted: false, ...(T.get(r.id) || {}), ...JSON.parse(JSON.stringify(r)), updated_at: ts() });
          return { error: null };
        }
        let rows = [...T.values()];
        for (const f of q.filters) rows = rows.filter(f);
        if (q.op === "update") {
          if (rows.some(r => srv.deny.has(t + ":" + r.id))) return { error: { message: "Só o responsável pode apagar o experimento", code: "P0001" } };
          for (const r of rows) Object.assign(r, q.patch, { updated_at: ts() });
          return { error: null };
        }
        rows.sort((a, b) => a.updated_at < b.updated_at ? -1 : 1);
        if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
        return { data: JSON.parse(JSON.stringify(rows)), error: null };
      };
      Object.assign(q, {
        select() { q.op = "select"; return q }, upsert(rows) { q.op = "upsert"; q.rows = rows; return q },
        update(patch) { q.op = "update"; q.patch = patch; return q },
        gt(c, v) { q.filters.push(r => r[c] > v); return q }, eq(c, v) { q.filters.push(r => r[c] === v); return q },
        in(c, v) { q.filters.push(r => v.includes(r[c])); return q }, order() { return q }, range(a, b) { q.range = [a, b]; return q },
        then(res, rej) { return Promise.resolve(run()).then(res, rej) }
      });
      return q;
    }
  };
  srv.edit = (t, id, patch) => Object.assign(tables[t].get(id), patch, { updated_at: ts() });
  return srv;
}

/* ---------- dados ---------- */
const mkDb = () => ({
  v: 2, active: "e1", species: [],
  experiments: [
    { id: "exemplo", exemplo: true, nome: "Exemplo", grupos: [{ id: "gA", nome: "A" }], animais: [], pesagens: [], consumo: [] },
    { id: "e1", nome: "Confinamento", especieId: "vaca", especie: "Vaca", responsavel: "", inicio: "2026-08-15", rotulo: "Baia",
      grupos: [{ id: "g40", nome: "Dieta 40%", dieta: "40% de concentrado", gmdMeta: 1, cor: "azul" }, { id: "g80", nome: "Dieta 80%", gmdMeta: 1.4, cor: "vermelho" }],
      animais: [{ id: "a1", baia: "1", brinco: "", grupoId: "g40", raca: "Nelore" }, { id: "a2", baia: "2", brinco: "4126", grupoId: "g80", saida: { data: "2026-10-05", motivo: "Morte" } }],
      pesagens: [{ id: "w1", data: "2026-08-15", pesos: { a1: 350.5, a2: 340 } }], consumo: [{ id: "k1", data: "2026-09-12", valores: { a1: 9.2 } }] }
  ],
  sessions: [
    { id: "s1", expId: "e1", nome: "Etograma 24 h", especie: "Vaca", observador: "Ana", comp: [{ id: "c1", nome: "Ruminando", tipo: "comum" }], animais: ["Baia 1"], animalIds: ["a1"], inicio: 1760000000000, intervalo: 5, duracao: 24, marks: { 0: { 0: ["c1"] } }, obs: {} },
    { id: "sx", exemplo: true, expId: "exemplo", nome: "x", comp: [], animais: [], inicio: 0, intervalo: 5, duracao: 1, marks: {}, obs: {} }
  ]
});
const fresh = () => ({ v: 2, active: null, species: [], experiments: [], sessions: [] });

(async () => {
  // toRows: exemplo fica de fora; ida e volta preserva os dados
  const rows = Sync.toRows(mkDb());
  assert.deepStrictEqual(rows.experiments.map(r => r.id), ["e1"]);
  assert.deepStrictEqual(rows.sessions.map(r => r.id), ["s1"]);
  assert.strictEqual(rows.animals[0].brinco, null); assert.deepStrictEqual(rows.animals[1].saida, { data: "2026-10-05", motivo: "Morte" });
  assert.strictEqual(rows.treatments[1].ordem, 1);
  const back = Sync.applyRows(fresh(), JSON.parse(JSON.stringify(rows)));
  assert.strictEqual(Sync.stable(Sync.toRows(back)), Sync.stable(rows), "ida e volta");
  assert.strictEqual(Sync.stable({ b: 1, a: [2, { d: 1, c: 2 }] }), Sync.stable({ a: [2, { c: 2, d: 1 }], b: 1 }));
  // experimento antigo sem rótulo é identificado pelo brinco no app: sobe como "Animal", não como "Baia"
  const semRotulo = mkDb(); delete semRotulo.experiments.find(e => e.id === "e1").rotulo;
  assert.strictEqual(Sync.toRows(semRotulo).experiments[0].rotulo, "Animal", "sem rótulo = brinco");
  // adaptação: config do experimento e etapas do tratamento vão e voltam; quem não tem não manda a coluna
  assert.ok(!("config" in rows.experiments[0]) && !("etapas" in rows.treatments[0]), "experimento antigo não muda");
  const comAd = mkDb(), eA = comAd.experiments.find(e => e.id === "e1");
  eA.config = { adapt: true, ini: 50, passo: 10, dias: 7, analise: "final", volumoso: "Silagem" };
  eA.grupos[0].etapas = [{ inicio: "2026-09-01", conc: 50 }, { inicio: "2026-09-08", conc: 80 }];
  const rA = Sync.toRows(comAd), volta = Sync.applyRows(fresh(), JSON.parse(JSON.stringify(rA)));
  const eV = volta.experiments.find(e => e.id === "e1");
  assert.deepStrictEqual(eV.config, eA.config); assert.deepStrictEqual(eV.grupos[0].etapas, eA.grupos[0].etapas);
  assert.strictEqual(Sync.stable(Sync.toRows(volta)), Sync.stable(rA), "ida e volta com adaptação");
  // jejum da pesagem: só vai quando informado; 0 (sem jejum) também vai e volta
  assert.ok(rows.weighings.length && !("jejum" in rows.weighings[0]), "pesagem sem jejum informado não manda a coluna");
  const comJ = mkDb(); comJ.experiments.find(e => e.id === "e1").pesagens[0].jejum = 0;
  const rJ = Sync.toRows(comJ); assert.strictEqual(rJ.weighings[0].jejum, 0);
  const vJ = Sync.applyRows(fresh(), JSON.parse(JSON.stringify(rJ)));
  assert.strictEqual(vJ.experiments.find(e => e.id === "e1").pesagens[0].jejum, 0, "sem jejum (0) volta como 0");
  rJ.weighings[0].jejum = 16; assert.strictEqual(Sync.applyRows(vJ, rJ).experiments.find(e => e.id === "e1").pesagens[0].jejum, 16);

  // Aparelho A envia tudo; segundo envio não manda nada
  const srv = fakeServer(); const A = mkDb(), shA = {};
  let r = await Sync.push(srv.client, A, shA);
  assert.strictEqual(r.enviados, 8); assert.strictEqual(srv.tables.sessions.size, 1); assert.ok(!srv.tables.experiments.has("exemplo"));
  r = await Sync.push(srv.client, A, shA); assert.strictEqual(r.enviados, 0);
  assert.strictEqual(Sync.pendingCount(A, shA), 0);

  // Aparelho B baixa tudo e fica igual
  const B = fresh(), shB = {};
  let p = await Sync.pull(srv.client, B, shB);
  assert.strictEqual(Sync.stable(Sync.toRows(B)), Sync.stable(Sync.toRows(A))); assert.strictEqual(B.active, "e1"); assert.ok(p.lastPull);
  assert.strictEqual(Sync.pendingCount(B, shB), 0, "o que veio do banco não conta como pendente");

  // A marca um X: só a observação vai; B recebe
  A.sessions[0].marks[0][1] = ["c1"]; assert.strictEqual(Sync.pendingCount(A, shA), 1);
  r = await Sync.push(srv.client, A, shA); assert.strictEqual(r.enviados, 1);
  p = await Sync.pull(srv.client, B, shB, { since: p.lastPull });
  assert.deepStrictEqual(B.sessions[0].marks[0][1], ["c1"]); assert.deepStrictEqual([...p.changed], ["sessions:s1"]);

  // Corrida: B marca algo enquanto chega versão do banco → a marcação local não se perde e vai no próximo envio
  srv.edit("sessions", "s1", { observador: "Ana Paula" });
  B.sessions[0].marks[0][2] = ["c1"];
  p = await Sync.pull(srv.client, B, shB, { since: p.lastPull });
  assert.deepStrictEqual(B.sessions[0].marks[0][2], ["c1"], "marcação local preservada");
  assert.strictEqual(Sync.pendingCount(B, shB), 1);
  await Sync.push(srv.client, B, shB); assert.deepStrictEqual(srv.tables.sessions.get("s1").marks[0][2], ["c1"]);

  // Exclusão de animal vira deleted = true no banco e some do outro aparelho
  const lastA = (await Sync.pull(srv.client, A, shA)).lastPull;
  A.experiments[1].animais.splice(0, 1);
  await Sync.push(srv.client, A, shA); assert.strictEqual(srv.tables.animals.get("a1").deleted, true);
  p = await Sync.pull(srv.client, B, shB, { since: p.lastPull });
  assert.deepStrictEqual(B.experiments[0].animais.map(a => a.id), ["a2"]);

  // Sem internet: erro de rede, nada marcado como enviado
  A.experiments[1].nome = "Confinamento Nelore"; srv.offline = true;
  await assert.rejects(Sync.push(srv.client, A, shA), e => e.network === true);
  assert.strictEqual(Sync.pendingCount(A, shA), 1); srv.offline = false;
  await Sync.push(srv.client, A, shA); assert.strictEqual(srv.tables.experiments.get("e1").nome, "Confinamento Nelore");

  // Observador sem permissão de apagar o experimento: fica registrado o erro e o pedido de rebaixar do banco; filhos não são apagados
  srv.deny.add("experiments:e1");
  const removed = B.experiments.splice(0, 1); B.sessions = B.sessions.filter(s => s.expId !== "e1");
  r = await Sync.push(srv.client, B, shB);
  assert.strictEqual(r.erros.length, 1); assert.deepStrictEqual(r.refetch, { experiments: ["e1"] });
  assert.strictEqual(srv.tables.sessions.get("s1").deleted, false, "observação não foi apagada no banco");
  await Sync.pull(srv.client, B, shB, { experimentId: "e1" });
  assert.strictEqual(B.experiments[0].id, "e1"); assert.strictEqual(B.sessions[0].id, "s1"); assert.strictEqual(Sync.pendingCount(B, shB), 0);
  srv.deny.clear();

  // Responsável apaga o experimento: no outro aparelho somem experimento e observações
  A.experiments = A.experiments.filter(e => e.id !== "e1"); A.sessions = A.sessions.filter(s => s.expId !== "e1");
  await Sync.push(srv.client, A, shA); assert.strictEqual(srv.tables.experiments.get("e1").deleted, true);
  await Sync.pull(srv.client, B, shB, { since: lastA });
  assert.strictEqual(B.experiments.length, 0); assert.strictEqual(B.sessions.length, 0); assert.strictEqual(B.active, null);

  // Sair da conta: some o que veio do banco, fica o exemplo e o que nunca foi enviado
  const C = mkDb(), shC = { "experiments:e1": "{}", "sessions:s1": "{}" }; C.sessions.push({ id: "local", expId: null });
  Sync.forget(C, shC);
  assert.deepStrictEqual(C.experiments.map(e => e.id), ["exemplo"]); assert.deepStrictEqual(C.sessions.map(s => s.id).sort(), ["local", "sx"]);

  // Chaves: só a pública
  const jwt = role => "x." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".y";
  assert.strictEqual(Sync.checkKey(jwt("anon")), null);
  assert.match(Sync.checkKey(jwt("service_role")), /service_role/);
  assert.match(Sync.checkKey("sb_secret_abc"), /secreta/);
  assert.strictEqual(Sync.checkKey("sb_publishable_abc"), null);
  assert.strictEqual(Sync.checkUrl("https://abcd1234.supabase.co"), null); assert.ok(Sync.checkUrl("http://abc.com"));

  console.log("Sincronização: todos os testes passaram.");
})().catch(e => { console.error(e); process.exit(1) });
