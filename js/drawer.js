/* ================================================================
   DRAWER + MODALS — task detail, add task, settings, campaigns
   ================================================================ */

function openDrawer(gid){
  const t=state.tasks.find(x=>x.gid===gid); if(!t) return;
  const w=document.getElementById("drawerWrap"), d=document.getElementById("drawer");
  const peopleOpts='<option value="unassigned">Unassigned</option>'+
    state.users.map(u=>'<option value="'+u.gid+'"'+(t.assignee&&t.assignee.gid===u.gid?" selected":"")+'>'+esc(u.name)+'</option>').join("");
  const projOpts=cfg.projects.map(p=>'<option value="'+p.gid+'"'+(p.gid===t.projectGid?" selected":"")+'>'+esc(p.name)+'</option>').join("");
  const cm = t.isComms ? communityOf(t) : null;
  const pu = t.isComms ? purposeOf(t) : null;
  d.innerHTML=
    '<h2>'+(t.isShoot?"🎬 ":"")+esc(t.name)+'</h2>'+
    '<div class="cmeta" style="margin-bottom:12px"><span class="dot" style="background:'+t.projectColor+'"></span> '+esc(t.projectName)+
      (t.sectionName?' · '+esc(t.sectionName):"")+
      (cm?' · <b style="color:'+cm.color+'">'+esc(cm.name)+'</b>':"")+
      (pu?' · '+pu.label:"")+'</div>'+
    '<div class="fld"><label>Name</label><input id="dName" value="'+esc(t.name)+'"></div>'+
    '<div class="fld"><label>Description</label><textarea id="dNotes" placeholder="Add a description…">'+esc(t.notes||"")+'</textarea></div>'+
    '<div class="row"><div class="fld"><label>Due date</label><input type="date" id="dDue" value="'+(t.due||"")+'"></div>'+
    '<div class="fld"><label>Assignee</label><select id="dAssignee">'+peopleOpts+'</select></div></div>'+
    '<div class="fld"><label>Board (move task between projects)</label><select id="dProject">'+projOpts+'</select></div>'+
    '<div class="fld" id="dSecWrap" style="display:none"><label>Section in new board</label><select id="dSection"><option value="">(no section)</option></select></div>'+
    '<div class="drawer-actions">'+
      '<button class="btn primary" id="dSave">Save to Asana</button>'+
      '<button class="btn '+(t.completed?"ghost":"teal")+'" id="dDone">'+(t.completed?"Reopen":(t.isComms?"Sent ✓":"✓ Done"))+'</button>'+
      '<button class="btn ghost" id="dOpen">Asana ↗</button>'+
    '</div>'+
    '<div class="cmts"><label>Comments</label><div id="dCmts" class="cmts-list"><span class="spin"></span></div>'+
      '<div class="additem" style="margin-top:8px"><input id="dCmtInput" placeholder="Add a comment…"><button class="btn primary" id="dCmtBtn">Post</button></div></div>';
  w.style.display="block"; requestAnimationFrame(()=>w.classList.add("open"));
  loadTaskDetail(gid);
  d.querySelector("#dCmtBtn").onclick=async()=>{
    const inp=d.querySelector("#dCmtInput"), txt=inp.value.trim(); if(!txt) return;
    const b=d.querySelector("#dCmtBtn"); b.disabled=true;
    try{ await call("add_comment",{task_id:gid,text:txt}); inp.value=""; toast("Comment added"); loadTaskDetail(gid); }
    catch(e){ toast("Failed: "+e.message); }
    b.disabled=false;
  };
  d.querySelector("#dCmtInput").onkeydown=e=>{ if(e.key==="Enter") d.querySelector("#dCmtBtn").click(); };
  d.querySelector("#dProject").onchange=async(e)=>{
    const proj=e.target.value, wrap=d.querySelector("#dSecWrap"), sel=d.querySelector("#dSection");
    if(proj===t.projectGid){ wrap.style.display="none"; return; }
    wrap.style.display="block"; sel.innerHTML='<option value="">Loading…</option>';
    try{ const res=await call("get_project",{project_id:proj,include_sections:true,opt_fields:"sections.name"});
      const secs=(res.data&&res.data.sections)||[];
      sel.innerHTML='<option value="">(no section)</option>'+secs.map(s=>'<option value="'+s.gid+'">'+esc(s.name)+'</option>').join("");
    }catch(err){ sel.innerHTML='<option value="">(couldn\'t load sections)</option>'; }
  };
  d.querySelector("#dSave").onclick=async()=>{
    const name=d.querySelector("#dName").value.trim();
    const due=d.querySelector("#dDue").value||null;
    const asg=d.querySelector("#dAssignee").value;
    const proj=d.querySelector("#dProject").value;
    const moved = proj && proj!==t.projectGid;
    const notes=d.querySelector("#dNotes").value;
    const upd={task:gid}; if(name&&name!==t.name)upd.name=name; upd.due_on=due; upd.notes=notes;
    upd.assignee = asg==="unassigned"?null:asg;
    if(moved){ const sec=d.querySelector("#dSection").value;
      upd.add_projects=[sec?{project_id:proj,section_id:sec}:{project_id:proj}]; upd.remove_projects=[t.projectGid]; }
    try{ await call("update_tasks",{tasks:[upd]});
      closeDrawer();
      if(moved){ toast("Moved to "+(cfg.projects.find(p=>p.gid===proj)||{}).name); loadAll(); }
      else { t.name=name||t.name; t.due=due; t.notes=notes; t.assignee=asg==="unassigned"?null:{gid:asg,name:userName(asg)}; renderAll(); toast("Saved ✓"); }
    }catch(e){ toast("Failed: "+e.message); }
  };
  d.querySelector("#dDone").onclick=()=>{ toggleDone(gid,!t.completed); closeDrawer(); };
  d.querySelector("#dOpen").onclick=()=>{ if(t.url) window.open(t.url,"_blank"); };
}
function closeDrawer(){
  const w=document.getElementById("drawerWrap");
  w.classList.remove("open");
  setTimeout(()=>{ w.style.display="none"; },200);
}
async function loadTaskDetail(gid){
  const box=document.getElementById("dCmts"); if(!box) return;
  try{
    const res=await call("get_task",{task_id:gid,opt_fields:"notes,comments.text,comments.created_by.name,comments.created_at"});
    const full=res.data||{}; const t=state.tasks.find(x=>x.gid===gid);
    const ta=document.getElementById("dNotes");
    if(ta && document.activeElement!==ta && full.notes!=null && full.notes!==ta.value){ ta.value=full.notes; if(t) t.notes=full.notes; }
    const cs=full.comments||[];
    if(!cs.length){ box.innerHTML='<div class="empty" style="padding:6px">No comments yet.</div>'; return; }
    box.innerHTML=cs.map(c=>'<div class="cmt"><div class="cmt-meta">'+esc((c.created_by&&c.created_by.name)||"Someone")+
      (c.created_at?' · '+new Date(c.created_at).toLocaleDateString():'')+'</div><div class="cmt-txt">'+esc(c.text||"")+'</div></div>').join("");
  }catch(e){ box.innerHTML='<div class="empty" style="padding:6px">Couldn\'t load comments.</div>'; }
}

