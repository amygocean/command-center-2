/* ================================================================
   DRAWER + MODALS — task detail, add task, settings, campaigns
   ================================================================ */

function openDrawer(gid){
  const t=findTask(gid); if(!t) return;
  const w=document.getElementById("drawerWrap"), d=document.getElementById("drawer");
  const peopleOpts=assigneeOptions(t.assignee?t.assignee.gid:"unassigned","unassigned");
  const currentBoardName=t.projectName||"Current Asana board";
  const projOpts='<option value="">Choose a destination board…</option>'+cfg.projects
    .filter(p=>p.gid!==t.projectGid)
    .map(p=>'<option value="'+p.gid+'">'+esc(p.name)+'</option>').join("");
  const cm = t.isComms ? communityOf(t) : null;
  const pu = t.isComms ? purposeOf(t) : null;
  const mentionContext=state.mentionOpenContext&&String(state.mentionOpenContext.taskGid)===String(gid)?state.mentionOpenContext:null;
  const mentionContextHtml=mentionContext?'<div class="mention-context"><div><b>@ Mention from '+esc(mentionContext.from||"Someone")+'</b><span>'+esc(mentionDate(mentionContext.at))+'</span></div><p>'+esc(mentionContext.text||"You were mentioned in this task.")+'</p></div>':'';
  d.innerHTML=
    '<h2>'+(t.isShoot?"🎬 ":"")+esc(t.name)+'</h2>'+
    '<div class="cmeta" style="margin-bottom:12px"><span class="dot" style="background:'+t.projectColor+'"></span> '+esc(t.projectName)+
      (t.sectionName?' · '+esc(t.sectionName):"")+
      (cm?' · <b style="color:'+cm.color+'">'+esc(cm.name)+'</b>':"")+
      (pu?' · '+pu.label:"")+'</div>'+mentionContextHtml+
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
      logMentions(mentioned, t, txt);
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
  setTimeout(()=>{ w.style.display="none"; state.mentionOpenContext=null; },200);
}
async function loadTaskDetail(gid){
  const box=document.getElementById("dCmts"); if(!box) return;
  try{
    const res=await call("get_task",{task_id:gid,opt_fields:"notes,comments.text,comments.created_by.name,comments.created_at"});
    const full=res.data||{}; const t=findTask(gid);
    const ta=document.getElementById("dNotes");
    if(ta && document.activeElement!==ta && full.notes!=null && full.notes!==ta.value){ ta.value=full.notes; if(t) t.notes=full.notes; }
    const cs=full.comments||[];
    if(!cs.length){ box.innerHTML='<div class="empty" style="padding:6px">No comments yet.</div>'; return; }
    box.innerHTML=cs.map(c=>'<div class="cmt"><div class="cmt-meta">'+esc((c.created_by&&c.created_by.name)||"Someone")+
      (c.created_at?' · '+new Date(c.created_at).toLocaleDateString():'')+'</div><div class="cmt-txt">'+esc(c.text||"")+'</div></div>').join("");
  }catch(e){ box.innerHTML='<div class="empty" style="padding:6px">Couldn\'t load comments.</div>'; }
}

/* ---- modal plumbing ---- */
function showModal(html,mode=""){ const w=document.getElementById("modalWrap"); document.getElementById("modal").innerHTML=html; w.classList.toggle("mention-mode",mode==="mention"); w.style.display="block"; requestAnimationFrame(()=>w.classList.add("open")); }
function closeModal(){ const w=document.getElementById("modalWrap"); w.classList.remove("open"); setTimeout(()=>{ w.style.display="none"; w.classList.remove("mention-mode"); },200); }
function wireModalClose(){ document.querySelectorAll("#modal [data-close]").forEach(x=>x.onclick=()=>{closeDrawer();closeModal();}); }

