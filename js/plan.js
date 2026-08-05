/* ================================================================
   90-DAY PLAN — a wall-planner (three months side by side) for the
   quarterly planning meeting.

   Auto-loads real campaigns, events, store openings and key due-dates,
   then lays a whiteboard on top: draggable sticky notes, four goal
   lanes (Campaigns · Content · Training · Events), freehand ink and
   emoji stamps. Content saves to the shared dashboard-state (keeper.plan)
   so the whole team sees the same plan; agreed items can be pushed
   straight into Asana as tasks.

   Auto-pulled items are read live off the calendar helpers (campaignsOn,
   state.tasks); the whiteboard layer is the only thing we persist.
   ================================================================ */

const PLAN_STAMPS = ["🔥","⭐","⚠️","✅","🎯","💡"];
const PLAN_INKS = ["#E4784D","#0A3D62","#00A8A8","#C64B8C","#121A24"];  // pen colours
const PLAN_LANES = [
  {key:"campaigns", name:"Campaigns", color:"#0A3D62"},
  {key:"content",   name:"Content",   color:"#00A8A8"},
  {key:"training",  name:"Training",  color:"#F7C325"},
  {key:"events",    name:"Events",    color:"#E4784D"}
];

function planStartOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }

/* transient UI state (never persisted — that lives in keeper.plan) */
state.plan = {
  start:  planStartOfMonth(todayD()),
  people: [],
  layers: {campaigns:true, shoots:true, events:true, stores:true, tasks:true},
  mode:   "select",               // select | note | stamp | pen
  layout: "stack",                // stack (big, full-width) | across (compact overview)
  stamp:  PLAN_STAMPS[0],
  ink:    "#E4784D",
  showHidden: false,
  pushTarget: null                // Asana project gid (defaults to Day to Day)
};

/* the persisted whiteboard, self-healing so a fresh keeper just works */
function planData(){
  const k=state.keeper||(state.keeper={});
  if(!k.plan||typeof k.plan!=="object") k.plan={};
  const p=k.plan;
  if(!Array.isArray(p.notes)) p.notes=[];
  if(!Array.isArray(p.ink)) p.ink=[];
  if(!Array.isArray(p.hidden)) p.hidden=[];
  if(!p.lanes||typeof p.lanes!=="object") p.lanes={};
  PLAN_LANES.forEach(l=>{ if(!Array.isArray(p.lanes[l.key])) p.lanes[l.key]=[]; });
  return p;
}
function planDefaultPushTarget(){
  const projs=cfg.projects||[];
  const d2d=projs.find(p=>/day to day/i.test(p.name));
  return (state.plan.pushTarget)||(d2d&&d2d.gid)||(projs[projs.length-1]&&projs[projs.length-1].gid)||null;
}

/* ---- day-item collection (respects the plan's own filters) ---- */
function planItemsOn(dt){
  const P=state.plan, day=iso(dt);
  const inPeople=t=>{ if(!P.people.length) return true; if(!t.assignee) return P.people.includes("unassigned"); return P.people.includes(t.assignee.gid); };
  const camps=P.layers.campaigns?campaignsOn(dt):[];
  const stores=P.layers.stores?state.tasks.filter(t=>(t.isOpening||t.isSchedule)&&!t.completed&&t.due===day):[];
  const tasks=state.tasks.filter(t=>{
    if(t.due!==day) return false;
    if(t.isOccasion||t.isNote||t.isPassion||t.isKeeper||t.isShot||t.isBrief||t.isComms||t.isVisit||t.isSchedule||t.isOpening||t.isBug) return false;
    if(!state.showDone&&t.completed) return false;
    return inPeople(t);
  });
  const shoots=P.layers.shoots?tasks.filter(t=>t.isShoot):[];
  const events=P.layers.events?tasks.filter(t=>t.isEvent&&!t.isShoot):[];
  const others=P.layers.tasks?tasks.filter(t=>!t.isShoot&&!t.isEvent):[];
  return {camps, stores, shoots, events, others};
}

/* ================================================================
   RENDER
   ================================================================ */
function renderPlan(){
  const board=document.getElementById("planBoard"); if(!board) return;
  renderPlanToolbar();
  const wrap=document.getElementById("planWrap");
  if(wrap) wrap.className="plan-wrap mode-"+state.plan.mode;
  const start=state.plan.start;
  let html="";
  for(let i=0;i<3;i++) html+=planMonthHTML(new Date(start.getFullYear(), start.getMonth()+i, 1));
  board.className="plan-board "+(state.plan.layout||"stack");
  board.innerHTML=html;
  wirePlanBoard();
  renderPlanInk();
  renderPlanNotes();
  renderPlanLanes();
}

