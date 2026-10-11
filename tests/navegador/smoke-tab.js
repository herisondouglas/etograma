// Fluxo da nuvem no navegador com Supabase falso. uso: node smoke-cloud.js <arquivo.html> <pasta-saida> <fake-supabase.js> [largura]
const { spawn } = require("child_process"); const fs = require("fs"), path = require("path");
const [file, out, fakePath, width = "390"] = process.argv.slice(2);
const port = 9400 + Math.floor(Math.random() * 400), prof = path.join(out, "prof-" + port); fs.mkdirSync(out, { recursive: true });
const proc = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let ws, id = 0; const pend = {}, errors = [], results = [];
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method: m, params: p })) });
const ev = async x => { const r = await send("Runtime.evaluate", { expression: `(async()=>{${x}})()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "erro"); return r.result.value };
const shot = async n => { const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); fs.writeFileSync(path.join(out, n + ".png"), Buffer.from(r.data, "base64")) };
const check = (n, ok, info = "") => results.push(`${ok ? "OK  " : "FALHOU"} ${n}${info ? " — " + info : ""}`);
const until = async (cond, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(`return !!(${cond})`)) return true; await sleep(150) } return false };
(async () => {
  let tabs; for (let k = 0; k < 50; k++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break } catch { await sleep(200) } }
  ws = new WebSocket(tabs.find(t => t.type === "page").webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { d.error ? pend[d.id].rej(new Error(d.error.message)) : pend[d.id].res(d.result); delete pend[d.id] }
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map(a => a.value || a.description).join(" ")) };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: +width, height: 900, deviceScaleFactor: 1, mobile: +width < 700 });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: fs.readFileSync(fakePath, "utf8") });
  await send("Page.navigate", { url: "file:///" + path.resolve(file).replace(/\\/g, "/") }); await sleep(1500);
  const click = s => ev(`const e=document.querySelector(${JSON.stringify(s)});if(!e)throw new Error("não achei "+${JSON.stringify(s)});e.click();await new Promise(r=>setTimeout(r,250));return true`);
  const tab = t => click(`${+width < 960 ? ".tabbar" : "#navD"} [data-tab="${t}"]`);
  const fill = (s, v) => ev(`const e=document.querySelector(${JSON.stringify(s)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event("input",{bubbles:true}));return true`);
  const LOCAL = `JSON.parse(localStorage.getItem("etograma.v2"))`;

  check("abre na tela de entrar", await until(`document.querySelector(".lp-body")`, 8000));
  const vshot = async n => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(out, n + ".png"), Buffer.from(r.data, "base64")) };
  const H = +(process.env.VH || 930);
  await send("Emulation.setDeviceMetricsOverride", { width: +width, height: H, deviceScaleFactor: 1, mobile: +width < 700 });
  await sleep(1500);
  const meas = () => ev(`const h=document.querySelector("#lpHero"),c=document.querySelector("#authCard"),f=document.querySelector(".auth-facts");return JSON.stringify({vh:innerHeight,hero:h.offsetHeight,card:Math.round(c.getBoundingClientRect().height),cardBottom:Math.round(c.getBoundingClientRect().bottom),facts:f?Math.round(f.getBoundingClientRect().bottom):null,stick:h.style.getPropertyValue("--stick"),body:Math.round(document.querySelector(".lp-body").getBoundingClientRect().top)})`);
  const m1=JSON.parse(await meas());results.push("entrar " + JSON.stringify(m1)); await vshot("tab-" + width + "x" + H + "-in");
  await click('[data-m="up"]'); await sleep(900);
  const m2=JSON.parse(await meas());results.push("criar  " + JSON.stringify(m2)); await vshot("tab-" + width + "x" + H + "-up");
  check("topo e cartão do mesmo tamanho nas duas abas", +width<960||(m1.hero===m2.hero&&m1.card===m2.card), m1.hero+"/"+m2.hero+" cartão "+m1.card+"/"+m2.card);
  check("topo cabe na tela (desktop)", +width<960||m2.vh<740||m2.hero===m2.vh, m2.hero+" vs "+m2.vh);
  await ev(`window.scrollTo(0,300);await new Promise(r=>setTimeout(r,800));return true`); await vshot("tab-" + width + "x" + H + "-up-scroll");
  const m3=JSON.parse(await meas());results.push("criar rolado " + JSON.stringify(m3));check("gruda no lugar certo depois de trocar de aba", m3.stick===Math.min(0,m3.vh-m3.hero)+"px", m3.stick);


  check("sem erros no console", !errors.length, errors.join(" | "));
  console.log(results.join("\n")); ws.close(); proc.kill(); process.exit(results.some(r => r.startsWith("FALHOU")) ? 1 : 0);
})().catch(e => { console.log(results.join("\n")); console.error("ERRO:", e.message, errors); proc.kill(); process.exit(1) });
