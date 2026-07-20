/* ================================================================
   PR — shared team pipeline.
   Everyone can see the same Idea → Pitched → In progress → Delivered
   board. The project id is discovered once, then stored in the shared
   dashboard keeper so it is no longer a browser-only Amy setting.
   ================================================================ */

const PR_STAGES=["Idea","Pitched","In progress","Delivered"];
let prTasks=[];
let prLoadError=null;
let prResolvePromise=null;
let prAccessChecked=null;
let prAccessWarning=null;

function prTabVisibility(){
  const tab=document.querySelector('[data-tab="pr"]');
  if(tab) tab.style.display="";
}

function currentPrBoard(){
  return (state.keeper&&state.keeper.boards&&state.keeper.boards.prBoard)||cfg.prBoard||null;
}
function setPrBoard(gid){
  if(!gid) return;
  cfg.prBoard=gid;
  saveCfg();
  state.keeper=normaliseKeeper(state.keeper);
  if(state.keeper.boards.prBoard!==gid){
    state.keeper.boards.prBoard=gid;
    saveKeeper();
  }
}
async function ensurePrTeamAccess(gid){
  if(!gid||DEMO||prAccessChecked===gid) return;
  try{
    await call("ensure_shared_project_access",{project_id:gid,team_id:ACADEMY_TEAM});
    prAccessChecked=gid;
    prAccessWarning=null;
  }catch(e){
    // The app can still display the pipeline through the shared service token,
    // but surface this honestly because direct access in Asana may need an admin.
    prAccessWarning=e.message||"Team sharing could not be confirmed";
    console.warn("PR team access check failed:",e);
  }
}
async function resolvePrBoard(){
  const known=currentPrBoard();
  if(known){ setPrBoard(known); await ensurePrTeamAccess(known); return known; }
  if(prResolvePromise) return prResolvePromise;
  prResolvePromise=(async()=>{
    try{
      const res=await call("find_project_by_name",{name:PR_PROJECT_NAME});
      const found=res&&res.data;
      if(found&&found.gid){ setPrBoard(found.gid); await ensurePrTeamAccess(found.gid); return found.gid; }
    }catch(_){ /* render the setup state below */ }
    return null;
  })();
  try{ return await prResolvePromise; }
  finally{ prResolvePromise=null; }
}

async function ensurePrBoard(){
  const existing=await resolvePrBoard();
  if(existing){ await prSectionMap(); return existing; }
  try{
    const res=await call("create_shared_project",{
      name:PR_PROJECT_NAME,
      team:ACADEMY_TEAM,
      color:"dark-teal",
      default_view:"board",
      privacy_setting:"private",
      sections:PR_STAGES.map(s=>({sectionName:s}))
    });
    const gid=res.data&&res.data.gid;
    if(!gid) throw new Error("no project id returned");
    setPrBoard(gid);
    prAccessChecked=gid;
    prAccessWarning=null;
    state.prSections={};
    ((res.data.sections_created&&res.data.sections_created.succeeded)||[]).forEach(s=>{ state.prSections[s.name]=s.gid; });
    confetti();
    toast("Shared PR board ready for everyone");
    await loadPr();
    return gid;
  }catch(e){ toast("Couldn't set up the PR board: "+e.message); return null; }
}

async function prSectionMap(){
  if(state.prSections&&PR_STAGES.every(stage=>state.prSections[stage])) return state.prSections;
  const board=await resolvePrBoard();
  if(!board) return null;
  try{
    const res=await call("ensure_shared_sections",{project_id:board,names:PR_STAGES});
    const map={};
    (res.data||[]).forEach(s=>{ map[s.name]=s.gid; });
    state.prSections=map;
    return map;
  }catch(e){ return null; }
}

async function loadPr(){
  prLoadError=null;
  const board=await resolvePrBoard();
  if(!board){ prTasks=[]; renderPR(); return; }
  try{
    const res=await call("get_tasks",{project:board,limit:100,
      opt_fields:"name,due_on,completed,notes,memberships.project.gid,memberships.section.name,permalink_url"});
    prTasks=(res.data||[]).filter(t=>!t.completed).map(t=>({
      gid:t.gid,name:t.name,due:t.due_on,notes:t.notes||"",url:t.permalink_url,
      stage:(()=>{
        const memberships=t.memberships||[];
        const own=memberships.find(m=>String(m.project&&m.project.gid)===String(board))||memberships[0];
        return (own&&own.section&&own.section.name)||"Idea";
      })()
    }));
  }catch(e){
    prTasks=[];
    prLoadError=e.message;
  }
  renderPR();
}

