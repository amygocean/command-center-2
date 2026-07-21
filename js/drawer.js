/* ================================================================
   DRAWER + MODALS — task detail, add task, settings, campaigns
   ================================================================ */

function openDrawer(gid){
  const t=findTask(gid); if(!t) return;
  const w=document.getElementById("drawerWrap"), d=document.getElementById("drawer");
  const peopleOpts='<option value="unassigned">Unassigned</option>'+
    state.users.map(u=>'<option value="'+u.gid+'"'+(t.assignee&&t.assignee.gid===u.gid?" selected":"")+'>'+esc(u.name)+'</option>').join("");
  const currentBoardName=t.projectName||"Current Asana board";
  const projOpts='<option value="">Choose a destination board…</option>'+cfg.projects
    .filter(p=>p.gid!==t.projectGid)
    .map(p=>'<option value="'+p.gid+'">'+esc(p.name)+'</option>').join("");
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
    '<div class="row"><div class="fld"><label>'+(t.isComms?'Send date':'Due date')+'</label><input type="date" id="dDue" value="'+(t.due||"")+'"></div>'+
    (t.isComms?'<div class="fld"><label>Send time</label><input type="time" id="dTime" step="300" value="'+(t.sendTime||"")+'"></div>':'')+
    '<div class="fld"><label>Assignee</label><select id="dAssignee">'+peopleOpts+'</select></div></div>'+
    '<div class="fld"><label>Board</label><div class="current-board"><span>Current board</span><b>'+esc(currentBoardName)+'</b></div>'+
      '<label class="move-board-toggle"><input type="checkbox" id="dMoveBoard"><span><b>Move this task to another board</b><small>The board will not change unless you tick this.</small></span></label></div>'+
    '<div class="move-board-fields" id="dMoveWrap" style="display:none">'+
      '<div class="fld"><label>Destination board</label><select id="dProject">'+projOpts+'</select></div>'+
      '<div class="fld" id="dSecWrap" style="display:none"><label>Section in destination board</label><select id="dSection"><option value="">(no section)</option></select></div>'+
    '</div>'+
    '<div class="drawer-actions">'+
      '<button class="btn primary" id="dSave">Save to Asana</button>'+
      '<button class="btn '+(t.completed?"ghost":"teal")+'" id="dDone">'+(t.completed?"Reopen":(t.isComms?"Sent ✓":"✓ Done"))+'</button>'+
      '<button class="btn ghost" id="dOpen">Asana ↗</button>'+
    '</div>'+
    '<div class="cmts"><label>Comments — type @ to mention anyone</label><div id="dCmts" class="cmts-list"><span class="spin"></span></div>'+
      '<div class="additem" style="margin-top:8px;position:relative"><input id="dCmtInput" placeholder="Add a comment… use @ to mention" autocomplete="off">'+
      '<div id="atDrop" class="at-drop" style="display:none"></div>'+
      '<button class="btn primary" id="dCmtBtn">Post</button></div></div>';
  w.style.display="block"; requestAnimationFrame(()=>w.classList.add("open"));
  loadTaskDetail(gid);
  wireMentionInput(d.querySelector("#dCmtInput"), d.querySelector("#atDrop"));
  d.querySelector("#dCmtBtn").onclick=async()=>{
    const inp=d.querySelector("#dCmtInput"), txt=inp.value.trim(); if(!txt) return;
    const b=d.querySelector("#dCmtBtn"); b.disabled=true;
    try{
      const {html,hasMentions,mentioned}=buildMentionHtml(txt);
      if(hasMentions) await call("add_comment",{task_id:gid,text:html,html:true});
      else await call("add_comment",{task_id:gid,text:txt});
      logMentions(mentioned, t);
      inp.value=""; toast("Comment added"); loadTaskDetail(gid);
    }
    catch(e){ toast("Failed: "+e.message); }
    b.disabled=false;
  };
  d.querySelector("#dCmtInput").onkeydown=e=>{
    if(e.key==="Enter" && document.getElementById("atDrop").style.display==="none") d.querySelector("#dCmtBtn").click();
  };
  const moveToggle=d.querySelector("#dMoveBoard"), moveWrap=d.querySelector("#dMoveWrap");
  moveToggle.onchange=()=>{
    moveWrap.style.display=moveToggle.checked?"block":"none";
    if(!moveToggle.checked){
      d.querySelector("#dProject").value="";
      d.querySelector("#dSecWrap").style.display="none";
      d.querySelector("#dSection").innerHTML='<option value="">(no section)</option>';
    }
  };
  d.querySelector("#dProject").onchange=async(e)=>{
    const proj=e.target.value, wrap=d.querySelector("#dSecWrap"), sel=d.querySelector("#dSection");
    if(!proj){ wrap.style.display="none"; sel.innerHTML='<option value="">(no section)</option>'; return; }
    wrap.style.display="block"; sel.innerHTML='<option value="">Loading…</option>';
    try{ const res=await call("get_project",{project_id:proj,include_sections:true,opt_fields:"sections.name"});
      const secs=(res.data&&res.data.sections)||[];
      sel.innerHTML='<option value="">(no section)</option>'+secs.map(s=>'<option value="'+s.gid+'">'+esc(s.name)+'</option>').join("");
    }catch(err){ sel.innerHTML='<option value="">(couldn\'t load sections)</option>'; }
  };
  d.querySelector("#dSave").onclick=async()=>{
    const name=d.querySelector("#dName").value.trim();
    const due=d.querySelector("#dDue").value||null;
    const sendTime=t.isComms&&d.querySelector("#dTime")?d.querySelector("#dTime").value:"";
    if(sendTime&&!due){ toast("Pick a send date before choosing a time"); return; }
    const asg=d.querySelector("#dAssignee").value;
    const wantsMove=d.querySelector("#dMoveBoard").checked;
    const proj=wantsMove?d.querySelector("#dProject").value:"";
    if(wantsMove&&!proj){ toast("Choose the board you want to move this task to"); return; }
    const moved=!!(wantsMove&&proj&&proj!==t.projectGid);
    const notes=d.querySelector("#dNotes").value;
    const upd={task:gid}; if(name&&name!==t.name)upd.name=name;
    if(t.isComms){
      // due_on and due_at are mutually exclusive in Asana. Explicitly clear
      // the other field so switching between timed and date-only stays safe.
      if(due&&sendTime){ upd.due_at=communityDueAt(due,sendTime); upd.due_on=null; }
      else if(due){ upd.due_on=due; upd.due_at=null; }
      else { upd.due_on=null; upd.due_at=null; }
    }else upd.due_on=due;
    upd.notes=notes;
    upd.assignee = asg==="unassigned"?null:asg;
    if(moved){ const sec=d.querySelector("#dSection").value;
      upd.add_projects=[sec?{project_id:proj,section_id:sec}:{project_id:proj}];
      if(t.projectGid) upd.remove_projects=[t.projectGid];
    }
    try{ await call(t.isComms?"update_shared_tasks":"update_tasks",{tasks:[upd]});
      closeDrawer();
      if(moved){
        const destination=(cfg.projects.find(p=>p.gid===proj)||{}).name||"the selected board";
        toast((t.projectGid?"Moved to ":"Added to ")+destination); loadAll();
      }
      else { t.name=name||t.name; t.due=due; t.sendTime=sendTime||null; t.dueAt=(due&&sendTime)?communityDueAt(due,sendTime):null; t.notes=notes; t.assignee=asg==="unassigned"?null:{gid:asg,name:userName(asg)}; renderAll(); toast("Saved ✓"); }
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

/* ================================================================
   CAMPAIGNS — launch-anchored creation wizard
   Sources are analysed before approval; the runway works backwards.
   ================================================================ */

function openCampaign(){
  const queued=[];
  const chBoxes=CAMPAIGN_CHANNELS.map(c=>'<label class="ctgt" style="--cc:var(--teal)"><input type="checkbox" value="'+c.key+'" checked><span>'+c.label+'</span></label>').join("");
  const roleBoxes=["FOH","BOH","Sushi","Bar / Deli","Managers"].map(r=>'<label class="ctgt" style="--cc:var(--deep)"><input type="checkbox" value="'+r+'"><span>'+r+'</span></label>').join("");
  showModal('<h2>New campaign</h2><p class="hint">Choose the launch date first. The runway works backwards so learning is ready before launch, not built after it.</p>'+
    '<div class="fld"><label>Campaign name</label><input id="cName" placeholder="e.g. Summer Menu 2027"></div>'+
    '<div class="row"><div class="fld"><label>Launch date</label><input type="date" id="cStart"></div><div class="fld"><label>Campaign ends</label><input type="date" id="cEnd"></div></div>'+
    '<div class="fld"><label>Channels</label><div style="display:flex;gap:4px;flex-wrap:wrap">'+chBoxes+'</div></div>'+
    '<div class="fld"><label>Roles affected</label><div style="display:flex;gap:4px;flex-wrap:wrap">'+roleBoxes+'</div></div>'+
    '<div class="fld"><label>Campaign notes</label><textarea id="cNotes" placeholder="Goal, audience, important decisions, source links, what cannot change…"></textarea></div>'+
    '<div class="fld campaign-create-resources"><label>Initial source material</label><div class="campaign-create-resource-line"><input type="file" id="cFiles" multiple accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json,image/*"><select id="cFileType">'+CAMPAIGN_RESOURCE_TYPES.map(x=>'<option>'+x+'</option>').join("")+'</select><button class="btn ghost" id="cAddFiles">Add files</button></div><div id="cFileQueue" class="campaign-create-file-queue"></div><small>Files are attached to the new Asana project and used to propose recipe, shoot and learning work.</small></div>'+
    '<div class="fld"><label>Band colour</label><select id="cColor">'+["#D9822B","#0A3D62","#00A8A8","#F7C325","#7A5FB0","#C0392B","#3A7D44"].map(c=>'<option value="'+c+'">'+c+'</option>').join("")+'</select></div>'+
    '<div class="drawer-actions"><button class="btn primary" id="cPlan">✨ Read sources and draft the plan</button><button class="btn ghost" data-close>Cancel</button></div><div id="cPlanOut"></div>');
  wireModalClose();
  const renderQueue=()=>{
    const box=document.getElementById("cFileQueue");
    box.innerHTML=queued.length?queued.map((q,i)=>'<div><span>'+esc(q.file.name)+'</span><select data-cqcat="'+i+'">'+CAMPAIGN_RESOURCE_TYPES.map(x=>'<option'+(x===q.category?' selected':'')+'>'+x+'</option>').join("")+'</select><button data-cqdel="'+i+'">×</button></div>').join(""):'<span class="hint">No files added yet.</span>';
    box.querySelectorAll("[data-cqcat]").forEach(el=>el.onchange=()=>{queued[+el.dataset.cqcat].category=el.value;queued[+el.dataset.cqcat].analysis=null;});
    box.querySelectorAll("[data-cqdel]").forEach(el=>el.onclick=()=>{queued.splice(+el.dataset.cqdel,1);renderQueue();});
  };
  renderQueue();
  document.getElementById("cAddFiles").onclick=()=>{
    const files=[...document.getElementById("cFiles").files],category=document.getElementById("cFileType").value;
    files.forEach(file=>{if(file.size>3*1024*1024)toast(file.name+" is larger than the 3 MB browser-upload limit");else queued.push({file,category,analysis:null,data_base64:null});});
    document.getElementById("cFiles").value="";renderQueue();
  };
  document.getElementById("cPlan").onclick=async()=>{
    const name=document.getElementById("cName").value.trim(),launch=document.getElementById("cStart").value,endDate=document.getElementById("cEnd").value;
    if(!name){toast("Name the campaign first");return;}if(!launch){toast("Choose the launch date");return;}if(endDate&&pd(endDate)<pd(launch)){toast("The campaign end must be after launch");return;}
    const channels=[...document.querySelectorAll('#modal .fld input[type="checkbox"]:checked')].map(i=>i.value).filter(v=>CAMPAIGN_CHANNELS.some(c=>c.key===v));
    const roles=[...document.querySelectorAll('#modal .fld input[type="checkbox"]:checked')].map(i=>i.value).filter(v=>!CAMPAIGN_CHANNELS.some(c=>c.key===v));
    const btn=document.getElementById("cPlan");btn.disabled=true;btn.innerHTML='<span class="spin"></span> reading sources…';
    try{
      for(const q of queued){
        if(q.analysis)continue;
        try{const r=await analyseCampaignFile(q.file,q.category,{name,start:launch,due:endDate});q.analysis=r.analysis;q.data_base64=r.data_base64;}
        catch(e){q.error=e.message;q.data_base64=await fileToBase64(q.file);}
      }
      const sourceMap={};queued.forEach((q,i)=>sourceMap["queued-"+i]={name:q.file.name,category:q.category,analysis:q.analysis,error:q.error});
      const plan=[...buildCampaignPlan(name,launch,endDate,channels,roles),...campaignSourceRecommendations(sourceMap,launch)];
      const seen=new Set(),deduped=plan.filter(r=>{const k=smartSlug(r.name);if(seen.has(k))return false;seen.add(k);return true;});
      const out=document.getElementById("cPlanOut");let html='<div class="campaign-create-plan-head"><b>The backwards plan</b><span>Launch '+campFmt(pd(launch))+' · untick or edit anything</span></div>';
      CAMPAIGN_PHASES.forEach(ph=>{
        const rows=deduped.filter(r=>r.phase===ph);if(!rows.length)return;html+='<div class="plan-ph">'+ph+'</div>';
        rows.forEach(r=>{const ix=deduped.indexOf(r);html+='<div class="plan-row smart"><input type="checkbox" data-pi="'+ix+'" checked><input type="text" data-pn="'+ix+'" value="'+esc(r.name)+'"><input type="date" data-pd="'+ix+'" value="'+r.due+'"><span>'+(r.sourceNames&&r.sourceNames[0]!=="Academy campaign playbook"?'SOURCE':'PLAYBOOK')+'</span></div>';});
      });
      html+='<div class="drawer-actions"><button class="btn primary" id="cCreate">Create campaign, resources and tasks</button></div>';out.innerHTML=html;
      document.getElementById("cCreate").onclick=()=>createCampaignFromPlan({name,launch,endDate,channels,roles,plan:deduped,queued});
    }catch(e){toast("Could not draft campaign: "+e.message);}finally{btn.disabled=false;btn.textContent="✨ Read sources and draft the plan";}
  };
}

async function createCampaignFromPlan(ctx){
  const {name,launch,endDate,plan,queued}=ctx,btn=document.getElementById("cCreate");btn.disabled=true;btn.innerHTML='<span class="spin"></span> building…';
  const color=document.getElementById("cColor").value,notes=document.getElementById("cNotes").value.trim();
  try{
    const res=await call("create_shared_project",{name,team:ACADEMY_TEAM,color:HEX_TO_ASANA[color]||"dark-orange",default_view:"calendar",privacy_setting:"private_to_team",start_on:launch,due_on:endDate||null,notes,sections:CAMPAIGN_SECTIONS.map(sectionName=>({sectionName}))});
    const gid=res.data&&res.data.gid;if(!gid)throw new Error("No project id returned");
    const secs=(res.data.sections_created&&res.data.sections_created.succeeded)||[],secMap={};secs.forEach(s=>secMap[s.name]=s.gid);
    const reviewed=plan.map((r,ix)=>{
      const cb=document.querySelector('[data-pi="'+ix+'"]'),nm=document.querySelector('[data-pn="'+ix+'"]'),dt=document.querySelector('[data-pd="'+ix+'"]');
      r.name=(nm&&nm.value.trim())||r.name;r.due=(dt&&dt.value)||r.due;r.selected=!!(cb&&cb.checked);r.dismissed=!r.selected;r.action=r.selected?"create":"dismissed";return r;
    }),selected=reviewed.filter(r=>r.selected);
    let shoot=null;
    const shootRec=selected.find(r=>r.type==="shoot_day");
    if(shootRec){
      const sr=await call("create_shared_tasks",{tasks:[{name:shootRec.name,project_id:CC_PROJECT,section_id:SEC_SHOOT,due_on:shootRec.due,notes:smartTaskNotes(shootRec,"")}]}),st=sr.data&&sr.data[0];
      if(st){shoot={gid:st.gid,name:shootRec.name,due:shootRec.due};shootRec.existingGid=st.gid;await call("update_shared_tasks",{tasks:[{task:st.gid,add_projects:[{project_id:gid,section_id:secMap[shootRec.phase]}]}]});}
    }
    for(const r of selected.filter(x=>x!==shootRec)){
      const display=shoot&&r.requiresShoot?'「shot」 '+r.name.replace(/^Film:\s*/i,"")+" — "+shoot.name:r.name,due=shoot&&r.requiresShoot?shoot.due:r.due;
      const cr=await call("create_shared_tasks",{tasks:[{name:display,project_id:gid,section_id:secMap[r.phase],due_on:due,notes:smartTaskNotes(r,"")}]}),t=cr.data&&cr.data[0];
      if(t&&shoot&&r.requiresShoot){await call("update_shared_tasks",{tasks:[{task:t.gid,add_projects:[{project_id:CC_PROJECT,section_id:SEC_PLAN}]}]});await call("set_task_parent",{task_id:t.gid,parent_id:shoot.gid});}
      if(t)r.existingGid=t.gid;r.action="covered";r.selected=false;
    }
    const sources={},uploadErrors=[];
    for(const q of queued){
      try{const data=q.data_base64||await fileToBase64(q.file),ur=await call("upload_attachment",{parent_id:gid,filename:q.file.name,mime:q.file.type||"application/octet-stream",data_base64:data}),a=ur.data||{};sources[a.gid]={gid:a.gid,name:a.name||q.file.name,category:q.category,analysis:q.analysis,error:q.error||null,addedAt:new Date().toISOString()};}
      catch(e){uploadErrors.push(q.file.name+": "+e.message);}
    }
    const sourceValues=Object.values(sources),smart={version:1,taskGid:null,launchDate:launch,dirty:uploadErrors.length>0,dirtyReason:uploadErrors.length?"Some initial source files did not upload. Add them again, then run Smart Update.":"",sources,summary:sourceValues.map(s=>s.analysis&&s.analysis.summary).filter(Boolean).join(" ").slice(0,1600),gaps:sourceValues.flatMap(s=>s.analysis&&s.analysis.gaps||[]),recommendations:reviewed.map(r=>r.dismissed?({...r,action:"dismissed",selected:false,dismissed:true}):({...r,action:"covered",selected:false,dismissed:false})),lastUpdate:new Date().toISOString()};
    const stateSave=await call("save_campaign_state",{project_id:gid,section_id:secMap["Campaign HQ"],name:"⚙️ campaign-smart-plan (managed by app)",notes:JSON.stringify(smart)});smart.taskGid=stateSave.data&&stateSave.data.gid||null;
    let portfolioLinked=true;try{await call("add_to_portfolio",{portfolio_gid:CAMPAIGN_PORTFOLIO,item:gid});}catch{portfolioLinked=false;}
    const campaign={gid,name,start:launch,due:endDate,color,notes,url:"https://app.asana.com/0/"+gid,source:"portfolio"};
    cfg.campaigns=(cfg.campaigns||[]).filter(c=>c.gid!==gid);cfg.campaigns.push(campaign);cfg.projects=(cfg.projects||[]).filter(p=>p.gid!==gid);cfg.projects.push({gid,name,color,on:true,campaign:true});state.campaignSmart[gid]=smart;state.campaignSelected=gid;state.campaignView[gid]="smart";state.campaignsLoaded=false;saveCfg();closeModal();confetti();switchTab("campaigns");toast((portfolioLinked?"Campaign created":"Campaign created; portfolio link needs attention")+(uploadErrors.length?" · some files failed":""));loadAll();
  }catch(e){btn.disabled=false;btn.textContent="Create campaign, resources and tasks";toast("Failed: "+e.message);}
}

/* ================================================================
   @MENTIONS — real Asana mentions from the comment box.
   Tokens look like @[Name](gid) while typing; on post they become
   Asana rich-text mentions, and the girls get an in-app badge.
   ================================================================ */
function wireMentionInput(inp, drop){
  if(!inp||!drop) return;
  let matches=[];
  const close=()=>{ drop.style.display="none"; matches=[]; };
  inp.addEventListener("input",()=>{
    const caret=inp.selectionStart;
    const before=inp.value.slice(0,caret);
    const m=before.match(/@([\w ]{0,20})$/);
    if(!m){ close(); return; }
    const q=m[1].toLowerCase();
    matches=state.users.filter(u=>u.name.toLowerCase().includes(q)).slice(0,6);
    if(!matches.length){ close(); return; }
    drop.innerHTML=matches.map((u,i)=>'<div class="at-opt'+(i===0?" on":"")+'" data-gid="'+u.gid+'">'+esc(u.name)+'</div>').join("");
    drop.style.display="block";
    drop.querySelectorAll(".at-opt").forEach(el=>el.onmousedown=e=>{
      e.preventDefault();
      pickMention(inp, el.dataset.gid, m[1].length);
      close();
    });
  });
  inp.addEventListener("keydown",e=>{
    if(drop.style.display==="none") return;
    const opts=[...drop.querySelectorAll(".at-opt")];
    let ix=opts.findIndex(o=>o.classList.contains("on"));
    if(e.key==="ArrowDown"){ e.preventDefault(); opts[ix]&&opts[ix].classList.remove("on"); opts[(ix+1)%opts.length].classList.add("on"); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); opts[ix]&&opts[ix].classList.remove("on"); opts[(ix-1+opts.length)%opts.length].classList.add("on"); }
    else if(e.key==="Enter"||e.key==="Tab"){
      e.preventDefault();
      const on=opts.find(o=>o.classList.contains("on"))||opts[0];
      const q=(inp.value.slice(0,inp.selectionStart).match(/@([\w ]{0,20})$/)||["",""])[1];
      pickMention(inp, on.dataset.gid, q.length);
      close();
    }
    else if(e.key==="Escape") close();
  });
  inp.addEventListener("blur",()=>setTimeout(close,150));
}
function pickMention(inp, gid, qLen){
  const u=state.users.find(x=>x.gid===gid); if(!u) return;
  const caret=inp.selectionStart;
  const token="@["+u.name+"]("+gid+") ";
  inp.value=inp.value.slice(0,caret-qLen-1)+token+inp.value.slice(caret);
  inp.focus();
  const pos=caret-qLen-1+token.length;
  inp.setSelectionRange(pos,pos);
}
function buildMentionHtml(txt){
  const mentioned=[];
  let hasMentions=false;
  const html=esc(txt).replace(/@\[([^\]]+)\]\((\d+)\)/g,(_,name,gid)=>{
    hasMentions=true; mentioned.push({gid,name});
    return '<a data-asana-gid="'+gid+'"/>';
  });
  return {html,hasMentions,mentioned};
}
function logMentions(mentioned, task){
  if(!mentioned||!mentioned.length) return;
  const girls=mentioned.filter(m=>GIRLS.some(g=>g.gid===m.gid));
  if(!girls.length) return;
  girls.forEach(m=>{
    state.keeper.mentions.unshift({to:m.gid, from:(state.me&&state.me.name)||"someone",
      taskGid:task.gid, taskName:task.name, at:new Date().toISOString()});
  });
  state.keeper.mentions=state.keeper.mentions.slice(0,50);
  saveKeeper(); renderMentionBadge();
}
function myMentions(){
  if(!state.me) return [];
  return (state.keeper.mentions||[]).filter(m=>m.to===state.me.gid ||
    (DEMO && state.me.gid==="u-amy" && m.to===GIRLS[0].gid));
}
function renderMentionBadge(){
  const b=document.getElementById("atBadge"); if(!b) return;
  const seen=localStorage.getItem("ob_at_seen")||"";
  const unseen=myMentions().filter(m=>m.at>seen).length;
  b.textContent=unseen; b.style.display=unseen?"flex":"none";
}
function openMentions(){
  const list=myMentions();
  localStorage.setItem("ob_at_seen", new Date().toISOString());
  renderMentionBadge();
  showModal('<h2>Mentions</h2>'+
    (list.length?list.slice(0,15).map(m=>'<div class="f-row" data-gid="'+m.taskGid+'">'+
      '<span>'+esc(m.from)+' mentioned you on <b>'+esc(m.taskName)+'</b></span>'+
      '<span class="f-meta">'+new Date(m.at).toLocaleDateString()+'</span></div>').join("")
    :'<div class="empty">No mentions yet. Very peaceful.</div>')+
    '<div class="drawer-actions"><button class="btn ghost" data-close>Close</button></div>');
  wireModalClose();
  document.querySelectorAll("#modal .f-row[data-gid]").forEach(r=>r.onclick=()=>{ closeModal(); openDrawer(r.dataset.gid); });
}
