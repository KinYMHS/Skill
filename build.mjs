import {mkdir, readFile, writeFile} from "node:fs/promises";

const files = ["index.html", "style.css", "app.js", "skills.json"];
const [index, css, script, dataText, worker, manifest] = await Promise.all(
  [...files, "worker/index.js", ".openai/hosting.json"]
    .map(path => readFile(new URL(path, import.meta.url), "utf8"))
);
const data = JSON.parse(dataText.replace(/^\uFEFF/, ""));
const staticScript = script.replace("const byId = id => document.getElementById(id);", "const byId = id => document.getElementById(id);\nwindow.SKILL_STATIC = true;");
const staticIndex = index.replace('href="./style.css"', 'href="./style.css"').replace('src="./app.js"', 'src="./app.js"');
const assets = {"/": staticIndex, "/index.html": staticIndex, "/style.css": css, "/app.js": script};
const bundle = `const assets = ${JSON.stringify(assets)};\nconst seed = ${JSON.stringify(data)};\n${worker}`;
await Promise.all(["dist/server/", "dist/.openai/", "dist/pages/"].map(path => mkdir(new URL(path, import.meta.url), {recursive:true})));
await Promise.all([
  writeFile(new URL("dist/server/index.js", import.meta.url), bundle),
  writeFile(new URL("dist/.openai/hosting.json", import.meta.url), manifest),
  writeFile(new URL("dist/pages/index.html", import.meta.url), staticIndex),
  writeFile(new URL("dist/pages/app.js", import.meta.url), staticScript),
  writeFile(new URL("dist/pages/style.css", import.meta.url), css),
  writeFile(new URL("dist/pages/skills.json", import.meta.url), dataText),
  writeFile(new URL("dist/pages/.nojekyll", import.meta.url), ""),
]);
