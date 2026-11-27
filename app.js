const byId = id => document.getElementById(id);
const query = byId("query");
const categoryList = byId("categories");
const cards = byId("cards");
const pages = byId("pages");
const editor = byId("editor");
const form = byId("editor-form");
const manage = byId("manage");
const add = byId("add");
const save = byId("save");
const pageSize = 12;
const categoryDesign = [
  ["▤", "#e5f2e7", "#24573e"],
  ["▷", "#f1eafa", "#634487"],
  ["⌘", "#e4f1fa", "#235f7d"],
  ["⌁", "#e8eee5", "#426643"],
  ["◫", "#f4efe1", "#7e5a23"],
  ["◈", "#f9e9e5", "#87483a"],
  ["✧", "#e6eaf9", "#465a93"],
];
let categories = [];
let skills = [];
let currentCategory = "";
let currentPage = 1;
let editing = null;
let managing = false;
let ready = false;
let saving = false;
let restoreFocus = null;
let toastTimer;
const staticSite = document.documentElement.dataset.catalogMode === "static" ||
  window.location.hostname.endsWith("github.io");

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function button(label, className, action) {
  const node = element("button", className, label);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

async function request(path, options) {
  const response = await fetch(new URL(path, document.baseURI), options);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || "目前無法連線，請稍後再試。");
  return data;
}

async function loadSkills() {
  manage.disabled = true;
  byId("load-error").hidden = true;
  try {
    const data = staticSite
      ? await (await fetch(new URL("./skills.json", document.baseURI))).json()
      : await request("api/skills");
    categories = data.categories;
    skills = data.skills;
    ready = true;
    manage.disabled = false;
    if (staticSite) {
      manage.hidden = true;
      byId("add").hidden = true;
      byId("editor").remove();
      byId("footer-source")?.setAttribute("hidden", "");
      const status = element("span", "read-only-note", "唯讀目錄 · 更新條目請使用 Sites 版本");
      byId("count").parentElement.append(status);
    }
    render();
  } catch (error) {
    const notice = byId("load-error");
    notice.replaceChildren(document.createTextNode(error.message), button("重新載入", "button outline", loadSkills));
    notice.hidden = false;
    byId("count").textContent = "條目載入失敗";
  }
}

function normalize(value) {
  return value.normalize("NFKC").toLocaleLowerCase("zh-Hant");
}

function shortCategory(category) {
  return category.replace("介面風格｜", "");
}

function renderCategories() {
  const focusedCategory = categoryList.contains(document.activeElement) ? document.activeElement.dataset.category : null;
  categoryList.replaceChildren();
  ["", ...categories].forEach((category, index) => {
    const count = category ? skills.filter(skill => skill.category === category).length : skills.length;
    const option = button("", "category", () => {
      currentCategory = category;
      currentPage = 1;
      render();
    });
    option.dataset.category = category;
    option.setAttribute("aria-pressed", String(currentCategory === category));
    const symbol = element("span", "category-symbol", index ? categoryDesign[index - 1][0] : "▦");
    symbol.setAttribute("aria-hidden", "true");
    option.append(symbol, element("span", "", category ? shortCategory(category) : "所有 Skill"), element("span", "category-count", count));
    categoryList.append(option);
    if (focusedCategory === category) option.focus({preventScroll:true});
  });
}

function render() {
  if (!ready) return;
  renderCategories();
  const terms = normalize(query.value).trim().split(/\s+/u).filter(Boolean);
  const matches = skills.filter(skill => {
    if (currentCategory && skill.category !== currentCategory) return false;
    const content = normalize([skill.name, skill.category, skill.usage, skill.example].join(" "));
    return terms.every(term => content.includes(term));
  });
  const lastPage = Math.max(1, Math.ceil(matches.length / pageSize));
  currentPage = Math.min(currentPage, lastPage);
  const start = (currentPage - 1) * pageSize;
  byId("results-title").textContent = currentCategory || (terms.length ? "搜尋結果" : "所有 Skill");
  byId("count").textContent = matches.length ? `共 ${matches.length} 筆 · 顯示 ${start + 1}–${Math.min(start + pageSize, matches.length)}` : "共 0 筆";
  byId("empty").hidden = matches.length > 0;
  add.hidden = !managing;
  cards.replaceChildren(...matches.slice(start, start + pageSize).map(renderCard));
  renderPages(lastPage);
}