/* ---- modal plumbing ---- */
function showModal(html){ const w=document.getElementById("modalWrap"); document.getElementById("modal").innerHTML=html; w.style.display="block"; requestAnimationFrame(()=>w.classList.add("open")); }
function closeModal(){ const w=document.getElementById("modalWrap"); w.classList.remove("open"); setTimeout(()=>{ w.style.display="none"; },200); }
function wireModalClose(){ document.querySelectorAll("#modal [data-close]").forEach(x=>x.onclick=()=>{closeDrawer();closeModal();}); }

/* ---- add task ---- */
function openAdd(){
  const projOpts=cfg.projects.map(p=>'<option value="'+p.gid+'">'+esc(p.name)+'</option>').join("");
  const peopleOpts='<option value="">Unassigned</option>'+state.users.map(u=>'<option value="'+u.gid+'">'+esc(u.name)+'</option>').join("");
  showModal(
    '<h2>Add task</h2>'+
    '<div class="fld"><label>Task name</label><input id="aName" placeholder="e.g. Shoot Day 12 – Winter menu"></div>'+
    '<div class="fld"><label>Board</label><select id="aProj">'+projOpts+'</select></div>'+
    '<div class="row"><div class="fld"><label>Due date</label><input type="date" id="aDue"></div>'+
    '<div class="fld"><label>Assignee</label><select id="aAsg">'+peopleOpts+'</select></div></div>'+
    '<div class="fld"><label>Notes</label><textarea id="aNotes"></textarea></div>'+
    '<div class="drawer-actions"><button class="btn primary" id="aSave">Create in Asana</button>'+
    '<button class="btn ghost" data-close>Cancel</button></div>'
  );
  wireModalClose();
  document.getElementById("aSave").onclick=async()=>{
    const name=document.getElementById("aName").value.trim(); if(!name){toast("Name required");return;}
    const task={name}; const due=document.getElementById("aDue").value; if(due)task.due_on=due;
    const asg=document.getElementById("aAsg").value; if(asg)task.assignee=asg;
    const notes=document.getElementById("aNotes").value.trim(); if(notes)task.notes=notes;
    const proj=document.getElementById("aProj").value; task.project_id=proj;
    try{ await call("create_tasks",{tasks:[task]}); closeModal(); toast("Created ✓"); loadAll(); }
    catch(e){ toast("Failed: "+e.message); }
  };
}

