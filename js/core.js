/* ================================================================
   CORE — state, config, Asana/AI plumbing, boot, tabs, greeting,
          toast, confetti, suggestions tray
   ================================================================ */

/* ---- config persistence (migrates the old v1 config forward) ---- */
const LS_KEY = "ob_cmd_center_cfg_v1";
function loadCfg(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if(s && s.projects){
      if(!s._m1){ if(!s.people.includes("1213630128899336")) s.people.push("1213630128899336"); s._m1=true; }
      if(!s._m2){ if(!s.projects.some(p=>p.gid===PB.proj)) s.projects.push({gid:PB.proj,name:"Day to Day",color:"#E4784D",on:true}); s._m2=true; }
      if(!s._m3){
        if(!s.campaigns) s.campaigns=[];
        if(!s.campaigns.some(c=>c.gid==="1216638197844781")) s.campaigns.push({gid:"1216638197844781",name:"Volume Drivers",start:"2026-08-01",due:"2026-09-30",color:"#D9822B"});
        if(!s.projects.some(p=>p.gid==="1216638197844781")) s.projects.push({gid:"1216638197844781",name:"Volume Drivers",color:"#D9822B",on:true});
        s._m3=true;
      }
      if(!s._m4){ // v2 dashboard: communities + layers
        s.communities = s.communities || COMMUNITIES_DEFAULT;
        if(s.showComms===undefined) s.showComms = true;
        if(s.showOccasions===undefined) s.showOccasions = true;
        s._m4=true;
      }
      if(!s._m5){ // v3: platform/messages split, stores layers, PR
        if(s.msgBoard===undefined) s.msgBoard=null;
        if(s.prBoard===undefined) s.prBoard=null;
        if(s.showStores===undefined) s.showStores=true;
        s._m5=true;
      }
      if(!s.campaigns) s.campaigns=[];
      localStorage.setItem(LS_KEY, JSON.stringify(s));
      return s;
    }
  }catch(e){}
  return JSON.parse(JSON.stringify(DEFAULT_CFG));
}
function saveCfg(){ localStorage.setItem(LS_KEY, JSON.stringify(cfg)); }
let cfg = loadCfg();

const state = {
  tasks: [],           // merged, tagged task list
  users: [],           // [{gid,name,email}]
  me: null,            // {gid,name} of the signed-in user
  cursor: new Date(),
  view: cfg.view || "month",
  peopleFilter: [],
  showDone: false,
  loading: true,
  error: null,
  curriculum: CURRICULUM_DEFAULT.slice(),
  waSections: null,    // {communityName: sectionGid} once ensured
  orderKeeper: null,   // gid of the shared dashboard-state task
  order: {},           // legacy board-lane order (kept for migration)
  keeper: {},          // full shared state: girls sections, corkboard, mentions
  myTasks: {amy:[],caitlin:[],jess:[]},   // each person's real Asana My Tasks
  myTasksErr: {},      // person -> error/no_pat flag
  suggestions: [],     // computed after load
  dismissed: JSON.parse(localStorage.getItem("ob_dismissed")||"{}")
};

const DEMO = new URLSearchParams(location.search).has("demo");

/* ---- Asana + AI plumbing ---- */
async function call(tool, args){
  if(DEMO) return demoCall(tool, args||{});
  const r = await fetch("/api/asana", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ tool, args: args||{} })
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok){ if(r.status===401) showLogin(); throw new Error(j.error||("HTTP "+r.status)); }
  return j;
}
async function askAI(prompt, data){
  if(DEMO) return demoAI(prompt, data);
  const r = await fetch("/api/ai", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ prompt, data })
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error||"AI error");
  return j.text || "";
}

