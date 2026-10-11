// 1) Carimba a versão no index.html: cada arquivo ganha ?v=<código do conteúdo> e a página ganha
//    <meta name="etograma-versao">. Mudou o código, muda o endereço: o navegador não usa a cópia velha
//    (o GitHub Pages manda guardar por 10 min) e o app avisa quem está com a página aberta.
// 2) Junta index.html + styles.css + js/*.js num único arquivo: dist/etograma.html
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const FILES = ["styles.css", "js/stats.js", "js/data.js", "js/sync.js", "js/config.js", "js/app.js"];
const hash = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ref = f => new RegExp(`(${f.endsWith(".css") ? "href" : "src"}=")${esc(f)}(\\?v=[0-9a-f]+)?"`);

let index = read("index.html");
for (const f of FILES) index = index.replace(ref(f), `$1${f}?v=${hash(read(f))}"`);
const versao = hash(FILES.map(read).join("\n"));
const meta = `<meta name="etograma-versao" content="${versao}">`;
index = /<meta name="etograma-versao"[^>]*>/.test(index) ? index.replace(/<meta name="etograma-versao"[^>]*>/, meta) : index.replace("</head>", meta + "\n</head>");
fs.writeFileSync(path.join(root, "index.html"), index);

let html = index.replace(/<link rel="stylesheet" href="styles\.css(\?v=[0-9a-f]+)?">/, () => `<style>\n${read("styles.css")}\n</style>`);
for (const f of FILES.slice(1)) html = html.replace(new RegExp(`<script src="${esc(f)}(\\?v=[0-9a-f]+)?"></script>`), () => `<script>\n${read(f)}\n</script>`);
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "etograma.html"), html);
console.log("Versão " + versao + " · gerado dist/etograma.html (" + Math.round(html.length / 1024) + " KB)");
