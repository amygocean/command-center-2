/* ================================================================
   CAMPAIGNS — portfolio-backed campaign workspace
   One portfolio item = one Asana project. This tab edits the project,
   creates project tasks/subtasks, and gives the team a compact calendar.
   ================================================================ */

const ASANA_CAMPAIGN_COLORS = {
  "dark-blue":"#0A3D62", "light-blue":"#5B9BD5",
  "dark-teal":"#008C8C", "light-teal":"#5BC4BF",
  "dark-green":"#3A7D44", "light-green":"#7CB342",
  "dark-orange":"#D9822B", "light-orange":"#F4A261",
  "dark-red":"#B03A2E", "light-red":"#E4784D",
  "dark-purple":"#6C4FA3", "light-purple":"#9B7BC4",
  "dark-pink":"#B74D7D", "light-pink":"#E59AB7",
  "dark-yellow":"#C99500", "light-yellow":"#F7C325",
  "dark-warm-gray":"#6F6259", "light-warm-gray":"#A89D94",
  "none":"#6B7A8F"
};
const HEX_TO_ASANA = {
  "#0A3D62":"dark-blue", "#00A8A8":"dark-teal", "#5BC4BF":"light-teal",
  "#3A7D44":"dark-green", "#D9822B":"dark-orange", "#E4784D":"light-red",
  "#B03A2E":"dark-red", "#7A5FB0":"dark-purple", "#F7C325":"light-yellow"
};

function retiredCampaign(c){
  return RETIRED_CAMPAIGN_GIDS.includes(c.gid) || /^volume drivers$/i.test((c.name||"").trim());
}
function campaignHex(c,ix){
  const old=(cfg.campaigns||[]).find(x=>x.gid===c.gid);
  if(old&&old.color) return old.color;
  if(c.color&&c.color.startsWith("#")) return c.color;
  return ASANA_CAMPAIGN_COLORS[c.color] || PALETTE[ix%PALETTE.length];
}
function campaignNormalise(c,ix){
  return {
    gid:c.gid, name:c.name||"Untitled campaign",
    start:c.start_on||c.start||null, due:c.due_on||c.due||null,
    color:campaignHex(c,ix), notes:c.notes||"",
    url:c.permalink_url||c.url||("https://app.asana.com/0/"+c.gid),
    asanaColor:c.color||HEX_TO_ASANA[campaignHex(c,ix)]||"dark-teal",
    source:"portfolio"
  };
}

async function syncCampaignPortfolio(force){
  if(state.campaignsLoading) return;
  if(state.campaignsLoaded&&!force) return;
  state.campaignsLoading=true; state.campaignError=null;
  try{
    const res=await call("get_portfolio_items",{portfolio_gid:CAMPAIGN_PORTFOLIO,
      opt_fields:"name,start_on,due_on,color,notes,permalink_url",limit:100});
    const items=(res.data||[]).filter(x=>x&&x.gid&&!retiredCampaign(x)).map(campaignNormalise);
    const previousCampaignGids=new Set((cfg.campaigns||[]).map(c=>c.gid));
    cfg.campaigns=items;
    cfg.projects=(cfg.projects||[]).filter(p=>{
      if(RETIRED_CAMPAIGN_GIDS.includes(p.gid)||/^volume drivers$/i.test(p.name||"")) return false;
      return !(p.campaign||previousCampaignGids.has(p.gid));
    });
    items.forEach(c=>cfg.projects.push({gid:c.gid,name:c.name,color:c.color,on:true,campaign:true}));
    state.campaignPortfolio=items;
    if(!items.some(c=>c.gid===state.campaignSelected)){
      const today=todayD();
      const best=items.find(c=>c.start&&c.due&&pd(c.start)<=today&&pd(c.due)>=today)
        ||items.find(c=>c.due&&pd(c.due)>=today)||items[0];
      state.campaignSelected=best?best.gid:null;
    }
    state.campaignsLoaded=true; saveCfg();
  }catch(e){
    state.campaignError=e.message;
    cfg.campaigns=(cfg.campaigns||[]).filter(c=>!retiredCampaign(c));
    cfg.projects=(cfg.projects||[]).filter(p=>!RETIRED_CAMPAIGN_GIDS.includes(p.gid)&&!/^volume drivers$/i.test(p.name||""));
    state.campaignPortfolio=cfg.campaigns;
  }finally{ state.campaignsLoading=false; }
}

