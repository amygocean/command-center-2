/* ================================================================
   THE GIRLS — each person's real Asana My Tasks, with app-side
   sections ("Top 3 right now" + your own), drag-to-prioritise,
   hide & private toggles, an unassigned pool, the corkboard,
   and the trophy cabinet.
   Shared layout state lives in the keeper task (state.keeper.girls).
   ================================================================ */

function girlCfg(key){ return state.keeper.girls[key]; }
function isMe(key){ const g=GIRLS.find(x=>x.key===key); return state.me && g && state.me.gid===g.gid; }
function myKey(){ const g=GIRLS.find(x=>state.me && x.gid===state.me.gid); return g?g.key:null; }

function visibleGirlTasks(key){
  const gc=girlCfg(key);
  return state.myTasks[key].filter(t=>{
    if(gc.private.includes(t.gid) && !isMe(key)) return false;
    return true;
  });
}

/* ---- lane rendering ---- */
function girlCardHTML(t,key){
  const gc=girlCfg(key);
  const today=todayD(); const over=t.due&&pd(t.due)<today;
  const hidden=gc.hidden.includes(t.gid), priv=gc.private.includes(t.gid);
  return '<div class="card gcard'+(hidden?" is-hidden":"")+'" draggable="true" data-gid="'+t.gid+'" data-key="'+key+'">'+
    '<span class="grip">⠿</span>'+
    '<div class="c-in"><div class="cn">'+esc(t.name)+(priv?' <span class="pv-tag">private</span>':'')+'</div>'+
    '<div class="cmeta">'+esc(t.projectName)+
    (t.due?'<span class="'+(over?"overdue":"")+'">'+(over?"⚠ ":"")+pd(t.due).toDateString().slice(4,10)+'</span>':'<span>no date</span>')+'</div></div>'+
    '<span class="c-acts">'+
      (isMe(key)?'<button class="cmini" data-priv="'+t.gid+'" title="'+(priv?"Make visible to the girls":"Only I can see this")+'">'+(priv?"🔓":"🔒")+'</button>':'')+
      '<button class="cmini" data-hide="'+t.gid+'" title="'+(hidden?"Unhide":"Hide (placeholder / noise)")+'">'+(hidden?"👁":"—")+'</button>'+
      '<button class="ctick" data-tick="'+t.gid+'" data-key="'+key+'" title="Done">✓</button>'+
    '</span></div>';
}