function renderPR(){
  const box=document.getElementById("prBody"); if(!box) return;
  const board=currentPrBoard();
  if(!board){
    box.innerHTML='<div class="empty" style="padding:50px 0">The shared PR pipeline has not been connected yet.<br><br>'+
      '<button class="btn glow" id="prCreate">Set up the shared PR board</button><br><br>'+
      '<span class="hint">The app first looks for an existing “PR &amp; Positioning” project. It only creates one when none exists, and the result is shared with the full Academy team.</span></div>';
    const create=document.getElementById("prCreate");
    if(create) create.onclick=ensurePrBoard;
    return;
  }
  if(prLoadError){
    box.innerHTML='<div class="empty" style="padding:40px 0">The PR board is connected, but it could not be loaded.<br><b>'+esc(prLoadError)+'</b><br><br>'+
      '<button class="btn ghost" id="prRetry">Try again</button></div>';
    document.getElementById("prRetry").onclick=loadPr;
    return;
  }

  let html='<div class="pr-top"><div><h2>PR &amp; Positioning</h2><p class="hint">One shared pipeline for the whole Academy team.</p></div>'+
    '<div class="pr-top-actions"><button class="btn ghost sm" id="prRefresh">Refresh</button>'+
    '<a class="btn ghost sm" href="https://app.asana.com/0/'+board+'/list" target="_blank">Open in Asana ↗</a></div></div>'+
    (prAccessWarning?'<div class="pr-access-warn">Visible inside this app, but direct Asana team access could not be confirmed: '+esc(prAccessWarning)+'</div>':'')+
    '<div class="pr-pipe">';
  PR_STAGES.forEach(st=>{
    const items=prTasks.filter(t=>t.stage===st);
    html+='<div class="pr-col" data-stage="'+st+'"><div class="lane-sub">'+st+' · '+items.length+'</div>'+
      items.map(t=>'<div class="card prcard" data-gid="'+t.gid+'" draggable="true">'+
        '<div class="c-in"><div class="cn">'+esc(t.name)+'</div>'+
        (t.notes?'<div class="cmeta">'+esc(t.notes.split("\n")[0].slice(0,70))+'</div>':'')+'</div></div>').join("")+
      '</div>';
  });
  html+='</div>'+
    '<div class="qadd" style="max-width:480px;margin-top:14px"><input class="qadd-name" id="prName" placeholder="+ new idea (outlet, talk, article…)">'+
    '<button class="qadd-btn" id="prAdd">Add</button></div>'+
    '<div class="stud-h"><span>Pitch radar</span><button class="btn glow" id="prRadar">Scan for opportunities</button></div>'+
    '<p class="hint">Web-searches for publications, podcasts, conference CFPs and journalists worth pitching — each with an angle tailored to what the Academy is doing right now.</p>'+
    '<div id="prRadarOut"></div>';
  box.innerHTML=html;

  document.getElementById("prRefresh").onclick=loadPr;
  box.querySelectorAll(".prcard").forEach(c=>{
    c.onclick=()=>{ if(findTask(c.dataset.gid)) openDrawer(c.dataset.gid); else openPrCard(c.dataset.gid); };
    c.ondragstart=e=>e.dataTransfer.setData("text/pr",c.dataset.gid);
  });
  box.querySelectorAll(".pr-col").forEach(col=>{
    col.ondragover=e=>{ e.preventDefault(); col.classList.add("dragover"); };
    col.ondragleave=()=>col.classList.remove("dragover");
    col.ondrop=async e=>{
      e.preventDefault(); col.classList.remove("dragover");
      const gid=e.dataTransfer.getData("text/pr"); if(!gid) return;
      const map=await prSectionMap(); const secGid=map&&map[col.dataset.stage];
      if(!secGid){ toast("Couldn't find that PR stage"); return; }
      const t=prTasks.find(x=>x.gid===gid); const old=t&&t.stage;
      if(t) t.stage=col.dataset.stage;
      renderPR();
      try{
        const result=await call("update_shared_tasks",{tasks:[{task:gid,add_projects:[{project_id:board,section_id:secGid}]}]});
        if(result.failed&&result.failed.length) throw new Error(result.failed[0].errors[0].message);
        toast(col.dataset.stage==="Delivered"?"Delivered — go team":"Moved to "+col.dataset.stage);
        if(col.dataset.stage==="Delivered") confetti();
      }catch(err){ if(t) t.stage=old; toast("Failed: "+err.message); loadPr(); }
    };
  });
  const add=async()=>{
    const inp=document.getElementById("prName"); const n=inp.value.trim(); if(!n) return;
    const map=await prSectionMap();
    try{
      const result=await call("create_shared_tasks",{tasks:[{name:n,project_id:board,section_id:map&&map["Idea"]}]});
      if(result.failed&&result.failed.length) throw new Error(result.failed[0].errors[0].message);
      inp.value=""; toast("On the shared pipeline"); loadPr();
    }catch(e){ toast("Failed: "+e.message); }
  };
  document.getElementById("prAdd").onclick=add;
  document.getElementById("prName").onkeydown=e=>{ if(e.key==="Enter") add(); };
  document.getElementById("prRadar").onclick=runPitchRadar;
}

