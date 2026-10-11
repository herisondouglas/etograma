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
const until = async (cond, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(`return !!(${cond})`).catch(() => false)) return true; /* durante um reload a página ainda não tem body */ await sleep(150) } return false };
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

  const vshot = async n => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(out, n + ".png"), Buffer.from(r.data, "base64")) };
  const submit = () => ev(`document.querySelector("#lf").requestSubmit();await new Promise(r=>setTimeout(r,500));return true`);
  const msg = () => ev(`return document.querySelector("#lMsg")?.textContent||""`);
  // servidor fechado: só a admin está na lista
  await ev(`__srv.fechado=true;__srv.libera("admin@x.com","admin");__srv.users.set("admin@x.com",{user:{id:"u-adm",email:"admin@x.com",user_metadata:{nome:"Admin"}},password:"segredo1"});return true`);

  check("abre na tela de entrar", await until(`document.body.classList.contains("auth")&&document.querySelector("#lf")`, 8000));
  check("sem 'Continuar sem conta'", await ev(`return !document.querySelector("#lSkip")&&!/Continuar sem conta/.test(document.body.textContent)`));
  check("aviso de acesso restrito", /Acesso só para e-mails autorizados/.test(await ev(`return document.querySelector(".auth-lock")?.textContent||""`)));
  // tentar ir para outra tela sem login volta para a tela de entrar
  await ev(`document.querySelector('#navD [data-tab="animais"]').click();await new Promise(r=>setTimeout(r,300));return true`);
  check("sem login não abre outras telas", await ev(`return document.body.classList.contains("auth")&&!!document.querySelector("#lf")`));
  check("nenhum dado do experimento aparece", await ev(`return !/Confinamento Nelore/.test(document.querySelector("#app").textContent)`));

  // e-mail de fora da lista não cria conta
  await click('[data-m="up"]'); await sleep(400);
  await fill("#lNome", "Intruso"); await fill("#lMail", "intruso@x.com"); await fill("#lPass", "segredo1"); await submit();
  check("e-mail de fora é recusado com explicação", /não tem acesso ao Etograma/.test(await msg()), await msg());
  await vshot("acesso-recusado");
  check("continua na tela de entrar", await ev(`return document.body.classList.contains("auth")`));

  // admin entra e libera um observador
  await click('[data-m="in"]'); await sleep(400);
  await fill("#lMail", "admin@x.com"); await fill("#lPass", "segredo1"); await submit();
  check("admin entra", await until(`!document.body.classList.contains("auth")`, 6000));
  await click(`[data-tab="ajustes"]:not(.syncchip)`);
  check("Ajustes mostra Acessos para o admin", await until(`document.querySelector("#acCard .item b")`, 4000));
  check("admin aparece como (você) e sem botão de retirar", await ev(`const i=[...document.querySelectorAll("#acList .item")].find(x=>/admin@x.com/.test(x.textContent));return /você/.test(i.textContent)&&!i.querySelector("[data-acrm]")`));
  await fill("#acMail", "Obs@X.com"); await ev(`document.querySelector("#acForm").requestSubmit();return true`);
  check("e-mail liberado (em minúsculas)", await until(`[...document.querySelectorAll("#acList b")].some(b=>b.textContent==="obs@x.com")`, 4000));
  await fill("#acMail", "tchau@x.com"); await ev(`document.querySelector("#acForm").requestSubmit();return true`);
  await until(`[...document.querySelectorAll("#acList b")].some(b=>b.textContent==="tchau@x.com")`, 4000);
  await vshot("acesso-lista");
  await click('[data-acrm="tchau@x.com"]');
  check("retirar pede confirmação", (await ev(`return document.querySelector('[data-acrm="tchau@x.com"]').textContent`)) === "Confirmar?");
  await click('[data-acrm="tchau@x.com"]');
  check("e-mail retirado", await until(`![...document.querySelectorAll("#acList b")].some(b=>b.textContent==="tchau@x.com")`, 4000));

  // admin sai; o observador liberado cria a conta
  await click("#cOut"); await click("#cOut");
  check("sair leva à tela de entrar", await until(`document.body.classList.contains("auth")&&document.querySelector("#lf")`, 6000));
  await click('[data-m="up"]'); await sleep(400);
  await fill("#lNome", "Obs"); await fill("#lMail", "obs@x.com"); await fill("#lPass", "segredo1"); await submit();
  check("e-mail liberado cria a conta e entra", await until(`!document.body.classList.contains("auth")`, 6000), await msg());
  await click(`[data-tab="ajustes"]:not(.syncchip)`); await sleep(500);
  check("membro não vê a tela de Acessos", await ev(`return !document.querySelector("#acCard")`));

  // administrador retira o observador: no próximo carregamento ele é desconectado com aviso
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `__srv.fechado=true;__srv.libera("admin@x.com","admin");__srv.users.set("obs@x.com",{user:{id:"u-obs",email:"obs@x.com",user_metadata:{}},password:"segredo1"});__srv.session={user:__srv.users.get("obs@x.com").user};` });
  await send("Page.reload");
  // (o servidor falso reinicia no reload; a sessão do observador volta sem ele na lista)
  check("retirado da lista é desconectado com aviso", await until(`document.body.classList.contains("auth")&&/não está na lista de acessos/.test(document.querySelector("#lMsg")?.textContent||"")`, 8000), await msg());
  await vshot("acesso-retirado");

  check("sem erros no console", !errors.length, errors.join(" | "));
  console.log(results.join("\n")); ws.close(); proc.kill(); process.exit(results.some(r => r.startsWith("FALHOU")) ? 1 : 0);
})().catch(e => { console.log(results.join("\n")); console.error("ERRO:", e.message, errors); proc.kill(); process.exit(1) });
