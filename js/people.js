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

/* The Girls column widths are a local UI preference.  We store proportional
   weights rather than pixels so the layout still adapts to another screen. */
const GIRLS_LANE_SIZE_KEY="ob-girls-lane-sizes-v1";
let girlsLaneSizes=(()=>{
  try{ return JSON.parse(localStorage.getItem(GIRLS_LANE_SIZE_KEY)||"{}")||{}; }
  catch(_){ return {}; }
})();
function girlLaneWeight(key){
  const n=Number(girlsLaneSizes[key]);
  return Number.isFinite(n)&&n>0?n:1;
}
function saveGirlLaneSizes(){
  try{ localStorage.setItem(GIRLS_LANE_SIZE_KEY,JSON.stringify(girlsLaneSizes)); }
  catch(_){ /* localStorage can be unavailable in strict/private browsers */ }
}

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

let girlsFocus=null;   // null = show everyone; otherwise a GIRLS key
function renderGirlsFilter(){
  const box=document.getElementById("girlsFilter"); if(!box) return;
  const chip=(label,val,active)=>'<span class="ptog'+(active?" on":"")+'" data-focus="'+val+'">'+esc(label)+'</span>';
  let html=chip("Everyone","",girlsFocus===null);
  GIRLS.forEach(g=>html+=chip(firstName(g.name)+(isMe(g.key)?" (me)":""),g.key,girlsFocus===g.key));
  box.innerHTML=html;
  box.querySelectorAll(".ptog").forEach(el=>el.onclick=()=>{
    const v=el.dataset.focus;
    girlsFocus=(v===""||v===girlsFocus)?null:v;
    renderGirls();
  });
}

function renderGirls(){
  const board=document.getElementById("girlsBoard"); if(!board) return;
  renderGirlsFilter();
  const lanes=girlsFocus?GIRLS.filter(g=>g.key===girlsFocus):GIRLS;
  let html='';
  lanes.forEach(g=>{
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

    html+='<div class="lane glane" data-key="'+g.key+'" data-resize-key="'+g.key+'" style="--lane-weight:'+girlLaneWeight(g.key)+'">'+
      '<div class="lane-h"><span class="avatar" style="--hue:'+(GIRLS.indexOf(g)*70)+'">'+g.name[0]+g.name[1].toUpperCase()+'</span>'+
      '<span class="nm">'+esc(g.name)+'</span>'+
      '<button class="lmode" data-addsec="'+g.key+'">+ section</button>'+
      '<span class="ct">'+all.filter(t=>!gc.hidden.includes(t.gid)).length+'</span></div>'+
      '<div class="lane-body">'+body+
      '<div class="qadd"><input class="qadd-name" data-key="'+g.key+'" placeholder="+ quick task…">'+
      '<button class="qadd-btn" data-key="'+g.key+'">Add</button></div></div>'+
      '<button class="lane-resizer" type="button" aria-label="Resize '+esc(g.name)+' task column" title="Drag to resize · double-click to reset"></button></div>';
  });

  // unassigned pool from the boards — only in "Everyone" view
  const pool=girlsFocus?[]:state.tasks.filter(t=>!t.assignee && !t.completed &&
    !t.isOccasion&&!t.isNote&&!t.isPassion&&!t.isKeeper&&!t.isShot&&!t.isBrief&&
    !t.isComms&&!t.isVisit&&!t.isOpening&&!t.isBug&&!t.isPlaceholder);
  if(!girlsFocus) html+='<div class="lane glane pool" data-resize-key="pool" style="--lane-weight:'+girlLaneWeight("pool")+'"><div class="lane-h"><span class="nm">Up for grabs</span><span class="ct">'+pool.length+'</span></div>'+
    '<div class="lane-body"><p class="hint" style="margin:4px 0 8px">Unassigned on the boards — drag onto a girl to hand it out.</p>'+
    (pool.length?pool.slice(0,15).map(t=>
      '<div class="card gcard" draggable="true" data-gid="'+t.gid+'" data-pool="1">'+
      '<div class="c-in"><div class="cn">'+esc(t.name)+'</div>'+
      '<div class="cmeta"><span class="dot" style="background:'+t.projectColor+'"></span>'+esc(t.projectName)+
      (t.due?'<span>'+pd(t.due).toDateString().slice(4,10)+'</span>':'')+'</div></div></div>').join("")
    :'<div class="empty">'+pick(EMPTY_LINES)+'</div>')+
    '</div><button class="lane-resizer" type="button" aria-label="Resize the up for grabs column" title="Drag to resize · double-click to reset"></button></div>';

  board.innerHTML=html;
  wireGirls(board);
  renderCorkboard();
}

