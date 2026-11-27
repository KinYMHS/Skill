const initialSkills = new Map(seed.skills.map(skill => [skill.name, {...skill, version:0}]));
const assetTypes = {"/":"text/html", "/style.css":"text/css", "/app.js":"text/javascript"};
const privateHeaders = {"Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"};

function error(message, status) {
  return Response.json({error:message}, {status, headers:privateHeaders});
}

function json(data, status = 200) {
  return Response.json(data, {status, headers:privateHeaders});
}

async function readSkills(db) {
  const {results} = await db.prepare("SELECT name, category, usage, example, version FROM skill_updates ORDER BY rowid DESC").all();
  const overrides = new Map(results.map(skill => [skill.name, skill]));
  const added = results.filter(skill => !initialSkills.has(skill.name));
  return json({
    categories:seed.categories,
    skills:[...added, ...Array.from(initialSkills.values(), skill => overrides.get(skill.name) ?? skill)],
  });
}

async function saveSkill(request, db, isEdit) {
  const origin = request.headers.get("Origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") {
    return error("請從本站送出更新。", 403);
  }
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) return error("應以 JSON 傳送資料。", 415);
  if (Number(request.headers.get("Content-Length")) > 30000) return error("條目內容過長。", 413);
  const body = await request.text();
  if (body.length > 30000) return error("條目內容過長。", 413);
  let value;
  try { value = JSON.parse(body); } catch { return error("資料格式有誤。", 400); }
  const {name, category, usage, example, version} = value ?? {};
  if (typeof name !== "string" || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    return error("Skill 名稱須為小寫英文字母、數字及連字號。", 400);
  }
  if (!seed.categories.includes(category)) return error("請選擇有效分類。", 400);
  if ([usage, example].some(text => typeof text !== "string" || !text.trim() || text.length > 2000)) {
    return error("請填寫用途與範例，各欄最多 2,000 字。", 400);
  }
  const cleanUsage = usage.trim();
  const cleanExample = example.trim();
  let result;
  if (!isEdit || version === 0) {
    if (isEdit !== initialSkills.has(name)) return error(isEdit ? "找不到這個 Skill。" : "此 Skill 名稱已存在。", isEdit ? 404 : 409);
    result = await db.prepare(
      "INSERT INTO skill_updates (name, category, usage, example, version) VALUES (?, ?, ?, ?, 1) ON CONFLICT(name) DO NOTHING"
    ).bind(name, category, cleanUsage, cleanExample).run();
  } else {
    if (!Number.isSafeInteger(version) || version < 1) return error("版本資料有誤，請重新整理後再編輯。", 400);
    result = await db.prepare(
      "UPDATE skill_updates SET category = ?, usage = ?, example = ?, version = version + 1 WHERE name = ? AND version = ?"
    ).bind(category, cleanUsage, cleanExample, name, version).run();
  }
  if (!result.meta.changes) return error(isEdit ? "這個條目已被更新。請先複製你的修改，再重新整理頁面。" : "此 Skill 名稱已存在。", 409);
  return json({skill:{name, category, usage:cleanUsage, example:cleanExample, version:isEdit ? version + 1 : 1}}, isEdit ? 200 : 201);
}

export default {
  async fetch(request, env) {
    const {pathname} = new URL(request.url);
    if (pathname === "/api/skills") {
      if (!request.headers.get("oai-authenticated-user-id")) return error("請登入後再使用 Skill 查詢手冊。", 401);
      try {
        if (request.method === "GET") return await readSkills(env.DB);
        if (request.method === "POST" || request.method === "PUT") return await saveSkill(request, env.DB, request.method === "PUT");
        return error("此操作不受支援。", 405);
      } catch (failure) {
        console.error("Skill catalogue storage request failed", failure?.message);
        return error("目前無法存取目錄，請稍後再試。", 503);
      }
    }
    if ((request.method === "GET" || request.method === "HEAD") && Object.hasOwn(assets, pathname)) {
      return new Response(request.method === "HEAD" ? null : assets[pathname], {
        headers:{
          ...privateHeaders,
          "Content-Type":`${assetTypes[pathname]}; charset=utf-8`,
          "Content-Security-Policy":"default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'self'",
          "Referrer-Policy":"strict-origin-when-cross-origin",
        },
      });
    }
    return new Response("找不到頁面", {status:404, headers:{"Content-Type":"text/plain; charset=utf-8"}});
  },
};
