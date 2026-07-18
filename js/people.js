/* ================================================================
   THE CREW — lanes, shared priority ordering, top-10 focus,
              notes & passion projects
   ================================================================ */

function cardHTML(t, opts){
  opts=opts||{};
  const today=todayD(); const over=t.due&&pd(t.due)<today&&!t.completed; const camp=isCampaignTask(t);
  return '<div class="card'+(camp?" camp":"")+(opts.handle?" ordered":"")+'" draggable="true" data-gid="'+t.gid+'" style="--pc:'+(t.isShoot?"#00A8A8":t.projectColor)+'">'+
    (opts.handle?'<span class="grip">⠿</span>':'')+
    '<div class="c-in"><div class="cn">'+(t.isShoot?'<span class="tag shoot">SHOOT</span> ':camp?'<span class="tag camp">CAMPAIGN</span> ':"")+esc(t.name)+'</div>'+
    '<div class="cmeta"><span class="dot" style="background:'+t.projectColor+'"></span>'+esc(t.projectName)+
    (t.due?'<span class="'+(over?"overdue":"")+'">'+(over?"⚠ ":"")+pd(t.due).toDateString().slice(4,10)+'</span>':'<span>no date</span>')+'</div></div>'+
    '<button class="ctick" data-tick="'+t.gid+'" title="Done!">✓</button></div>';
}
function wireCards(scope){
  scope.querySelectorAll(".card").forEach(c=>{
    c.onclick=e=>{ if(e.target.closest(".ctick")||e.target.closest(".grip")) return; openDrawer(c.dataset.gid); };
    c.ondragstart=e=>e.dataTransfer.setData("text/gid",c.dataset.gid);
  });
  scope.querySelectorAll(".ctick").forEach(b=>b.onclick=e=>{ e.stopPropagation(); toggleDone(b.dataset.tick,true); });
}

/* ---- personal workspace helpers (notes/passion) ---- */
const paneOpen = {};
const addMode  = {};
function paneIsOpen(gid,p){ const k=gid+":"+p; if(paneOpen[k]===undefined) paneOpen[k]=(p==="tasks"); return paneOpen[k]; }
function modeFor(gid,kind){ const k=gid+":"+kind; if(!addMode[k]) addMode[k]="shared"; return addMode[k]; }
function privKey(kind,gid){ return "ob_"+kind+"_"+gid; }
function privGet(kind,gid){ try{ return JSON.parse(localStorage.getItem(privKey(kind,gid)))||[]; }catch(e){ return []; } }
function privSave(kind,gid,arr){ localStorage.setItem(privKey(kind,gid),JSON.stringify(arr)); }
function privAdd(kind,gid,text){ const a=privGet(kind,gid); a.unshift({id:"p"+Date.now(),text}); privSave(kind,gid,a); }
function privDel(kind,gid,id){ privSave(kind,gid,privGet(kind,gid).filter(x=>x.id!==id)); }
function sharedItems(kind,gid){
  return state.tasks.filter(t=> (kind==="notes"?t.isNote:t.isPassion) && !t.isKeeper && t.assignee && t.assignee.gid===gid);
}
async function addShared(kind,gid,text){
  try{
    await call("create_tasks",{tasks:[{name:text,project_id:PB.proj,section_id:kind==="notes"?PB.notes:PB.passion,assignee:gid}]});
    toast("Saved for the team"); loadAll();
  }catch(e){ toast("Failed: "+e.message); }
}
async function delShared(taskGid){
  try{ await call("delete_task",{task:taskGid}); toast("Deleted"); loadAll(); }
  catch(e){ toast("Failed: "+e.message); }
}
async function addDayTask(gid,name,due){
  const task={name,project_id:PB.proj,section_id:PB.day}; if(gid!=="unassigned") task.assignee=gid; if(due) task.due_on=due;
  try{ await call("create_tasks",{tasks:[task]}); toast("Added"); loadAll(); }
  catch(e){ toast("Failed: "+e.message); }
}

function itemsPanelHTML(gid,kind){
  const mode=modeFor(gid,kind);
  const shared=sharedItems(kind,gid), priv=privGet(kind,gid);
  const item=(text,scope,id)=>
    '<div class="witem '+kind+'"><span class="wtxt">'+esc(text)+'</span>'+
    '<span class="wbadge '+scope+'">'+(scope==="shared"?"team":"me")+'</span>'+
    '<button class="wdel" data-kind="'+kind+'" data-scope="'+scope+'" data-id="'+id+'" data-gid="'+gid+'">✕</button></div>';
  let list = shared.map(t=>item(t.name,"shared",t.gid)).join("") + priv.map(p=>item(p.text,"private",p.id)).join("");
  if(!shared.length && !priv.length) list='<div class="empty">'+(kind==="passion"?"No side quests yet":"Clean slate")+'</div>';
  return '<div class="modebar">'+
      '<span class="mode-btn'+(mode==="shared"?" on":"")+'" data-gid="'+gid+'" data-kind="'+kind+'" data-mode="shared">Team</span>'+
      '<span class="mode-btn'+(mode==="private"?" on":"")+'" data-gid="'+gid+'" data-kind="'+kind+'" data-mode="private">Just me</span>'+
      '<span class="modehint">'+(mode==="shared"?"saves to Asana — the crew sees it":"stays on this device")+'</span>'+
    '</div>'+
    '<div class="additem"><input class="witem-input" data-gid="'+gid+'" data-kind="'+kind+'" placeholder="'+(kind==="notes"?"Jot a note…":"Add a side quest…")+'">'+
      '<button class="witem-add" data-gid="'+gid+'" data-kind="'+kind+'">Add</button></div>'+
    '<div class="wlist">'+list+'</div>';
}