function planLabel(){
  const s=state.plan.start, e=new Date(s.getFullYear(), s.getMonth()+2, 1);
  const span=MO[s.getMonth()].slice(0,3)+" – "+MO[e.getMonth()].slice(0,3)+" "+e.getFullYear();
  return s.getFullYear()!==e.getFullYear()
    ? MO[s.getMonth()].slice(0,3)+" "+s.getFullYear()+" – "+MO[e.getMonth()].slice(0,3)+" "+e.getFullYear()
    : span;
}

function planMonthHTML(c){
  const y=c.getFullYear(), m=c.getMonth();
  const first=new Date(y,m,1);
  const startDow=(first.getDay()+6)%7;
  const gridStart=new Date(first); gridStart.setDate(1-startDow);
  const today=todayD();
  const P=state.plan, hidden=new Set(planData().hidden);
  const trim=(s,n)=>{ s=String(s||""); return s.length>n?s.slice(0,n-1)+"…":s; };
  const cleanName=t=>String(t.name||"").replace(/^\[.+?\]\s*/,"");
  // Every item shows its full name; the cell grows to fit rather than hiding
  // anything behind a "+N" count.
  const keyPill=(t,icon,cls)=>{
    const isHid=hidden.has(t.gid);
    if(isHid&&!P.showHidden) return "";
    return '<span class="pp '+cls+(isHid?" ghosted":"")+(t.completed?" done":"")+'" data-gid="'+t.gid+'" title="'+esc(t.name)+'">'+
      icon+esc(cleanName(t))+
      '<b class="pp-x" data-hide="'+t.gid+'" title="Hide from the plan">×</b></span>';
  };
  const taskPill=t=>{
    const isHid=hidden.has(t.gid);
    if(isHid&&!P.showHidden) return "";
    return '<span class="pp task'+(isHid?" ghosted":"")+(t.completed?" done":"")+'" data-gid="'+t.gid+'" title="'+esc(t.name)+'">'+
      '<i class="pp-dot" style="background:'+(t.projectColor||"#6B7A8F")+'"></i>'+esc(cleanName(t))+
      '<b class="pp-x" data-hide="'+t.gid+'" title="Hide from the plan">×</b></span>';
  };
  let cells="";
  for(let i=0;i<42;i++){
    const dt=new Date(gridStart); dt.setDate(gridStart.getDate()+i);
    const dim=dt.getMonth()!==m;
    const isToday=sameDay(dt,today);
    const {camps,stores,shoots,events,others}=dim?{camps:[],stores:[],shoots:[],events:[],others:[]}:planItemsOn(dt);
    let inner='<span class="pd-num">'+dt.getDate()+'</span>';
    camps.forEach(c2=>{ const showName=sameDay(dt,pd(c2.start))||i%7===0;
      inner+='<div class="pd-camp" style="background:'+c2.color+'" title="'+esc(c2.name)+'">'+(showName?esc(trim(c2.name,20)):"&nbsp;")+'</div>'; });
    shoots.forEach(t=>inner+=keyPill(t,"🎬 ","shoot"));
    events.forEach(t=>inner+=keyPill(t,"⭐ ","event"));
    stores.forEach(t=>{ if(t.isOpening) inner+=keyPill(t,"📍 ","store"); });
    others.forEach(t=>inner+=taskPill(t));
    cells+='<div class="pd-cell'+(dim?" dim":"")+(isToday?" today":"")+'" data-date="'+iso(dt)+'">'+inner+'</div>';
  }
  return '<div class="plan-month"><div class="pm-h">'+MO[m]+' <span>'+y+'</span></div>'+
    '<div class="pm-dow">'+DOW.map(d=>"<span>"+d+"</span>").join("")+'</div>'+
    '<div class="pm-grid">'+cells+'</div></div>';
}