/* ---- add task ---- */
function openAdd(){
  const projOpts=cfg.projects.map(p=>'<option value="'+p.gid+'">'+esc(p.name)+'</option>').join("");
  const peopleOpts=assigneeOptions("","");
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
    '<div class="fld"><label>Experience</label><div class="setlist"><label class="setrow celebration-setting"><input type="checkbox" id="sCelebrate" '+(cfg.completionCelebrations!==false?"checked":"")+'><span><b>Celebrate completed tasks</b><small>Confetti and a short completion moment. This is a personal browser setting.</small></span></label></div></div>'+
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
    cfg.completionCelebrations=document.getElementById("sCelebrate").checked;
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
   @MENTIONS — task-comment mentions from the whole Asana workspace.

   Asana does not expose its Inbox through the public API. The server scans
   recently active tasks the signed-in person follows and parses Asana's real
   rich-text user links. Mentions created inside this app are merged in
   immediately while Asana's search index catches up.
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
function logMentions(mentioned, task, text=""){
  if(!mentioned||!mentioned.length) return;
  const girls=mentioned.filter(m=>GIRLS.some(g=>g.gid===m.gid));
  if(!girls.length) return;
  girls.forEach(m=>{
    state.keeper.mentions.unshift({to:m.gid, from:(state.me&&state.me.name)||"someone",
      taskGid:task.gid, taskName:task.name, text, at:new Date().toISOString()});
  });
  state.keeper.mentions=state.keeper.mentions.slice(0,50);
  saveKeeper(); renderMentionBadge();
}

const MENTION_SCAN_DAYS=180;
const MENTION_CACHE_MS=5*60*1000;
const MENTION_INCREMENTAL_OVERLAP_MS=15*60*1000;
const MENTION_REF_PREFIX="mention-ref:";
const asanaMentions={items:[],loadedAt:0,loading:null,error:null,meta:null,hydrated:false};
const mentionPanel={filter:"new",query:"",expanded:{}};
let mentionPrefs=null,mentionWatcherStarted=false,mentionWatcherTimer=null;

function mentionUserKey(){ return String((state.me&&state.me.gid)||"guest"); }
function mentionCacheKey(){ return "ob-asana-mentions-v3:"+mentionUserKey(); }
function mentionPrefsKey(){ return "ob-mention-triage-v1:"+mentionUserKey(); }
function mentionId(m){
  return String(m&&(m.storyGid||m.gid||[m.taskGid,m.at,m.from,m.text].filter(Boolean).join("|"))||"");
}
function loadMentionPrefs(){
  if(mentionPrefs) return mentionPrefs;
  try{ mentionPrefs=JSON.parse(localStorage.getItem(mentionPrefsKey())||"null"); }
  catch(_){ mentionPrefs=null; }
  if(!mentionPrefs||typeof mentionPrefs!=="object") mentionPrefs={seen:{},hidden:{}};
  if(!mentionPrefs.seen||typeof mentionPrefs.seen!=="object") mentionPrefs.seen={};
  if(!mentionPrefs.hidden||typeof mentionPrefs.hidden!=="object") mentionPrefs.hidden={};
  if(!mentionPrefs.legacySeenAt){
    const old=localStorage.getItem("ob_at_seen:"+mentionUserKey())||localStorage.getItem("ob_at_seen")||"";
    if(old&&!Number.isNaN(new Date(old).getTime()))mentionPrefs.legacySeenAt=old;
  }
  return mentionPrefs;
}
function saveMentionPrefs(){
  try{ localStorage.setItem(mentionPrefsKey(),JSON.stringify(loadMentionPrefs())); }
  catch(_){ /* keep the in-memory triage state */ }
}
function mentionIsSeen(m){
  const prefs=loadMentionPrefs();
  return !!prefs.seen[mentionId(m)] || !!(prefs.legacySeenAt&&m&&m.at&&new Date(m.at)<=new Date(prefs.legacySeenAt));
}
function mentionIsHidden(m){ return !!loadMentionPrefs().hidden[mentionId(m)]; }
function markMentionsSeen(items){
  const prefs=loadMentionPrefs(),now=Date.now();
  (items||[]).forEach(m=>{ const id=mentionId(m); if(id)prefs.seen[id]=now; });
  saveMentionPrefs(); renderMentionBadge();
}
function setMentionsHidden(items,hidden){
  const prefs=loadMentionPrefs(),now=Date.now();
  (items||[]).forEach(m=>{ const id=mentionId(m); if(!id)return; if(hidden)prefs.hidden[id]=now; else delete prefs.hidden[id]; });
  saveMentionPrefs(); renderMentionBadge();
}
function hydrateMentionCache(){
  if(asanaMentions.hydrated) return;
  asanaMentions.hydrated=true;
  try{
    const cached=JSON.parse(localStorage.getItem(mentionCacheKey())||"null");
    if(cached&&Array.isArray(cached.items)){
      asanaMentions.items=cached.items;
      asanaMentions.loadedAt=Number(cached.loadedAt)||0;
      asanaMentions.meta=cached.meta||null;
    }
  }catch(_){ /* private browsers may block local storage */ }
}
function saveMentionCache(){
  try{ localStorage.setItem(mentionCacheKey(),JSON.stringify({items:asanaMentions.items,loadedAt:asanaMentions.loadedAt,meta:asanaMentions.meta})); }
  catch(_){ /* keep the in-memory result */ }
}
function myLocalMentions(){
  if(!state.me) return [];
  return (state.keeper.mentions||[]).filter(m=>m.to===state.me.gid ||
    (DEMO && state.me.gid==="u-amy" && m.to===GIRLS[0].gid)).map(m=>{
      const task=findTask(m.taskGid);
      return {...m,gid:m.gid||("local:"+m.taskGid+":"+m.at),storyGid:m.storyGid||("local:"+m.taskGid+":"+m.at),source:"local",taskUrl:task&&task.url||null,
        projectName:task&&task.projectName||null,text:m.text||""};
    });
}
function mergedMentions(){
  hydrateMentionCache();
  const out=[...asanaMentions.items];
  myLocalMentions().forEach(local=>{
    const duplicate=out.some(real=>real.taskGid===local.taskGid&&String(real.from||"").toLowerCase()===String(local.from||"").toLowerCase()&&
      Math.abs(new Date(real.at||0)-new Date(local.at||0))<10*60*1000);
    if(!duplicate) out.push(local);
  });
  const deduped=new Map();
  out.forEach(m=>{ const id=mentionId(m); if(id&&!deduped.has(id))deduped.set(id,{...m,_mentionId:id}); });
  return [...deduped.values()].sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
}
function mergeMentionResults(previous,incoming){
  const byId=new Map();
  (previous||[]).forEach(m=>{ const id=mentionId(m); if(id)byId.set(id,m); });
  (incoming||[]).forEach(m=>{ const id=mentionId(m); if(id)byId.set(id,m); });
  const cutoff=Date.now()-MENTION_SCAN_DAYS*86400000;
  return [...byId.values()].filter(m=>!m.at||new Date(m.at).getTime()>=cutoff)
    .sort((a,b)=>new Date(b.at||0)-new Date(a.at||0)).slice(0,300);
}
function announceNewMentions(items){
  const visible=(items||[]).filter(m=>!mentionIsHidden(m)); if(!visible.length)return;
  const btn=document.getElementById("btnAt");
  if(btn){ btn.classList.remove("mention-pop"); void btn.offsetWidth; btn.classList.add("mention-pop"); setTimeout(()=>btn.classList.remove("mention-pop"),1300); }
  const first=visible[0];
  toast(visible.length===1?(first.from||"Someone")+" mentioned you in "+(first.taskName||"a task"):
    visible.length+" new mentions found");
}
async function refreshAsanaMentions(force=false,deep=false){
  hydrateMentionCache();
  if(asanaMentions.loading) return asanaMentions.loading;
  if(!force&&asanaMentions.loadedAt&&Date.now()-asanaMentions.loadedAt<MENTION_CACHE_MS){ renderMentionBadge(); return asanaMentions.items; }
  asanaMentions.error=null;
  const previousItems=[...asanaMentions.items],previousIds=new Set(previousItems.map(mentionId));
  const hadBaseline=!!asanaMentions.loadedAt;
  const generatedAt=asanaMentions.meta&&asanaMentions.meta.generatedAt;
  let afterIso=null;
  if(!deep&&generatedAt){
    const since=new Date(generatedAt).getTime()-MENTION_INCREMENTAL_OVERLAP_MS;
    if(Number.isFinite(since))afterIso=new Date(since).toISOString();
  }
  asanaMentions.loading=(async()=>{
    try{
      const projectIds=[...new Set([
        ...(cfg.projects||[]).map(project=>project.gid),PB.proj,CC_PROJECT,WA_PROJECT,COMMUNITIES_PROJECT,
        BUGS_PROJECT,VISITS_PROJECT,SCHEDULE_PROJECT,REVAMP_PROJECT,CURRICULUM_PROJECT,cfg.msgBoard,cfg.prBoard
      ].filter(Boolean).map(String))];
      const loadedTasks=(state.tasks||[]).filter(task=>task&&task.gid&&!task.isKeeper).slice(0,180).map(task=>({
        gid:String(task.gid),name:task.name||"Untitled task",url:task.url||null,modified_at:task.modifiedAt||null,
        projectGid:task.projectGid||null,projectName:task.projectName||null,parent:task.parent||null
      }));
      const res=await call("get_mentions",{
        days:MENTION_SCAN_DAYS,after_iso:afterIso,task_limit:100,mention_limit:100,project_ids:projectIds,tasks:loadedTasks
      });
      const incoming=Array.isArray(res.data)?res.data:[];
      asanaMentions.items=(afterIso&&!deep)?mergeMentionResults(previousItems,incoming):incoming;
      asanaMentions.loadedAt=Date.now();
      asanaMentions.meta={
        scannedTasks:res.scanned_tasks||0,scannedSubtasks:res.scanned_subtasks||0,scannedComments:res.scanned_comments||0,
        windowDays:res.window_days||MENTION_SCAN_DAYS,warning:res.warning||null,diagnostics:res.diagnostics||null,
        generatedAt:res.generated_at||new Date().toISOString(),incremental:!!afterIso&&!deep
      };
      saveMentionCache();
      if(hadBaseline){
        const fresh=incoming.filter(m=>!previousIds.has(mentionId(m)));
        if(fresh.length)announceNewMentions(fresh);
      }
    }catch(e){ asanaMentions.error=e.message||"Could not load Asana mentions"; }
    finally{
      asanaMentions.loading=null;
      renderMentionBadge();
      if(document.getElementById("mentionList")) renderMentionsModal();
    }
    return asanaMentions.items;
  })();
  if(document.getElementById("mentionList")) renderMentionsModal();
  return asanaMentions.loading;
}
function startMentionWatcher(){
  if(mentionWatcherStarted)return;
  mentionWatcherStarted=true;
  mentionWatcherTimer=setInterval(()=>{
    if(document.visibilityState==="visible")refreshAsanaMentions(false,false);
  },MENTION_CACHE_MS);
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"&&Date.now()-asanaMentions.loadedAt>2*60*1000)refreshAsanaMentions(true,false);
  });
}
function renderMentionBadge(){
  const b=document.getElementById("atBadge"); if(!b) return;
  const unseen=mergedMentions().filter(m=>!mentionIsHidden(m)&&!mentionIsSeen(m)).length;
  b.textContent=unseen>99?"99+":unseen;
  b.style.display=unseen?"flex":"none";
  const btn=document.getElementById("btnAt");
  if(btn)btn.title=unseen?unseen+" unacknowledged mention"+(unseen===1?"":"s"):"Your mentions";
}
function mentionDate(value){
  if(!value) return "";
  const d=new Date(value),now=new Date(),days=Math.floor((new Date(now.getFullYear(),now.getMonth(),now.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/86400000);
  if(days===0) return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  if(days===1) return "Yesterday";
  return d.toLocaleDateString([],{day:"numeric",month:"short",year:d.getFullYear()===now.getFullYear()?undefined:"numeric"});
}
function mentionThreadKey(m){ return String(m&&m.taskGid||mentionId(m)); }
function allMentionGroups(){
  const groups=new Map();
  mergedMentions().forEach(m=>{
    const key=mentionThreadKey(m);
    if(!groups.has(key))groups.set(key,{key,taskGid:m.taskGid,taskName:m.taskName||"Untitled task",taskUrl:m.taskUrl||null,
      projectName:m.projectName||null,parentName:m.parentName||null,isSubtask:!!m.isSubtask,items:[]});
    const group=groups.get(key); group.items.push(m);
    if(!group.taskUrl&&m.taskUrl)group.taskUrl=m.taskUrl;
    if(!group.projectName&&m.projectName)group.projectName=m.projectName;
  });
  return [...groups.values()].map(group=>{
    group.items.sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
    group.latest=group.items[0];
    group.unseen=group.items.filter(m=>!mentionIsHidden(m)&&!mentionIsSeen(m)).length;
    group.visibleItems=group.items.filter(m=>!mentionIsHidden(m));
    group.hiddenItems=group.items.filter(mentionIsHidden);
    return group;
  }).sort((a,b)=>new Date(b.latest&&b.latest.at||0)-new Date(a.latest&&a.latest.at||0));
}
function mentionGroupsForPanel(){
  const q=mentionPanel.query.trim().toLowerCase();
  return allMentionGroups().filter(group=>{
    const items=mentionPanel.filter==="hidden"?group.hiddenItems:group.visibleItems;
    if(!items.length)return false;
    if(mentionPanel.filter==="new"&&!items.some(m=>!mentionIsSeen(m)))return false;
    if(!q)return true;
    return [group.taskName,group.projectName,group.parentName,...items.flatMap(m=>[m.from,m.text])]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  });
}
function mentionCounts(){
  const all=mergedMentions();
  return {
    new:all.filter(m=>!mentionIsHidden(m)&&!mentionIsSeen(m)).length,
    all:all.filter(m=>!mentionIsHidden(m)).length,
    hidden:all.filter(mentionIsHidden).length
  };
}
function mentionPeopleLabel(items){
  const names=[...new Set((items||[]).map(m=>m.from||"Someone"))];
  if(names.length===1)return names[0];
  if(names.length===2)return names[0]+" and "+names[1];
  return names[0]+" and "+(names.length-1)+" others";
}
function mentionRefsForUser(userGid=mentionUserKey()){
  if(!state.keeper.mentionRefs||typeof state.keeper.mentionRefs!=="object")state.keeper.mentionRefs={};
  if(!Array.isArray(state.keeper.mentionRefs[userGid]))state.keeper.mentionRefs[userGid]=[];
  return state.keeper.mentionRefs[userGid];
}
function mentionRefId(taskGid){ return MENTION_REF_PREFIX+String(taskGid); }
function mentionReferenceForTask(taskGid,userGid=mentionUserKey()){
  return mentionRefsForUser(userGid).find(ref=>String(ref.taskGid)===String(taskGid))||null;
}
function isMentionTaskPinned(taskGid){ return !!mentionReferenceForTask(taskGid); }
function myGirlForMentions(){ return GIRLS.find(g=>state.me&&String(g.gid)===String(state.me.gid))||null; }
function latestMentionForTask(taskGid){
  const group=allMentionGroups().find(g=>String(g.taskGid)===String(taskGid));
  return group&&group.latest||null;
}
function addMentionReference(group){
  const girl=myGirlForMentions(); if(!girl){toast("Your Asana account is not linked to a Girls column yet");return;}
  const refs=mentionRefsForUser(),latest=group.latest||group.items&&group.items[0]||{};
  let ref=refs.find(item=>String(item.taskGid)===String(group.taskGid));
  const data={id:mentionRefId(group.taskGid),taskGid:String(group.taskGid),taskName:group.taskName||latest.taskName||"Mention follow-up",
    taskUrl:group.taskUrl||latest.taskUrl||null,projectName:group.projectName||latest.projectName||null,
    parentName:group.parentName||latest.parentName||null,from:latest.from||null,text:latest.text||"",addedAt:new Date().toISOString()};
  if(ref)Object.assign(ref,data); else refs.unshift(data);
  const gc=girlCfg(girl.key),sourceAlreadyVisible=(state.myTasks[girl.key]||[]).some(t=>String(t.gid)===String(group.taskGid));
  if(!sourceAlreadyVisible&&!gc.order.includes(data.id))gc.order.unshift(data.id);
  markMentionsSeen(group.items); saveKeeper(); renderGirls(); renderMentionsModal();
  toast(sourceAlreadyVisible?"Mention linked to the task already in your list":"Shown in your to-do list");
}
function removeMentionReference(taskGid,quiet=false){
  const girl=myGirlForMentions(),refs=mentionRefsForUser(),id=mentionRefId(taskGid);
  const index=refs.findIndex(ref=>String(ref.taskGid)===String(taskGid));
  if(index<0)return false;
  refs.splice(index,1);
  if(girl){
    const gc=girlCfg(girl.key);
    gc.sections.forEach(section=>{section.taskIds=section.taskIds.filter(taskId=>taskId!==id);});
    gc.order=gc.order.filter(taskId=>taskId!==id); gc.hidden=gc.hidden.filter(taskId=>taskId!==id); gc.private=gc.private.filter(taskId=>taskId!==id);
  }
  saveKeeper(); renderGirls(); if(!quiet)toast("Removed from your to-do list");
  return true;
}
function toggleMentionReference(group){
  if(isMentionTaskPinned(group.taskGid))removeMentionReference(group.taskGid);
  else addMentionReference(group);
  renderMentionsModal();
}
function mentionReferenceTask(ref){
  const latest=latestMentionForTask(ref.taskGid)||ref;
  return {gid:ref.id||mentionRefId(ref.taskGid),name:ref.taskName||latest.taskName||"Mention follow-up",notes:latest.text||ref.text||"",due:null,
    completed:false,url:ref.taskUrl||latest.taskUrl||null,projectGid:null,projectName:ref.parentName?"@ Mention · "+ref.parentName:(ref.projectName||"@ Mention"),
    projectColor:"#7A5FB0",assignee:state.me?{gid:state.me.gid,name:state.me.name}:null,my:myKey(),isMentionRef:true,
    mentionPinned:true,sourceTaskGid:String(ref.taskGid),mentionFrom:latest.from||ref.from||null,mentionText:latest.text||ref.text||""};
}
function mentionContextForTask(taskGid){
  const group=allMentionGroups().find(g=>String(g.taskGid)===String(taskGid));
  if(!group)return null;
  return {group,latest:group.latest};
}
async function openMentionTask(groupOrTask){
  const requestedTask=String(groupOrTask&&groupOrTask.taskGid||groupOrTask||"");
  let group=groupOrTask&&groupOrTask.items?groupOrTask:allMentionGroups().find(g=>String(g.taskGid)===requestedTask);
  if(!group){
    const ref=mentionReferenceForTask(requestedTask);
    if(ref){
      const fallback={...ref,gid:"ref-context:"+requestedTask,storyGid:"ref-context:"+requestedTask,at:ref.addedAt||new Date().toISOString()};
      group={key:requestedTask,taskGid:requestedTask,taskName:ref.taskName,taskUrl:ref.taskUrl,projectName:ref.projectName,
        parentName:ref.parentName,isSubtask:!!ref.parentName,items:[fallback],visibleItems:[fallback],hiddenItems:[],latest:fallback};
    }
  }
  if(!group)return;
  markMentionsSeen(group.items);
  const latest=group.latest||group.items[0];
  state.mentionOpenContext={taskGid:String(group.taskGid),from:latest&&latest.from,text:latest&&latest.text,at:latest&&latest.at,
    parentName:group.parentName,projectName:group.projectName};
  let task=findTask(group.taskGid);
  if(!task){
    try{
      const res=await call("get_task",{task_id:group.taskGid,opt_fields:"name,notes,due_on,due_at,completed,assignee.gid,assignee.name,permalink_url,projects.gid,projects.name,memberships.project.gid,memberships.project.name"});
      const raw=res.data||{},project=(raw.projects&&raw.projects[0])||(raw.memberships&&raw.memberships[0]&&raw.memberships[0].project)||null;
      task={gid:String(raw.gid||group.taskGid),name:raw.name||group.taskName||"Untitled task",notes:raw.notes||"",due:raw.due_on||null,dueAt:raw.due_at||null,
        completed:!!raw.completed,url:raw.permalink_url||group.taskUrl||null,projectGid:project&&project.gid||null,
        projectName:project&&project.name||group.projectName||"Asana task",projectColor:"#7A5FB0",sectionName:"",
        assignee:raw.assignee||null,isExternalMentionTask:true};
      state.externalTasks[task.gid]=task;
    }catch(e){
      if(group.taskUrl){window.open(group.taskUrl,"_blank","noopener");toast("Opened in Asana because this task could not be loaded in the app");}
      else toast("Could not open the source task: "+e.message);
      return;
    }
  }
  closeModal(); openDrawer(String(group.taskGid));
}
function markAllVisibleMentionsSeen(){
  const groups=mentionGroupsForPanel();
  markMentionsSeen(groups.flatMap(group=>mentionPanel.filter==="hidden"?group.hiddenItems:group.visibleItems));
  renderMentionsModal();
}
function renderMentionsModal(){
  const listBox=document.getElementById("mentionList"),metaBox=document.getElementById("mentionMeta"),refresh=document.getElementById("mentionRefresh");
  if(!listBox) return;
  const groups=mentionGroupsForPanel(),counts=mentionCounts();
  document.querySelectorAll("#modal [data-mention-filter]").forEach(btn=>{
    const key=btn.dataset.mentionFilter; btn.classList.toggle("on",key===mentionPanel.filter);
    const count=btn.querySelector("b"); if(count)count.textContent=counts[key]||0;
  });
  const search=document.getElementById("mentionSearch"); if(search&&document.activeElement!==search)search.value=mentionPanel.query;
  if(refresh){ refresh.disabled=!!asanaMentions.loading; refresh.innerHTML=asanaMentions.loading?'<span class="spin"></span> Checking…':'↻ Check now'; }
  if(metaBox){
    if(asanaMentions.loading&&asanaMentions.loadedAt)metaBox.textContent="Showing saved mentions · checking for new ones…";
    else if(asanaMentions.loading)metaBox.textContent="Checking recent Asana task comments…";
    else if(asanaMentions.meta){
      const mode=asanaMentions.meta.incremental?"Latest changes checked":"Full scan complete";
      metaBox.textContent=mode+" · "+asanaMentions.meta.scannedTasks+" tasks · "+asanaMentions.meta.scannedSubtasks+" subtasks · "+asanaMentions.meta.scannedComments+" comments";
    }else metaBox.textContent="Saved mentions appear immediately while Asana checks in the background";
  }
  const warning=asanaMentions.error||asanaMentions.meta&&asanaMentions.meta.warning;
  const warningHtml=warning?'<div class="mention-warning">'+esc(warning)+(mergedMentions().length?' Showing the mentions already saved in this browser.':'')+'</div>':'';
  if(!groups.length){
    const empty=mentionPanel.filter==="new"?"No new mentions — you are caught up.":mentionPanel.filter==="hidden"?"No hidden mentions.":"No accessible mentions match this view.";
    listBox.innerHTML=warningHtml+'<div class="empty">'+(asanaMentions.loading?'<span class="spin"></span> ':'')+empty+'</div>';
  }else{
    listBox.innerHTML=warningHtml+groups.map(group=>{
      const items=mentionPanel.filter==="hidden"?group.hiddenItems:group.visibleItems;
      const latest=items[0]||group.latest,expanded=!!mentionPanel.expanded[group.key],pinned=isMentionTaskPinned(group.taskGid);
      const initial=esc(String(latest&&latest.from||"?").trim().charAt(0).toUpperCase());
      const location=group.isSubtask&&group.parentName?"Subtask of "+group.parentName:group.projectName;
      const unseen=items.filter(m=>!mentionIsSeen(m)).length;
      const comments=expanded?'<div class="mention-thread-comments">'+items.map(m=>
        '<div class="mention-comment'+(!mentionIsSeen(m)?' is-new':'')+'"><div><b>'+esc(m.from||"Someone")+'</b><span>'+esc(mentionDate(m.at))+'</span></div><p>'+esc(m.text||"Mentioned you")+'</p></div>'
      ).join("")+'</div>':'';
      return '<article class="mention-thread'+(unseen?' has-new':'')+'" data-thread="'+esc(group.key)+'">'+
        '<div class="mention-thread-main" role="button" tabindex="0" data-mention-action="toggle" data-thread="'+esc(group.key)+'">'+
          '<div class="mention-avatar">'+initial+'</div><div class="mention-copy">'+
            '<div class="mention-who"><b>'+esc(mentionPeopleLabel(items))+'</b> mentioned you'+(items.length>1?' '+items.length+' times':'')+'</div>'+
            '<div class="mention-task">'+esc(group.taskName||"Untitled task")+'</div>'+
            '<div class="mention-excerpt">'+esc(latest&&latest.text||"Mentioned you in this task")+'</div>'+
            '<div class="mention-where">'+esc([location,mentionDate(latest&&latest.at)].filter(Boolean).join(" · "))+'</div>'+
          '</div><div class="mention-thread-state">'+(unseen?'<span class="mention-new-dot" title="New"></span>':'')+'<span>'+(expanded?'⌃':'⌄')+'</span></div></div>'+
        comments+
        '<div class="mention-actions">'+
          '<button class="btn '+(pinned?'teal':'primary')+' sm" data-mention-action="pin" data-thread="'+esc(group.key)+'">'+(pinned?'✓ In My To-Do':'Show in My To-Do')+'</button>'+
          '<button class="btn ghost sm" data-mention-action="open" data-thread="'+esc(group.key)+'">Open task</button>'+
          '<button class="btn ghost sm" data-mention-action="'+(mentionPanel.filter==="hidden"?'restore':'hide')+'" data-thread="'+esc(group.key)+'">'+(mentionPanel.filter==="hidden"?'Restore':'Hide')+'</button>'+
        '</div></article>';
    }).join("");
  }
  listBox.onclick=async event=>{
    const actionEl=event.target.closest("[data-mention-action]"); if(!actionEl)return;
    event.preventDefault(); event.stopPropagation();
    const group=allMentionGroups().find(g=>g.key===actionEl.dataset.thread); if(!group)return;
    const action=actionEl.dataset.mentionAction;
    if(action==="toggle"){
      mentionPanel.expanded[group.key]=!mentionPanel.expanded[group.key]; markMentionsSeen(group.visibleItems); renderMentionsModal();
    }else if(action==="pin")toggleMentionReference(group);
    else if(action==="open")await openMentionTask(group);
    else if(action==="hide"){setMentionsHidden(group.visibleItems,true);delete mentionPanel.expanded[group.key];renderMentionsModal();}
    else if(action==="restore"){setMentionsHidden(group.hiddenItems,false);renderMentionsModal();}
  };
}
function openMentions(){
  hydrateMentionCache(); loadMentionPrefs();
  showModal('<div class="mention-shell"><div class="mention-sticky"><div class="mention-head"><div><h2>@ Mentions</h2><p class="hint">Notice it, deal with it, or show the original task in your to-do list.</p></div>'+ 
    '<a class="btn ghost sm" href="https://app.asana.com/0/inbox" target="_blank" rel="noopener">Asana Inbox ↗</a></div>'+ 
    '<div class="mention-tabs"><button class="mention-tab on" data-mention-filter="new">New <b>0</b></button><button class="mention-tab" data-mention-filter="all">All <b>0</b></button><button class="mention-tab" data-mention-filter="hidden">Hidden <b>0</b></button></div>'+ 
    '<div class="mention-search-row"><input id="mentionSearch" placeholder="Search people, tasks or comments…"><button class="btn ghost sm" id="mentionMarkSeen">Mark all seen</button></div>'+ 
    '<div class="mention-toolbar"><span id="mentionMeta"></span><div><button class="btn ghost sm" id="mentionRefresh">↻ Check now</button><button class="btn ghost sm" id="mentionDeepRefresh" title="Reread the last six months">Deep scan</button></div></div></div>'+ 
    '<div id="mentionList" class="mention-list"></div><div class="mention-foot"><span>Hidden mentions stay recoverable. Showing a task in My To-Do never moves or reassigns it.</span><button class="btn ghost sm" data-close>Close</button></div></div>',"mention");
  wireModalClose();
  document.querySelectorAll("#modal [data-mention-filter]").forEach(btn=>btn.onclick=()=>{mentionPanel.filter=btn.dataset.mentionFilter;renderMentionsModal();});
  document.getElementById("mentionSearch").oninput=e=>{mentionPanel.query=e.target.value;renderMentionsModal();};
  document.getElementById("mentionMarkSeen").onclick=markAllVisibleMentionsSeen;
  document.getElementById("mentionRefresh").onclick=()=>refreshAsanaMentions(true,false);
  document.getElementById("mentionDeepRefresh").onclick=()=>refreshAsanaMentions(true,true);
  renderMentionsModal();
  refreshAsanaMentions(false,false);
}
