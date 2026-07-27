/* ================================================================
   CONTENT LIBRARY (CMS) — one place for every asset: courses,
   videos, infographics, banners. Assets are mostly LINKS (Canva,
   YouTube, Vimeo) with optional file upload for local Adobe exports.
   The library is stored as JSON in one managed Asana task,
   ⚙️ content-library, like the events data and campaign smart plans.
   Each asset can be linked to a campaign, event and/or shoot, and
   tagged + moved through a draft→published status — so it doubles as
   the reuse finder for planning shoots, messages and courses.
   ================================================================ */

const CONTENT_DATA_NAME = "⚙️ content-library (managed by app)";
const CONTENT_TYPES = [
  { key: "video", label: "Video", icon: "🎬" },
  { key: "infographic", label: "Infographic", icon: "📊" },
  { key: "banner", label: "Banner", icon: "🖼️" },
  { key: "course", label: "Course", icon: "🎓" },
  { key: "other", label: "Other", icon: "📄" }
];
const CONTENT_STATUSES = [
  { key: "idea", label: "Idea" },
  { key: "draft", label: "Draft" },
  { key: "review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Published" }
];
const CONTENT_ROLES = ["FOH", "BOH", "Sushi", "Mgmt", "Bar/Deli"];

function contentTypeMeta(k){ return CONTENT_TYPES.find(t => t.key === k) || CONTENT_TYPES[CONTENT_TYPES.length - 1]; }
function contentStatusMeta(k){ return CONTENT_STATUSES.find(s => s.key === k) || CONTENT_STATUSES[0]; }
function contentUid(){ return "c" + Math.random().toString(36).slice(2, 9); }

/* ---- URL helpers (auto-detect type + thumbnail) ---- */
function youtubeId(url){
  const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}
function detectContentType(url){
  const u = String(url || "").toLowerCase();
  if(youtubeId(u) || u.includes("vimeo.com")) return "video";
  if(u.includes("canva.")) return "banner";
  return "other";
}
function contentThumb(item){
  const yt = youtubeId(item.url);
  if(yt) return '<img src="https://img.youtube.com/vi/' + esc(yt) + '/hqdefault.jpg" alt="" loading="lazy">';
  if(item.thumb) return '<img src="' + esc(item.thumb) + '" alt="" loading="lazy">';
  return '<span class="cl-thumb-icon">' + contentTypeMeta(item.type).icon + '</span>';
}

/* ---- load & save the managed content-library task ---- */
function readContentLibrary(){
  const task = state.tasks.find(t => t.isContentLibrary);
  state.contentLibraryTask = task ? task.gid : state.contentLibraryTask;
  let parsed = {};
  if(task){ try{ parsed = JSON.parse(task.notes || "{}") || {}; }catch(_){ parsed = {}; } }
  const map = (parsed && parsed.items && typeof parsed.items === "object") ? parsed.items : {};
  const clean = {};
  Object.keys(map).forEach(id => {
    const i = map[id] && typeof map[id] === "object" ? map[id] : {};
    clean[id] = {
      id: String(i.id || id), title: String(i.title || "Untitled"),
      type: i.type || "other", url: i.url || "", thumb: i.thumb || "",
      attachmentGid: i.attachmentGid || null,
      tags: Array.isArray(i.tags) ? i.tags : [], roles: Array.isArray(i.roles) ? i.roles : [],
      status: i.status || "idea", owner: i.owner || "",
      links: (i.links && typeof i.links === "object") ? i.links : {},
      notes: i.notes || "", addedAt: i.addedAt || new Date().toISOString()
    };
  });
  state.contentLibrary = clean;
}
let contentSaveTimer = null, contentSaving = false, contentDirty = false;
function saveContentLibrary(){
  contentDirty = true;
  clearTimeout(contentSaveTimer);
  contentSaveTimer = setTimeout(flushContentLibrary, 200);
}
async function flushContentLibrary(){
  if(DEMO || contentSaving || !contentDirty) return;
  contentSaving = true; contentDirty = false;
  try{
    const notes = JSON.stringify({ version: 1, items: state.contentLibrary });
    const r = await call("save_campaign_state", {
      task_id: state.contentLibraryTask || undefined,
      project_id: CC_PROJECT, section_id: SEC_PLAN,
      name: CONTENT_DATA_NAME, notes
    });
    if(r && r.data && r.data.gid) state.contentLibraryTask = r.data.gid;
  }catch(e){
    contentDirty = true;
    toast("Saved here; content library will sync to Asana shortly");
    setTimeout(flushContentLibrary, 4000);
  }finally{
    contentSaving = false;
    if(contentDirty){ clearTimeout(contentSaveTimer); contentSaveTimer = setTimeout(flushContentLibrary, 400); }
  }
}