function wirePlanBoard(){
  const board=document.getElementById("planBoard");
  board.querySelectorAll(".pp[data-gid]").forEach(p=>{
    p.onclick=e=>{
      if(e.target.closest(".pp-x")){ e.stopPropagation(); planToggleHide(e.target.dataset.hide); return; }
      if(state.plan.mode!=="select") return;
      openDrawer(p.dataset.gid);
    };
  });
  board.querySelectorAll(".pd-more").forEach(m=>m.onclick=()=>{
    if(state.plan.mode!=="select") return;
    state.cursor=pd(m.dataset.day); switchTab("calendar"); if(typeof setView==="function") setView("day");
  });
  // click on empty board space places a note / stamp
  board.onclick=e=>{
    if(e.target.closest(".pp,.pd-more")) return;
    const mode=state.plan.mode;
    if(mode!=="note"&&mode!=="stamp") return;
    const rect=board.getBoundingClientRect();
    const nx=(e.clientX-rect.left)/rect.width, ny=(e.clientY-rect.top)/rect.height;
    if(mode==="note") planAddNote(nx,ny);
    else planAddStamp(nx,ny);
  };
}

function planToggleHide(gid){
  const p=planData(); const i=p.hidden.indexOf(gid);
  if(i>=0) p.hidden.splice(i,1); else p.hidden.push(gid);
  saveKeeper(); renderPlan();
}

/* ---- toolbar ---- */
function renderPlanToolbar(){
  const box=document.getElementById("planToolbar"); if(!box) return;
  const P=state.plan;
  const layerChip=(k,label)=>'<button class="plchip'+(P.layers[k]?"":" off")+'" data-layer="'+k+'">'+esc(label)+'</button>';
  const stampBtns=PLAN_STAMPS.map(s=>'<button class="pl-stamp'+(P.mode==="stamp"&&P.stamp===s?" on":"")+'" data-stamp="'+s+'">'+s+'</button>').join("");
  const people=(cfg.people||[]).map(g=>'<span class="ptog'+(P.people.includes(g)?" on":"")+'" data-person="'+g+'">'+esc(firstName(userName(g)))+'</span>').join("");
  const projOpts=(cfg.projects||[]).map(pr=>'<option value="'+pr.gid+'"'+(planDefaultPushTarget()===pr.gid?" selected":"")+'>'+esc(pr.name)+'</option>').join("");
  const hiddenCount=planData().hidden.length;
  box.innerHTML=
    '<div class="plan-row plan-row-nav">'+
      '<div class="plan-nav"><button class="btn ghost sm" id="planPrev">‹</button>'+
        '<button class="btn ghost sm" id="planToday">This quarter</button>'+
        '<button class="btn ghost sm" id="planNext">›</button>'+
        '<span class="plan-period">'+esc(planLabel())+'</span>'+
        '<button class="btn ghost sm plan-layout-btn" id="planLayout" title="Switch layout">'+
          (P.layout==="across"?"⬍ Stack big":"⬌ All 90 across")+'</button></div>'+
      '<div class="plan-people"><span class="ptog'+(P.people.length===0?" on":"")+'" data-person="">Everyone</span>'+people+'</div>'+
    '</div>'+
    '<div class="plan-row plan-row-tools">'+
      '<div class="plan-layers">'+layerChip("campaigns","Campaigns")+layerChip("shoots","Shoots")+layerChip("events","Events")+layerChip("stores","Openings & visits")+layerChip("tasks","Tasks")+
        (hiddenCount?'<button class="plchip'+(P.showHidden?"":" off")+'" id="planHiddenToggle">Hidden ('+hiddenCount+')</button>':'')+'</div>'+
      '<div class="plan-tools">'+
        '<button class="pl-tool'+(P.mode==="select"?" on":"")+'" data-mode="select" title="Select & drag">✋</button>'+
        '<button class="pl-tool'+(P.mode==="note"?" on":"")+'" data-mode="note" title="Add sticky notes">🗒 Note</button>'+
        '<span class="pl-stamps">'+stampBtns+'</span>'+
        '<button class="pl-tool'+(P.mode==="pen"?" on":"")+'" data-mode="pen" title="Freehand pen">✏️ Pen</button>'+
        '<span class="pl-ink">'+PLAN_INKS.map(c=>'<span class="pl-ic'+(P.ink===c?" on":"")+'" data-ink="'+c+'" style="background:'+c+'"></span>').join("")+'</span>'+
        '<button class="btn ghost sm" id="planClearInk">Clear ink</button>'+
      '</div>'+
      '<div class="plan-push"><label>Push to</label><select id="planPushTarget">'+projOpts+'</select></div>'+
    '</div>';

  document.getElementById("planPrev").onclick=()=>{ P.start=new Date(P.start.getFullYear(),P.start.getMonth()-1,1); renderPlan(); };
  document.getElementById("planNext").onclick=()=>{ P.start=new Date(P.start.getFullYear(),P.start.getMonth()+1,1); renderPlan(); };
  document.getElementById("planToday").onclick=()=>{ P.start=planStartOfMonth(todayD()); renderPlan(); };
  document.getElementById("planLayout").onclick=()=>{ P.layout=P.layout==="across"?"stack":"across"; renderPlan(); };
  box.querySelectorAll("[data-person]").forEach(el=>el.onclick=()=>{
    const v=el.dataset.person;
    if(v===""){ P.people=[]; } else { const i=P.people.indexOf(v); if(i>=0) P.people.splice(i,1); else P.people.push(v); }
    renderPlan();
  });
  box.querySelectorAll("[data-layer]").forEach(el=>el.onclick=()=>{ P.layers[el.dataset.layer]=!P.layers[el.dataset.layer]; renderPlan(); });
  const ht=document.getElementById("planHiddenToggle"); if(ht) ht.onclick=()=>{ P.showHidden=!P.showHidden; renderPlan(); };
  box.querySelectorAll("[data-mode]").forEach(el=>el.onclick=()=>{ P.mode=el.dataset.mode; renderPlan(); });
  box.querySelectorAll("[data-stamp]").forEach(el=>el.onclick=()=>{ P.stamp=el.dataset.stamp; P.mode="stamp"; renderPlan(); });
  box.querySelectorAll("[data-ink]").forEach(el=>el.onclick=()=>{ P.ink=el.dataset.ink; if(P.mode!=="pen") P.mode="pen"; renderPlan(); });
  document.getElementById("planClearInk").onclick=()=>{ if(!planData().ink.length) return; planData().ink=[]; saveKeeper(); renderPlanInk(); };
  const sel=document.getElementById("planPushTarget"); if(sel) sel.onchange=()=>{ P.pushTarget=sel.value; };
}