function campaignStatus(c){
  const t=todayD(), s=c.start?pd(c.start):null, e=c.due?pd(c.due):null;
  if(e&&e<t) return {key:"done",label:"Wrapped"};
  if(s&&s>t) return {key:"next",label:"Upcoming"};
  if(s&&e&&s<=t&&e>=t) return {key:"live",label:"Live"};
  return {key:"plan",label:"Planning"};
}
function campaignTasks(gid){ return state.tasks.filter(t=>t.projectGid===gid&&!t.isKeeper); }
function campFmt(d){ return d?d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):""; }
function campaignDateLabel(c){
  if(!c.start&&!c.due) return "Dates not set";
  if(c.start&&c.due) return campFmt(pd(c.start))+" – "+campFmt(pd(c.due));
  return c.start?"Starts "+campFmt(pd(c.start)):"Ends "+campFmt(pd(c.due));
}

function renderCampaigns(){
  const list=document.getElementById("campaignList"), detail=document.getElementById("campaignDetail"), summary=document.getElementById("campaignSummary");
  if(!list||!detail||!summary) return;
  wireCampaignHeader();
  if(state.campaignsLoading){ list.innerHTML='<div class="empty"><span class="spin"></span> loading portfolio…</div>'; detail.innerHTML=""; return; }
  const camps=(state.campaignPortfolio.length?state.campaignPortfolio:cfg.campaigns||[]).filter(c=>!retiredCampaign(c));
  if(state.campaignError){
    summary.innerHTML='<div class="campaign-sync-warn">Portfolio refresh failed: '+esc(state.campaignError)+'<br><span>Showing the last saved campaign list.</span></div>';
  }else{
    const live=camps.filter(c=>campaignStatus(c).key==="live").length;
    const upcoming=camps.filter(c=>campaignStatus(c).key==="next").length;
    summary.innerHTML='<b>'+camps.length+'</b><span>campaign'+(camps.length===1?"":"s")+'</span><i></i><b>'+live+'</b><span>live</span><i></i><b>'+upcoming+'</b><span>upcoming</span>';
  }
  if(!camps.length){
    list.innerHTML="";
    detail.innerHTML='<div class="campaign-empty"><span class="campaign-empty-mark">◎</span><h2>No campaigns in the portfolio</h2><p>Create the next campaign here and the app will make the Asana project, add it to your portfolio and draft the launch runway.</p><button class="btn primary" id="campaignEmptyNew">Create a campaign</button></div>';
    const b=document.getElementById("campaignEmptyNew"); if(b)b.onclick=openCampaign;
    return;
  }
  if(!camps.some(c=>c.gid===state.campaignSelected)) state.campaignSelected=camps[0].gid;
  list.innerHTML=camps.map(c=>{
    const st=campaignStatus(c), tasks=campaignTasks(c.gid), open=tasks.filter(t=>!t.completed).length;
    return '<button class="campaign-row'+(c.gid===state.campaignSelected?' on':'')+'" data-campaign="'+c.gid+'">'+
      '<span class="campaign-row-dot" style="background:'+c.color+'"></span><span class="campaign-row-main"><b>'+esc(c.name)+'</b><small>'+esc(campaignDateLabel(c))+'</small></span>'+
      '<span class="campaign-row-side"><em class="campaign-status '+st.key+'">'+st.label+'</em><small>'+open+' open</small></span></button>';
  }).join("");
  list.querySelectorAll("[data-campaign]").forEach(b=>b.onclick=()=>{
    state.campaignSelected=b.dataset.campaign; renderCampaigns(); loadCampaignSections(state.campaignSelected);
  });
  renderCampaignDetail(camps.find(c=>c.gid===state.campaignSelected));
}

