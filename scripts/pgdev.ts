// Postgres LOCAL embebido para desarrollo (sin Docker). localhost:5432, datos en ./.pgdata.
//   node scripts/pgdev.ts
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const DATA_DIR = new URL("../.pgdata", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: "voxtext",
  password: "voxtext",
  port: 5433,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

if (!existsSync(`${DATA_DIR}/PG_VERSION`)) {
  console.log("Inicializando cluster Postgres en", DATA_DIR);
  await pg.initialise();
}
await pg.start();
try { await pg.createDatabase("voxtext"); console.log("BD 'voxtext' creada."); }
catch { console.log("BD 'voxtext' ya existía."); }
console.log("✅ Postgres LISTO en postgresql://voxtext:voxtext@localhost:5432/voxtext");

const apagar = async () => { console.log("\nApagando Postgres…"); await pg.stop(); process.exit(0); };
process.on("SIGINT", apagar);
process.on("SIGTERM", apagar);
setInterval(() => {}, 1 << 30);