/* ---- sticky notes + stamps ---- */
function planAddNote(nx,ny){
  planData().notes.push({id:"pn"+Date.now(),text:"",color:STICKY_COLORS[planData().notes.length%STICKY_COLORS.length],
    nx:clamp01(nx),ny:clamp01(ny),author:firstName(state.me&&state.me.name)||"someone",at:iso(todayD())});
  saveKeeper(); renderPlanNotes();
  state.plan.mode="select"; renderPlanToolbar();
  const wrap=document.getElementById("planWrap"); if(wrap) wrap.className="plan-wrap mode-select";
  requestAnimationFrame(()=>{ const el=document.querySelector('#planNotes .plan-sticky:last-child .ps-txt'); if(el){ el.focus(); } });
}
function planAddStamp(nx,ny){
  planData().notes.push({id:"pn"+Date.now(),stamp:state.plan.stamp,nx:clamp01(nx),ny:clamp01(ny)});
  saveKeeper(); renderPlanNotes();
}
function clamp01(v){ return Math.max(0,Math.min(1,v)); }

function renderPlanNotes(){
  const layer=document.getElementById("planNotes"); if(!layer) return;
  const board=document.getElementById("planBoard"); if(!board) return;
  const W=board.clientWidth, H=board.clientHeight;
  layer.style.width=W+"px"; layer.style.height=H+"px";
  if(W<200||H<100) return;   // hidden tab reports 0×0 — wait for a real open
  const notes=planData().notes;
  layer.innerHTML=notes.map(n=>{
    const x=Math.round((Number(n.nx)||0)*W), y=Math.round((Number(n.ny)||0)*H);
    if(n.stamp) return '<div class="plan-stamp" data-id="'+n.id+'" style="left:'+x+'px;top:'+y+'px">'+esc(n.stamp)+
      '<button class="ps-x" data-id="'+n.id+'" title="Remove">✕</button></div>';
    return '<div class="plan-sticky" data-id="'+n.id+'" style="background:'+n.color+';left:'+x+'px;top:'+y+'px">'+
      '<div class="ps-bar"><span class="ps-grip" title="Drag">⠿</span>'+
        '<button class="ps-asana" data-id="'+n.id+'" title="Make an Asana task">➦</button>'+
        '<button class="ps-x" data-id="'+n.id+'" title="Remove">✕</button></div>'+
      '<div class="ps-txt" contenteditable="true" data-id="'+n.id+'">'+esc(n.text)+'</div>'+
      (n.author?'<div class="ps-by">'+esc(n.author)+'</div>':'')+'</div>';
  }).join("");
  wirePlanNotes(W,H);
}