function wireCampaignHeader(){
  const fresh=document.getElementById("campaignRefresh"), add=document.getElementById("campaignNew");
  if(fresh&&!fresh.dataset.wired){ fresh.dataset.wired="1"; fresh.onclick=async()=>{
    fresh.disabled=true; fresh.innerHTML='<span class="spin"></span>';
    state.campaignsLoaded=false; await loadAll(); fresh.disabled=false; fresh.textContent="Refresh"; toast(state.campaignError?"Portfolio refresh hiccup":"Portfolio refreshed");
  }; }
  if(add&&!add.dataset.wired){ add.dataset.wired="1"; add.onclick=openCampaign; }
}

async function loadCampaignSections(gid){
  if(!gid||state.campaignSections[gid]||state.campaignSectionLoading[gid]) return;
  state.campaignSectionLoading[gid]=true; renderCampaigns();
  try{
    const res=await call("get_project",{project_id:gid,include_sections:true,opt_fields:"name,notes,start_on,due_on,color,permalink_url"});
    const p=res.data||{};
    state.campaignSections[gid]=(p.sections||[]).map(s=>({gid:s.gid,name:s.name}));
    const c=(state.campaignPortfolio.length?state.campaignPortfolio:cfg.campaigns).find(x=>x.gid===gid);
    if(c){
      if(p.name)c.name=p.name; if(p.notes!=null)c.notes=p.notes;
      if(p.start_on!==undefined)c.start=p.start_on; if(p.due_on!==undefined)c.due=p.due_on;
      if(p.permalink_url)c.url=p.permalink_url;
    }
  }catch(e){ state.campaignSections[gid]=[]; }
  state.campaignSectionLoading[gid]=false; renderCampaigns();
}

function renderCampaignDetail(c){
  const box=document.getElementById("campaignDetail"); if(!box||!c)return;
  const tasks=campaignTasks(c.gid), done=tasks.filter(t=>t.completed).length, st=campaignStatus(c);
  const sections=state.campaignSections[c.gid];
  if(!sections&&!state.campaignSectionLoading[c.gid]) setTimeout(()=>loadCampaignSections(c.gid),0);
  const people='<option value="">Unassigned</option>'+state.users.map(u=>'<option value="'+u.gid+'">'+esc(u.name)+'</option>').join("");
  const phaseOpts=(sections||[]).map(s=>'<option value="'+s.gid+'">'+esc(s.name)+'</option>').join("");
  box.innerHTML=
    '<div class="campaign-detail-head"><div><div class="campaign-kicker"><span class="campaign-status '+st.key+'">'+st.label+'</span><span>'+tasks.length+' tasks · '+done+' done</span></div><h2>'+esc(c.name)+'</h2><p>'+esc(campaignDateLabel(c))+'</p></div>'+
      '<a class="btn ghost sm" href="'+esc(c.url||("https://app.asana.com/0/"+c.gid))+'" target="_blank">Open project ↗</a></div>'+
    '<div class="campaign-detail-grid"><div class="campaign-main">'+
      '<section class="campaign-section"><div class="campaign-section-h"><h3>Campaign details</h3><span>Saved to the Asana project</span></div>'+campaignDetailsForm(c)+'</section>'+
      '<section class="campaign-section"><div class="campaign-section-h"><h3>Tasks</h3><span>Tasks also appear in Calendar and The Girls</span></div>'+campaignTaskComposer(c,people,phaseOpts,!!sections)+campaignTaskList(c,tasks,sections)+'</section>'+ 
    '</div><aside class="campaign-aside"><section class="campaign-section campaign-calendar-section"><div class="campaign-section-h"><h3>Campaign calendar</h3></div>'+campaignCalendar(c,tasks)+'</section>'+campaignNextUp(tasks)+'</aside></div>';
  wireCampaignDetail(c);
}

