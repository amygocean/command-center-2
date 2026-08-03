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

/* ================================================================
   CONTENT HUB — the read-only front door to published content.
   Reads every project in the Content Hub portfolio + the Academy
   Courses project (via the server), and shows them alongside items
   added from the app, as one searchable library. Edit/source links
   are only returned by the server for Amy & Jess.
   ================================================================ */
const LIB_TYPES = ["Courses","Videos","Visuals","Recipes & Job aids","Launch","Templates","Other"];
function ensureHubState(){
  if(!state.contentHub) state.contentHub = { records:[], editor:false, loadedAt:0, loading:false, error:null };
  if(!state.contentSel) state.contentSel = null;
  if(!state.contentFilter) state.contentFilter = { type:"", role:"", programme:"", q:"", view:"all" };
  return state.contentHub;
}
async function loadContentHub(force){
  const hub = ensureHubState();
  if(hub.loading) return;
  if(!force && hub.loadedAt && Date.now()-hub.loadedAt < 5*60*1000) return;
  hub.loading = true; hub.error = null; renderContentTab();
  try{
    const res = await call("get_content_library", { portfolio_gid: CONTENT_HUB_PORTFOLIO, courses_project_gid: ACADEMY_COURSES_PROJECT });
    hub.records = Array.isArray(res.data) ? res.data : [];
    hub.editor = !!res.editor;
    hub.warning = res.warning || null;
    hub.loadedAt = Date.now();
  }catch(e){ hub.error = e.message || "Couldn't load the Content Hub"; }
  finally{ hub.loading = false; renderContentTab(); }
}
/* ---- field derivation (custom fields → a usable record) ---- */
function libIsUrl(v){ return /^https?:\/\//i.test(String(v||"")); }
function libField(fields, re){ const k = Object.keys(fields||{}).find(n=>re.test(n)); return k ? fields[k] : ""; }
function libPublished(rec){
  const f = rec.fields||{};
  const pref = Object.keys(f).find(n=>/publish|view|^link$|url|articulate|rise|watch|resource|hosted/i.test(n) && libIsUrl(f[n]));
  if(pref) return f[pref];
  const any = Object.keys(f).find(n=>libIsUrl(f[n]));
  if(any) return f[any];
  const m = String(rec.notes||"").match(/https?:\/\/\S+/); return m ? m[0] : "";
}
function libEdit(rec){ const f = rec.fields||{}; const k = Object.keys(f).find(n=>/edit|source|master/i.test(n) && libIsUrl(f[n])); return k ? f[k] : ""; }
function libTypeFrom(v){
  v = String(v||"").toLowerCase();
  if(/course|rise|articulate/.test(v)) return "Courses";
  if(/video|reel|clip|masterclass recording/.test(v)) return "Videos";
  if(/recipe|sop|job aid|cheat/.test(v)) return "Recipes & Job aids";
  if(/template/.test(v)) return "Templates";
  if(/banner|tile|infographic|visual|image|canva|poster/.test(v)) return "Visuals";
  if(/launch|lto/.test(v)) return "Launch";
  return null;
}
function libType(rec){
  if(rec.source==="courses") return "Courses";
  // The explicit Content-type field wins; only fall back to section/name.
  return libTypeFrom(libField(rec.fields,/content type|^type$|format|category/i))
    || libTypeFrom((rec.section||"")+" "+((rec.project||{}).name||"")+" "+rec.name)
    || "Other";
}
function libStatus(rec){ return libField(rec.fields,/status/i) || (rec.completed?"Complete":""); }
function libArchived(rec){ return /remove|archive|retire/i.test(libStatus(rec)); }
function libRole(rec){ return libField(rec.fields,/role|audience/i); }
function libProgramme(rec){ return libField(rec.fields,/programme|program|pathway|content set|campaign/i); }
function libNeeds(rec){ return !libPublished(rec) || /progress|to ?do|wip/i.test(libStatus(rec)); }
function libRecords(){
  const hub = ensureHubState();
  const asana = (hub.records||[]).map(r=>({
    id:r.gid, kind:"asana", name:r.name, notes:r.notes, asana:r.url, source:r.source,
    collection:(r.project||{}).name||null, section:r.section, moduleCount:r.moduleCount||0, owner:r.owner, fields:r.fields||{},
    updated:r.modifiedAt, type:libType(r), role:libRole(r), programme:libProgramme(r), status:libStatus(r),
    published:libPublished(r), edit:libEdit(r), archived:libArchived(r), needs:libNeeds(r)
  }));
  const local = contentItems().map(i=>({
    id:i.id, kind:"local", name:i.title, notes:i.notes, asana:null, source:"local",
    collection:"Added in the app", section:null, moduleCount:0, owner:i.owner, fields:{},
    updated:i.addedAt, type:contentTypeMeta(i.type).label==="Course"?"Courses":(contentTypeMeta(i.type).label==="Video"?"Videos":(contentTypeMeta(i.type).label==="Banner"||contentTypeMeta(i.type).label==="Infographic"?"Visuals":"Other")),
    role:(i.roles||[]).join(", "), programme:"", status:contentStatusMeta(i.status).label, published:i.url, edit:"", archived:false, needs:!i.url
  }));
  const seed = typeof academyVideoRecords==="function" ? academyVideoRecords() : [];
  return [...asana, ...seed, ...local];
}
function libFacetValues(recs, key){ return [...new Set(recs.map(r=>r[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b)); }

/* ---- render: the Content Hub ---- */
function renderContentTab(){
  const box = document.getElementById("contentBody");
  if(!box) return;
  const hub = ensureHubState(), f = state.contentFilter;
  if(!hub.loadedAt && !hub.loading && !hub.error) { loadContentHub(); return; } // first paint kicks off the load
  const all = libRecords();
  let recs = f.view==="archived" ? all.filter(r=>r.archived) : all.filter(r=>!r.archived);
  if(f.view==="needs") recs = recs.filter(r=>r.needs);
  const facetRoles = libFacetValues(recs,"role"), facetProgs = libFacetValues(recs,"programme");
  if(f.type) recs = recs.filter(r=>r.type===f.type);
  if(f.role) recs = recs.filter(r=>r.role===f.role);
  if(f.programme) recs = recs.filter(r=>r.programme===f.programme);
  if(f.q){ const q=f.q.toLowerCase(); recs = recs.filter(r=>[r.name,r.notes,r.role,r.programme,r.type,r.collection,r.owner].filter(Boolean).join(" ").toLowerCase().includes(q)); }
  recs.sort((a,b)=>(b.updated||"").localeCompare(a.updated||""));
  const sel = recs.find(r=>String(r.id)===String(state.contentSel)) || recs[0] || null;
  state.contentSel = sel ? sel.id : null;

  const typeChips = '<button class="lib-chip'+(!f.type?' on':'')+'" data-lib-type="">All</button>'+
    LIB_TYPES.filter(t=>all.some(r=>r.type===t)).map(t=>'<button class="lib-chip'+(f.type===t?' on':'')+'" data-lib-type="'+esc(t)+'">'+esc(t)+'</button>').join("");
  const roleSel = '<select id="libRole"><option value="">All roles</option>'+facetRoles.map(r=>'<option'+(f.role===r?' selected':'')+'>'+esc(r)+'</option>').join("")+'</select>';
  const progSel = '<select id="libProg"><option value="">All programmes</option>'+facetProgs.map(p=>'<option'+(f.programme===p?' selected':'')+'>'+esc(p)+'</option>').join("")+'</select>';
  const rows = recs.length ? recs.map(r=>libRowHTML(r,sel)).join("")
    : '<div class="empty">'+(hub.loading?'<span class="spin"></span> loading the library…':'Nothing matches. Try another search or filter.')+'</div>';
  const meta = hub.loading ? 'Checking Asana…' : (hub.loadedAt ? recs.length+' of '+all.length+(hub.editor?' · edit links on':'') : '');

  box.innerHTML =
    '<div class="lib-top">'+
      '<input id="libSearch" class="lib-search" placeholder="Search courses, recipes, videos, campaigns, roles…" value="'+esc(f.q||"")+'">'+
      '<div class="lib-top-actions"><button class="btn ghost sm" id="libRefresh" title="Refresh from Asana">↻</button><button class="btn primary sm" id="libAdd">+ Add resource</button></div>'+
    '</div>'+
    (hub.error?'<div class="mention-warning">'+esc(hub.error)+' · showing what\'s cached.</div>':'')+
    (hub.warning?'<div class="mention-warning">'+esc(hub.warning)+'</div>':'')+
    '<div class="lib-filters"><div class="lib-chips">'+typeChips+'</div><div class="lib-selects">'+roleSel+progSel+'</div></div>'+
    '<div class="lib-views">'+
      ['all','needs','archived'].map(v=>'<button class="lib-view'+(f.view===v?' on':'')+'" data-lib-view="'+v+'">'+(v==="all"?"All":v==="needs"?"Needs attention":"Archived")+'</button>').join("")+
      '<span class="lib-meta">'+esc(meta)+'</span></div>'+
    '<div class="lib-shell"><div class="lib-list">'+rows+'</div><div class="lib-detail" id="libDetail">'+libDetailHTML(sel)+'</div></div>';

  const search = document.getElementById("libSearch");
  if(search) search.oninput = e => { f.q = e.target.value; clearTimeout(search._t); search._t = setTimeout(renderContentTab,180); };
  document.querySelectorAll("[data-lib-type]").forEach(b=>b.onclick=()=>{ f.type=b.dataset.libType; renderContentTab(); });
  document.querySelectorAll("[data-lib-view]").forEach(b=>b.onclick=()=>{ f.view=b.dataset.libView; renderContentTab(); });
  const rs=document.getElementById("libRole"); if(rs) rs.onchange=()=>{ f.role=rs.value; renderContentTab(); };
  const ps=document.getElementById("libProg"); if(ps) ps.onchange=()=>{ f.programme=ps.value; renderContentTab(); };
  document.getElementById("libRefresh").onclick=()=>loadContentHub(true);
  document.getElementById("libAdd").onclick=()=>openContentEditor(null);
  box.querySelectorAll("[data-lib-row]").forEach(el=>el.onclick=()=>{ state.contentSel=el.dataset.libRow; renderContentTab(); });
  wireLibDetail();
}
function libRowHTML(r,sel){
  const on = sel && String(sel.id)===String(r.id);
  const badge = r.source==="courses"?'Course':r.source==="local"?'Added':r.type;
  const bits = [r.collection, r.role, r.programme].filter(Boolean).join(" · ");
  return '<button class="lib-row'+(on?' on':'')+(r.needs?' needs':'')+'" data-lib-row="'+esc(String(r.id))+'">'+
    '<span class="lib-row-type '+esc(r.type.replace(/[^a-z]/gi,'').toLowerCase())+'">'+esc(badge)+'</span>'+
    '<span class="lib-row-main"><b>'+esc(r.name)+'</b>'+(bits?'<small>'+esc(bits)+'</small>':'')+'</span>'+
    (r.moduleCount?'<span class="lib-row-mods">'+r.moduleCount+' mod</span>':(r.needs?'<span class="lib-row-flag" title="Needs a link or review">!</span>':''))+
    '</button>';
}
function libDetailHTML(r){
  if(!r) return '<div class="lib-detail-empty">Select a resource to see its details.</div>';
  const fieldRows = Object.entries(r.fields||{}).filter(([n,v])=>v&&!libIsUrl(v)&&!/status|role|audience|programme|program|type|format/i.test(n))
    .slice(0,8).map(([n,v])=>'<div class="lib-f"><span>'+esc(n)+'</span><b>'+esc(String(v))+'</b></div>').join("");
  const modsOpen = state.contentModules && state.contentModules[r.id];
  const modsHtml = r.moduleCount ? '<div class="lib-mods"><button class="btn ghost sm" data-lib-mods="'+esc(String(r.id))+'">'+(modsOpen?'Hide':'Show')+' '+r.moduleCount+' modules</button>'+
    (modsOpen ? '<div class="lib-mod-list">'+(modsOpen==="loading"?'<span class="spin"></span>':(modsOpen||[]).map(m=>'<div class="lib-mod'+(m.completed?' done':'')+'">'+esc(m.name)+'</div>').join(""))+'</div>' : '')+'</div>' : '';
  return '<div class="lib-detail-head"><h3>'+esc(r.name)+'</h3>'+
      '<div class="lib-detail-sub">'+esc([r.type,r.programme,r.role].filter(Boolean).join(" · ")||r.collection||"")+'</div>'+
      (r.status?'<span class="lib-status">'+esc(r.status)+'</span>':'')+'</div>'+
    (r.notes?'<p class="lib-desc">'+esc(r.notes)+'</p>':'')+
    (fieldRows?'<div class="lib-fields">'+fieldRows+'</div>':'')+
    modsHtml+
    (r.owner?'<div class="lib-owner">Owner: '+esc(r.owner)+(r.updated?' · updated '+new Date(r.updated).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):'')+'</div>':'')+
    '<div class="lib-actions">'+
      (r.published?'<a class="btn primary sm" href="'+esc(r.published)+'" target="_blank" rel="noopener">Open resource ↗</a>':'<span class="lib-nolink">No published link yet</span>')+
      (r.published?'<button class="btn ghost sm" data-lib-copy="'+esc(r.published)+'">Copy link</button>':'')+
      (r.asana?'<a class="btn ghost sm" href="'+esc(r.asana)+'" target="_blank" rel="noopener">Open in Asana ↗</a>':'')+
      (r.kind==="local"?'<button class="btn ghost sm" data-lib-editlocal="'+esc(String(r.id))+'">Edit</button>':'')+
      (r.edit?'<a class="btn teal sm" href="'+esc(r.edit)+'" target="_blank" rel="noopener" title="Only you and Jess see this">Edit source ↗</a>':'')+
    '</div>';
}
function wireLibDetail(){
  document.querySelectorAll("[data-lib-copy]").forEach(b=>b.onclick=()=>navigator.clipboard.writeText(b.dataset.libCopy).then(()=>toast("Link copied")));
  document.querySelectorAll("[data-lib-editlocal]").forEach(b=>b.onclick=()=>openContentEditor(b.dataset.libEditlocal));
  document.querySelectorAll("[data-lib-mods]").forEach(b=>b.onclick=()=>toggleContentModules(b.dataset.libMods));
}
async function toggleContentModules(id){
  if(!state.contentModules) state.contentModules={};
  if(state.contentModules[id]){ delete state.contentModules[id]; renderContentTab(); return; }
  state.contentModules[id]="loading"; renderContentTab();
  try{ const r=await call("get_subtasks",{parent:id}); state.contentModules[id]=(r.data||[]).map(s=>({name:s.name,completed:!!s.completed})); }
  catch(_){ state.contentModules[id]=[]; }
  renderContentTab();
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
