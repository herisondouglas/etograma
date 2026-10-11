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
  const H = await ev(`return document.documentElement.scrollHeight`);
  const stops = [0, 0.04, 0.09, 0.16, 0.25, 0.36, 0.45, 0.55, 0.65, 0.75, 0.88, 1];
  for (let k = 0; k < stops.length; k++) {
    await ev(`window.scrollTo(0,${Math.round(stops[k] * H)});await new Promise(r=>setTimeout(r,1400));return true`);
    const st = await ev(`return {y:scrollY,p:getComputedStyle(document.querySelector(".lp-hero .auth-wrap")).getPropertyValue("--p"),nav:document.querySelector("#lpNav").className,q:[...document.querySelectorAll(".lp-step")].map(s=>s.style.getPropertyValue("--q")).join(","),on:document.querySelectorAll("#lpFrase span.on").length}`);
    results.push(`stop ${k}: ${JSON.stringify(st)}`);
    await vshot("lp-" + width + "-" + String(k).padStart(2, "0"));
  }
  check("sem rolagem horizontal", await ev(`return document.documentElement.scrollWidth<=innerWidth`), await ev(`return document.documentElement.scrollWidth+"/"+innerWidth`));
  await ev(`window.scrollTo(0,99999);await new Promise(r=>setTimeout(r,600));return true`);
  await ev(`document.querySelector(".lp-body").dispatchEvent(new PointerEvent("pointermove",{clientX:500,clientY:400,bubbles:true}));return true`); await vshot("lp-"+width+"-glow");
  await click('#lpNav [data-lp="entrar"]'); await sleep(1600); await vshot("lp-"+width+"-entrar");
  check("um toque em Entrar leva ao formulário", await ev(`const r=document.querySelector("#authCard").getBoundingClientRect(),p=+getComputedStyle(document.querySelector(".lp-hero .auth-wrap")).getPropertyValue("--p");return r.top>=0&&r.bottom<=innerHeight+1&&p===0`), await ev(`return scrollY+" p="+getComputedStyle(document.querySelector(".lp-hero .auth-wrap")).getPropertyValue("--p")`));
  check("Entrar do menu foca o e-mail", await ev(`return document.activeElement&&document.activeElement.id==="lMail"`));
  check("chamada final só oferece entrar", await ev(`return document.querySelectorAll(".lp-cta button").length===1`));

  check("sem erros no console", !errors.length, errors.join(" | "));
  console.log(results.join("\n")); ws.close(); proc.kill(); process.exit(results.some(r => r.startsWith("FALHOU")) ? 1 : 0);
})().catch(e => { console.log(results.join("\n")); console.error("ERRO:", e.message, errors); proc.kill(); process.exit(1) });