function campaignDetailsForm(c){
  return '<div class="campaign-fields"><label><span>Name</span><input id="campEditName" value="'+esc(c.name)+'"></label><label><span>Starts</span><input type="date" id="campEditStart" value="'+(c.start||"")+'"></label><label><span>Ends</span><input type="date" id="campEditDue" value="'+(c.due||"")+'"></label></div>'+ 
    '<label class="campaign-note"><span>Working notes</span><textarea id="campEditNotes" placeholder="Objectives, audience, decisions, links, what cannot change…">'+esc(c.notes||"")+'</textarea></label>'+ 
    '<div class="campaign-save-line"><span id="campaignSaveState">Notes and dates live on the Asana project.</span><button class="btn primary sm" id="campaignSave">Save campaign</button></div>';
}
function campaignTaskComposer(c,people,phaseOpts,ready){
  return '<div class="campaign-add"><input id="campTaskName" placeholder="Add a campaign task…"><input type="date" id="campTaskDue">'+
    '<select id="campTaskPhase" '+(ready?'':'disabled')+'><option value="">'+(ready?'No phase':'Loading phases…')+'</option>'+phaseOpts+'</select>'+ 
    '<select id="campTaskAssignee">'+people+'</select><button class="btn primary sm" id="campTaskAdd">Add</button></div>';
}
function campaignTaskList(c,tasks,sections){
  if(!tasks.length) return '<div class="empty campaign-task-empty">No tasks yet. Add the first one above, or use <b>+ New campaign</b> to create a full playbook.</div>';
  const order=(sections||[]).map(s=>s.name);
  const groups={}; tasks.forEach(t=>{ const k=t.sectionName||"Other"; (groups[k]=groups[k]||[]).push(t); });
  const keys=[...order.filter(k=>groups[k]),...Object.keys(groups).filter(k=>!order.includes(k))];
  return '<div class="campaign-task-groups">'+keys.map(k=>{
    const rows=groups[k].sort((a,b)=>(a.completed-b.completed)||((a.due||"9999").localeCompare(b.due||"9999")));
    return '<div class="campaign-task-group"><div class="campaign-phase"><span>'+esc(k)+'</span><b>'+rows.filter(x=>!x.completed).length+'</b></div>'+rows.map(campaignTaskRow).join("")+'</div>';
  }).join("")+'</div>';
}
function campaignTaskRow(t){
  const open=!!state.campaignExpanded[t.gid], subs=state.campaignSubtasks[t.gid];
  let sub="";
  if(open){
    if(subs==="loading") sub='<div class="campaign-subtasks"><span class="spin"></span></div>';
    else{
      const arr=Array.isArray(subs)?subs:[];
      sub='<div class="campaign-subtasks">'+arr.map(s=>'<div class="campaign-subtask'+(s.completed?' done':'')+'"><button class="camp-sub-check" data-subdone="'+s.gid+'" data-parent="'+t.gid+'">'+(s.completed?'✓':'')+'</button><span>'+esc(s.name)+'</span><small>'+(s.due_on?campFmt(pd(s.due_on)):"")+'</small></div>').join("")+
        '<div class="campaign-sub-add"><input data-subname="'+t.gid+'" placeholder="Add a subtask…"><input type="date" data-subdue="'+t.gid+'"><button class="btn ghost sm" data-subadd="'+t.gid+'">Add</button></div></div>';
    }
  }
  return '<div class="campaign-task-wrap"><div class="campaign-task'+(t.completed?' done':'')+'">'+
    '<button class="camp-check" data-campdone="'+t.gid+'">'+(t.completed?'✓':'')+'</button><button class="campaign-task-name" data-campopen="'+t.gid+'">'+esc(t.name)+'</button>'+ 
    '<span class="campaign-task-meta">'+(t.assignee?esc(firstName(t.assignee.name)):"Unassigned")+(t.due?' · '+campFmt(pd(t.due)):"")+'</span>'+ 
    '<button class="btn ghost sm campaign-sub-btn" data-subtoggle="'+t.gid+'">'+(open?'Hide':'Subtasks')+'</button></div>'+sub+'</div>';
}