/* ---- settings ---- */
function openSettings(){
  const projRows=cfg.projects.map((p,i)=>
    '<div class="setrow"><input type="checkbox" data-pi="'+i+'" '+(p.on?"checked":"")+'>'+
    '<span class="dot" style="background:'+p.color+'"></span>'+esc(p.name)+'</div>').join("");
  const peopleRows=state.users.map(u=>
    '<div class="setrow"><input type="checkbox" data-pg="'+u.gid+'" '+(cfg.people.includes(u.gid)?"checked":"")+'>'+
    '<span class="avatar sm2">'+initials(u.name)+'</span>'+esc(u.name)+'</div>').join("");
  const commRows=cfg.communities.map((c,i)=>
    '<div class="setrow"><input type="color" data-cc="'+i+'" value="'+c.color+'" style="width:30px;height:24px;border:none;background:none;padding:0">'+
    '<input type="text" data-cn="'+i+'" value="'+esc(c.name)+'" style="flex:1;border:1px solid var(--line);border-radius:6px;padding:4px 8px;font:inherit"></div>').join("");
  const curRows=state.curriculum.map((c,i)=>
    '<div class="setrow"><span class="cur-mo">'+MO[i].slice(0,3)+'</span>'+
    '<input type="text" data-cu="'+i+'" value="'+esc(c.t)+'" style="flex:1;border:1px solid var(--line);border-radius:6px;padding:4px 8px;font:inherit"></div>').join("");
  showModal(
    '<h2>Settings</h2>'+
    '<div class="fld"><label>Boards on the dashboard</label><div class="setlist">'+projRows+'</div></div>'+
    '<div class="fld"><label>Crew lanes</label><div class="setlist">'+peopleRows+'</div></div>'+
    '<div class="fld"><label>WhatsApp communities</label><div class="setlist">'+commRows+'</div></div>'+
    '<div class="fld"><label>OB Fit marathon (edits sync to the Curriculum board)</label><div class="setlist">'+curRows+'</div></div>'+
    '<div class="row"><div class="fld"><label>Max pages/board (100 tasks each)</label><input type="number" id="sCap" min="1" max="15" value="'+cfg.pageCap+'"></div></div>'+
    '<div class="drawer-actions"><button class="btn primary" id="sSave">Save & reload</button>'+
    '<button class="btn ghost" data-close>Cancel</button></div>'
  );
  wireModalClose();
  document.getElementById("sSave").onclick=async()=>{
    cfg.projects.forEach((p,i)=>{ const cb=document.querySelector('[data-pi="'+i+'"]'); p.on=cb.checked; });
    cfg.people=[...document.querySelectorAll('[data-pg]')].filter(c=>c.checked).map(c=>c.dataset.pg);
    cfg.communities.forEach((c,i)=>{
      const cn=document.querySelector('[data-cn="'+i+'"]'), cc=document.querySelector('[data-cc="'+i+'"]');
      if(cn) c.name=cn.value.trim()||c.name; if(cc) c.color=cc.value;
    });
    cfg.pageCap=Math.max(1,Math.min(15,+document.getElementById("sCap").value||6));
    // curriculum edits -> Asana Curriculum board (create or rename "Month: Title" tasks)
    const curUpdates=[], curCreates=[];
    state.curriculum.forEach((c,i)=>{
      const inp=document.querySelector('[data-cu="'+i+'"]'); if(!inp) return;
      const v=inp.value.trim(); if(!v||v===c.t) return;
      c.t=v;
      if(c.gid) curUpdates.push({task:c.gid, name:MO[i]+": "+v});
      else curCreates.push({name:MO[i]+": "+v, project_id:CURRICULUM_PROJECT, notes:c.d||""});
    });
    saveCfg(); closeModal();
    try{
      if(curUpdates.length) await call("update_tasks",{tasks:curUpdates});
      if(curCreates.length) await call("create_tasks",{tasks:curCreates});
      if(curUpdates.length||curCreates.length) toast("Marathon updated");
    }catch(e){ toast("Curriculum sync hiccup: "+e.message); }
    state.waSections=null; // names may have changed
    loadAll();
  };
}