/* Capture the exact DOM order after every drop.  This is deliberately
   broader than only saving the destination section: it preserves moves between
   sections, reordering inside a section, and the Everything else order in one
   atomic snapshot. */
function captureGirlLayoutFromDOM(board,key){
  const gc=girlCfg(key);
  const seen=new Set();
  gc.sections.forEach(sec=>{
    const zone=board.querySelector('.gdrop[data-key="'+key+'"][data-sec="'+sec.id+'"]');
    if(!zone) return;
    sec.taskIds=[...zone.querySelectorAll('.gcard[data-key="'+key+'"]')]
      .map(c=>c.dataset.gid).filter(id=>id&&!seen.has(id)&&(seen.add(id),true));
  });
  const restZone=board.querySelector('.gdrop[data-key="'+key+'"][data-sec="rest"]');
  gc.order=restZone?[...restZone.querySelectorAll('.gcard[data-key="'+key+'"]')]
    .map(c=>c.dataset.gid).filter(id=>id&&!seen.has(id)&&(seen.add(id),true)):[];
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
    const removed=gc.sections.find(s=>s.id===b.dataset.sec);
    gc.sections=gc.sections.filter(s=>s.id!==b.dataset.sec);
    // Tasks from a deleted section keep their visible order when they fall
    // back into Everything else instead of being re-sorted by date.
    if(removed) gc.order=[...removed.taskIds,...gc.order.filter(id=>!removed.taskIds.includes(id))];
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
      const key=zone.dataset.key;
      if(!key){ return; }
      if(fromPool || gDragging.dataset.key!==key){ assignToGirl(gid,key,fromPool); return; }
      const gc=girlCfg(key);
      gc.sections.forEach(s=>{ s.taskIds=s.taskIds.filter(id=>id!==gid); });
      captureGirlLayoutFromDOM(board,key);
      saveKeeper(); renderGirls(); toast("Shuffled · saved automatically");
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
  wireGirlLaneResize(board);
}

/* Dragging one divider enlarges that lane while the remaining lanes give up
   space proportionally.  Widths are saved as ratios, so rerendering a task or
   resizing the browser does not throw the user's layout away. */