function openPrCard(gid){
  const t=prTasks.find(x=>x.gid===gid);
  if(t&&t.url) window.open(t.url,"_blank");
}

async function runPitchRadar(){
  const out=document.getElementById("prRadarOut");
  if(!out) return;
  out.innerHTML='<div class="empty" style="padding:26px 0"><span class="spin"></span>&nbsp; scanning the media landscape…</div>';
  const board=currentPrBoard();
  const context={
    campaigns:(cfg.campaigns||[]).map(c=>c.name),
    curriculum_this_month:state.curriculum[new Date().getMonth()],
    current_pr_pipeline:prTasks.map(t=>t.name),
    recent_work:state.tasks.filter(t=>t.isShoot).slice(0,5).map(t=>t.name)
  };
  try{
    let data;
    if(DEMO){ await new Promise(r=>setTimeout(r,900)); data=demoPitch(); }
    else{
      const r=await fetch("/api/pitch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context})});
      data=await r.json();
      if(!r.ok) throw new Error(data.error||("HTTP "+r.status));
      if(data.off) throw new Error(data.error);
    }
    const picks=data.picks||[];
    if(!picks.length){ out.innerHTML='<div class="empty">Nothing found this pass — try again later.</div>'; return; }
    out.innerHTML=picks.map((p,ix)=>
      '<div class="ev-row"><span class="news-main">'+
      '<span class="news-t">'+esc(p.outlet)+' <span class="news-meta" style="display:inline">· '+esc(p.type||"")+'</span></span>'+
      '<span class="news-b"><b>Angle:</b> '+esc(p.angle||"")+'</span>'+
      (p.why?'<span class="news-meta">'+esc(p.why)+'</span>':'')+
      (p.url?'<span class="news-meta"><a href="'+esc(p.url)+'" target="_blank" style="color:var(--teal)">'+esc(p.url.replace(/^https?:\/\//,"").slice(0,50))+'</a></span>':'')+
      '</span><button class="btn teal sm radar-add" data-ix="'+ix+'">+ Pipeline</button></div>').join("");
    out.querySelectorAll(".radar-add").forEach(b=>b.onclick=async()=>{
      const p=picks[+b.dataset.ix];
      const map=await prSectionMap();
      b.disabled=true; b.textContent="…";
      try{
        const result=await call("create_shared_tasks",{tasks:[{name:"Pitch "+p.outlet+(p.type?" ("+p.type+")":""),
          project_id:board,section_id:map&&map["Idea"],
          notes:"Angle: "+(p.angle||"")+"\n"+(p.why||"")+"\n"+(p.url||"")}]});
        if(result.failed&&result.failed.length) throw new Error(result.failed[0].errors[0].message);
        b.textContent="✓"; toast("On the shared pipeline"); loadPr();
      }catch(e){ b.disabled=false; b.textContent="+ Pipeline"; toast("Failed: "+e.message); }
    });
  }catch(e){ out.innerHTML='<div class="empty">Radar down: '+esc(e.message)+'</div>'; }
}
