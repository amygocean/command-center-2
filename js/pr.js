/* ================================================================
   PR — Amy's baby. Only rendered (and only visible) for Amy.
   A pipeline board (Idea → Pitched → In progress → Delivered)
   plus the pitch radar: web-searched outlets with tailored angles.
   ================================================================ */

const PR_STAGES=["Idea","Pitched","In progress","Delivered"];

function isAmy(){ return DEMO ? (state.me&&state.me.gid==="u-amy") : (state.me&&state.me.gid===AMY_GID); }

function prTabVisibility(){
  const tab=document.querySelector('[data-tab="pr"]');
  if(tab) tab.style.display=isAmy()?"":"none";
}

async function ensurePrBoard(){
  if(cfg.prBoard) return cfg.prBoard;
  try{
    const res=await call("create_project",{name:"PR & Positioning",team:ACADEMY_TEAM,color:"dark-teal",
      default_view:"board",privacy_setting:"private",
      sections:PR_STAGES.map(s=>({sectionName:s}))});
    const gid=res.data&&res.data.gid; if(!gid) throw new Error("no project id returned");
    cfg.prBoard=gid;
    state.prSections={};
    ((res.data.sections_created&&res.data.sections_created.succeeded)||[]).forEach(s=>{ state.prSections[s.name]=s.gid; });
    saveCfg(); confetti(); toast("PR board created — just yours");
    loadPr();
    return gid;
  }catch(e){ toast("Couldn't create the board: "+e.message); return null; }
}

async function prSectionMap(){
  if(state.prSections) return state.prSections;
  if(!cfg.prBoard) return null;
  try{
    const res=await call("get_project",{project_id:cfg.prBoard,include_sections:true,opt_fields:"sections.name"});
    const map={};
    ((res.data&&res.data.sections)||[]).forEach(s=>{ map[s.name]=s.gid; });
    state.prSections=map; return map;
  }catch(e){ return null; }
}

let prTasks=[];
async function loadPr(){
  if(!cfg.prBoard){ renderPR(); return; }
  try{
    const res=await call("get_tasks",{project:cfg.prBoard,limit:100,
      opt_fields:"name,due_on,completed,notes,memberships.section.name,permalink_url"});
    prTasks=(res.data||[]).filter(t=>!t.completed).map(t=>({
      gid:t.gid,name:t.name,due:t.due_on,notes:t.notes||"",url:t.permalink_url,
      stage:(t.memberships&&t.memberships[0]&&t.memberships[0].section&&t.memberships[0].section.name)||"Idea"
    }));
  }catch(e){ prTasks=[]; }
  renderPR();
}

function renderPR(){
  const box=document.getElementById("prBody"); if(!box) return;
  if(!isAmy()){ box.innerHTML=""; return; }
  if(!cfg.prBoard){
    box.innerHTML='<div class="empty" style="padding:50px 0">Your PR pipeline doesn\'t exist yet.<br><br>'+
      '<button class="btn glow" id="prCreate">Create my PR board</button><br><br>'+
      '<span class="hint">Makes a private "PR &amp; Positioning" project in Asana with Idea → Pitched → In progress → Delivered.</span></div>';
    document.getElementById("prCreate").onclick=ensurePrBoard;
    return;
  }
  let html='<div class="pr-pipe">';
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

  box.querySelectorAll(".prcard").forEach(c=>{
    c.onclick=()=>openDrawer(c.dataset.gid)||openPrCard(c.dataset.gid);
    c.ondragstart=e=>e.dataTransfer.setData("text/pr",c.dataset.gid);
  });
  box.querySelectorAll(".pr-col").forEach(col=>{
    col.ondragover=e=>{ e.preventDefault(); col.classList.add("dragover"); };
    col.ondragleave=()=>col.classList.remove("dragover");
    col.ondrop=async e=>{
      e.preventDefault(); col.classList.remove("dragover");
      const gid=e.dataTransfer.getData("text/pr"); if(!gid) return;
      const map=await prSectionMap(); const secGid=map&&map[col.dataset.stage];
      if(!secGid){ toast("Couldn't find that stage"); return; }
      const t=prTasks.find(x=>x.gid===gid); if(t) t.stage=col.dataset.stage;
      renderPR();
      try{ await call("update_tasks",{tasks:[{task:gid,add_projects:[{project_id:cfg.prBoard,section_id:secGid}]}]});
        toast(col.dataset.stage==="Delivered"?"Delivered — go you":"Moved to "+col.dataset.stage);
        if(col.dataset.stage==="Delivered") confetti();
      }catch(err){ toast("Failed: "+err.message); loadPr(); }
    };
  });
  document.getElementById("prAdd").onclick=async()=>{
    const inp=document.getElementById("prName"); const n=inp.value.trim(); if(!n) return;
    const map=await prSectionMap();
    try{ await call("create_tasks",{tasks:[{name:n,project_id:cfg.prBoard,section_id:map&&map["Idea"]}]});
      inp.value=""; toast("On the pipeline"); loadPr();
    }catch(e){ toast("Failed: "+e.message); }
  };
  document.getElementById("prRadar").onclick=runPitchRadar;
}
function openPrCard(gid){ /* drawer handles tasks it can find; PR tasks open via url fallback */
  const t=prTasks.find(x=>x.gid===gid);
  if(t && !findTask(gid) && t.url) window.open(t.url,"_blank");
}

async function runPitchRadar(){
  const out=document.getElementById("prRadarOut");
  out.innerHTML='<div class="empty" style="padding:26px 0"><span class="spin"></span>&nbsp; scanning the media landscape…</div>';
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
      try{ await call("create_tasks",{tasks:[{name:"Pitch "+p.outlet+(p.type?" ("+p.type+")":""),
          project_id:cfg.prBoard, section_id:map&&map["Idea"],
          notes:"Angle: "+(p.angle||"")+"\n"+(p.why||"")+"\n"+(p.url||"")}]});
        b.textContent="✓"; toast("On the pipeline"); loadPr();
      }catch(e){ b.disabled=false; b.textContent="+ Pipeline"; toast("Failed: "+e.message); }
    });
  }catch(e){ out.innerHTML='<div class="empty">Radar down: '+esc(e.message)+'</div>'; }
}