/* ---- loading ---- */
const TASK_FIELDS = "name,assignee.name,assignee.gid,due_on,start_on,completed,completed_at,memberships.section.name,memberships.section.gid,permalink_url,notes";
async function fetchProject(p){
  let out = [], offset = null, pages = 0;
  do{
    const args = {project:p.gid, limit:100, opt_fields:TASK_FIELDS};
    if(offset) args.offset = offset;
    const res = await call("get_tasks", args);
    (res.data||[]).forEach(t=>{
      const sec = (t.memberships&&t.memberships[0]&&t.memberships[0].section)||null;
      out.push({
        gid:t.gid, name:t.name, notes:t.notes||"",
        assignee:t.assignee? {gid:t.assignee.gid,name:t.assignee.name}:null,
        due:t.due_on||null, start:t.start_on||null,
        completed:!!t.completed, completedAt:t.completed_at||null,
        sectionName: sec?sec.name:"", sectionGid: sec?sec.gid:"",
        url:t.permalink_url,
        projectGid:p.gid, projectName:p.name, projectColor:p.color,
        isShoot: (sec&&sec.gid===SEC_SHOOT) || /^shoot day/i.test(t.name||""),
        isOccasion: (sec&&sec.gid===SEC_OCC),
        isNote: (sec&&sec.gid===PB.notes),
        isPassion: (sec&&sec.gid===PB.passion),
        isComms: !!cfg.msgBoard && p.gid===cfg.msgBoard,
        isPlatform: p.gid===WA_PROJECT,
        isBug: p.gid===BUGS_PROJECT,
        isVisit: p.gid===VISITS_PROJECT,
        isOpening: p.gid===REVAMP_PROJECT && !!t.due_on,
        isEvent: /masterclass|workshop|webinar|forum/i.test(t.name||""),
        isPrep: /^「prep」/.test(t.name||""),
        isShot: /^「shot」/.test(t.name||""),
        isBrief: /^「brief」/.test(t.name||""),
        isKeeper: /^⚙️ dashboard-state/.test(t.name||""),
        isPlaceholder: (p.gid===REVAMP_PROJECT && !t.assignee && !!t.due_on)
      });
    });
    offset = res.next_page ? res.next_page.offset : null;
    pages++;
  } while(offset && pages < cfg.pageCap);
  return out;
}

async function loadAll(){
  state.loading = true; state.error=null; renderSub();
  try{
    if(!state.users.length){
      const u = await call("get_users",{limit:100});
      state.users = (u.data||[]).filter(x=>x.email && !/team\.asana\.com$/.test(x.email));
    }
    const active = cfg.projects.filter(p=>p.on).slice();
    // always-on hidden boards: trainer visits + X Force bugs (+ messages board once created)
    const hidden = [
      {gid:VISITS_PROJECT, name:"Store Visits",  color:LAYER.visit},
      {gid:BUGS_PROJECT,   name:"X Force Bugs",  color:"#B03A2E"}
    ];
    if(cfg.msgBoard && !active.some(p=>p.gid===cfg.msgBoard))
      hidden.push({gid:cfg.msgBoard, name:"Community Messages", color:"#7A5FB0"});
    hidden.forEach(h=>{ if(!active.some(p=>p.gid===h.gid)) active.push(h); });
    const results = await Promise.all(active.map(fetchProject));
    const map = new Map();
    results.flat().forEach(t=>{ if(!map.has(t.gid)) map.set(t.gid,t); });
    state.tasks = [...map.values()];
    readOrderKeeper();
    loadMyTasks(); // async — re-renders The Girls when each list lands
    state.loading = false;
    computeSuggestions();
    renderAll();
    loadCurriculum(); // async, re-renders the bar when done
  }catch(e){
    state.loading=false; state.error=e.message; renderSub();
    toast("Hmm, Asana's not talking: "+e.message);
  }
}

/* ---- curriculum: live from Asana when available ---- */
async function loadCurriculum(){
  try{
    const res = await call("get_tasks",{project:CURRICULUM_PROJECT, limit:100, opt_fields:"name,notes"});
    const rows = res.data||[];
    let found = 0;
    const cur = CURRICULUM_DEFAULT.map(c=>({...c}));
    rows.forEach(t=>{
      const m = (t.name||"").match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s*[:—-]\s*(.+)$/i);
      if(m){
        const ix = MO.findIndex(x=>x.toLowerCase()===m[1].toLowerCase());
        if(ix>=0){ cur[ix] = {t:m[2].trim(), d:(t.notes||"").split("\n")[0]||cur[ix].d, q:cur[ix].q, biz:cur[ix].biz, gid:t.gid}; found++; }
      }
    });
    if(found){ state.curriculum = cur; renderCurriculumBar(); }
  }catch(e){ /* fallback stays */ }
}

