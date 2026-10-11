// Novidades e Por que usar na apresentação do login: animações, menu e capturas. uso: node smoke-novo.js <arquivo.html> <pasta-saida> <fake-supabase.js> [largura]
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
  check("abre na tela de entrar", await until(`document.querySelector("#lpNovo")`, 8000));
  for (const id of ["lpNovo", "lpPor"]) {
    // rola em passos para o IntersectionObserver ver cada cartão
    const top = await ev(`return document.querySelector("#${id}").getBoundingClientRect().top+scrollY`), h = await ev(`return document.querySelector("#${id}").offsetHeight`);
    for (let y = top - 600; y < top + h; y += 300) await ev(`window.scrollTo(0,${y});await new Promise(r=>setTimeout(r,250));return 1`);
    await sleep(1800);
    const r = await ev(`const b=document.querySelector("#${id}").getBoundingClientRect();return {x:0,y:b.top+scrollY-20,width:innerWidth,height:b.height+40,scale:1}`);
    const o = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: r }); fs.writeFileSync(path.join(out, `novo-${id}-${width}.png`), Buffer.from(o.data, "base64"));
  }
  check("cartões das novidades animaram", await ev(`return [...document.querySelectorAll(".lp-new")].every(x=>x.classList.contains("in"))`));
  check("link Novidades no menu", await ev(`return !!document.querySelector('#lpNav [data-lp="lpNovo"]')`));
  check("sem rolagem horizontal", await ev(`return document.documentElement.scrollWidth<=innerWidth`), await ev(`return document.documentElement.scrollWidth+"/"+innerWidth`));
  check("sem erros no console", !errors.length, errors.join(" | "));
  console.log(results.join("\n")); ws.close(); proc.kill(); process.exit(results.some(r => r.startsWith("FALHOU")) ? 1 : 0);
})().catch(e => { console.log(results.join("\n")); console.error("ERRO:", e.message, errors); proc.kill(); process.exit(1) });
