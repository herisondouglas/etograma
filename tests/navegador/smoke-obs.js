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
  check("entra logado", await until(`!document.body.classList.contains("auth")`, 8000));
  await click(`${+width < 960 ? ".tabbar" : "#navD"} [data-tab="observar"]`);
  const txt = await ev(`return document.querySelector("#app").innerText`);
  check("sem experimento: aviso e botão Criar experimento no topo", await ev(`const m=document.querySelector("#mkExp"),r=[...document.querySelectorAll("#app h2")].find(h=>/Registros/.test(h.textContent));return !!m&&!!r&&(m.compareDocumentPosition(r)&Node.DOCUMENT_POSITION_FOLLOWING)>0`));
  check("registros vazios explicados", /Nenhuma observação ainda/.test(txt));
  check("espécies como Etogramas prontos, depois dos registros", /Etogramas prontos/.test(txt) && /Não são registros/.test(txt) && txt.indexOf("Etogramas prontos") > txt.indexOf("Registros"));
  check("nome científico nos cartões", (await ev(`return document.querySelector('[data-sp="vaca"] .sci')?.textContent`)) === "Bos taurus / Bos indicus");
  check("rodapé fala da sincronização", /se juntam às da equipe/.test(txt) && !/exporta a planilha e você importa/.test(txt));
  await vshot("obs-vazio-" + width);
  await click("#edEto"); check("Editar etogramas abre a tela de etogramas", await until(`/Etogramas/.test(document.querySelector("#app h1").textContent)`));
  await click(`${+width < 960 ? ".tabbar" : "#navD"} [data-tab="observar"]`); await click("#mkExp");
  check("Criar experimento abre o formulário", await until(`document.querySelector("#xNome")`));

  check("sem erros no console", !errors.length, errors.join(" | "));
  console.log(results.join("\n"));
  ws.close(); proc.kill(); process.exit(results.some(r => r.startsWith("FALHOU")) ? 1 : 0);
})().catch(e => { console.log(results.join("\n")); console.error("ERRO:", e.message, errors); proc.kill(); process.exit(1) });