function wireGirlLaneResize(board){
  const handles=[...board.querySelectorAll(".lane-resizer")];
  handles.forEach(handle=>{
    const lane=handle.closest(".glane");
    if(!lane || lane===board.lastElementChild){ handle.hidden=true; return; }

    handle.onpointerdown=e=>{
      if(window.matchMedia("(max-width: 960px)").matches) return;
      e.preventDefault(); e.stopPropagation();

      const lanes=[...board.querySelectorAll(".glane")];
      const targetIndex=lanes.indexOf(lane);
      if(targetIndex<0 || lanes.length<2) return;

      const startX=e.clientX;
      const startWidths=lanes.map(el=>el.getBoundingClientRect().width);
      const minWidths=lanes.map(el=>{
        const n=parseFloat(getComputedStyle(el).minWidth);
        return Number.isFinite(n)?n:180;
      });
      const otherIndexes=lanes.map((_,i)=>i).filter(i=>i!==targetIndex);
      const growCapacity=otherIndexes.reduce((sum,i)=>sum+Math.max(0,startWidths[i]-minWidths[i]),0);
      const shrinkCapacity=Math.max(0,startWidths[targetIndex]-minWidths[targetIndex]);
      const oldCursor=document.body.style.cursor;

      lanes.forEach((el,i)=>{ el.style.flex="0 0 "+startWidths[i]+"px"; });
      document.body.classList.add("lane-resize-active");
      handle.classList.add("active");
      handle.setPointerCapture(e.pointerId);

      const move=ev=>{
        const delta=Math.max(-shrinkCapacity,Math.min(growCapacity,ev.clientX-startX));
        const next=[...startWidths];
        next[targetIndex]=startWidths[targetIndex]+delta;

        if(delta>0){
          const capacities=otherIndexes.map(i=>Math.max(0,startWidths[i]-minWidths[i]));
          const total=capacities.reduce((a,b)=>a+b,0)||1;
          otherIndexes.forEach((i,j)=>{ next[i]=startWidths[i]-delta*(capacities[j]/total); });
        }else if(delta<0){
          const released=-delta;
          const total=otherIndexes.reduce((sum,i)=>sum+startWidths[i],0)||1;
          otherIndexes.forEach(i=>{ next[i]=startWidths[i]+released*(startWidths[i]/total); });
        }

        lanes.forEach((el,i)=>{ el.style.flexBasis=Math.max(minWidths[i],next[i])+"px"; });
      };

      const finish=()=>{
        const finalWidths=lanes.map(el=>el.getBoundingClientRect().width);
        const average=finalWidths.reduce((a,b)=>a+b,0)/finalWidths.length||1;
        lanes.forEach((el,i)=>{
          const key=el.dataset.resizeKey;
          const weight=Math.max(.35,finalWidths[i]/average);
          if(key) girlsLaneSizes[key]=Number(weight.toFixed(4));
          el.style.removeProperty("flex");
          el.style.setProperty("--lane-weight",weight);
        });
        saveGirlLaneSizes();
        document.body.classList.remove("lane-resize-active");
        document.body.style.cursor=oldCursor;
        handle.classList.remove("active");
        handle.removeEventListener("pointermove",move);
        handle.removeEventListener("pointerup",finish);
        handle.removeEventListener("pointercancel",finish);
      };

      handle.addEventListener("pointermove",move);
      handle.addEventListener("pointerup",finish);
      handle.addEventListener("pointercancel",finish);
    };

    handle.ondblclick=e=>{
      e.preventDefault(); e.stopPropagation();
      board.querySelectorAll(".glane").forEach(el=>{
        const key=el.dataset.resizeKey;
        if(key) delete girlsLaneSizes[key];
        el.style.removeProperty("flex");
        el.style.setProperty("--lane-weight",1);
      });
      saveGirlLaneSizes();
      toast("Column widths reset");
    };
  });
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
  const gc=girlCfg(key);
  const snapshot={
    sections:gc.sections.map(s=>({...s,taskIds:[...s.taskIds]})),
    order:[...gc.order],hidden:[...gc.hidden],private:[...gc.private]
  };
  if(i>=0) list.splice(i,1);
  gc.sections.forEach(s=>{ s.taskIds=s.taskIds.filter(id=>id!==gid); });
  gc.order=gc.order.filter(id=>id!==gid);
  gc.hidden=gc.hidden.filter(id=>id!==gid);
  gc.private=gc.private.filter(id=>id!==gid);
  saveKeeper(); renderGirls(); toast(pick(DONE_LINES));
  try{ await call("update_tasks",{tasks:[{task:gid,completed:true}]}); }
  catch(e){
    if(t) list.splice(i,0,t);
    gc.sections=snapshot.sections; gc.order=snapshot.order; gc.hidden=snapshot.hidden; gc.private=snapshot.private;
    saveKeeper(); renderGirls(); toast("Failed: "+e.message);
  }
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
function clampCorkNotes(shouldSave){
  const areaEl=document.getElementById("corkArea");
  if(!areaEl) return;
  const width=areaEl.clientWidth, height=areaEl.clientHeight;
  // renderAll() also renders hidden tabs. A display:none corkboard reports
  // 0×0; never treat that as a real viewport or every note would collapse
  // into the top-left corner before the user even opens The Girls.
  if(width<150||height<90) return;
  const maxX=Math.max(0,width-150);
  const maxY=Math.max(0,height-90);
  let changed=false;
  state.keeper.cork.forEach(n=>{
    const x=Math.max(0,Math.min(maxX,Number(n.x)||0));
    const y=Math.max(0,Math.min(maxY,Number(n.y)||0));
    if(x!==n.x||y!==n.y){ n.x=x; n.y=y; changed=true; }
    const el=areaEl.querySelector('.sticky[data-id="'+n.id+'"]');
    if(el){ el.style.left=x+"px"; el.style.top=y+"px"; }
  });
  if(changed&&shouldSave) saveKeeper();
}

function renderCorkboard(){
  const cb=document.getElementById("corkboard"); if(!cb) return;
  const notes=state.keeper.cork;
  cb.innerHTML='<div class="cork-h"><span>The corkboard</span><small>shared with everyone · auto-saved</small></div>'+
    '<div class="cork-area" id="corkArea">'+
    (!notes.length?'<div class="cork-empty">Pin a note and the whole team will see it here.</div>':'')+
    notes.map(n=>'<div class="sticky" data-id="'+n.id+'" style="background:'+n.color+';left:'+(Number(n.x)||0)+'px;top:'+(Number(n.y)||0)+'px">'+
      '<button class="sticky-x" data-id="'+n.id+'">✕</button>'+
      '<div class="sticky-txt">'+esc(n.text)+'</div>'+
      '<div class="sticky-by">'+esc(n.author)+'</div></div>').join("")+
    '</div>'+
    '<div class="cork-add"><input id="corkText" placeholder="Pin a note…">'+
    '<div class="cork-colors">'+STICKY_COLORS.map((c,i)=>'<span class="ckc'+(i===0?" on":"")+'" data-c="'+c+'" style="background:'+c+'"></span>').join("")+'</div>'+
    '<button class="qadd-btn" id="corkPin">Pin</button></div>';

  requestAnimationFrame(()=>clampCorkNotes(true));
  let color=STICKY_COLORS[0];
  cb.querySelectorAll(".ckc").forEach(el=>el.onclick=()=>{
    cb.querySelectorAll(".ckc").forEach(x=>x.classList.remove("on")); el.classList.add("on"); color=el.dataset.c;
  });
  const pin=()=>{
    const inp=document.getElementById("corkText"); const txt=inp.value.trim(); if(!txt) return;
    const area=document.getElementById("corkArea");
    const maxX=Math.max(0,(area&&area.clientWidth||250)-150);
    const maxY=Math.max(0,(area&&area.clientHeight||220)-90);
    state.keeper.cork.push({id:"n"+Date.now(),text:txt,color,
      x:Math.round(Math.random()*maxX), y:Math.round(Math.random()*maxY),
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
  // Free drag. Coordinates are clamped on release so a note remains visible
  // when another teammate opens the board on a smaller screen.
  cb.querySelectorAll(".sticky").forEach(el=>{
    el.onpointerdown=e=>{
      if(e.target.closest(".sticky-x")) return;
      const areaEl=document.getElementById("corkArea");
      const area=areaEl.getBoundingClientRect();
      const sx=e.clientX-el.offsetLeft, sy=e.clientY-el.offsetTop;
      el.setPointerCapture(e.pointerId);
      el.classList.add("lifted");
      el.onpointermove=ev=>{
        el.style.left=Math.max(0,Math.min(area.width-150,ev.clientX-sx))+"px";
        el.style.top=Math.max(0,Math.min(area.height-90,ev.clientY-sy))+"px";
      };
      el.onpointerup=()=>{
        el.onpointermove=null; el.classList.remove("lifted");
        const n=state.keeper.cork.find(x=>x.id===el.dataset.id);
        if(n){ n.x=parseFloat(el.style.left)||0; n.y=parseFloat(el.style.top)||0; clampCorkNotes(false); saveKeeper(); }
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
