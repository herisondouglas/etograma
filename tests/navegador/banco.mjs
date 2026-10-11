// Testa supabase/schema.sql num Postgres real (PGlite), simulando o auth do Supabase.
// uso: node pgtest.mjs <caminho do schema.sql> <pasta com node_modules do pglite>
import fs from "fs"; import path from "path"; import { pathToFileURL } from "url";
const [schemaPath, pgDir] = process.argv.slice(2);
const { PGlite } = await import(pathToFileURL(path.join(pgDir, "node_modules/@electric-sql/pglite/dist/index.js")).href);
const db = new PGlite();
const results = []; const check = (n, ok, info = "") => results.push(`${ok ? "OK  " : "FALHOU"} ${n}${info ? " — " + info : ""}`);
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const fails = async (sql, p = []) => { try { await q(sql, p); return null } catch (e) { return e.message } };
const as = async uid => { await q("reset role"); await q("select set_config('test.uid', $1, false)", [uid || ""]); await q("set role authenticated") };
const admin = async () => { await q("reset role") };

// simulação mínima do Supabase
await db.exec(`
  create schema auth;
  create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role authenticated; create role anon;
  grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
const schema = fs.readFileSync(schemaPath, "utf8");
await db.exec(schema); await db.exec(schema); check("schema roda 2 vezes sem erro", true);

const U1 = "11111111-1111-1111-1111-111111111111", U2 = "22222222-2222-2222-2222-222222222222", U3 = "33333333-3333-3333-3333-333333333333";
check("lista começa vazia (sem contas antes)", (await q("select count(*)::int n from acessos"))[0].n === 0);
await q("insert into acessos(email,papel) values ('raquel@x.com','admin'),('obs@x.com','membro'),('fora@x.com','membro')");
check("e-mail fora da lista não cria conta", /EMAIL_SEM_ACESSO/.test(await fails("insert into auth.users values ('99999999-9999-9999-9999-999999999999','intruso@x.com','{}')") || ""));
await q(`insert into auth.users values ($1,'RAQUEL@x.com','{"nome":"Raquel"}'),($2,'obs@x.com','{}'),($3,'fora@x.com','{}')`, [U1, U2, U3]);
check("perfil criado com o nome", (await q("select nome from profiles where id=$1", [U1]))[0]?.nome === "Raquel");

// Raquel cria o experimento (upsert como o app faz)
await as(U1);
const up = (t, cols, vals) => q(`insert into ${t}(${cols.join(",")}) values (${cols.map((_, i) => "$" + (i + 1)).join(",")}) on conflict (id) do update set ${cols.filter(c => c !== "id").map(c => `${c}=excluded.${c}`).join(",")}`, vals);
await up("experiments", ["id", "nome", "especie", "rotulo", "inicio"], ["e1", "Confinamento", "Vaca", "Baia", "2026-08-15"]);
const [e1] = await q("select owner, codigo, updated_at from experiments where id='e1'");
check("experimento criado com dono e código", e1.owner === U1 && /^[0-9A-F]{6}$/.test(e1.codigo), JSON.stringify(e1));
check("criador vira responsável", (await q("select papel from experiment_members where experiment_id='e1'"))[0]?.papel === "responsavel");
await up("treatments", ["id", "experiment_id", "nome", "gmd_meta", "cor", "ordem"], ["g40", "e1", "Dieta 40%", 1.0, "azul", 0]);
await up("animals", ["id", "experiment_id", "treatment_id", "baia"], ["a1", "e1", "g40", "1"]);
await up("weighings", ["id", "experiment_id", "data", "pesos", "jejum"], ["w1", "e1", "2026-08-15", JSON.stringify({ a1: 350.5 }), 16]);
await up("sessions", ["id", "experiment_id", "nome", "comp", "animais", "animal_ids", "inicio", "intervalo", "duracao", "marks"],
  ["s1", "e1", "Etograma", JSON.stringify([{ id: "c1", nome: "Ruminando", tipo: "comum" }, { id: "c2", nome: "Deitada", tipo: "comum" }]), JSON.stringify(["Baia 1"]), JSON.stringify(["a1"]), Date.UTC(2026, 9, 4, 10), 5, 24, JSON.stringify({ 0: { 0: ["c1", "c2"], 1: ["c1"] } })]);
check("responsável grava tratamentos, animais, pesagens e observações", (await q("select count(*)::int n from animals")).at(0).n === 1);

// Pessoa de fora não vê nem grava
await as(U3);
check("de fora não vê o experimento", (await q("select * from experiments")).length === 0 && (await q("select * from animals")).length === 0);
check("de fora não grava animal", !!(await fails(`insert into animals(id,experiment_id,baia) values ('x','e1','9')`)));
check("de fora não usa código errado", /não encontrado/.test(await fails("select join_experiment('ZZZZZZ')") || ""));
await up("sessions", ["id", "nome", "inicio", "intervalo", "duracao"], ["avulsa3", "Avulsa", 0, 5, 1]);

// Observador entra pelo código (minúsculo e com espaço também vale)
await as(U2);
check("observador entra com o código", (await q("select join_experiment($1) id", [" " + e1.codigo.toLowerCase() + " "]))[0].id === "e1");
check("observador vê os animais", (await q("select baia from animals")).length === 1);
check("observador não vê observação avulsa de outro", (await q("select id from sessions where id='avulsa3'")).length === 0);
await up("animals", ["id", "experiment_id", "treatment_id", "baia", "brinco"], ["a1", "e1", "g40", "1", "4113"]);
check("observador corrige animal", (await q("select brinco from animals where id='a1'"))[0].brinco === "4113");
await up("sessions", ["id", "experiment_id", "nome", "inicio", "intervalo", "duracao"], ["s2", "e1", "Obs 2", 0, 5, 24]);
check("observador cria observação (dono = ele)", (await q("select owner from sessions where id='s2'"))[0].owner === U2);
await up("experiments", ["id", "nome", "especie", "rotulo", "inicio"], ["e1", "Confinamento Nelore", "Vaca", "Baia", "2026-08-15"]);
const [e1b] = await q("select owner, codigo, nome, updated_at from experiments where id='e1'");
check("observador renomeia (dono e código não mudam)", e1b.nome === "Confinamento Nelore" && e1b.owner === U1 && e1b.codigo === e1.codigo);
check("updated_at avança", new Date(e1b.updated_at) > new Date(e1.updated_at));
check("observador não apaga o experimento", /Só o responsável/.test(await fails("update experiments set deleted=true where id='e1'") || ""));
check("observador não muda papel / não se promove", !!(await fails(`insert into experiment_members values ('e1','${U2}','responsavel')`)));

// Responsável edita a observação do observador: o dono continua sendo o observador
await as(U1);
await q(`update sessions set marks='{"0":{"0":["c1"]}}' where id='s2'`);
check("responsável edita observação de outro; dono mantido", (await q("select owner from sessions where id='s2'"))[0].owner === U2);
check("responsável vê os 2 membros", (await q("select * from experiment_members where experiment_id='e1'")).length === 2);

// Visões para análise
const pes = await q("select baia, tratamento, peso_kg, jejum_h from vw_pesagens");
check("vw_pesagens em formato longo", pes.length === 1 && pes[0].baia === "1" && pes[0].tratamento === "Dieta 40%" && +pes[0].peso_kg === 350.5 && +pes[0].jejum_h === 16, JSON.stringify(pes));
const mk = await q("select animal, animal_id, comportamento, horario from vw_marcacoes where observacao_id='s1' order by horario, comportamento");
check("vw_marcacoes: uma linha por X com nome do comportamento", mk.length === 3 && mk.map(m => m.comportamento).join() === "Deitada,Ruminando,Ruminando" && mk[0].animal === "Baia 1" && mk[0].animal_id === "a1", JSON.stringify(mk));
check("vw_marcacoes: horário certo (10:00 e 10:05 UTC)", new Date(mk[0].horario).toISOString() === "2026-10-04T10:00:00.000Z" && new Date(mk[2].horario).toISOString() === "2026-10-04T10:05:00.000Z");
await as(U3);
check("de fora não vê nada nas visões", (await q("select * from vw_pesagens")).length === 0 && (await q("select * from vw_marcacoes")).length === 0);

// Responsável apaga (exclusão lógica): os membros recebem deleted = true
await as(U1);
await q("update experiments set deleted=true where id='e1'");
await as(U2);
check("exclusão chega aos membros como deleted", (await q("select deleted from experiments where id='e1'"))[0]?.deleted === true);
check("código de experimento apagado não funciona", /não encontrado/.test(await fails(`select join_experiment('${e1.codigo}')`) || ""));
// ---------- fase de adaptação ----------
await admin(); await q("update experiments set deleted=false where id='e1'");
await as(U1);
await up("treatments", ["id", "experiment_id", "nome", "gmd_meta", "cor", "ordem", "etapas"], ["g80", "e1", "Dieta 80%", 1.5, "vermelho", 1, JSON.stringify([{ inicio: "2026-09-15", conc: 70 }, { inicio: "2026-09-01", conc: 50 }, { inicio: "2026-09-22", conc: 80 }, { inicio: "2026-09-08", conc: 60 }])]);
await up("experiments", ["id", "nome", "especie", "rotulo", "inicio", "config"], ["e1", "Confinamento Nelore", "Vaca", "Baia", "2026-08-15", JSON.stringify({ adapt: true, analise: "final" })]);
const et = await q("select etapa, dieta_final, inicio::text, concentrado_pct::float c, volumoso_pct::float v from vw_etapas where tratamento_id='g80' order by etapa");
check("vw_etapas: uma linha por etapa, em ordem de data, com volumoso", et.map(x => x.etapa + ":" + x.inicio + ":" + x.c + "/" + x.v + (x.dieta_final ? "F" : "")).join() === "1:2026-09-01:50/50,2:2026-09-08:60/40,3:2026-09-15:70/30,4:2026-09-22:80/20F", JSON.stringify(et));
check("config do experimento gravada", (await q("select config->>'analise' a from experiments where id='e1'"))[0].a === "final");
await as(U3);
check("de fora não vê etapas", (await q("select * from vw_etapas")).length === 0);

// ---------- lista de acessos ----------
const U4 = "44444444-4444-4444-4444-444444444444";
await as(U2);
check("membro vê só a própria linha da lista", (await q("select email from acessos")).map(x => x.email).join() === "obs@x.com");
check("membro não inclui e-mail", !!(await fails("insert into acessos(email) values ('novo@x.com')")));
check("membro não se promove a admin", (await q("update acessos set papel='admin' where email='obs@x.com' returning *")).length === 0);
await as(U1);
check("admin vê a lista toda", (await q("select * from acessos")).length === 3);
await q("insert into acessos(email) values ('novo@x.com')");
check("admin inclui e-mail", (await q("select papel from acessos where email='novo@x.com'"))[0]?.papel === "membro");
check("e-mail com maiúsculas é recusado na lista", !!(await fails("insert into acessos(email) values ('Maiusc@x.com')")));
check("admin não remove a si mesmo", (await q("delete from acessos where email='raquel@x.com' returning *")).length === 0);
await admin();
check("e-mail incluído cria conta (maiúsculas no cadastro valem)", !(await fails("insert into auth.users values ($1,'Novo@X.com','{}')", [U4])));
// retirar da lista corta o acesso de quem já tem conta e é membro do experimento
await q("update experiments set deleted=false where id='e1'");
await as(U1); await q("delete from acessos where email='obs@x.com'");
await as(U2);
check("retirado da lista não vê experimento, animais nem observações", (await q("select * from experiments")).length === 0 && (await q("select * from animals")).length === 0 && (await q("select * from sessions")).length === 0);
check("retirado da lista não grava", !!(await fails("insert into animals(id,experiment_id,baia) values ('y','e1','8')")) && !!(await fails("insert into sessions(id,nome,inicio,intervalo,duracao) values ('z','x',0,5,1)")));
check("retirado da lista não usa código", /EMAIL_SEM_ACESSO/.test(await fails("select join_experiment($1)", [e1.codigo]) || ""));
await as(U1);
check("responsável continua vendo tudo", (await q("select * from animals")).length === 1);
await q("insert into acessos(email) values ('obs@x.com')");
await as(U2);
check("devolver à lista devolve o acesso", (await q("select * from animals")).length === 1);
// primeira vez: lista vazia recebe quem já tem conta; rodar de novo não traz de volta quem saiu
await admin(); await q("delete from acessos"); await db.exec(schema);
check("lista vazia recebe as contas existentes como membro", (await q("select count(*)::int n from acessos where papel='membro'"))[0].n === 4);
await q("delete from acessos where email='fora@x.com'"); await db.exec(schema);
check("rodar o schema de novo não devolve quem foi retirado", (await q("select * from acessos where email='fora@x.com'")).length === 0);

await as(null);
check("sem login não vê nada", (await q("select * from experiments")).length === 0);

console.log(results.join("\n"));
process.exit(results.some(r => r.startsWith("FALHOU")) ? 1 : 0);
