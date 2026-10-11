// Teste de fumaça: abre o app no Chrome headless via DevTools Protocol, navega e confere fluxos críticos.
// uso: node smoke.js <arquivo.html> <pasta-saida> [largura]
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path");
const [file, out, width = "390"] = process.argv.slice(2);
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9300 + Math.floor(Math.random() * 500);
const prof = path.join(out, "prof-" + port);
fs.mkdirSync(out, { recursive: true });
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, `--window-size=${width},900`, "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = {}; const errors = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method, params })) });
const ev = async expr => { const r = await send("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)); return r.result.value };
const shot = async name => { const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); fs.writeFileSync(path.join(out, name + ".png"), Buffer.from(r.data, "base64")) };
const results = []; const check = (name, ok, info = "") => { results.push(`${ok ? "OK  " : "FALHOU"} ${name}${info ? " — " + info : ""}`) };
(async () => {
  let tabs; for (let k = 0; k < 50; k++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break } catch { await sleep(200) } }
  const page = tabs.find(t => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { d.error ? pending[d.id].rej(new Error(d.error.message)) : pending[d.id].res(d.result); delete pending[d.id] }
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map(a => a.value || a.description).join(" ")) };
  await send("Runtime.enable"); await send("Page.enable"); await send("Page.addScriptToEvaluateOnNewDocument", { source: fs.readFileSync(path.join(__dirname, "fake-supabase.js"), "utf8") + ";__srv.entrar(\"teste@x.com\",\"Teste\");" });
  await send("Emulation.setDeviceMetricsOverride", { width: +width, height: 900, deviceScaleFactor: 1, mobile: +width < 700 });
  await send("Page.navigate", { url: "file:///" + path.resolve(file).replace(/\\/g, "/") }); await sleep(1500);
  const click = sel => ev(`const e=document.querySelector(${JSON.stringify(sel)});if(!e)throw new Error("não achei "+${JSON.stringify(sel)});e.click();await new Promise(r=>setTimeout(r,250));return true`);
  const tab = t => click(`${+width < 960 ? ".tabbar" : "#navD"} [data-tab="${t}"]`);

  // o app abre zerado; o exemplo entra pelo botão de Ajustes
  check("app abre sem experimentos", (await ev(`return (JSON.parse(localStorage.getItem("etograma.v2")||"null")?.experiments||[]).length`)) === 0 && /Nenhum experimento/.test(await ev(`return document.querySelector("#app").textContent`)));
  await click('[data-tab="ajustes"]:not(.syncchip)'); await click("#addEx");
  check("Carregar exemplo em Ajustes", (await ev(`return JSON.parse(localStorage.getItem("etograma.v2")).experiments.filter(x=>x.exemplo).length`)) === 1);
  // telas principais
  for (const t of ["inicio", "observar", "desempenho", "estatistica", "visao"]) { await tab(t); await sleep(300); await shot("tela-" + t); check("abre " + t, !!(await ev(`return document.querySelector("#app h1")?.textContent`))) }
  await click('[data-tab="ajustes"]:not(.syncchip)'); await shot("tela-ajustes");

  // planilha da observação
  await tab("observar"); await click("[data-open]"); await sleep(300); await shot("tela-planilha");
  check("planilha tem 288 horários", (await ev(`return document.querySelectorAll("#tb tr[data-i]").length`)) === 288);

  // ANIMAIS: editar a baia 1 (corrigir brinco, trocar tratamento, raça) não pode perder pesagens
  const DB = `JSON.parse(localStorage.getItem("etograma.v2")).experiments.find(x=>x.id==="exemplo")`;
  const before = await ev(`const e=${DB};const a=e.animais.find(a=>a.baia==="1");return {id:a.id,n:e.pesagens.filter(p=>isFinite(p.pesos[a.id])).length,g:a.grupoId}`);
  await tab("animais"); await shot("tela-animais");
  check("exemplo na ordem do curral", (await ev(`return ${"(e=>e.animais.slice().sort((a,b)=>a.baia-b.baia).map(a=>({azul:\"A\",vermelho:\"V\"})[e.grupos.find(g=>g.id===a.grupoId).cor]).join(\"\"))"}(${DB})`)) === "AVVAAVVAVAAV");
  check("lista de animais", (await ev(`return document.querySelectorAll("#anList .item").length`)) === 12);
  await click(`[data-ed="${before.id}"]`); await shot("tela-animal-editar");
  await ev(`const q=s=>document.querySelector(s);q("#aBrinco").value="BR-777";q("#aRaca").value="Angus";q("#aSexo").value="Fêmea";q("#aNasc").value="2024-05-01";
    const s=q("#aG");s.value=[...s.options].find(o=>o.value!==s.value).value;q("#f").requestSubmit();await new Promise(r=>setTimeout(r,300));return true`);
  const after = await ev(`const e=${DB};const a=e.animais.find(a=>a.id===${JSON.stringify(before.id)});return {a,n:e.pesagens.filter(p=>isFinite(p.pesos[a.id])).length}`);
  check("editar animal mantém pesagens", after.a.baia === "1" && after.a.brinco === "BR-777" && after.n === before.n && before.n > 0, JSON.stringify({ before, after }));
  check("troca de tratamento e dados salvos", after.a.grupoId !== before.g && after.a.raca === "Angus" && after.a.sexo === "Fêmea" && after.a.nascimento === "2024-05-01");
  // baia repetida é recusada
  await click("#newA"); await ev(`document.querySelector("#aBaia").value="3";document.querySelector("#f").requestSubmit();await new Promise(r=>setTimeout(r,300));return true`);
  check("baia repetida recusada", /Já existe: Baia 3/.test(await ev(`return document.querySelector("#toast").textContent`)));
  // "Salvar e cadastrar outro" e cadastro rápido por faixa (13-14 novas, 12 repetida)
  await ev(`document.querySelector("#aBaia").value="15";document.querySelector("[data-more]").click();await new Promise(r=>setTimeout(r,300));return true`);
  check("salvar e cadastrar outro abre formulário novo", !!(await ev(`return document.querySelector("#aBaia")&&document.querySelector("#aBaia").value===""`)));
  await tab("animais"); await ev(`document.querySelector("#qIds").value="12-14";document.querySelector("#qAdd").click();await new Promise(r=>setTimeout(r,300));return true`);
  check("cadastro rápido 12-14", (await ev(`return ${DB}.animais.length`)) === 15, await ev(`return document.querySelector("#toast").textContent`));
  // remover (com confirmação) apaga as pesagens do animal
  await click(`[data-ed="${before.id}"]`); await click("#delA");
  check("remover pede confirmação", (await ev(`return ${DB}.animais.length`)) === 15);
  await click("#delA");
  check("remover apaga animal e pesagens", await ev(`const e=${DB};return e.animais.length===14&&!e.pesagens.some(p=>${JSON.stringify(before.id)} in p.pesos)`));
  // nova observação mostra os animais pelo nome da baia
  await tab("observar"); await click("#newExpObs");
  check("nova observação lista baias", /^Baia \d+/.test(await ev(`return document.querySelector(".checks .check span").textContent`)));

  // desempenho e estatística continuam calculando
  await tab("desempenho"); check("tabela de desempenho", (await ev(`return document.querySelector("table.t").querySelectorAll("tbody tr").length`)) === 14);
  // SAÍDA DO EXPERIMENTO: baia 2 morre → sai das médias, alertas, nova observação e estatística; histórico fica
  const b2 = await ev(`const e=${DB};const a=e.animais.find(a=>a.baia==="2");return {id:a.id,n:e.pesagens.filter(p=>isFinite(p.pesos[a.id])).length}`);
  await tab("animais"); await click(`[data-ed="${b2.id}"]`); await click("#openSaida");
  await ev(`const q=s=>document.querySelector(s);q("#sData").value="2026-10-05";q("#sMot").value="Morte";q("#sObs").value="timpanismo";q("#okSaida").click();await new Promise(r=>setTimeout(r,300));return true`);
  await shot("tela-animais-saida");
  const sx = await ev(`const e=${DB};const a=e.animais.find(a=>a.id===${JSON.stringify(b2.id)});return {saida:a.saida,n:e.pesagens.filter(p=>isFinite(p.pesos[a.id])).length,ativos:document.querySelectorAll("#anList .item").length,fora:document.querySelectorAll("#anOut .item").length}`);
  check("saída registrada e histórico mantido", sx.saida?.motivo === "Morte" && sx.saida.data === "2026-10-05" && sx.saida.obs === "timpanismo" && sx.n === b2.n, JSON.stringify(sx));
  check("lista separa quem saiu", sx.ativos === 13 && sx.fora === 1, JSON.stringify(sx));
  await tab("inicio");
  check("painel conta só ativos", /13/.test(await ev(`return document.querySelector(".hero .fact b").textContent`)) && /1 saiu/.test(await ev(`return document.querySelector(".hero .fact span").textContent`)));
  check("alerta não lista quem saiu", !(await ev(`return [...document.querySelectorAll(".list .title")].some(t=>/^Baia 2 /.test(t.textContent))`)));
  await tab("observar"); await click("#newExpObs");
  check("nova observação sem quem saiu", !(await ev(`return [...document.querySelectorAll(".checks .check span")].some(s=>s.textContent==="Baia 2")`)));
  await tab("estatistica");
  check("estatística exclui e avisa", /1 animal que saiu do experimento não entra/.test(await ev(`return document.querySelector(".page-h p").textContent`)) && (await ev(`return [...document.querySelectorAll("section.stack .tablebox tbody tr")].length`)) === 13);
  await tab("desempenho");
  check("desempenho mostra Saiu", /Saiu/.test(await ev(`return document.querySelector(".t tbody tr:last-child").textContent`)));
  // baia 2 reocupada por um animal novo; desfazer saída do antigo é bloqueado
  await tab("animais"); await ev(`document.querySelector("#qIds").value="2";document.querySelector("#qAdd").click();await new Promise(r=>setTimeout(r,300));return true`);
  check("baia de quem saiu pode ser reocupada", (await ev(`return ${DB}.animais.filter(a=>a.baia==="2").length`)) === 2);
  await click(`[data-ed="${b2.id}"]`); await click("#undoSaida"); await click("#undoSaida");
  check("desfazer bloqueado com baia ocupada", /já está ocupada/.test(await ev(`return document.querySelector("#toast").textContent`)) && !!(await ev(`return ${DB}.animais.find(a=>a.id===${JSON.stringify(b2.id)}).saida`)));

  await tab("estatistica"); await sleep(300); await shot("tela-estatistica-depois");
  check("nota do mapa (BH)", /pares testados/.test(await ev(`return document.querySelector("#heatNote").textContent`)), await ev(`return document.querySelector("#heatNote").textContent`));

  // importar o CSV de uma observação duas vezes: a 2ª deve ser ignorada
  const csv = await ev(`const d=JSON.parse(localStorage.getItem("etograma.v2"));return null`);
  await click('[data-tab="ajustes"]:not(.syncchip)');
  const imp = await ev(`
    const d=JSON.parse(localStorage.getItem("etograma.v2"));const s=d.sessions[0];const txt=Data.sessionCSV({...s,observador:"Teste CSV"});
    const inp=document.querySelector("#csvIn");const put=async()=>{const dt=new DataTransfer();dt.items.add(new File([txt],"obs.csv",{type:"text/csv"}));inp.files=dt.files;inp.dispatchEvent(new Event("change"));await new Promise(r=>setTimeout(r,400));return document.querySelector("#csvMsg").textContent};
    const m1=await put();const m2=await put();return {m1,m2,n:JSON.parse(localStorage.getItem("etograma.v2")).sessions.length}`);
  check("importar CSV", /^1 observa/.test(imp.m1), imp.m1);
  check("reimportar o mesmo CSV é ignorado", /^0 observa.*1 já existia/.test(imp.m2), imp.m2);

  // falha ao salvar mostra a barra de aviso
  await ev(`const o=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException("cheio","QuotaExceededError")};window.__restore=()=>Storage.prototype.setItem=o;return true`);
  await tab("observar"); await click("[data-open]"); await click("#chips button[data-c]");
  check("aviso aparece quando não salva", await ev(`return !document.querySelector("#saveErr").hidden`)); await shot("tela-erro-salvar");
  await ev(`window.__restore();return true`); await click("#chips button[data-c]");
  check("aviso some quando volta a salvar", await ev(`return document.querySelector("#saveErr").hidden`));

  // dados ilegíveis: guardados, não sobrescritos
  await ev(`localStorage.setItem("etograma.v2","{quebrado");return true`);
  await send("Page.reload"); await sleep(1200);
  check("dados ilegíveis guardados em etograma.ilegivel", (await ev(`return localStorage.getItem("etograma.ilegivel")`)) === "{quebrado");
  await click('[data-tab="ajustes"]:not(.syncchip)'); check("cartão de recuperação em Ajustes", !!(await ev(`return document.querySelector("#badDl")`))); await shot("tela-ajustes-recuperar");

  // NOVO EXPERIMENTO na ordem do curral (opção padrão)
  await tab("inicio"); await ev(`(document.querySelector('[data-go="new"]')||document.querySelector('#mkExp')).click();await new Promise(r=>setTimeout(r,250));return true`);
  check("ordem do curral é a 1ª opção", (await ev(`return document.querySelector("#xDiv").value`)) === "curral");
  await ev(`const q=s=>document.querySelector(s);q("#xNome").value="Teste curral";q("#f").requestSubmit();await new Promise(r=>setTimeout(r,300));return true`);
  check("novo experimento segue a ordem do curral", (await ev(`return ${"(e=>e.animais.slice().sort((a,b)=>a.baia-b.baia).map(a=>({azul:\"A\",vermelho:\"V\"})[e.grupos.find(g=>g.id===a.grupoId).cor]).join(\"\"))"}(JSON.parse(localStorage.getItem("etograma.v2")).experiments.find(x=>x.nome==="Teste curral"))`)) === "AVVAAVVAVAAV");
  // 14 baias na ordem do curral: 13 e 14 sem dieta até a pessoa escolher
  await tab("inicio"); await ev(`(document.querySelector('[data-go="new"]')||document.querySelector('#mkExp')).click();await new Promise(r=>setTimeout(r,250));return true`);
  await ev(`const q=s=>document.querySelector(s);q("#xNome").value="Teste 14";q("#xNB").value="14";q("#xNB").dispatchEvent(new Event("input"));return true`);
  await shot("tela-novo-14-baias");
  check("baias 13 e 14 ficam para escolher", (await ev(`return [...document.querySelectorAll("#bGrid .bchip.none b")].map(b=>b.textContent).join()`)) === "13,14");
  await ev(`document.querySelector("#f").requestSubmit();await new Promise(r=>setTimeout(r,300));return true`);
  check("criar bloqueado sem dieta", /Escolha a dieta da\(s\) baia\(s\) 13, 14/.test(await ev(`return document.querySelector("#toast").textContent`)) && !(await ev(`return JSON.parse(localStorage.getItem("etograma.v2")).experiments.some(x=>x.nome==="Teste 14")`)));
  await click('#bGrid [data-b="12"]'); await click('#bGrid [data-b="13"]'); await click('#bGrid [data-b="13"]'); // 13 → azul; 14 → azul → vermelho
  await click('[data-b="0"]'); await click('[data-b="0"]'); // baia 1: azul → vermelho → azul (volta)
  await ev(`document.querySelector("#f").requestSubmit();await new Promise(r=>setTimeout(r,300));return true`);
  check("14 baias com a dieta escolhida", (await ev(`return ${"(e=>e.animais.slice().sort((a,b)=>a.baia-b.baia).map(a=>({azul:\"A\",vermelho:\"V\"})[e.grupos.find(g=>g.id===a.grupoId).cor]).join(\"\"))"}(JSON.parse(localStorage.getItem("etograma.v2")).experiments.find(x=>x.nome==="Teste 14"))`)) === "AVVAAVVAVAAVAV");
  // NOVO EXPERIMENTO de porco com 8 baias em sequência (1–4 na 1ª dieta, 5–8 na 2ª) + botão "Baia 9"
  await tab("inicio"); await ev(`(document.querySelector('[data-go="new"]')||document.querySelector('#mkExp')).click();await new Promise(r=>setTimeout(r,250));return true`);
  check("espécie Suíno disponível", await ev(`return [...document.querySelector("#xSp").options].some(o=>o.textContent==="Suíno")`));
  await ev(`const q=s=>document.querySelector(s);q("#xNome").value="Teste porco";q("#xSp").value="porco";q("#xNB").value="8";q("#xNB").dispatchEvent(new Event("input"));q("#xDiv").value="seq";q("#xDiv").dispatchEvent(new Event("change"));q("#f").requestSubmit();await new Promise(r=>setTimeout(r,300));return true`);
  const px = await ev(`const d=JSON.parse(localStorage.getItem("etograma.v2"));const e=d.experiments.find(x=>x.nome==="Teste porco");return {esp:e.especie,baias:e.animais.map(a=>a.baia).join(),g:e.animais.map(a=>e.grupos.findIndex(g=>g.id===a.grupoId)).join(""),view:document.querySelector("#app h1").textContent}`);
  check("experimento criado com 8 baias divididas em sequência", px.esp === "Suíno" && px.baias === "1,2,3,4,5,6,7,8" && px.g === "00001111" && px.view === "Cadastro de animais", JSON.stringify(px));
  await shot("tela-animais-porco");
  check("botões da próxima baia por dieta", (await ev(`return [...document.querySelectorAll("[data-nextg]")].map(b=>b.textContent.trim()).join("|")`)) === "Baia 9 · Dieta 40%|Baia 9 · Dieta 80%", await ev(`return [...document.querySelectorAll("[data-nextg]")].map(b=>b.textContent.trim()).join("|")`));
  await click("[data-nextg]:last-child");
  check("baia 9 adicionada na dieta escolhida", (await ev(`const e=JSON.parse(localStorage.getItem("etograma.v2")).experiments.find(x=>x.nome==="Teste porco");const a=e.animais.find(a=>a.baia==="9");return a&&e.grupos.find(g=>g.id===a.grupoId).nome`)) === "Dieta 80%");
  await click('[data-ed]'); check("raças de porco no cadastro", await ev(`return [...document.querySelectorAll("#racas option")].some(o=>o.value==="Landrace")`));

  // exemplo antigo (Dieta A/B, sem rótulo) vira o novo; um experimento real junto não é tocado
  await ev(`localStorage.setItem("etograma.v2",JSON.stringify({v:2,active:"exemplo",species:[],sessions:[{id:"s0",exemplo:true,expId:"exemplo",animais:[],comp:[],marks:{},obs:{}}],experiments:[
    {id:"exemplo",exemplo:true,nome:"Confinamento Nelore",especie:"Vaca",inicio:"2026-08-15",grupos:[{id:"gA",nome:"Dieta A",gmdMeta:1.4}],animais:[{id:"a1",brinco:"01",grupoId:"gA"}],pesagens:[],consumo:[]},
    {id:"real",nome:"Experimento da Raquel",especie:"Vaca",inicio:"2026-10-01",grupos:[{id:"g1",nome:"Dieta A",gmdMeta:1}],animais:[{id:"x1",brinco:"5",grupoId:"g1"}],pesagens:[],consumo:[]}]}));return true`);
  await send("Page.reload"); await sleep(1200); await shot("tela-inicio-baias");
  const mig = await ev(`const d=JSON.parse(localStorage.getItem("etograma.v2"))||{};return {ex:d.experiments?.find(x=>x.id==="exemplo"),real:d.experiments?.find(x=>x.id==="real"),title:document.querySelector("#app .title")?.textContent}`);
  check("exemplo antigo (criado sozinho por versões anteriores) é tirado uma vez", !mig.ex && !(JSON.parse(await ev(`return localStorage.getItem("etograma.v2")`)).sessions.some(s=>s.exemplo)), JSON.stringify(mig.ex||null).slice(0,80));
  check("experimento real intacto", mig.real?.grupos[0].nome === "Dieta A" && mig.real.rotulo !== "Baia" && mig.real.animais[0].brinco === "5", JSON.stringify(mig.real));
  check("usuário antigo ganha Porco", (JSON.parse(await ev(`return localStorage.getItem("etograma.v2")`))).species.some(s=>s.id==="porco"));
  check("sem erros no console", !errors.length, errors.join(" | "));
  console.log(results.join("\n"));
  ws.close(); proc.kill(); process.exit(results.some(r => r.startsWith("FALHOU")) ? 1 : 0);
})().catch(e => { console.log(results.join("\n")); console.error("ERRO:", e.message, errors); proc.kill(); process.exit(1) });