function renderGirls(){
  const board=document.getElementById("girlsBoard"); if(!board) return;
  let html='';
  GIRLS.forEach(g=>{
    const gc=girlCfg(g.key);
    const all=visibleGirlTasks(g.key);
    const err=state.myTasksErr[g.key];
    const inSection=new Set(gc.sections.flatMap(s=>s.taskIds));
    const rest=all.filter(t=>!inSection.has(t.gid)&&!gc.hidden.includes(t.gid));
    rest.sort((a,b)=>{
      const ia=gc.order.indexOf(a.gid), ib=gc.order.indexOf(b.gid);
      if(ia>=0&&ib>=0) return ia-ib;
      if(ia>=0) return -1; if(ib>=0) return 1;
      return (a.due||"9999")<(b.due||"9999")?-1:1;
    });
    const hiddenTasks=all.filter(t=>gc.hidden.includes(t.gid));

    let body='';
    gc.sections.forEach(sec=>{
      const secTasks=sec.taskIds.map(id=>all.find(t=>t.gid===id)).filter(Boolean).filter(t=>!gc.hidden.includes(t.gid));
      body+='<div class="gsec" data-key="'+g.key+'" data-sec="'+sec.id+'">'+
        '<div class="lane-sub">'+esc(sec.name)+
        (sec.id!=="top3"?' <button class="sec-del" data-key="'+g.key+'" data-sec="'+sec.id+'" title="Remove section">✕</button>':'')+'</div>'+
        '<div class="gdrop" data-key="'+g.key+'" data-sec="'+sec.id+'">'+
        (secTasks.length?secTasks.map(t=>girlCardHTML(t,g.key)).join(""):'<div class="gph">drag tasks here</div>')+
        '</div></div>';
    });
    body+='<div class="gsec" data-key="'+g.key+'" data-sec="rest">'+
      '<div class="lane-sub">Everything else</div>'+
      '<div class="gdrop" data-key="'+g.key+'" data-sec="rest">'+
      (rest.length?rest.map(t=>girlCardHTML(t,g.key)).join(""):'<div class="gph">'+(all.length?"all sorted":pick(EMPTY_LINES))+'</div>')+
      '</div></div>';
    if(hiddenTasks.length){
      const open=paneOpen["gh:"+g.key];
      body+='<div class="ghid" data-key="'+g.key+'">hidden ('+hiddenTasks.length+') '+(open?"▾":"▸")+'</div>';
      if(open) body+='<div class="gdrop">'+hiddenTasks.map(t=>girlCardHTML(t,g.key)).join("")+'</div>';
    }
    if(err==="no_pat") body='<div class="empty" style="padding:30px 8px">Not connected yet.<br>Add <b>'+g.key.toUpperCase()+'_PAT</b> in Vercel → redeploy, and '+esc(g.name)+"'s My Tasks appear here.</div>";
    else if(err) body='<div class="empty">Couldn\'t load: '+esc(err)+'</div>';

    html+='<div class="lane glane" data-key="'+g.key+'">'+
      '<div class="lane-h"><span class="avatar" style="--hue:'+(GIRLS.indexOf(g)*70)+'">'+g.name[0]+g.name[1].toUpperCase()+'</span>'+
      '<span class="nm">'+esc(g.name)+'</span>'+
      '<button class="lmode" data-addsec="'+g.key+'">+ section</button>'+
      '<span class="ct">'+all.filter(t=>!gc.hidden.includes(t.gid)).length+'</span></div>'+
      '<div class="lane-body">'+body+
      '<div class="qadd"><input class="qadd-name" data-key="'+g.key+'" placeholder="+ quick task…">'+
      '<button class="qadd-btn" data-key="'+g.key+'">Add</button></div></div></div>';
  });

  // unassigned pool from the boards
  const pool=state.tasks.filter(t=>!t.assignee && !t.completed &&
    !t.isOccasion&&!t.isNote&&!t.isPassion&&!t.isKeeper&&!t.isShot&&!t.isBrief&&
    !t.isComms&&!t.isVisit&&!t.isOpening&&!t.isBug&&!t.isPlaceholder);
  html+='<div class="lane glane pool"><div class="lane-h"><span class="nm">Up for grabs</span><span class="ct">'+pool.length+'</span></div>'+
    '<div class="lane-body"><p class="hint" style="margin:4px 0 8px">Unassigned on the boards — drag onto a girl to hand it out.</p>'+
    (pool.length?pool.slice(0,15).map(t=>
      '<div class="card gcard" draggable="true" data-gid="'+t.gid+'" data-pool="1">'+
      '<div class="c-in"><div class="cn">'+esc(t.name)+'</div>'+
      '<div class="cmeta"><span class="dot" style="background:'+t.projectColor+'"></span>'+esc(t.projectName)+
      (t.due?'<span>'+pd(t.due).toDateString().slice(4,10)+'</span>':'')+'</div></div></div>').join("")
    :'<div class="empty">'+pick(EMPTY_LINES)+'</div>')+
    '</div></div>';

  board.innerHTML=html;
  wireGirls(board);
  renderCorkboard();
}