function campaignNextUp(tasks){
  const next=tasks.filter(t=>!t.completed&&t.due&&pd(t.due)>=todayD()).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);
  return '<section class="campaign-section campaign-next"><div class="campaign-section-h"><h3>Next up</h3></div>'+(!next.length?'<div class="empty" style="padding:12px 0">Nothing dated ahead.</div>':next.map(t=>'<button data-campopen="'+t.gid+'"><span>'+campFmt(pd(t.due))+'</span><b>'+esc(t.name)+'</b></button>').join(""))+'</section>';
}

function campaignCalendar(c,tasks){
  let cursor=state.campaignCursor[c.gid]?pd(state.campaignCursor[c.gid]):(c.start?pd(c.start):todayD());
  cursor=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const y=cursor.getFullYear(), m=cursor.getMonth(), first=new Date(y,m,1);
  let offset=(first.getDay()+6)%7; const start=new Date(first); start.setDate(1-offset);
  const cS=c.start?pd(c.start):null, cE=c.due?pd(c.due):null;
  let html='<div class="campaign-cal-nav"><button class="btn ghost sm" data-campcal="-1">‹</button><b>'+MO[m]+' '+y+'</b><button class="btn ghost sm" data-campcal="1">›</button></div><div class="campaign-cal-dow">'+DOW.map(d=>'<span>'+d.slice(0,1)+'</span>').join("")+'</div><div class="campaign-cal-grid">';
  for(let i=0;i<42;i++){
    const d=new Date(start); d.setDate(start.getDate()+i); const dayTasks=tasks.filter(t=>t.due&&sameDay(pd(t.due),d));
    const inRange=cS&&cE&&d>=cS&&d<=cE, dim=d.getMonth()!==m;
    html+='<button class="campaign-cal-day'+(dim?' dim':'')+(inRange?' in-range':'')+(sameDay(d,todayD())?' today':'')+'" data-campdate="'+iso(d)+'"><span>'+d.getDate()+'</span>'+dayTasks.slice(0,2).map(t=>'<i style="background:'+c.color+'" title="'+esc(t.name)+'"></i>').join("")+(dayTasks.length>2?'<em>+'+(dayTasks.length-2)+'</em>':'')+'</button>';
  }
  return html+'</div>';
}

function wireCampaignDetail(c){
  const save=document.getElementById("campaignSave"); if(save) save.onclick=()=>saveCampaignDetails(c);
  const add=document.getElementById("campTaskAdd"); if(add) add.onclick=()=>addCampaignTask(c);
  document.querySelectorAll('[data-campopen]').forEach(b=>b.onclick=()=>openDrawer(b.dataset.campopen));
  document.querySelectorAll('[data-campdone]').forEach(b=>b.onclick=()=>toggleDone(b.dataset.campdone,!findTask(b.dataset.campdone).completed));
  document.querySelectorAll('[data-subtoggle]').forEach(b=>b.onclick=()=>toggleCampaignSubtasks(b.dataset.subtoggle));
  document.querySelectorAll('[data-subadd]').forEach(b=>b.onclick=()=>addCampaignSubtask(b.dataset.subadd));
  document.querySelectorAll('[data-subdone]').forEach(b=>b.onclick=()=>toggleCampaignSubtask(b.dataset.parent,b.dataset.subdone));
  document.querySelectorAll('[data-campcal]').forEach(b=>b.onclick=()=>{
    const current=state.campaignCursor[c.gid]?pd(state.campaignCursor[c.gid]):(c.start?pd(c.start):todayD());
    current.setDate(1); current.setMonth(current.getMonth()+(+b.dataset.campcal)); state.campaignCursor[c.gid]=iso(current); renderCampaigns();
  });
  document.querySelectorAll('[data-campdate]').forEach(b=>b.onclick=()=>{
    const due=document.getElementById("campTaskDue"); if(due){ due.value=b.dataset.campdate; document.getElementById("campTaskName").focus(); }
  });
}