/* ---- campaign playbook generator ----
   A campaign = a real Asana project with phase sections and dated
   workstream tasks per channel. The plan is drafted client-side from
   the house playbook, editable, then created on approval. */

const CAMPAIGN_PHASES = ["Pre-launch","Launch week","In market","Wrap-up"];
const CAMPAIGN_CHANNELS = [
  {key:"courses", label:"Courses"},
  {key:"videos",  label:"Videos / shoot"},
  {key:"training",label:"In-person training"},
  {key:"comms",   label:"Comms"}
];

function buildCampaignPlan(name, start, end, channels, roles){
  const S=pd(start), E=pd(end);
  const mid=new Date((S.valueOf()+E.valueOf())/2);
  const d=(base,off)=>{ const x=new Date(base); x.setDate(x.getDate()+off); return iso(x); };
  const roleTxt = roles.length ? " ("+roles.join(", ")+")" : "";
  const rows=[]; const add=(phase,ch,due,task)=>{ if(ch==="all"||channels.includes(ch)) rows.push({phase,ch,due,name:task,on:true}); };

  add("Pre-launch","courses",d(S,-28),"Write & build courses"+roleTxt);
  add("Pre-launch","courses",d(S,-10),"QA + configure courses");
  add("Pre-launch","courses",d(S,-7), "Manager launch pack (why, who, deadline, coaching)");
  add("Pre-launch","videos", d(S,-21),"Brief to Content Go — "+name+" videos");
  add("Pre-launch","videos", d(S,-14),"Shoot Day — "+name);
  add("Pre-launch","videos", d(S,-5), "Final videos delivered & loaded");
  add("Pre-launch","training",d(S,-21),"Book venues & trainers");
  add("Pre-launch","training",d(S,-14),"Regional session schedule locked");
  add("Pre-launch","comms",  d(S,-3), "Teaser message (queue in Communities)");
  add("Pre-launch","comms",  start,   "Launch announcement");
  add("Launch week","courses",start,  "Courses live + assigned");
  add("Launch week","courses",d(S,5), "First-week participation check");
  add("Launch week","training",d(S,3),"Run in-person sessions");
  add("Launch week","comms",  d(S,1), "Manager huddle reminder");
  add("In market","comms",   iso(mid),"Mid-campaign boost message");
  add("In market","courses", iso(mid),"Wrong-answer check — Skills Booster if needed");
  add("In market","training",iso(mid),"Trainer field check-ins");
  add("Wrap-up","all",       d(E,2),  "Completion & results snapshot");
  add("Wrap-up","all",       d(E,5),  "What we'd do differently (15 min huddle)");
  add("Wrap-up","all",       d(E,7),  "Archive assets & source of truth");
  return rows;
}