/* ---- queries ---- */
function contentItems(){
  return Object.values(state.contentLibrary || {}).sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
}
function contentTagPool(){
  const s = new Set();
  contentItems().forEach(i => (i.tags || []).forEach(t => s.add(t)));
  return [...s].sort((a, b) => a.localeCompare(b));
}
// Reuse finder: items matching any of the given free-text terms/tags.
function matchingContent(terms){
  const words = (Array.isArray(terms) ? terms : String(terms || "").split(/\s+/)).map(w => String(w).toLowerCase()).filter(w => w.length > 2);
  if(!words.length) return [];
  return contentItems().filter(i => {
    const hay = [i.title, i.notes, (i.tags || []).join(" "), contentTypeMeta(i.type).label].join(" ").toLowerCase();
    return words.some(w => hay.includes(w));
  });
}
function contentForLink(kind, gid){
  return contentItems().filter(i => i.links && String(i.links[kind]) === String(gid));
}

/* ---- render ---- */
function renderContentTab(){
  const box = document.getElementById("contentBody");
  if(!box) return;
  const f = state.contentFilter || (state.contentFilter = { type: "", status: "", q: "" });
  let items = contentItems();
  if(f.type) items = items.filter(i => i.type === f.type);
  if(f.status) items = items.filter(i => i.status === f.status);
  if(f.q){ const q = f.q.toLowerCase(); items = items.filter(i => [i.title, i.notes, (i.tags || []).join(" ")].join(" ").toLowerCase().includes(q)); }

  const typeChips = '<button class="cl-chip' + (!f.type ? ' on' : '') + '" data-cl-type="">All types</button>' +
    CONTENT_TYPES.map(t => '<button class="cl-chip' + (f.type === t.key ? ' on' : '') + '" data-cl-type="' + t.key + '">' + t.icon + ' ' + t.label + '</button>').join("");
  const statusChips = '<button class="cl-chip' + (!f.status ? ' on' : '') + '" data-cl-status="">Any status</button>' +
    CONTENT_STATUSES.map(s => '<button class="cl-chip' + (f.status === s.key ? ' on' : '') + '" data-cl-status="' + s.key + '">' + s.label + '</button>').join("");

  const gallery = items.length ? '<div class="cl-grid">' + items.map(contentCardHTML).join("") + '</div>'
    : '<div class="empty">' + (contentItems().length ? "No assets match these filters." : "No content yet. Add a Canva / YouTube / Vimeo link or upload a file to start your library.") + '</div>';

  box.innerHTML =
    '<div class="cl-toolbar">' +
      '<input id="clSearch" class="cl-search" placeholder="Search title, tag or note…" value="' + esc(f.q || "") + '">' +
      '<button class="btn primary sm" id="clNew">+ Add content</button>' +
    '</div>' +
    '<div class="cl-filters">' + typeChips + '</div>' +
    '<div class="cl-filters">' + statusChips + '</div>' +
    gallery;

  document.querySelectorAll("[data-cl-type]").forEach(b => b.onclick = () => { f.type = b.dataset.clType; renderContentTab(); });
  document.querySelectorAll("[data-cl-status]").forEach(b => b.onclick = () => { f.status = b.dataset.clStatus; renderContentTab(); });
  const search = document.getElementById("clSearch");
  if(search) search.oninput = e => { f.q = e.target.value; clearTimeout(search._t); search._t = setTimeout(renderContentTab, 180); };
  const nb = document.getElementById("clNew");
  if(nb) nb.onclick = () => openContentEditor(null);
  box.querySelectorAll("[data-cl-open]").forEach(b => b.onclick = () => {
    const item = state.contentLibrary[b.dataset.clOpen];
    if(item && item.url) window.open(item.url, "_blank", "noopener");
  });
  box.querySelectorAll("[data-cl-edit]").forEach(b => b.onclick = e => { e.stopPropagation(); openContentEditor(b.dataset.clEdit); });
}
function contentCardHTML(item){
  const t = contentTypeMeta(item.type), s = contentStatusMeta(item.status);
  const links = [];
  if(item.links){
    if(item.links.campaign){ const c = (cfg.campaigns || []).find(x => String(x.gid) === String(item.links.campaign)); if(c) links.push("📣 " + c.name); }
    if(item.links.event){ const e = findTask(item.links.event); if(e) links.push("🎤 " + e.name); }
    if(item.links.shoot){ const sh = findTask(item.links.shoot); if(sh) links.push("🎬 " + sh.name); }
  }
  return '<article class="cl-card">' +
    '<div class="cl-thumb" data-cl-open="' + esc(item.id) + '" role="button" title="Open the asset">' + contentThumb(item) +
      '<span class="cl-type-chip">' + t.icon + ' ' + t.label + '</span></div>' +
    '<div class="cl-body">' +
      '<div class="cl-title">' + esc(item.title) + '</div>' +
      '<div class="cl-meta"><span class="cl-status ' + item.status + '">' + s.label + '</span>' + (item.owner ? '<span class="cl-owner">' + esc(item.owner) + '</span>' : '') + '</div>' +
      (item.tags && item.tags.length ? '<div class="cl-tags">' + item.tags.map(x => '<span>' + esc(x) + '</span>').join("") + '</div>' : '') +
      (links.length ? '<div class="cl-links">' + links.map(esc).join(" · ") + '</div>' : '') +
    '</div>' +
    '<div class="cl-card-actions">' +
      (item.url ? '<button class="btn ghost sm" data-cl-open="' + esc(item.id) + '">Open ↗</button>' : '') +
      '<button class="btn ghost sm" data-cl-edit="' + esc(item.id) + '">Edit</button>' +
    '</div>' +
  '</article>';
}

