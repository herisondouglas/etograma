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

  const until = async (cond, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(`return !!(${cond})`)) return true; await sleep(150) } return false };
  const fill = (s, v) => ev(`const e=document.querySelector(${JSON.stringify(s)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event("input",{bubbles:true}));return true`);
  const vshot = async n => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(out, n + ".png"), Buffer.from(r.data, "base64")) };
  const LOC = `JSON.parse(localStorage.getItem("etograma.v2"))`;
  check("entra logado", await until(`!document.body.classList.contains("auth")`, 8000));
  await click("#mkExp");
  const opts = await ev(`return [...document.querySelector("#xSp").options].map(o=>o.textContent)`);
  check("nomes zootécnicos em ordem + Nova espécie", opts.join("|") === "Bovino|Suíno|Equino|Ovino|Caprino|Ave (galinha)|+ Nova espécie…", opts.join("|"));
  check("nome científico embaixo do campo", (await ev(`return document.querySelector("#xSpH i")?.textContent`)) === "Bos taurus / Bos indicus");
  await ev(`const s=document.querySelector("#xSp");s.value="porco";s.dispatchEvent(new Event("change"));return true`);
  check("científico acompanha a escolha", (await ev(`return document.querySelector("#xSpH").textContent`)) === "Sus scrofa domesticus");
  await ev(`const s=document.querySelector("#xSp");s.value="__nova";s.dispatchEvent(new Event("change"));await new Promise(r=>setTimeout(r,100));return true`);
  check("+ Nova espécie abre o cadastro e mantém a escolha anterior", await ev(`return !document.querySelector("#espNova").hidden&&document.querySelector("#xSp").value==="porco"`));
  await click("#enAdd");
  check("pede o nome", /Digite o nome/.test(await ev(`return document.querySelector("#enMsg").textContent`)));
  await fill("#enNome", "Bovino"); await click("#enAdd");
  check("não deixa repetir nome", /Já existe/.test(await ev(`return document.querySelector("#enMsg").textContent`)));
  await fill("#enNome", "Bubalino"); await fill("#enCient", "Bubalus bubalis");
  await ev(`document.querySelector("#enBase").value="vaca";return true`); await vshot("esp-nova-" + width);
  await click("#enAdd");
  check("nova espécie selecionada com o científico", await ev(`const s=document.querySelector("#xSp");return s.options[s.selectedIndex].textContent==="Bubalino"&&document.querySelector("#xSpH").textContent==="Bubalus bubalis"&&document.querySelector("#espNova").hidden`));
  check("comportamentos copiados do Bovino", await ev(`const d=${LOC};const b=d.species.find(s=>s.nome==="Bubalino"),v=d.species.find(s=>s.id==="vaca");return b.comp.map(c=>c.nome).join()===v.comp.map(c=>c.nome).join()&&b.comp[0].id!==v.comp[0].id`));
  await fill("#xNome", "Teste búfalos");
  await ev(`document.querySelector("#f").requestSubmit();await new Promise(r=>setTimeout(r,400));return true`);
  const ex = await ev(`const e=${LOC}.experiments.find(x=>x.nome==="Teste búfalos");return {esp:e.especie,def:e.config.especieDef&&e.config.especieDef.nome+"|"+e.config.especieDef.cientifico+"|"+e.config.especieDef.comp.length}`);
  check("experimento leva a espécie junto (para os observadores)", ex.esp === "Bubalino" && /^Bubalino\|Bubalus bubalis\|\d+$/.test(ex.def), JSON.stringify(ex));
  // Ajustes → Etogramas mostra e edita o nome científico
  await click('[data-tab="ajustes"]:not(.syncchip)'); await click("#spc");
  check("Etogramas: campo do nome científico", (await ev(`return [...document.querySelectorAll('[id^="spc"]')].map(i=>i.value).filter(Boolean).length`)) >= 7);
  // observador recebe o experimento sem ter a espécie: ela é criada a partir do experimento
  // aparelho de quem já usava: "Vaca" vira "Bovino" (também no experimento) e entra o Caprino
  await ev(`localStorage.setItem("etograma.v2",JSON.stringify({v:2,speciesV:2,limpoV:1,active:"r1",sessions:[{id:"s1",expId:"r1",especie:"Vaca",nome:"x",animais:[],comp:[],marks:{},obs:{},inicio:0,intervalo:5,duracao:1}],
    species:[{id:"vaca",nome:"Vaca",comp:[{id:"c1",nome:"Comendo",tipo:"comum"}]},{id:"porco",nome:"Porquinho",comp:[]}],
    experiments:[{id:"r1",nome:"Real",especieId:"vaca",especie:"Vaca",rotulo:"Baia",inicio:"2026-10-01",grupos:[],animais:[],pesagens:[],consumo:[]},
      {id:"r2",nome:"Do colega",especieId:"buf9",especie:"Bubalino",rotulo:"Baia",inicio:"2026-10-01",config:{especieDef:{nome:"Bubalino",cientifico:"Bubalus bubalis",comp:[{id:"k1",nome:"Chafurdando",tipo:"comum"}]}},grupos:[],animais:[],pesagens:[],consumo:[]}]}));return true`);
  await send("Page.reload"); await sleep(1500);
  const mg = await ev(`const d=${LOC};return {sp:d.species.map(s=>s.id+":"+s.nome+":"+(s.cientifico||"")),e:d.experiments.find(x=>x.id==="r1").especie,s:d.sessions[0].especie,v:d.speciesV}`);
  check("Vaca vira Bovino com o científico (experimento e observação também)", mg.sp.includes("vaca:Bovino:Bos taurus / Bos indicus") && mg.e === "Bovino" && mg.s === "Bovino" && mg.v === 3, JSON.stringify(mg));
  check("nome personalizado não é trocado", mg.sp.some(x => x.startsWith("porco:Porquinho:Sus scrofa")), JSON.stringify(mg.sp));
  check("entra o Caprino", mg.sp.some(x => x.startsWith("cabra:Caprino:Capra hircus")));
  check("espécie de experimento de outro aparelho é criada aqui", mg.sp.includes("buf9:Bubalino:Bubalus bubalis") && (await ev(`return ${LOC}.species.find(s=>s.id==="buf9").comp[0].nome`)) === "Chafurdando", JSON.stringify(mg.sp));

  check("sem erros no console", !errors.length, errors.join(" | "));
  console.log(results.join("\n"));
  ws.close(); proc.kill(); process.exit(results.some(r => r.startsWith("FALHOU")) ? 1 : 0);
})().catch(e => { console.log(results.join("\n")); console.error("ERRO:", e.message, errors); proc.kill(); process.exit(1) });