/* ---- interactions ---- */
let gDragging=null;
function wireGirls(board){
  board.querySelectorAll(".gcard").forEach(card=>{
    card.onclick=e=>{ if(e.target.closest(".c-acts")||e.target.closest(".grip")) return; openDrawer(card.dataset.gid); };
    card.ondragstart=e=>{ gDragging=card; e.dataTransfer.setData("text/gid",card.dataset.gid); setTimeout(()=>card.classList.add("ghosting"),0); };
    card.ondragend=()=>{ if(gDragging) gDragging.classList.remove("ghosting"); gDragging=null; };
  });
  board.querySelectorAll(".ctick").forEach(b=>b.onclick=e=>{ e.stopPropagation(); completeGirlTask(b.dataset.tick,b.dataset.key); });
  board.querySelectorAll("[data-hide]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const card=b.closest(".gcard"), key=card.dataset.key, gc=girlCfg(key), gid=b.dataset.hide;
    const i=gc.hidden.indexOf(gid); if(i>=0) gc.hidden.splice(i,1); else gc.hidden.push(gid);
    saveKeeper(); renderGirls();
  });
  board.querySelectorAll("[data-priv]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const card=b.closest(".gcard"), key=card.dataset.key, gc=girlCfg(key), gid=b.dataset.priv;
    if(!isMe(key)) return;
    const i=gc.private.indexOf(gid); if(i>=0) gc.private.splice(i,1); else gc.private.push(gid);
    saveKeeper(); renderGirls(); toast(i>=0?"Visible to the girls":"Just for you now");
  });
  board.querySelectorAll(".ghid").forEach(h=>h.onclick=()=>{ paneOpen["gh:"+h.dataset.key]=!paneOpen["gh:"+h.dataset.key]; renderGirls(); });
  board.querySelectorAll("[data-addsec]").forEach(b=>b.onclick=()=>{
    const name=prompt("Name the section (e.g. Waiting on others)"); if(!name) return;
    girlCfg(b.dataset.addsec).sections.push({id:"s"+Date.now(),name:name.trim(),taskIds:[]});
    saveKeeper(); renderGirls();
  });
  board.querySelectorAll(".sec-del").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const gc=girlCfg(b.dataset.key);
    gc.sections=gc.sections.filter(s=>s.id!==b.dataset.sec);
    saveKeeper(); renderGirls();
  });

  // drop zones: sections + rest (reorder / re-section), lanes (reassign)
  board.querySelectorAll(".gdrop").forEach(zone=>{
    zone.ondragover=e=>{
      if(!gDragging) return;
      e.preventDefault(); e.stopPropagation();
      const after=[...zone.querySelectorAll(".gcard:not(.ghosting)")].find(c=>{
        const r=c.getBoundingClientRect(); return e.clientY < r.top + r.height/2;
      });
      if(after) zone.insertBefore(gDragging, after); else zone.appendChild(gDragging);
    };
    zone.ondrop=e=>{
      if(!gDragging) return;
      e.preventDefault(); e.stopPropagation();
      const gid=gDragging.dataset.gid;
      const fromPool=gDragging.dataset.pool==="1";
      const key=zone.dataset.key, secId=zone.dataset.sec;
      if(!key){ return; }
      if(fromPool || gDragging.dataset.key!==key){ assignToGirl(gid,key,fromPool); return; }
      const gc=girlCfg(key);
      gc.sections.forEach(s=>{ s.taskIds=s.taskIds.filter(id=>id!==gid); });
      if(secId!=="rest"){
        const sec=gc.sections.find(s=>s.id===secId);
        if(sec) sec.taskIds=[...zone.querySelectorAll(".gcard")].map(c=>c.dataset.gid);
      }
      // capture rest order from its zone
      const restZone=board.querySelector('.gdrop[data-key="'+key+'"][data-sec="rest"]');
      if(restZone) gc.order=[...restZone.querySelectorAll(".gcard")].map(c=>c.dataset.gid);
      saveKeeper(); renderGirls(); toast("Shuffled");
    };
  });
  board.querySelectorAll(".glane:not(.pool)").forEach(lane=>{
    lane.ondragover=e=>{ if(gDragging) e.preventDefault(); };
    lane.ondrop=e=>{
      if(!gDragging) return;
      e.preventDefault();
      const key=lane.dataset.key;
      if(gDragging.dataset.pool==="1" || (gDragging.dataset.key&&gDragging.dataset.key!==key))
        assignToGirl(gDragging.dataset.gid,key,gDragging.dataset.pool==="1");
    };
  });
  board.querySelectorAll(".qadd-btn").forEach(b=>{
    const inp=board.querySelector('.qadd-name[data-key="'+b.dataset.key+'"]');
    const go=async()=>{
      const n=inp.value.trim(); if(!n){toast("Type a task name");return;}
      const g=GIRLS.find(x=>x.key===b.dataset.key);
      try{ await call("create_tasks",{tasks:[{name:n,assignee:g.gid,project_id:PB.proj,section_id:PB.day}]});
        toast("Added"); inp.value=""; loadAll();
      }catch(e){ toast("Failed: "+e.message); }
    };
    b.onclick=go; inp.onkeydown=e=>{ if(e.key==="Enter") go(); };
  });
  const tc=document.getElementById("btnTrophy");
  if(tc && !tc.dataset.wired){ tc.dataset.wired="1"; tc.onclick=openTrophy; }
}

