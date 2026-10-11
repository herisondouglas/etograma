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
  const vshot = async n => { const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); fs.writeFileSync(path.join(out, n + ".png"), Buffer.from(r.data, "base64")) };
  const LOC = `JSON.parse(localStorage.getItem("etograma.v2"))`;
  const etapas = gid => ev(`return [...document.querySelectorAll('[data-eg="${gid}"] .etp-r')].map(r=>r.querySelector('[data-f="inicio"]').value+":"+r.querySelector('[data-f="conc"]').value).join(",")`);
  const gids = () => ev(`return [...document.querySelectorAll("[data-gid]")].map(c=>c.dataset.gid)`);
  const setv = (sel, v, evn = "input") => ev(`const e=document.querySelector(${JSON.stringify(sel)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event(${JSON.stringify(evn)},{bubbles:true}));await new Promise(r=>setTimeout(r,120));return true`);
  const addD = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) };
  const hoje = await ev(`const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")`);
  const ini = addD(hoje, -10);

  check("entra logado", await until(`!document.body.classList.contains("auth")`, 8000));
  check("app zerado mostra Criar experimento", await until(`document.querySelector("#mkExp")`)); await click("#mkExp");
  check("novo experimento tem a seção Fase de adaptação", await until(`document.querySelector("#adCard")`));
  await setv("#xNome", "Teste adaptação"); await setv("#xIni", ini);
  const [g40, g80] = await gids();
  check("concentrado final lido do nome da dieta", (await ev(`return [...document.querySelectorAll('[data-k="conc"]')].map(i=>i.value).join()`)) === "40,80");
  check("Dieta 80%: 50 → 60 → 70 → 80, uma por semana", (await etapas(g80)) === [0, 7, 14, 21].map((d, i) => addD(ini, d) + ":" + (50 + 10 * i)).join(","), await etapas(g80));
  check("Dieta 40%: começa em 50 e desce até 40", (await etapas(g40)) === `${ini}:50,${addD(ini, 7)}:40`, await etapas(g40));
  await setv("#adAbaixo", "direto", "change");
  check("opção: dieta abaixo do começo já começa na final", (await etapas(g40)) === `${ini}:40`, await etapas(g40));
  await setv("#adDias", "5");
  check("dias por etapa refazem a tabela", (await etapas(g80)).split(",")[1] === addD(ini, 5) + ":60", await etapas(g80));
  // edição à mão: a tabela para de acompanhar as opções até "Refazer"
  await setv(`[data-eg="${g80}"] .etp-r[data-k="1"] [data-f="conc"]`, "65");
  await setv("#adDias", "7");
  check("depois de editar à mão, mudar opção não apaga a edição", (await etapas(g80)).split(",")[1] === addD(ini, 5) + ":65", await etapas(g80));
  check("botão Refazer fica em destaque", await ev(`return document.querySelector("#adGen").classList.contains("primary")`));
  await click("#adGen");
  check("Refazer volta a seguir as opções", (await etapas(g80)).split(",")[1] === addD(ini, 7) + ":60", await etapas(g80));
  await click(`[data-eg="${g80}"] [data-adde]`);
  check("+ Etapa acrescenta uma etapa depois da última", (await etapas(g80)).split(",").length === 5 && (await etapas(g80)).endsWith(addD(ini, 28) + ":80"), await etapas(g80));
  await click(`[data-eg="${g80}"] [data-del="4"]`);
  await ev(`document.querySelector("#adBox").scrollIntoView();return true`);{const r=await send("Page.captureScreenshot",{format:"png"});fs.writeFileSync(path.join(out,"adapt-etapas-"+width+".png"),Buffer.from(r.data,"base64"))}
  check("tirar etapa", (await etapas(g80)).split(",").length === 4);
  await vshot("adapt-form-" + width);
  await setv("#adOn", "0", "change");
  check("sem adaptação: esconde as opções e deixa só a dieta final", await ev(`return document.querySelector("#adIni").closest("[data-ad]").hidden`) && (await etapas(g80)) === `${ini}:80`);
  await setv("#adOn", "1", "change");
  await ev(`document.querySelector("#f").requestSubmit();await new Promise(r=>setTimeout(r,400));return true`);
  const salvo = await ev(`const e=${LOC}.experiments.find(x=>x.nome==="Teste adaptação");return {cfg:e.config,et:e.grupos.map(g=>g.etapas.map(x=>x.conc).join("/")),d:e.grupos.map(g=>g.dieta)}`);
  check("salva opções e etapas no experimento", salvo.cfg.adapt === true && salvo.cfg.analise === "final" && salvo.cfg.volumoso === "Silagem" && salvo.et.join() === "40,50/60/70/80", JSON.stringify(salvo));
  check("descrição da dieta preenchida", salvo.d[0] === "40% de concentrado", JSON.stringify(salvo.d));

  // Início: dieta agora (dia 11: Dieta 80% na etapa 2 de 3, próxima troca em 4 dias)
  await click(`${+width < 960 ? ".tabbar" : "#navD"} [data-tab="inicio"]`);
  check("Início mostra Dieta agora", await until(`document.querySelector(".dieta")`));
  const dieta = await ev(`return [...document.querySelectorAll(".dieta .item")].map(i=>i.textContent.replace(/\\s+/g," ").trim())`);
  check("Dieta 80% em adaptação 2 de 3 com a próxima troca", /Adaptação 2 de 3/.test(dieta[1]) && /60% \/ 40%/.test(dieta[1]) && /em 4 dias/.test(dieta[1]) && /70% de concentrado/.test(dieta[1]), dieta[1]);
  check("Dieta 40% sem adaptação", /Sem fase de adaptação/.test(dieta[0]) && /40% \/ 60%/.test(dieta[0]), dieta[0]);
  await vshot("adapt-inicio-" + width);

  // Desempenho e Estatística: escolher se a adaptação entra
  await click(`${+width < 960 ? ".tabbar" : "#navD"} [data-tab="desempenho"]`);
  check("Desempenho mostra a escolha do período", await until(`document.querySelector(".analise [data-an]")`));
  check("padrão: só a dieta final", await ev(`return document.querySelector('[data-an="final"]').getAttribute("aria-pressed")==="true"`));
  await click('[data-an="todo"]');
  check("trocar para período todo grava no experimento", (await ev(`return ${LOC}.experiments.find(x=>x.nome==="Teste adaptação").config.analise`)) === "todo" && await ev(`return document.querySelector('[data-an="todo"]').getAttribute("aria-pressed")==="true"`));
  await vshot("adapt-desempenho-" + width);
  await click(`${+width < 960 ? ".tabbar" : "#navD"} [data-tab="estatistica"]`);
  check("Estatística também mostra a escolha", await until(`document.querySelector(".analise [data-an]")`));

  // Editar: as etapas salvas voltam como estavam
  await click(`${+width < 960 ? ".tabbar" : "#navD"} [data-tab="inicio"]`); await click('[data-go="edit"]');
  check("editar mantém as etapas salvas", (await etapas(g80)) === [0, 7, 14, 21].map((d, i) => addD(ini, d) + ":" + (50 + 10 * i)).join(","), await etapas(g80));
  check("sem rolagem horizontal", await ev(`return document.documentElement.scrollWidth<=innerWidth`));

  check("sem erros no console", !errors.length, errors.join(" | "));
  console.log(results.join("\n"));
  ws.close(); proc.kill(); process.exit(results.some(r => r.startsWith("FALHOU")) ? 1 : 0);
})().catch(e => { console.log(results.join("\n")); console.error("ERRO:", e.message, errors); proc.kill(); process.exit(1) });