function renderCard(skill) {
  const card = element("article", "card");
  const [mark, tone, ink] = categoryDesign[categories.indexOf(skill.category)] || categoryDesign[0];
  const category = element("div", "card-top");
  const icon = element("span", "card-symbol", mark);
  icon.setAttribute("aria-hidden", "true");
  icon.style.setProperty("--tone", tone);
  icon.style.setProperty("--tone-ink", ink);
  category.append(icon, element("span", "chip", shortCategory(skill.category)));
  const usage = element("p", "usage", skill.usage);
  const example = element("div", "example");
  const code = element("code", "", skill.example);
  example.append(element("span", "example-label", "使用範例"), code);
  const actions = element("div", "card-actions");
  const copy = button("", "text-button", () => copyExample(skill.example, code, copy));
  const copyIcon = element("span", "copy-icon");
  copyIcon.setAttribute("aria-hidden", "true");
  copy.append(copyIcon, element("span", "", "複製範例"));
  copy.setAttribute("aria-label", `複製 ${skill.name} 的範例`);
  actions.append(copy);
  if (managing) {
    const edit = button("編輯", "text-button", () => openEditor(skill));
    edit.setAttribute("aria-label", `編輯 ${skill.name}`);
    actions.append(edit);
  }
  card.append(category, element("h3", "", skill.name), usage, example, actions);
  return card;
}

function renderPages(lastPage) {
  pages.hidden = lastPage < 2;
  if (pages.hidden) return;
  const move = page => {
    currentPage = page;
    render();
    byId("results-title").focus({preventScroll:true});
    byId("results-title").scrollIntoView({block:"start"});
  };
  const previous = button("上一頁", "button outline", () => move(currentPage - 1));
  const next = button("下一頁", "button outline", () => move(currentPage + 1));
  previous.disabled = currentPage === 1;
  next.disabled = currentPage === lastPage;
  pages.replaceChildren(previous, element("span", "", `第 ${currentPage} / ${lastPage} 頁`), next);
}

function notify(message) {
  const toast = byId("toast");
  clearTimeout(toastTimer);
  toast.hidden = false;
  toast.textContent = message;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2800);
}

async function copyExample(value, code, control) {
  try {
    await navigator.clipboard.writeText(value);
    notify("已複製使用範例");
    const label = control.lastElementChild;
    label.textContent = "已複製";
    setTimeout(() => { label.textContent = "複製範例"; }, 1400);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
    notify("已選取範例，請使用複製快捷鍵");
  }
}

function openEditor(skill) {
  restoreFocus = document.activeElement;
  editing = skill;
  form.reset();
  byId("dialog-title").textContent = skill ? "編輯 Skill" : "新增 Skill";
  byId("category").replaceChildren(...categories.map(category => new Option(category, category)));
  byId("name").value = skill?.name || "";
  byId("name").readOnly = Boolean(skill);
  byId("name-hint").hidden = Boolean(skill);
  byId("category").value = skill?.category || currentCategory || categories[0];
  byId("usage").value = skill?.usage || "";
  byId("example").value = skill?.example || "";
  byId("form-error").hidden = true;
  editor.showModal();
  byId(skill ? "usage" : "name").focus();
}

async function saveSkill(event) {
  event.preventDefault();
  if (saving) return;
  const details = Object.fromEntries(new FormData(form));
  details.name = details.name.trim();
  details.usage = details.usage.trim();
  details.example = details.example.trim();
  const errorMessage = byId("form-error");
  errorMessage.hidden = true;
  if (staticSite) {
    errorMessage.textContent = "GitHub Pages 只提供瀏覽。請使用 Sites 版本更新 Skill。";
    errorMessage.hidden = false;
    return;
  }
  saving = true;
  save.disabled = true;
  save.textContent = "儲存中…";
  try {
    const result = await request("api/skills", {
      method: editing ? "PUT" : "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({...details, version: editing?.version}),
    });
    query.value = result.skill.name;
    currentCategory = "";
    currentPage = 1;
    const position = skills.findIndex(skill => skill.name === result.skill.name);
    if (position < 0) skills = [result.skill, ...skills];
    else skills[position] = result.skill;
    editor.close();
    render();
    query.focus({preventScroll:true});
    notify(editing ? "已更新條目" : "已新增條目");
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
  } finally {
    saving = false;
    save.disabled = false;
    save.textContent = "儲存條目";
  }
}

function closeEditor() { if (!saving) editor.close(); }
byId("results-title").tabIndex = -1;
byId("close").addEventListener("click", closeEditor);
byId("cancel").addEventListener("click", closeEditor);
editor.addEventListener("cancel", event => { if (saving) event.preventDefault(); });
editor.addEventListener("close", () => {
  if (restoreFocus?.isConnected) restoreFocus.focus({preventScroll:true});
  restoreFocus = null;
});
form.addEventListener("submit", saveSkill);
add.addEventListener("click", () => openEditor(null));
query.addEventListener("input", () => {
  currentPage = 1;
  render();
});
manage.addEventListener("click", () => {
  managing = !managing;
  manage.setAttribute("aria-pressed", String(managing));
  manage.lastElementChild.textContent = managing ? "結束管理" : "管理條目";
  render();
});
byId("reset").addEventListener("click", () => {
  query.value = "";
  currentCategory = "";
  currentPage = 1;
  render();
  query.focus();
});
document.addEventListener("keydown", event => {
  if (event.key === "/" && !event.altKey && !event.ctrlKey && !event.metaKey && !editor.open &&
      !event.target.closest?.("input,textarea,select,[contenteditable]")) {
    event.preventDefault();
    query.focus();
  }
});
loadSkills();