function wirePlanNotes(W,H){
  const layer=document.getElementById("planNotes");
  const find=id=>planData().notes.find(n=>n.id===id);
  layer.querySelectorAll(".ps-x").forEach(b=>b.onclick=e=>{ e.stopPropagation();
    const p=planData(); p.notes=p.notes.filter(n=>n.id!==b.dataset.id); saveKeeper(); renderPlanNotes(); });
  layer.querySelectorAll(".ps-asana").forEach(b=>b.onclick=e=>{ e.stopPropagation();
    const n=find(b.dataset.id); if(n) planPush(n.text,"Sticky note"); });
  layer.querySelectorAll(".ps-txt").forEach(t=>{
    t.onblur=()=>{ const n=find(t.dataset.id); if(n){ n.text=t.textContent.trim(); saveKeeper(); } };
    t.onpointerdown=e=>e.stopPropagation();  // let the caret work; drag uses the grip
  });
  // drag by the grip / bar
  layer.querySelectorAll(".plan-sticky, .plan-stamp").forEach(el=>{
    const handle=el.querySelector(".ps-grip")||el;
    handle.onpointerdown=e=>{
      if(e.target.closest(".ps-x,.ps-asana,.ps-txt")) return;
      e.preventDefault();
      const sx=e.clientX-el.offsetLeft, sy=e.clientY-el.offsetTop;
      el.setPointerCapture(e.pointerId); el.classList.add("lifted");
      const mv=ev=>{
        el.style.left=Math.max(0,Math.min(W-el.offsetWidth, ev.clientX-sx))+"px";
        el.style.top =Math.max(0,Math.min(H-el.offsetHeight,ev.clientY-sy))+"px";
      };
      const up=()=>{
        el.onpointermove=null; el.onpointerup=null; el.classList.remove("lifted");
        const n=find(el.dataset.id);
        if(n){ n.nx=clamp01((parseFloat(el.style.left)||0)/W); n.ny=clamp01((parseFloat(el.style.top)||0)/H); saveKeeper(); }
      };
      el.onpointermove=mv; el.onpointerup=up;
    };
  });
}

/* ---- freehand ink (SVG overlay, only active in pen mode) ---- */
function renderPlanInk(){
  const svg=document.getElementById("planInk"); if(!svg) return;
  const board=document.getElementById("planBoard"); if(!board) return;
  const W=board.clientWidth, H=board.clientHeight;
  svg.setAttribute("width",W); svg.setAttribute("height",H);
  svg.setAttribute("viewBox","0 0 "+W+" "+H);
  const strokes=planData().ink;
  svg.innerHTML=strokes.map(s=>{
    const pts=(s.points||[]).map(p=>[(p[0]*W).toFixed(1),(p[1]*H).toFixed(1)].join(",")).join(" ");
    return '<polyline points="'+pts+'" fill="none" stroke="'+(s.color||"#E4784D")+'" stroke-width="'+(s.w||3)+'" stroke-linecap="round" stroke-linejoin="round"/>';
  }).join("");
  wirePlanInk(W,H);
}
function wirePlanInk(W,H){
  const svg=document.getElementById("planInk"); if(!svg) return;
  svg.onpointerdown=e=>{
    if(state.plan.mode!=="pen") return;
    e.preventDefault();
    const rect=svg.getBoundingClientRect();
    const stroke={color:state.plan.ink,w:3,points:[[clamp01((e.clientX-rect.left)/W),clamp01((e.clientY-rect.top)/H)]]};
    svg.setPointerCapture(e.pointerId);
    const line=document.createElementNS("http://www.w3.org/2000/svg","polyline");
    line.setAttribute("fill","none"); line.setAttribute("stroke",stroke.color);
    line.setAttribute("stroke-width",stroke.w); line.setAttribute("stroke-linecap","round"); line.setAttribute("stroke-linejoin","round");
    svg.appendChild(line);
    const draw=()=>line.setAttribute("points",stroke.points.map(p=>[(p[0]*W).toFixed(1),(p[1]*H).toFixed(1)].join(",")).join(" "));
    svg.onpointermove=ev=>{ stroke.points.push([clamp01((ev.clientX-rect.left)/W),clamp01((ev.clientY-rect.top)/H)]); draw(); };
    svg.onpointerup=()=>{ svg.onpointermove=null; svg.onpointerup=null;
      if(stroke.points.length>1){ planData().ink.push(stroke); saveKeeper(); } else { svg.removeChild(line); } };
  };
}

