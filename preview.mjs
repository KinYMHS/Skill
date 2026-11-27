import {createServer} from "node:http";
import {mkdir, readFile} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import {fileURLToPath} from "node:url";
import worker from "./dist/server/index.js";

const port = Number(process.env.SKILL_PREVIEW_PORT || 4173);
const origin = `http://127.0.0.1:${port}`;
const runtime = new URL(".sites-runtime/", import.meta.url);
await mkdir(runtime, {recursive:true});
const db = new DatabaseSync(fileURLToPath(new URL("preview.sqlite", runtime)));
const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'skill_updates'").get();
if (!table) db.exec(await readFile(new URL("drizzle/0000_skill_updates.sql", import.meta.url), "utf8"));
const wrap = (statement, args) => ({
  bind: (...values) => wrap(statement, values),
  all: () => ({results:statement.all(...args)}),
  run: () => ({meta:{changes:statement.run(...args).changes}}),
});
const env = {DB:{prepare: sql => wrap(db.prepare(sql), [])}};
createServer(async (incoming, outgoing) => {
  try {
    const headers = new Headers(incoming.headers);
    headers.set("oai-authenticated-user-id", "local-preview");
    const hasBody = incoming.method !== "GET" && incoming.method !== "HEAD";
    const request = new Request(new URL(incoming.url, origin), {
      method:incoming.method, headers,
      ...(hasBody ? {body:incoming, duplex:"half"} : {}),
    });
    const response = await worker.fetch(request, env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500).end("Local preview request failed.");
  }
}).listen(port, "127.0.0.1", () => console.log(`Local: ${origin}`));