/* ---- shared priority order (kept in a hidden Asana task's notes) ---- */
function readOrderKeeper(){
  const k = state.tasks.find(t=>t.isKeeper);
  if(k){ state.orderKeeper = k.gid;
    try{ state.keeper = JSON.parse(k.notes||"{}")||{}; }catch(e){ state.keeper={}; }
  }
  state.order = state.keeper.order||{};
  if(!state.keeper.girls) state.keeper.girls={};
  GIRLS.forEach(g=>{ if(!state.keeper.girls[g.key])
    state.keeper.girls[g.key]={sections:[{id:"top3",name:"Top 3 right now",taskIds:[]}], order:[], hidden:[], private:[]}; });
  if(!state.keeper.cork) state.keeper.cork=[];
  if(!state.keeper.mentions) state.keeper.mentions=[];
}
let keeperTimer = null;
function saveKeeper(){
  clearTimeout(keeperTimer);
  keeperTimer = setTimeout(async ()=>{
    state.keeper.order = state.order;
    const notes = JSON.stringify(state.keeper);
    try{
      if(state.orderKeeper){
        await call("update_tasks",{tasks:[{task:state.orderKeeper, notes}]});
      }else{
        const r = await call("create_tasks",{tasks:[{name:"⚙️ dashboard-state (do not delete)", project_id:PB.proj, section_id:PB.notes, notes}]});
        state.orderKeeper = r.data&&r.data[0]&&r.data[0].gid;
      }
    }catch(e){ /* still works locally this session */ }
  }, 700);
}
const saveOrder = saveKeeper; // legacy callers

/* ---- each person's Asana My Tasks (via their PAT, server-side) ---- */
async function loadMyTasks(){
  await Promise.all(GIRLS.map(async g=>{
    try{
      const r = await call("get_my_tasks",{person:g.key});
      state.myTasksErr[g.key] = r.no_pat ? "no_pat" : null;
      state.myTasks[g.key] = (r.data||[]).filter(t=>!t.completed).map(t=>({
        gid:t.gid, name:t.name, notes:t.notes||"", due:t.due_on||null,
        completed:false, url:t.permalink_url,
        projectName:(t.projects&&t.projects[0]&&t.projects[0].name)||"My Tasks",
        projectColor:"#5BC4BF", assignee:{gid:g.gid,name:g.name}, my:g.key
      }));
    }catch(e){ state.myTasksErr[g.key]=e.message; state.myTasks[g.key]=[]; }
    if(typeof renderGirls==="function") renderGirls();
  }));
}
function findTask(gid){
  return state.tasks.find(x=>x.gid===gid) ||
    GIRLS.map(g=>state.myTasks[g.key]).flat().find(x=>x.gid===gid);
}