/* ---- goal lanes ---- */
function renderPlanLanes(){
  const box=document.getElementById("planLanes"); if(!box) return;
  const lanes=planData().lanes;
  box.innerHTML=PLAN_LANES.map(l=>{
    const items=lanes[l.key]||[];
    return '<div class="lane" style="--lc:'+l.color+'"><div class="lane-h"><span class="lane-dot"></span>'+esc(l.name)+' <b>'+items.length+'</b></div>'+
      '<div class="lane-items">'+(items.length?items.map(it=>
        '<div class="lane-it'+(it.done?" done":"")+'" data-lane="'+l.key+'" data-id="'+it.id+'">'+
          '<button class="li-tick" data-lane="'+l.key+'" data-id="'+it.id+'" title="Mark done">'+(it.done?"✓":"")+'</button>'+
          '<span class="li-txt">'+esc(it.text)+'</span>'+
          '<button class="li-asana" data-lane="'+l.key+'" data-id="'+it.id+'" title="Make an Asana task">➦</button>'+
          '<button class="li-x" data-lane="'+l.key+'" data-id="'+it.id+'" title="Remove">✕</button></div>').join("")
        :'<div class="lane-empty">What do we want to achieve here in 90 days?</div>')+'</div>'+
      '<div class="lane-add"><input class="lane-inp" data-lane="'+l.key+'" placeholder="Add to '+esc(l.name)+'…"></div></div>';
  }).join("");
  const laneOf=k=>planData().lanes[k];
  box.querySelectorAll(".lane-inp").forEach(inp=>inp.onkeydown=e=>{
    if(e.key!=="Enter") return; const txt=inp.value.trim(); if(!txt) return;
    laneOf(inp.dataset.lane).push({id:"ll"+Date.now(),text:txt,done:false}); inp.value=""; saveKeeper(); renderPlanLanes();
  });
  box.querySelectorAll(".li-x").forEach(b=>b.onclick=()=>{ const k=b.dataset.lane;
    planData().lanes[k]=laneOf(k).filter(x=>x.id!==b.dataset.id); saveKeeper(); renderPlanLanes(); });
  box.querySelectorAll(".li-tick").forEach(b=>b.onclick=()=>{ const it=laneOf(b.dataset.lane).find(x=>x.id===b.dataset.id);
    if(it){ it.done=!it.done; saveKeeper(); renderPlanLanes(); } });
  box.querySelectorAll(".li-asana").forEach(b=>b.onclick=()=>{ const l=PLAN_LANES.find(x=>x.key===b.dataset.lane);
    const it=laneOf(b.dataset.lane).find(x=>x.id===b.dataset.id); if(it) planPush(it.text, l?l.name:"Plan"); });
}

/* ---- push an agreed plan item into Asana as a real task ---- */
async function planPush(text, source){
  text=(text||"").trim();
  if(!text){ toast("Add some words first, then push it"); return; }
  const target=document.getElementById("planPushTarget");
  const gid=(target&&target.value)||planDefaultPushTarget();
  if(!gid){ toast("Pick a board to push to"); return; }
  const proj=(cfg.projects||[]).find(p=>p.gid===gid);
  try{
    await call("create_tasks",{tasks:[{name:text, project_id:gid, notes:"From the 90-day plan"+(source?" · "+source:"")+" · "+iso(todayD())}]});
    toast("Added to "+(proj?proj.name:"Asana")); if(typeof confetti==="function") confetti();
    if(typeof loadAll==="function") loadAll();
  }catch(e){ toast("Couldn't push: "+e.message); }
}

/* re-fit notes & ink when the plan tab is opened at real size, or on resize */
let _planResizeT=null;
window.addEventListener("resize",()=>{
  if(!document.getElementById("tab-plan")||!document.getElementById("tab-plan").classList.contains("active")) return;
  clearTimeout(_planResizeT); _planResizeT=setTimeout(()=>{ renderPlanInk(); renderPlanNotes(); },150);
});