async function assignToGirl(gid,key,fromPool){
  const g=GIRLS.find(x=>x.key===key); if(!g) return;
  try{
    await call("update_tasks",{tasks:[{task:gid,assignee:g.gid}]});
    toast("Handed to "+g.name);
    loadAll();
  }catch(e){ toast("Failed: "+e.message); }
}

async function completeGirlTask(gid,key){
  const list=state.myTasks[key];
  const i=list.findIndex(t=>t.gid===gid);
  const t=i>=0?list[i]:null;
  if(i>=0) list.splice(i,1);
  renderGirls(); toast(pick(DONE_LINES));
  try{ await call("update_tasks",{tasks:[{task:gid,completed:true}]}); }
  catch(e){ if(t) list.splice(i,0,t); renderGirls(); toast("Failed: "+e.message); }
}

/* ---- trophy cabinet ---- */
async function openTrophy(){
  showModal('<h2>The trophy cabinet</h2><div id="trophyBody"><span class="spin"></span> counting the wins…</div>'+
    '<div class="drawer-actions"><button class="btn glow" id="trophyAI">Summarise the impact</button>'+
    '<button class="btn ghost" data-close>Close</button></div>');
  wireModalClose();
  const jan1=new Date(new Date().getFullYear(),0,1).toISOString();
  const monthStart=new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const done={};
  await Promise.all(GIRLS.map(async g=>{
    try{
      const r=await call("get_my_tasks",{person:g.key,completed_since:jan1});
      done[g.key]=(r.data||[]).filter(t=>t.completed);
    }catch(e){ done[g.key]=[]; }
  }));
  const body=document.getElementById("trophyBody"); if(!body) return;
  let html='<div class="ins-tiles" style="grid-template-columns:repeat(3,1fr)">';
  GIRLS.forEach(g=>{
    const ytd=done[g.key].length;
    const mo=done[g.key].filter(t=>t.completed_at&&new Date(t.completed_at)>=monthStart).length;
    html+='<div class="tile"><b>'+ytd+'</b><span>'+esc(g.name)+' · YTD ('+mo+' this month)</span></div>';
  });
  html+='</div><div class="ins-h">Recently shipped</div>';
  const recent=GIRLS.flatMap(g=>done[g.key].map(t=>({...t,who:g.name})))
    .sort((a,b)=>(b.completed_at||"")<(a.completed_at||"")?-1:1).slice(0,12);
  html+=recent.map(t=>'<div class="f-row"><span>'+esc(t.name)+'</span><span class="f-meta">'+esc(t.who)+'</span></div>').join("")||'<div class="empty">Nothing yet this year.</div>';
  body.innerHTML=html;
  document.getElementById("trophyAI").onclick=async()=>{
    const btn=document.getElementById("trophyAI"); btn.disabled=true; btn.innerHTML='<span class="spin"></span> writing…';
    try{
      const text=await askAI(
        "You summarise the accomplishments of the Ocean Basket Academy team (Amy, Caitlin, Jess) for an internal impact report. From the completed-task lists, write: one headline paragraph on key business impact and value added this year, then 3-4 bullets of standout themes (courses shipped, shoots delivered, platform fixes, campaigns). Warm, concrete, no fluff, under 150 words.",
        [{completed_year_to_date:{amy:done.amy.map(t=>t.name),caitlin:done.caitlin.map(t=>t.name),jess:done.jess.map(t=>t.name)}}]);
      body.insertAdjacentHTML("beforeend",'<div class="ins-h" style="margin-top:16px">The impact</div><div class="ideabox">'+esc(text).replace(/\n/g,"<br>")+'</div>');
    }catch(e){ toast("Couldn't summarise: "+e.message); }
    btn.disabled=false; btn.textContent="Summarise the impact";
  };
}