/* ---- add / edit editor (modal) ---- */
function openContentEditor(id){
  const item = id && state.contentLibrary[id] ? state.contentLibrary[id] : null;
  const draft = item ? JSON.parse(JSON.stringify(item)) : {
    id: contentUid(), title: "", type: "other", url: "", thumb: "", attachmentGid: null,
    tags: [], roles: [], status: "idea", owner: "", links: {}, notes: "", addedAt: new Date().toISOString()
  };
  const campaignOpts = '<option value="">—</option>' + (cfg.campaigns || []).map(c => '<option value="' + esc(String(c.gid)) + '"' + (String(draft.links.campaign) === String(c.gid) ? ' selected' : '') + '>' + esc(c.name) + '</option>').join("");
  const eventOpts = '<option value="">—</option>' + (typeof eventTasks === "function" ? eventTasks() : []).map(e => '<option value="' + esc(String(e.gid)) + '"' + (String(draft.links.event) === String(e.gid) ? ' selected' : '') + '>' + esc(e.name) + '</option>').join("");
  const shoots = state.tasks.filter(t => t.isShoot).sort((a, b) => (b.due || "").localeCompare(a.due || ""));
  const shootOpts = '<option value="">—</option>' + shoots.map(sh => '<option value="' + esc(String(sh.gid)) + '"' + (String(draft.links.shoot) === String(sh.gid) ? ' selected' : '') + '>' + esc(sh.name) + '</option>').join("");

  showModal('<div class="cl-editor"><h2>' + (item ? "Edit content" : "Add content") + '</h2>' +
    '<div class="cl-ed-grid">' +
      '<label class="cl-full"><span>Title</span><input id="clTitle" value="' + esc(draft.title) + '" placeholder="e.g. Sushi rolling — 60s how-to"></label>' +
      '<label class="cl-full"><span>Link (Canva / YouTube / Vimeo)</span><input id="clUrl" value="' + esc(draft.url) + '" placeholder="Paste a link, or upload a file below"></label>' +
      '<label class="cl-full cl-upload-row"><span>Or upload a file <small>(local Adobe export, ≤8 MB)</small></span><input type="file" id="clFile"><span id="clUploadState"></span></label>' +
      '<label><span>Type</span><select id="clType">' + CONTENT_TYPES.map(t => '<option value="' + t.key + '"' + (draft.type === t.key ? ' selected' : '') + '>' + t.icon + ' ' + t.label + '</option>').join("") + '</select></label>' +
      '<label><span>Status</span><select id="clStatus">' + CONTENT_STATUSES.map(s => '<option value="' + s.key + '"' + (draft.status === s.key ? ' selected' : '') + '>' + s.label + '</option>').join("") + '</select></label>' +
      '<label><span>Owner</span><input id="clOwner" value="' + esc(draft.owner) + '" placeholder="Who owns it"></label>' +
      '<label><span>Tags <small>(comma-separated)</small></span><input id="clTags" value="' + esc((draft.tags || []).join(", ")) + '" placeholder="summer menu, sushi, july"></label>' +
      '<label><span>Link to campaign</span><select id="clLinkCampaign">' + campaignOpts + '</select></label>' +
      '<label><span>Link to event</span><select id="clLinkEvent">' + eventOpts + '</select></label>' +
      '<label><span>Link to shoot</span><select id="clLinkShoot">' + shootOpts + '</select></label>' +
      '<label class="cl-full"><span>Notes</span><textarea id="clNotes" placeholder="Anything useful about this asset">' + esc(draft.notes || "") + '</textarea></label>' +
    '</div>' +
    '<div class="cl-ed-actions">' + (item ? '<button class="btn ghost danger" id="clDelete">Delete</button>' : '<span></span>') +
      '<div><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="clSave">Save</button></div></div></div>');
  wireModalClose();

  // Auto-fill type from a pasted link.
  const urlEl = document.getElementById("clUrl");
  urlEl.onchange = () => { const d = detectContentType(urlEl.value); if(d !== "other") document.getElementById("clType").value = d; };

  // File upload → attach to the managed library task, store the reference.
  document.getElementById("clFile").onchange = async e => {
    const file = e.target.files && e.target.files[0]; if(!file) return;
    if(file.size > 8 * 1024 * 1024){ toast("File must be under 8 MB — for big video use a YouTube/Vimeo link"); e.target.value = ""; return; }
    const stEl = document.getElementById("clUploadState"); stEl.textContent = "Uploading…";
    try{
      if(!DEMO){
        if(!state.contentLibraryTask) await flushContentLibrary(); // ensure a parent task exists
        const data_base64 = await fileToBase64(file);
        const r = await call("upload_attachment", { parent_id: state.contentLibraryTask, filename: file.name, mime: file.type || "application/octet-stream", data_base64 });
        const att = r.data || {};
        draft.attachmentGid = att.gid || null;
        draft.url = att.view_url || att.download_url || draft.url;
        if(/^image\//.test(file.type)) draft.thumb = att.view_url || att.download_url || "";
      }
      if(!document.getElementById("clTitle").value.trim()) document.getElementById("clTitle").value = file.name.replace(/\.[^.]+$/, "");
      document.getElementById("clUrl").value = draft.url || "";
      stEl.textContent = "✓ " + file.name;
    }catch(err){ stEl.textContent = ""; toast("Upload failed: " + err.message); }
  };

  document.getElementById("clSave").onclick = () => {
    const title = document.getElementById("clTitle").value.trim();
    if(!title){ toast("Give the content a title"); return; }
    draft.title = title;
    draft.url = document.getElementById("clUrl").value.trim();
    draft.type = document.getElementById("clType").value;
    draft.status = document.getElementById("clStatus").value;
    draft.owner = document.getElementById("clOwner").value.trim();
    draft.tags = document.getElementById("clTags").value.split(",").map(s => s.trim()).filter(Boolean);
    draft.links = {
      campaign: document.getElementById("clLinkCampaign").value || null,
      event: document.getElementById("clLinkEvent").value || null,
      shoot: document.getElementById("clLinkShoot").value || null
    };
    draft.notes = document.getElementById("clNotes").value;
    state.contentLibrary[draft.id] = draft;
    saveContentLibrary();
    closeModal(); renderContentTab();
    toast(item ? "Content updated" : "Content added");
  };
  const del = document.getElementById("clDelete");
  if(del) del.onclick = () => {
    if(!confirm("Remove this asset from the library? (The file/link itself is not deleted.)")) return;
    delete state.contentLibrary[draft.id];
    saveContentLibrary();
    closeModal(); renderContentTab();
    toast("Removed from library");
  };
}
