// Pesagem antes e depois: opção no experimento, lembrete no Início, pesagem inicial/final e análise no Desempenho.
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
  await until(`document.querySelector("#mkExp")`); await click("#mkExp");
  check("novo experimento tem Pesagem antes e depois (ligada)", await until(`document.querySelector("#pzCard")`) && (await ev(`return document.querySelector("#pzOn").value`)) === "1");
  await setv("#xNome", "Teste peso"); await setv("#xIni", ini);
  check("pesagem inicial acompanha a data de início", (await ev(`return document.querySelector("#pzIni").value`)) === ini);
  await setv("#pzFim", addD(ini, -1));
  check("avisa quando a final é antes da inicial", /depois da pesagem inicial/.test(await ev(`return document.querySelector("#pzDur").textContent`)));
  await click('#f button[type="submit"]');
  check("não cria com a final antes da inicial", !(await ev(`return (${LOC}?.experiments||[]).some(x=>x.nome==="Teste peso")`)));
  await setv("#pzFim", hoje); await setv("#pzJej", "16", "change");
  check("mostra os dias entre as pesagens", /10 dias/.test(await ev(`return document.querySelector("#pzDur").textContent`)));
  await click('#f button[type="submit"]');
  const cfg = await ev(`return ${LOC}.experiments.find(x=>x.nome==="Teste peso").config.pesagem`);
  check("grava a opção no experimento", cfg && cfg.on && cfg.ini === ini && cfg.fim === hoje && cfg.jejum === 16, JSON.stringify(cfg));

  await tab("inicio");
  check("Início mostra o lembrete das pesagens", await until(`document.querySelector('[data-pzgo="inicial"]')`));
  check("as duas pendentes, com o jejum", await ev(`const c=document.querySelector('[data-pzgo="inicial"]').closest(".card");return c.querySelectorAll(".pill.warn").length===2&&/16 h de jejum/.test(c.textContent)`));
  await vshot("peso-inicio-vazio-" + width);
  await click('[data-pzgo="inicial"]');
  check("pesagem já vem com o jejum padrão", (await ev(`return document.querySelector("#jj").value`)) === "16");
  check("abre Pesagem inicial na data prevista", (await ev(`return document.querySelector("h1").textContent`)) === "Pesagem inicial" && (await ev(`return document.querySelector("#d").value`)) === ini);
  const A = await ev(`const e=${LOC}.experiments.find(x=>x.nome==="Teste peso");return e.animais.map(a=>({id:a.id,b:+a.baia,g:e.grupos.findIndex(g=>g.id===a.grupoId)}))`);
  for (const a of A) await ev(`document.querySelector("#v${a.id}").value="${300 + a.b}";return 1`);
  await click('#f button[type="submit"]');
  await tab("inicio");
  check("inicial aparece como feita (12 de 12)", await until(`/Feita em .* 12 de 12 animais/.test(document.querySelector('[data-pzgo="final"]').closest(".card").textContent)`));
  await click('[data-pzgo="final"]');
  check("abre Pesagem final com a data de hoje", (await ev(`return document.querySelector("h1").textContent`)) === "Pesagem final" && (await ev(`return document.querySelector("#d").value`)) === hoje);
  check("mostra o peso da pesagem anterior", /antes 301,0/.test(await ev(`return document.querySelector('[data-prev="${A.find(a => a.b === 1).id}"]').textContent`)));
  // Dieta da cor 0 ganha ~30 kg, a outra ~50 kg (com variação)
  for (const a of A) await ev(`const i=document.querySelector("#v${a.id}");i.value="${300 + a.b + (a.g === 0 ? 30 : 50) + (a.b % 3) * 2}";i.dispatchEvent(new Event("input",{bubbles:true}));return 1`);
  const a1 = A.find(a => a.b === 1);
  check("diferença aparece enquanto digita", /^\+\d/.test(await ev(`return document.querySelector('[data-prev="${a1.id}"] [data-dif]').textContent`)));
  await vshot("peso-final-" + width);
  await click('#f button[type="submit"]');
  check("depois da final, vai para o antes e depois", await until(`document.querySelector("#pzAD .verdict")`));
  const txt = await ev(`return document.querySelector("#pzAD").textContent.replace(/\\s+/g," ")`);
  check("frase por dieta com t pareado", (txt.match(/teste t pareado/g) || []).length === 2, txt.slice(0, 300));
  check("confere se começaram parecidos", /começaram com peso parecido|já começaram com peso diferente/.test(txt));
  check("compara o ganho entre dietas (difere)", /ganho total difere/.test(txt), txt.match(/ganho total[^.]*/)?.[0]);
  check("gráfico com 12 animais antes e depois", (await ev(`return document.querySelectorAll("#pzAD svg circle").length`)) >= 24);
  check("tabela por tratamento", (await ev(`return document.querySelectorAll("#pzAD tbody tr").length`)) === 2);
  check("inicial e final com o mesmo jejum: sem aviso", /mesma condição/.test(txt) && !(await ev(`return !!document.querySelector("#pzAD .callout.warn")`)));
  check("pesagens gravam o jejum", (await ev(`return ${LOC}.experiments.find(x=>x.nome==="Teste peso").pesagens.map(p=>p.jejum).join()`)) === "16,16");
  // pesagem cheia (sem jejum) na véspera da final → perda de peso no jejum
  await click("#lp"); await setv("#d", addD(hoje, -1));
  await setv("#jj", "outro", "change");
  check("Outro tempo abre o campo de horas", await ev(`return !document.querySelector("#jjH").hidden`));
  await setv("#jjH", ""); await click('#f button[type="submit"]');
  check("Outro tempo sem horas não salva", (await ev(`return document.querySelector("h1").textContent`)) === "Lançar pesagem");
  await setv("#jj", "0", "change");
  for (const a of A) await ev(`document.querySelector("#v${a.id}").value="${300 + a.b + (a.g === 0 ? 30 : 50) + (a.b % 3) * 2 + (a.g === 0 ? 14 : 20)}";return 1`);
  await click('#f button[type="submit"]');
  check("mostra a perda de peso no jejum", await until(`/Perda de peso no jejum/.test(document.querySelector("#pzAD").textContent)`));
  check("lista de pesagens mostra o jejum", /sem jejum/.test(await ev(`return [...document.querySelectorAll("[data-ed^='peso:']")].map(b=>b.closest(".item").textContent).join("|")`)));
  await vshot("peso-desempenho-" + width);
  // inicial passa a ser sem jejum → aviso de condição diferente
  const pIni = await ev(`return ${LOC}.experiments.find(x=>x.nome==="Teste peso").pesagens.find(p=>p.data==="${ini}").id`);
  check("faixa Jejum nas pesagens aparece, com só o jejum padrão", await until(`document.querySelector('.jejumbar [data-jg="padrao"][aria-pressed="true"]')`));
  check("pesagem cheia marcada como fora do GMD", /fora do GMD/.test(await ev(`return [...document.querySelectorAll("[data-ed^='peso:']")].map(b=>b.closest(".item").textContent).join("|")`)));
  check("GMD não mistura peso cheio com jejum (positivo)", await ev(`return [...document.querySelectorAll("table.t tbody tr")].slice(0,12).every(tr=>!/−|-\d/.test(tr.children[5].textContent))`));
  await click(`[data-ed="peso:${pIni}"]`); await setv("#jj", "0", "change"); await click('#f button[type="submit"]');
  check("inicial fora do padrão: avisa que há pesagens fora da conta", await until(`/com outro jejum estão fora da conta/.test(document.querySelector("#pzAD").textContent)`));
  await click('[data-jg="todas"]');
  check("Todas: grava a escolha", (await ev(`return ${LOC}.experiments.find(x=>x.nome==="Teste peso").config.pesagem.gmd`)) === "todas");
  check("avisa jejum diferente no começo e no fim", await until(`/Jejum diferente no começo e no fim/.test((document.querySelector("#pzAD .callout.warn")||{}).textContent||"")`));
  check("aviso diz quais jejuns", /sem jejum → 16 h de jejum/.test(await ev(`return document.querySelector("#pzAD .callout.warn").textContent`)));
  await vshot("peso-aviso-" + width);
  await tab("inicio");
  check("Início marca a final como feita", await until(`document.querySelectorAll('[data-pzgo="ver"]').length && document.querySelector('[data-pzgo="ver"]').closest(".card").querySelectorAll(".pill.good").length===2`));
  await vshot("peso-inicio-feito-" + width);
  await tab("estatistica");
  check("Estatística tem Ganho total no experimento", await until(`[...document.querySelectorAll("#sv option")].some(o=>/Ganho total no experimento/.test(o.textContent))`));
  check("sem rolagem horizontal", await ev(`return document.documentElement.scrollWidth<=innerWidth`));

  check("sem erros no console", !errors.length, errors.join(" | "));
  console.log(results.join("\n"));
  ws.close(); proc.kill(); process.exit(results.some(r => r.startsWith("FALHOU")) ? 1 : 0);
})().catch(e => { console.log(results.join("\n")); console.error("ERRO:", e.message, errors); proc.kill(); process.exit(1) });