/* ---- small utilities ---- */
function pd(s){ if(!s) return null; const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function iso(dt){ return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0"); }
function sameDay(a,b){ return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function todayD(){ const t=new Date(); return new Date(t.getFullYear(),t.getMonth(),t.getDate()); }
function initials(n){ return (n||"?").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase(); }
function esc(s){ return (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function userName(gid){ const u=state.users.find(x=>x.gid===gid); return u?u.name:gid; }
function firstName(n){ return (n||"").split(" ")[0]; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function daysTo(dateStr){ return Math.round((pd(dateStr)-todayD())/864e5); }
function humanWhen(days){ return days===0?"today":days===1?"tomorrow":days===-1?"yesterday":days<0?Math.abs(days)+"d ago":"in "+days+" days"; }
function toast(m){ const t=document.getElementById("toast"); t.textContent=m; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove("show"),2600); }

/* filtered task views */
function visibleTasks(){
  const pf=state.peopleFilter;
  return state.tasks.filter(t=>{
    if(t.isOccasion||t.isNote||t.isPassion||t.isKeeper) return false;
    if(t.isShot||t.isBrief) return false;             // live in Studio, not on the calendar
    if(t.isComms) return false;                       // comms render as their own layer
    if(t.isVisit||t.isOpening||t.isBug) return false; // stores + platform have their own layers/tabs
    if(!state.showDone && t.completed) return false;
    if(pf.length){
      if(!t.assignee) return pf.includes("unassigned");
      return pf.includes(t.assignee.gid);
    }
    return true;
  });
}
function occasionsOn(dt){
  const asana = state.tasks.filter(t=>t.isOccasion && t.due && sameDay(pd(t.due),dt));
  if(!cfg.showOccasions) return asana;
  const d = iso(dt);
  const app = OCCASIONS_APP.filter(o=>o.date===d).map(o=>({name:o.flag+" "+o.name, appOccasion:true, reg:o.reg}));
  return [...asana.map(a=>({name:a.name, gid:a.gid})), ...app];
}
function tasksOn(dt){ return visibleTasks().filter(t=>t.due && sameDay(pd(t.due),dt)); }
function commsOn(dt){ return state.tasks.filter(t=>t.isComms && !t.isKeeper && t.due && sameDay(pd(t.due),dt)); }
function campaignsOn(dt){
  return (cfg.campaigns||[]).filter(c=>{ const s=pd(c.start),e=pd(c.due); return s&&e&&dt>=s&&dt<=e; });
}
function isCampaignTask(t){ return (cfg.campaigns||[]).some(c=>c.gid===t.projectGid); }
function communityOf(t){
  // section name match first, then [Name] prefix
  const c = cfg.communities.find(c=>c.name.toLowerCase()===(t.sectionName||"").toLowerCase());
  if(c) return c;
  const m = (t.name||"").match(/^\[(.+?)\]/);
  if(m) return cfg.communities.find(c=>c.name.toLowerCase()===m[1].toLowerCase())||null;
  return null;
}
function purposeOf(t){
  const m = (t.notes||"").match(/#purpose:(\w+)/);
  return m ? MSG_PURPOSES.find(p=>p.key===m[1]) : null;
}

/* ---- write-backs ---- */
async function reschedule(gid,dateStr){
  const t=findTask(gid); if(!t) return;
  const prev=t.due; t.due=dateStr; renderCalendar(); renderPeople(); renderCommunities();
  try{ await call("update_tasks",{tasks:[{task:gid,due_on:dateStr}]}); toast("Rescheduled → "+dateStr); renderGreeting(); }
  catch(e){ t.due=prev; renderCalendar(); toast("Failed: "+e.message); }
}
async function reassign(gid,personGid){
  const t=state.tasks.find(x=>x.gid===gid); if(!t) return;
  const prev=t.assignee;
  t.assignee = personGid==="unassigned"?null:{gid:personGid,name:userName(personGid)};
  renderPeople(); renderCalendar();
  try{
    await call("update_tasks",{tasks:[{task:gid,assignee: personGid==="unassigned"?null:personGid}]});
    toast(personGid==="unassigned"?"Unassigned":"Handed to "+firstName(userName(personGid)));
  }catch(e){ t.assignee=prev; renderPeople(); toast("Failed: "+e.message); }
}
async function toggleDone(gid,val){
  const t=findTask(gid); if(!t) return;
  t.completed=val; renderAll();
  if(val){ if(t.isComms){ confetti(); toast(pick(SENT_LINES)); } else { toast(pick(DONE_LINES)); if(t.isShoot) confetti(); } }
  else toast("Back in play");
  try{ await call("update_tasks",{tasks:[{task:gid,completed:val}]}); }
  catch(e){ t.completed=!val; renderAll(); toast("Failed: "+e.message); }
}

/* ---- confetti (tiny, no deps) ---- */
function confetti(){
  const c = document.createElement("canvas");
  c.className="confetti"; document.body.appendChild(c);
  const ctx=c.getContext("2d"); c.width=innerWidth; c.height=innerHeight;
  const colors=["#0A3D62","#00A8A8","#F7C325","#E4784D","#5BC4BF","#7A5FB0"];
  const ps=Array.from({length:120},()=>({x:Math.random()*c.width,y:-20-Math.random()*c.height*.5,
    r:4+Math.random()*5,vy:2+Math.random()*3.5,vx:-1.5+Math.random()*3,rot:Math.random()*6,vr:-.15+Math.random()*.3,
    col:colors[Math.floor(Math.random()*colors.length)]}));
  let frames=0;
  (function tick(){
    ctx.clearRect(0,0,c.width,c.height);
    ps.forEach(p=>{ p.y+=p.vy; p.x+=p.vx; p.rot+=p.vr;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle=p.col; ctx.fillRect(-p.r/2,-p.r/4,p.r,p.r/2); ctx.restore(); });
    if(++frames<170) requestAnimationFrame(tick); else c.remove();
  })();
}

/* ---- greeting panel ---- */
function renderGreeting(){
  const el=document.getElementById("greeting"); if(!el) return;
  if(state.loading){ el.innerHTML=""; return; }
  const h=new Date().getHours();
  const slot = h<12?"morning":h<17?"afternoon":"evening";
  const name = firstName(state.me&&state.me.name)||"friend";
  const today=todayD();
  const nextShoot = state.tasks.filter(t=>t.isShoot&&!t.completed&&t.due&&pd(t.due)>=today).sort((a,b)=>a.due<b.due?-1:1)[0];
  const chips=[];
  if(nextShoot){ const d=daysTo(nextShoot.due);
    chips.push(`<button class="gchip shoot" data-open="${nextShoot.gid}" data-run="${d===0?1:""}">🎬 ${esc(nextShoot.name)} — <b>${d===0?"TODAY — run sheet":humanWhen(d)}</b></button>`); }
  el.innerHTML =
    `<div class="g-left"><h2>${esc(pick(GREETINGS[slot]).replace("{n}",name))}</h2>
      <div class="gchips">${chips.join("")}</div></div>
     <button class="btn glow" id="btnBriefMe">✨ Brief me</button>`;
  el.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{ if(b.dataset.run) openRunSheet(b.dataset.open); else openDrawer(b.dataset.open); });
  const bm=document.getElementById("btnBriefMe");
  if(bm) bm.onclick=dailyBrief;
}
async function dailyBrief(){
  const today=todayD();
  const horizon = new Date(today); horizon.setDate(horizon.getDate()+7);
  const slice = visibleTasks().filter(t=>t.due&&pd(t.due)>=today&&pd(t.due)<=horizon)
    .map(t=>({name:t.name,due:t.due,who:t.assignee?firstName(t.assignee.name):"unassigned",board:t.projectName,shoot:t.isShoot}));
  const comms = state.tasks.filter(t=>t.isComms&&!t.isKeeper&&t.due&&pd(t.due)>=today&&pd(t.due)<=horizon)
    .map(t=>({msg:t.name,due:t.due,sent:t.completed}));
  const overdue = visibleTasks().filter(t=>t.due&&pd(t.due)<today).map(t=>({name:t.name,due:t.due,who:t.assignee?firstName(t.assignee.name):"unassigned"}));
  showModal('<h2>Your brief</h2><div class="ideabox" id="briefBox"><span class="spin"></span> reading the room…</div>'+
    '<div class="drawer-actions"><button class="btn ghost" data-close>Close</button></div>');
  wireModalClose();
  try{
    const text = await askAI(
      "You are the cheerful ops sidekick for the Ocean Basket Academy team (internal, casual, fun — light emoji fine). Write a short morning brief: 1) the headline (what matters most this week), 2) today at a glance, 3) the week ahead in 3-5 bullets, 4) one gentle nudge if anything looks at risk (overdue or a shoot day that's close with prep unfinished). Keep it under 160 words.",
      [{today:iso(today), tasks:slice, whatsapp_messages:comms, overdue, curriculum_this_month:state.curriculum[today.getMonth()]}]);
    const box=document.getElementById("briefBox"); if(box) box.innerHTML=esc(text).replace(/\n/g,"<br>");
  }catch(e){ const box=document.getElementById("briefBox"); if(box) box.textContent="Couldn't brief: "+e.message; }
}

/* ---- suggestions tray ---- */
function dismissKey(id){ return id; }
function dismissSuggestion(id){ state.dismissed[id]=Date.now(); localStorage.setItem("ob_dismissed",JSON.stringify(state.dismissed)); computeSuggestions(); renderTray(); }
function computeSuggestions(){
  const out=[]; const today=todayD();
  // 1. store openings a month from HO with no training visit scheduled
  state.tasks.filter(t=>t.isOpening&&!t.completed&&t.due).forEach(o=>{
    const d=daysTo(o.due); if(d<0||d>31) return;
    const oWords=(o.name||"").toLowerCase().split(/\W+/).filter(x=>x.length>3);
    const hasVisit=state.tasks.some(v=>v.isVisit&&v.due&&Math.abs(pd(v.due)-pd(o.due))<21*864e5&&
      oWords.some(wd=>(v.name||"").toLowerCase().includes(wd)));
    if(!hasVisit) out.push({id:"ho-"+o.gid, icon:"", label:`“${o.name}” hands over ${humanWhen(d)} — has training been scheduled?`, action:null});
  });
  // 2. shoots inside 14 days with no brief in the library
  state.tasks.filter(t=>t.isShoot&&!t.completed&&t.due).forEach(s=>{
    const d=daysTo(s.due); if(d<0||d>14) return;
    const hasBrief = state.tasks.some(p=>p.isBrief&&p.name.includes(s.name)) || /brief sent|brief done/i.test(s.notes||"");
    if(!hasBrief) out.push({id:"brief-"+s.gid, icon:"", label:`No supplier brief yet for “${s.name}” (${humanWhen(d)})`, action:"Draft it ✨", run:()=>{switchTab("studio"); draftBrief(s.gid);}});
  });
  // 2b. shoot day is TODAY — offer the run sheet
  state.tasks.filter(t=>t.isShoot&&!t.completed&&t.due&&daysTo(t.due)===0).forEach(s=>{
    out.push({id:"run-"+s.gid+"-"+s.due, icon:"🎬", label:`Shoot day today — “${s.name}”`, action:"Open run sheet", run:()=>openRunSheet(s.gid)});
  });
  // 2c. events within 10 days with no promo queued
  state.tasks.filter(t=>t.isEvent&&!t.isComms&&!t.completed&&t.due).forEach(ev=>{
    const d=daysTo(ev.due); if(d<1||d>10) return;
    if(!eventHasPromo(ev)) out.push({id:"evpromo-"+ev.gid, icon:"", label:`“${ev.name}” is ${humanWhen(d)} and nothing's queued in Communities`, action:"Queue promo", run:()=>queuePromoFor(ev.gid)});
  });
  // 3. busy comms days (>3 per community per day)
  const perDay={};
  state.tasks.filter(t=>t.isComms&&!t.isKeeper&&t.due&&!t.completed).forEach(t=>{
    const c=communityOf(t); const key=t.due+"|"+(c?c.name:"?");
    (perDay[key]=perDay[key]||[]).push(t);
  });
  Object.entries(perDay).forEach(([key,list])=>{
    if(list.length>3){ const [date,comm]=key.split("|");
      out.push({id:"busy-"+key, icon:"🔥", label:`${comm} gets ${list.length} messages on ${date} — that's a lot of pings`, action:null});
    }
  });
  // 4. occasions in the next 21 days worth planning for
  const soon = OCCASIONS_APP.filter(o=>{ const d=daysTo(o.date); return d>=3&&d<=21; }).slice(0,3);
  soon.forEach(o=>{
    const planned = state.tasks.some(t=>!t.completed&&t.due&&Math.abs(pd(t.due)-pd(o.date))<3*864e5&&t.name.toLowerCase().includes(o.name.toLowerCase().split(" ")[0]));
    if(!planned) out.push({id:"occ-"+o.date+o.name, icon:o.flag, label:`${o.name} is ${humanWhen(daysTo(o.date))} — worth a moment?`, action:"Plan something", run:()=>quickPlanOccasion(o)});
  });
  state.suggestions = out.filter(s=>!state.dismissed[s.id]);
  const badge=document.getElementById("trayBadge");
  if(badge){ badge.textContent=state.suggestions.length; badge.style.display=state.suggestions.length?"flex":"none"; }
}
function renderTray(){
  const box=document.getElementById("trayList"); if(!box) return;
  if(!state.suggestions.length){ box.innerHTML='<div class="empty">'+pick(EMPTY_LINES)+'</div>'; return; }
  box.innerHTML = state.suggestions.map(s=>
    `<div class="sugg"><span class="s-ic">${s.icon}</span><span class="s-tx">${esc(s.label)}</span>
      <span class="s-btns">${s.action?`<button class="btn teal sm" data-act="${s.id}">${esc(s.action)}</button>`:""}
      <button class="btn ghost sm" data-dis="${s.id}">✕</button></span></div>`).join("");
  box.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{ const s=state.suggestions.find(x=>x.id===b.dataset.act); if(s&&s.run){ toggleTray(false); s.run(); } });
  box.querySelectorAll("[data-dis]").forEach(b=>b.onclick=()=>dismissSuggestion(b.dataset.dis));
}
function toggleTray(force){
  const t=document.getElementById("tray");
  const show = force!==undefined?force:!t.classList.contains("open");
  t.classList.toggle("open",show);
  if(show) renderTray();
}
async function quickPlanOccasion(o){
  try{
    await call("create_tasks",{tasks:[{name:"Plan: "+o.name, project_id:CC_PROJECT, section_id:SEC_PLAN, due_on:o.date, notes:"Auto-suggested from the occasions radar ("+o.reg+"). Make it fun."}]});
    toast("On the board"); dismissSuggestion("occ-"+o.date+o.name); loadAll();
  }catch(e){ toast("Failed: "+e.message); }
}

/* ---- header sub-line ---- */
function renderSub(){
  const el=document.getElementById("sub");
  if(state.loading){ el.innerHTML='<span class="spin"></span> talking to Asana…'; return; }
  if(state.error){ el.textContent="⚠︎ "+state.error; return; }
  const n=state.tasks.filter(t=>!t.isOccasion&&!t.isKeeper).length;
  el.textContent = n+" tasks · "+cfg.projects.filter(p=>p.on).length+" boards · live with Asana";
}

/* ---- tabs ---- */
function switchTab(name){
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  document.querySelectorAll(".tabpane").forEach(x=>{
    const on = x.id==="tab-"+name;
    if(on && !x.classList.contains("active")){ x.classList.add("active"); x.classList.remove("enter"); void x.offsetWidth; x.classList.add("enter"); }
    else if(!on) x.classList.remove("active");
  });
  moveTabInk();
}
function moveTabInk(){
  const bar=document.querySelector(".tabs"), act=document.querySelector(".tab.active"), ink=document.getElementById("tabInk");
  if(!bar||!act||!ink) return;
  ink.style.left=(act.offsetLeft)+"px"; ink.style.width=act.offsetWidth+"px";
}

function renderAll(){
  renderSub(); renderGreeting(); renderChips(); renderPersonToggles();
  renderCalendar(); renderGirls(); renderStudio(); renderCommunities();
  renderStores(); renderPlatform(); prTabVisibility(); renderMentionBadge();
  computeSuggestions();
}

/* ---- boot ---- */
function showLogin(){ document.getElementById("loginGate").style.display="flex"; document.getElementById("app").style.display="none"; }
async function init(){
  document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>switchTab(t.dataset.tab));
  window.addEventListener("resize",moveTabInk);
  document.getElementById("btnAdd").onclick=openAdd;
  document.getElementById("btnSettings").onclick=openSettings;
  document.getElementById("btnCampaign").onclick=openCampaign;
  document.getElementById("btnTray").onclick=()=>toggleTray();
  document.getElementById("btnAt").onclick=()=>openMentions();
  const prTab=document.querySelector('[data-tab="pr"]');
  if(prTab) prTab.addEventListener("click",()=>loadPr());
  document.getElementById("btnGenIdeas").onclick=()=>generateAllUpcoming();
  document.getElementById("btnFriday").onclick=openFriday;
  document.getElementById("showDone").onchange=e=>{ state.showDone=e.target.checked; renderAll(); };
  document.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>{closeDrawer();closeModal();});
  document.getElementById("drawerWrap").addEventListener("click",e=>{ if(e.target.classList.contains("drawer-scrim"))closeDrawer(); });
  document.getElementById("modalWrap").addEventListener("click",e=>{ if(e.target.classList.contains("modal-scrim"))closeModal(); });
  document.addEventListener("click",e=>{ const t=document.getElementById("tray");
    if(t.classList.contains("open") && !t.contains(e.target) && e.target.id!=="btnTray" && !document.getElementById("btnTray").contains(e.target)) toggleTray(false); });
  wireCalendarControls(); wireCommunityControls();
  // it's Friday? make the huddle button wink
  if(new Date().getDay()===5) document.getElementById("btnFriday").classList.add("its-friday");

  if(DEMO){
    state.me = {gid:"u-amy", name:"Amy Gray"};
    cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));   // in-memory only — don't touch saved config
    cfg.people = ["u-amy","u-cait","u-jess"];
    cfg.msgBoard = "demo-msg";
    cfg.prBoard = "demo-pr";
    saveCfg = ()=>{};
    GIRLS[0].gid="u-amy"; GIRLS[1].gid="u-cait"; GIRLS[2].gid="u-jess";
    document.getElementById("loginGate").style.display="none";
    document.getElementById("app").style.display="";
    loadAll(); requestAnimationFrame(moveTabInk);
    return;
  }
  try{
    const r=await fetch("/api/me");
    if(r.ok){
      const j = await r.json().catch(()=>null);
      if(j&&j.user) state.me = {gid:j.user.gid, name:j.user.name};
      document.getElementById("loginGate").style.display="none";
      document.getElementById("app").style.display="";
      loadAll(); requestAnimationFrame(moveTabInk);
    }
    else showLogin();
  }catch(e){ showLogin(); }
}
window.addEventListener("DOMContentLoaded", init);