/* ---- ordering helpers ---- */
function orderedTasks(gid, mine){
  const ord = state.order[gid]||[];
  const inOrder=[], rest=[];
  mine.forEach(t=>{ (ord.includes(t.gid)?inOrder:rest).push(t); });
  inOrder.sort((a,b)=>ord.indexOf(a.gid)-ord.indexOf(b.gid));
  rest.sort((a,b)=>(a.due||"9999")<(b.due||"9999")?-1:1);
  return [...inOrder,...rest];
}

function renderPeople(){
  const board=document.getElementById("peopleBoard"); board.innerHTML="";
  const lanes=[...cfg.people.map(g=>({gid:g,name:userName(g)})),{gid:"unassigned",name:"Unassigned"}];
  const pool=state.tasks.filter(t=>!t.isOccasion && !t.isNote && !t.isPassion && !t.isKeeper && !t.isPlaceholder && !t.isComms && !t.isShot && !t.isBrief && (state.showDone||!t.completed));
  const today=todayD();
  const counts = lanes.map(L=>pool.filter(t=> L.gid==="unassigned" ? !t.assignee : (t.assignee&&t.assignee.gid===L.gid)).length);
  const maxCount = Math.max(1,...counts);
  lanes.forEach((L,li)=>{
    const mine=pool.filter(t=> L.gid==="unassigned" ? !t.assignee : (t.assignee&&t.assignee.gid===L.gid));
    const mode = state.laneMode[L.gid]||"date";
    let tasksBody="";
    if(mode==="order" && L.gid!=="unassigned"){
      const list=orderedTasks(L.gid,mine);
      const top=list.slice(0,10), restN=list.length-10;
      tasksBody='<div class="lane-sub">'+firstName(L.name)+"'s order — drag to shuffle</div>"+
        '<div class="orderlist" data-lane="'+L.gid+'">'+top.map(t=>cardHTML(t,{handle:true})).join("")+'</div>'+
        (restN>0?'<button class="btn ghost sm showall" data-lane="'+L.gid+'">show '+restN+' more</button>':"");
      if(paneOpen["exp:"+L.gid]) tasksBody='<div class="lane-sub">'+firstName(L.name)+"'s order — drag to shuffle</div>"+
        '<div class="orderlist" data-lane="'+L.gid+'">'+list.map(t=>cardHTML(t,{handle:true})).join("")+'</div>';
    }else{
      const over=mine.filter(t=>t.due&&pd(t.due)<today);
      const wk=mine.filter(t=>{if(!t.due)return false;const d=pd(t.due);return d>=today&&d<today.valueOf()+7*864e5;});
      const later=mine.filter(t=>t.due&&pd(t.due)>=today.valueOf()+7*864e5);
      const nd=mine.filter(t=>!t.due);
      const grp=(title,arr)=> arr.length? '<div class="lane-sub">'+title+'</div>'+arr.map(t=>cardHTML(t)).join("") : "";
      const all=[["⚠ Overdue",over],["This week",wk],["Later",later],["No date",nd]];
      let shown=0, html="";
      const expanded = paneOpen["exp:"+L.gid];
      for(const [title,arr] of all){
        if(!arr.length) continue;
        if(!expanded && shown>=10) break;
        const slice = expanded?arr:arr.slice(0,Math.max(0,10-shown));
        if(slice.length) html+=grp(title,slice);
        shown+=slice.length;
      }
      const hidden = mine.length-shown;
      tasksBody = html + (hidden>0 && !expanded ? '<button class="btn ghost sm showall" data-lane="'+L.gid+'">show '+hidden+' more</button>' : "");
    }
    if(!mine.length) tasksBody='<div class="empty">'+pick(EMPTY_LINES)+'</div>';
    const quick='<div class="qadd"><input class="qadd-name" data-gid="'+L.gid+'" placeholder="+ quick task…">'+
      '<input type="date" class="qadd-date" data-gid="'+L.gid+'"><button class="qadd-btn" data-gid="'+L.gid+'">Add</button></div>';

    const panel=(p,icon,label,body)=>{
      const open=paneIsOpen(L.gid,p);
      return '<div class="panel"><div class="panel-h" data-gid="'+L.gid+'" data-panel="'+p+'">'+
        '<span>'+(icon?icon+' ':'')+label+'</span><span class="caret">'+(open?"▾":"▸")+'</span></div>'+
        '<div class="panel-b" style="'+(open?"":"display:none")+'">'+body+'</div></div>';
    };
    const load = Math.round(counts[li]/maxCount*100);
    const modeToggle = L.gid==="unassigned" ? "" :
      '<span class="lmode" data-lane="'+L.gid+'" title="Toggle date / my order">'+(mode==="order"?"my order":"by date")+'</span>';

    const lane=document.createElement("div"); lane.className="lane"; lane.dataset.gid=L.gid;
    lane.style.animationDelay=(li*60)+"ms";
    lane.innerHTML=
      '<div class="lane-h"><span class="avatar" style="--hue:'+(li*70)+'">'+(L.gid==="unassigned"?"—":initials(L.name))+'</span>'+
        '<span class="nm">'+esc(firstName(L.name))+'</span>'+modeToggle+'<span class="ct" title="'+mine.length+' open tasks">'+mine.length+'</span></div>'+
      '<div class="loadbar"><i style="width:'+load+'%"></i></div>'+
      '<div class="lane-body">'+
        panel("tasks","","Tasks",tasksBody+quick)+
        (L.gid==="unassigned"?"":panel("notes","","Notes",itemsPanelHTML(L.gid,"notes")))+
        (L.gid==="unassigned"?"":panel("passion","","Side Quests",itemsPanelHTML(L.gid,"passion")))+
      '</div>';
    board.appendChild(lane);

    lane.ondragover=e=>{e.preventDefault();lane.classList.add("dragover");};
    lane.ondragleave=()=>lane.classList.remove("dragover");
    lane.ondrop=e=>{e.preventDefault();lane.classList.remove("dragover");
      if(lane._reordering){ lane._reordering=false; return; }
      const gid=e.dataTransfer.getData("text/gid"); if(gid) reassign(gid,L.gid);};
    wireCards(lane);
    wireLane(lane,L.gid);
    wireOrderList(lane,L.gid);
  });
}