async function saveCampaignDetails(c){
  const btn=document.getElementById("campaignSave"), stateEl=document.getElementById("campaignSaveState");
  const name=document.getElementById("campEditName").value.trim();
  const start=document.getElementById("campEditStart").value||null, due=document.getElementById("campEditDue").value||null;
  const notes=document.getElementById("campEditNotes").value;
  if(!name){toast("Campaign name required");return;} if(start&&due&&pd(start)>pd(due)){toast("The end date must be after the start date");return;}
  btn.disabled=true; btn.innerHTML='<span class="spin"></span>';
  try{
    await call("update_project",{project_id:c.gid,fields:{name,notes,start_on:start,due_on:due}});
    c.name=name;c.notes=notes;c.start=start;c.due=due;
    const p=cfg.projects.find(p=>p.gid===c.gid); if(p)p.name=name;
    const local=cfg.campaigns.find(x=>x.gid===c.gid); if(local)Object.assign(local,c);
    saveCfg(); renderCampaigns(); renderCalendar(); toast("Campaign saved ✓");
  }catch(e){ stateEl.textContent="Save failed: "+e.message; btn.disabled=false;btn.textContent="Save campaign"; }
}
async function addCampaignTask(c){
  const name=document.getElementById("campTaskName").value.trim(); if(!name){toast("Task name required");return;}
  const btn=document.getElementById("campTaskAdd"), task={name,project_id:c.gid};
  const due=document.getElementById("campTaskDue").value, sec=document.getElementById("campTaskPhase").value, asg=document.getElementById("campTaskAssignee").value;
  if(due)task.due_on=due;if(sec)task.section_id=sec;if(asg)task.assignee=asg;
  btn.disabled=true;btn.innerHTML='<span class="spin"></span>';
  try{ await call("create_tasks",{tasks:[task]}); toast("Campaign task added"); await loadAll(); }
  catch(e){toast("Failed: "+e.message);btn.disabled=false;btn.textContent="Add";}
}
async function toggleCampaignSubtasks(parent){
  const open=!state.campaignExpanded[parent]; state.campaignExpanded[parent]=open;
  if(open&&state.campaignSubtasks[parent]===undefined){
    state.campaignSubtasks[parent]="loading";renderCampaigns();
    try{ const r=await call("get_subtasks",{parent});state.campaignSubtasks[parent]=r.data||[]; }
    catch(e){state.campaignSubtasks[parent]=[];toast("Couldn't load subtasks");}
  }
  renderCampaigns();
}
async function addCampaignSubtask(parent){
  const nameEl=document.querySelector('[data-subname="'+parent+'"]'), dueEl=document.querySelector('[data-subdue="'+parent+'"]');
  const name=nameEl&&nameEl.value.trim();if(!name){toast("Subtask name required");return;}
  const data={name};if(dueEl&&dueEl.value)data.due_on=dueEl.value;
  try{await call("create_subtask",{parent,data});const r=await call("get_subtasks",{parent});state.campaignSubtasks[parent]=r.data||[];renderCampaigns();toast("Subtask added");}
  catch(e){toast("Failed: "+e.message);}
}
async function toggleCampaignSubtask(parent,gid){
  const arr=state.campaignSubtasks[parent]||[], sub=arr.find(x=>x.gid===gid);if(!sub)return;
  sub.completed=!sub.completed;renderCampaigns();
  try{await call("update_tasks",{tasks:[{task:gid,completed:sub.completed}]});}
  catch(e){sub.completed=!sub.completed;renderCampaigns();toast("Failed: "+e.message);}
}
