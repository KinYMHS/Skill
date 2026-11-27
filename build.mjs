import {mkdir, readFile, writeFile} from "node:fs/promises";

const files = ["index.html", "style.css", "app.js", "skills.json"];
const [index, css, script, dataText, worker, manifest] = await Promise.all(
  [...files, "worker/index.js", ".openai/hosting.json"]
    .map(path => readFile(new URL(path, import.meta.url), "utf8"))
);
const data = JSON.parse(dataText.replace(/^\uFEFF/, ""));
const assets = {"/": index, "/style.css": css, "/app.js": script};
const bundle = `const assets = ${JSON.stringify(assets)};\nconst seed = ${JSON.stringify(data)};\n${worker}`;
await Promise.all(["dist/server/", "dist/.openai/"].map(path => mkdir(new URL(path, import.meta.url), {recursive:true})));
await Promise.all([
  writeFile(new URL("dist/server/index.js", import.meta.url), bundle),
  writeFile(new URL("dist/.openai/hosting.json", import.meta.url), manifest),
]);