function wireOrderList(lane,gid){
  const list=lane.querySelector(".orderlist"); if(!list) return;
  let dragging=null;
  list.querySelectorAll(".card").forEach(card=>{
    card.ondragstart=e=>{ dragging=card; e.dataTransfer.setData("text/gid",card.dataset.gid); setTimeout(()=>card.classList.add("ghosting"),0); };
    card.ondragend=()=>{ if(dragging){dragging.classList.remove("ghosting");} dragging=null; };
  });
  list.ondragover=e=>{
    if(!dragging) return;
    e.preventDefault(); e.stopPropagation();
    const after=[...list.querySelectorAll(".card:not(.ghosting)")].find(c=>{
      const r=c.getBoundingClientRect(); return e.clientY < r.top + r.height/2;
    });
    if(after) list.insertBefore(dragging, after); else list.appendChild(dragging);
  };
  list.ondrop=e=>{
    if(!dragging) return;
    e.preventDefault(); e.stopPropagation(); lane._reordering=true;
    state.order[gid]=[...list.querySelectorAll(".card")].map(c=>c.dataset.gid);
    saveOrder(); toast("Priorities shuffled");
  };
}

function wireLane(lane,gid){
  lane.querySelectorAll(".panel-h").forEach(h=>h.onclick=()=>{
    const k=h.dataset.gid+":"+h.dataset.panel; paneOpen[k]=!paneIsOpen(h.dataset.gid,h.dataset.panel); renderPeople();
  });
  const lm=lane.querySelector(".lmode");
  if(lm) lm.onclick=()=>{ state.laneMode[gid]=(state.laneMode[gid]==="order"?"date":"order"); renderPeople(); };
  lane.querySelectorAll(".showall").forEach(b=>b.onclick=()=>{ paneOpen["exp:"+b.dataset.lane]=true; renderPeople(); });
  const qn=lane.querySelector(".qadd-name"), qd=lane.querySelector(".qadd-date"), qb=lane.querySelector(".qadd-btn");
  if(qb){ const go=()=>{ const n=qn.value.trim(); if(!n){toast("Type a task name");return;} addDayTask(gid,n,qd.value||null); };
    qb.onclick=go; qn.onkeydown=e=>{ if(e.key==="Enter") go(); }; }
  lane.querySelectorAll(".mode-btn").forEach(b=>b.onclick=()=>{ addMode[b.dataset.gid+":"+b.dataset.kind]=b.dataset.mode; renderPeople(); });
  lane.querySelectorAll(".witem-add").forEach(b=>{
    const inp=lane.querySelector('.witem-input[data-kind="'+b.dataset.kind+'"]');
    const go=()=>{ const txt=inp.value.trim(); if(!txt) return; const kind=b.dataset.kind, g=b.dataset.gid;
      if(modeFor(g,kind)==="shared") addShared(kind,g,txt); else { privAdd(kind,g,txt); renderPeople(); toast("Saved on this device"); } };
    b.onclick=go; inp.onkeydown=e=>{ if(e.key==="Enter") go(); };
  });
  lane.querySelectorAll(".wdel").forEach(b=>b.onclick=()=>{
    if(b.dataset.scope==="shared") delShared(b.dataset.id);
    else { privDel(b.dataset.kind,b.dataset.gid,b.dataset.id); renderPeople(); toast("Removed"); }
  });
}