/* ---- corkboard ---- */
function renderCorkboard(){
  const cb=document.getElementById("corkboard"); if(!cb) return;
  const notes=state.keeper.cork;
  cb.innerHTML='<div class="cork-h">The corkboard</div>'+
    '<div class="cork-area" id="corkArea">'+
    notes.map(n=>'<div class="sticky" data-id="'+n.id+'" style="background:'+n.color+';left:'+(n.x||10)+'px;top:'+(n.y||10)+'px">'+
      '<button class="sticky-x" data-id="'+n.id+'">✕</button>'+
      '<div class="sticky-txt">'+esc(n.text)+'</div>'+
      '<div class="sticky-by">'+esc(n.author)+'</div></div>').join("")+
    '</div>'+
    '<div class="cork-add"><input id="corkText" placeholder="Pin a note…">'+
    '<div class="cork-colors">'+STICKY_COLORS.map((c,i)=>'<span class="ckc'+(i===0?" on":"")+'" data-c="'+c+'" style="background:'+c+'"></span>').join("")+'</div>'+
    '<button class="qadd-btn" id="corkPin">Pin</button></div>';

  let color=STICKY_COLORS[0];
  cb.querySelectorAll(".ckc").forEach(el=>el.onclick=()=>{
    cb.querySelectorAll(".ckc").forEach(x=>x.classList.remove("on")); el.classList.add("on"); color=el.dataset.c;
  });
  const pin=()=>{
    const inp=document.getElementById("corkText"); const txt=inp.value.trim(); if(!txt) return;
    state.keeper.cork.push({id:"n"+Date.now(),text:txt,color,
      x:8+Math.random()*60, y:8+Math.random()*120,
      author:firstName(state.me&&state.me.name)||"someone", at:iso(todayD())});
    saveKeeper(); renderCorkboard();
  };
  document.getElementById("corkPin").onclick=pin;
  document.getElementById("corkText").onkeydown=e=>{ if(e.key==="Enter") pin(); };
  cb.querySelectorAll(".sticky-x").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    state.keeper.cork=state.keeper.cork.filter(n=>n.id!==b.dataset.id);
    saveKeeper(); renderCorkboard();
  });
  // free drag
  cb.querySelectorAll(".sticky").forEach(el=>{
    el.onpointerdown=e=>{
      if(e.target.closest(".sticky-x")) return;
      const area=document.getElementById("corkArea").getBoundingClientRect();
      const sx=e.clientX-el.offsetLeft, sy=e.clientY-el.offsetTop;
      el.setPointerCapture(e.pointerId);
      el.classList.add("lifted");
      el.onpointermove=ev=>{
        el.style.left=Math.max(0,Math.min(area.width-150, ev.clientX-sx))+"px";
        el.style.top=Math.max(0,Math.min(area.height-90, ev.clientY-sy))+"px";
      };
      el.onpointerup=()=>{
        el.onpointermove=null; el.classList.remove("lifted");
        const n=state.keeper.cork.find(x=>x.id===el.dataset.id);
        if(n){ n.x=parseFloat(el.style.left); n.y=parseFloat(el.style.top); saveKeeper(); }
      };
    };
  });
}

/* legacy shims — old callers */
const paneOpen = {};
function renderPeople(){ renderGirls(); }

/* ---- board-task cards (calendar day view etc.) ---- */
function cardHTML(t){
  const today=todayD(); const over=t.due&&pd(t.due)<today&&!t.completed; const camp=isCampaignTask(t);
  return '<div class="card" draggable="true" data-gid="'+t.gid+'" style="--pc:'+(t.isShoot?"#00A8A8":t.projectColor)+'">'+
    '<div class="c-in"><div class="cn">'+(t.isShoot?'<span class="tag shoot">SHOOT</span> ':camp?'<span class="tag camp">CAMPAIGN</span> ':"")+esc(t.name)+'</div>'+
    '<div class="cmeta"><span class="dot" style="background:'+t.projectColor+'"></span>'+esc(t.projectName)+
    (t.due?'<span class="'+(over?"overdue":"")+'">'+(over?"⚠ ":"")+pd(t.due).toDateString().slice(4,10)+'</span>':'<span>no date</span>')+'</div></div>'+
    '<button class="ctick" data-tick="'+t.gid+'" title="Done">✓</button></div>';
}
function wireCards(scope){
  scope.querySelectorAll(".card").forEach(c=>{
    c.onclick=e=>{ if(e.target.closest(".ctick")) return; openDrawer(c.dataset.gid); };
    c.ondragstart=e=>e.dataTransfer.setData("text/gid",c.dataset.gid);
  });
  scope.querySelectorAll(".ctick[data-tick]").forEach(b=>{
    if(b.dataset.key) return; // girls lanes handle their own
    b.onclick=e=>{ e.stopPropagation(); toggleDone(b.dataset.tick,true); };
  });
}