function openCampaign(){
  const chBoxes=CAMPAIGN_CHANNELS.map(c=>
    '<label class="ctgt" style="--cc:var(--teal)"><input type="checkbox" value="'+c.key+'" checked><span>'+c.label+'</span></label>').join("");
  const roleBoxes=["FOH","BOH","Sushi","Bar/Deli","Managers"].map(r=>
    '<label class="ctgt" style="--cc:var(--deep)"><input type="checkbox" value="'+r+'"><span>'+r+'</span></label>').join("");
  showModal(
    '<h2>New campaign</h2>'+
    '<p class="hint">Answer four things and the playbook drafts the whole runway — a real Asana project with Pre-launch, Launch week, In market and Wrap-up phases, dated back from your launch. You edit before anything is created.</p>'+
    '<div class="fld"><label>Campaign name</label><input id="cName" placeholder="e.g. Summer Menu 2027"></div>'+
    '<div class="row"><div class="fld"><label>Launch (start)</label><input type="date" id="cStart"></div>'+
    '<div class="fld"><label>Ends</label><input type="date" id="cEnd"></div></div>'+
    '<div class="fld"><label>Channels</label><div style="display:flex;gap:4px;flex-wrap:wrap">'+chBoxes+'</div></div>'+
    '<div class="fld"><label>Roles affected</label><div style="display:flex;gap:4px;flex-wrap:wrap">'+roleBoxes+'</div></div>'+
    '<div class="fld"><label>Band colour</label><select id="cColor">'+
      ["#D9822B","#0A3D62","#00A8A8","#F7C325","#7A5FB0","#C0392B","#3A7D44"].map(c=>'<option value="'+c+'">'+c+'</option>').join("")+'</select></div>'+
    '<div class="drawer-actions"><button class="btn primary" id="cPlan">Draft the plan</button>'+
    '<button class="btn ghost" data-close>Cancel</button></div>'+
    '<div id="cPlanOut"></div>'
  );
  wireModalClose();
  document.getElementById("cPlan").onclick=()=>{
    const name=document.getElementById("cName").value.trim(); if(!name){toast("Name first");return;}
    const start=document.getElementById("cStart").value, end=document.getElementById("cEnd").value;
    if(!start||!end){toast("Pick the dates");return;}
    const channels=[...document.querySelectorAll('#modal .fld input[type="checkbox"]:checked')]
      .map(i=>i.value).filter(v=>CAMPAIGN_CHANNELS.some(c=>c.key===v));
    const roles=[...document.querySelectorAll('#modal .fld input[type="checkbox"]:checked')]
      .map(i=>i.value).filter(v=>!CAMPAIGN_CHANNELS.some(c=>c.key===v));
    const plan=buildCampaignPlan(name,start,end,channels,roles);
    const out=document.getElementById("cPlanOut");
    let html='<div class="ins-h" style="margin-top:18px">The plan — untick or edit anything</div>';
    CAMPAIGN_PHASES.forEach(ph=>{
      const rows=plan.filter(r=>r.phase===ph); if(!rows.length) return;
      html+='<div class="plan-ph">'+ph+'</div>';
      rows.forEach((r)=>{ const ix=plan.indexOf(r);
        html+='<div class="plan-row"><input type="checkbox" data-pi="'+ix+'" checked>'+
          '<input type="text" data-pn="'+ix+'" value="'+esc(r.name)+'">'+
          '<input type="date" data-pd="'+ix+'" value="'+r.due+'"></div>';
      });
    });
    html+='<div class="drawer-actions"><button class="btn primary" id="cCreate">Create it all in Asana</button></div>';
    out.innerHTML=html;
    document.getElementById("cCreate").onclick=async()=>{
      const btn=document.getElementById("cCreate"); btn.disabled=true; btn.innerHTML='<span class="spin"></span> building…';
      const color=document.getElementById("cColor").value;
      try{
        const res=await call("create_project",{name,team:ACADEMY_TEAM,color:"dark-orange",default_view:"calendar",
          privacy_setting:"private_to_team",start_on:start,due_on:end,
          sections:CAMPAIGN_PHASES.map(p=>({sectionName:p}))});
        const gid=res.data&&res.data.gid; if(!gid) throw new Error("no project id returned");
        const secs=(res.data.sections_created&&res.data.sections_created.succeeded)||[];
        const secMap={}; secs.forEach(s=>{ secMap[s.name]=s.gid; });
        const tasks=[];
        plan.forEach((r,ix)=>{
          const cb=document.querySelector('[data-pi="'+ix+'"]'); if(cb&&!cb.checked) return;
          const nm=document.querySelector('[data-pn="'+ix+'"]'), dt=document.querySelector('[data-pd="'+ix+'"]');
          const t={name:(nm?nm.value.trim():r.name)||r.name, project_id:gid, due_on:(dt&&dt.value)||r.due};
          if(secMap[r.phase]) t.section_id=secMap[r.phase];
          tasks.push(t);
        });
        if(tasks.length) await call("create_tasks",{tasks});
        cfg.campaigns.push({gid,name,start,due:end,color});
        cfg.projects.push({gid,name,color,on:true});
        saveCfg(); closeModal(); confetti();
        toast("Campaign live — "+tasks.length+" tasks on the runway");
        loadAll();
      }catch(e){ btn.disabled=false; btn.textContent="Create it all in Asana"; toast("Failed: "+e.message); }
    };
  };
}
