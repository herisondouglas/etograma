// Servidor local para desenvolvimento (sem dependências): npm run dev → http://localhost:5173
// Use --host para abrir também no celular pela mesma rede Wi-Fi (npm run dev -- --host).
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const root = path.join(__dirname, "..");
const args = process.argv.slice(2);
const lan = args.includes("--host");
let port = +(process.env.PORT || 5173);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".md": "text/plain; charset=utf-8" };

function handler(req, res) {
  let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(root, rel);
  // Não deixa sair da pasta do projeto (ex.: /../../arquivo)
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end("Proibido"); return }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Não encontrado: " + rel); return }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}

// No Windows, "localhost" costuma apontar primeiro para o IPv6 (::1); por isso escuta em 127.0.0.1 e em ::1.
// Com --host, escuta em todas as interfaces (IPv4 e IPv6).
const host = lan ? "::" : "127.0.0.1";
const main = http.createServer(handler);
main.on("error", err => {
  if (err.code === "EADDRINUSE" && port < 5200) { console.log(`Porta ${port} ocupada, tentando ${port + 1}…`); port++; main.listen(port, host); return }
  if (err.code === "EAFNOSUPPORT" && lan) { main.listen(port, "0.0.0.0"); return } // computador sem IPv6
  console.error("Não consegui iniciar o servidor:", err.message); process.exit(1);
});
main.on("listening", () => {
  if (!lan) { const v6 = http.createServer(handler); v6.on("error", () => {}); v6.listen(port, "::1") }
  console.log(`\nEtograma rodando em http://localhost:${port}  (ou http://127.0.0.1:${port})`);
  if (lan) for (const list of Object.values(os.networkInterfaces())) for (const a of list || [])
    if (a.family === "IPv4" && !a.internal) console.log(`No celular (mesmo Wi-Fi): http://${a.address}:${port}`);
  console.log("Deixe este terminal aberto enquanto usa o app. Ctrl+C para parar.\n");
});
main.listen(port, host);
