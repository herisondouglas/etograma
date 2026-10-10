// Junta index.html + styles.css + js/*.js num único arquivo: dist/etograma.html
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
let html = read("index.html")
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read("styles.css")}\n</style>`)
  .replace('<script src="js/stats.js"></script>', () => `<script>\n${read("js/stats.js")}\n</script>`)
  .replace('<script src="js/data.js"></script>', () => `<script>\n${read("js/data.js")}\n</script>`)
  .replace('<script src="js/sync.js"></script>', () => `<script>\n${read("js/sync.js")}\n</script>`)
  .replace('<script src="js/config.js"></script>', () => `<script>\n${read("js/config.js")}\n</script>`)
  .replace('<script src="js/app.js"></script>', () => `<script>\n${read("js/app.js")}\n</script>`);
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "etograma.html"), html);
console.log("Gerado dist/etograma.html (" + Math.round(html.length / 1024) + " KB)");
