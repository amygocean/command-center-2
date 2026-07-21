/* ================================================================
   CAMPAIGNS — portfolio-backed campaign workspace
   Launch-date runway + project resources + source-grounded Smart Plan.
   ================================================================ */

const ASANA_CAMPAIGN_COLORS = {
  "dark-blue":"#0A3D62", "light-blue":"#5B9BD5", "dark-teal":"#008C8C", "light-teal":"#5BC4BF",
  "dark-green":"#3A7D44", "light-green":"#7CB342", "dark-orange":"#D9822B", "light-orange":"#F4A261",
  "dark-red":"#B03A2E", "light-red":"#E4784D", "dark-purple":"#6C4FA3", "light-purple":"#9B7BC4",
  "dark-pink":"#B74D7D", "light-pink":"#E59AB7", "dark-yellow":"#C99500", "light-yellow":"#F7C325",
  "dark-warm-gray":"#6F6259", "light-warm-gray":"#A89D94", "none":"#6B7A8F"
};
const HEX_TO_ASANA = {
  "#0A3D62":"dark-blue", "#00A8A8":"dark-teal", "#5BC4BF":"light-teal", "#3A7D44":"dark-green",
  "#D9822B":"dark-orange", "#E4784D":"light-red", "#B03A2E":"dark-red", "#7A5FB0":"dark-purple", "#F7C325":"light-yellow"
};
const CAMPAIGN_PHASES = ["Pre-launch","Launch week","In market","Wrap-up"];
const CAMPAIGN_SECTIONS = ["Campaign HQ",...CAMPAIGN_PHASES];
const CAMPAIGN_CHANNELS = [
  {key:"courses",label:"Courses"},{key:"videos",label:"Videos / shoot"},
  {key:"training",label:"In-person training"},{key:"comms",label:"Comms"}
];
const CAMPAIGN_RESOURCE_TYPES=["Recipe","Operational brief","Existing learning","Supplier brief","Creative reference","Brand guidance","Research / data","Other"];

// Every offset is relative to launch. This is the core backwards-planning model.
const CAMPAIGN_PLAN_RULES = [
  {id:"scope-lock",phase:"Pre-launch",ch:"all",offset:-42,name:"Confirm scope, source pack and what cannot change",type:"planning"},
  {id:"course-outline",phase:"Pre-launch",ch:"courses",offset:-35,name:"Course outline and learning approach locked",type:"course"},
  {id:"shoot-brief",phase:"Pre-launch",ch:"videos",offset:-35,name:"Send shoot brief and recipe list to Content Go",type:"shoot_brief"},
  {id:"shoot-day",phase:"Pre-launch",ch:"videos",offset:-28,name:"Shoot Day — {{name}}",type:"shoot_day",requiresShoot:true},
  {id:"first-edits",phase:"Pre-launch",ch:"videos",offset:-21,name:"First edits and image selects reviewed",type:"video"},
  {id:"course-material-live",phase:"Pre-launch",ch:"courses",offset:-14,name:"Course material sent out and available to teams",type:"course"},
  {id:"manager-pack",phase:"Pre-launch",ch:"courses",offset:-14,name:"Manager coaching pack sent out",type:"manager_support"},
  {id:"regional-plan",phase:"Pre-launch",ch:"training",offset:-14,name:"Regional training and field-support plan locked",type:"training"},
  {id:"qa",phase:"Pre-launch",ch:"courses",offset:-7,name:"Final QA, mobile check and links tested",type:"course"},
  {id:"teaser",phase:"Pre-launch",ch:"comms",offset:-3,name:"Campaign teaser queued in Communities",type:"community_message"},
  {id:"launch",phase:"Launch week",ch:"all",offset:0,name:"{{name}} launches",type:"milestone"},
  {id:"launch-comms",phase:"Launch week",ch:"comms",offset:0,name:"Launch announcement sent",type:"community_message"},
  {id:"first-week",phase:"Launch week",ch:"courses",offset:5,name:"First-week participation and issue check",type:"measurement"},
  {id:"manager-reminder",phase:"Launch week",ch:"comms",offset:2,name:"Manager huddle reminder",type:"community_message"},
  {id:"field-check",phase:"In market",ch:"training",offset:14,name:"Trainer field check-ins and execution feedback",type:"training"},
  {id:"wrong-answer",phase:"In market",ch:"courses",offset:14,name:"Wrong-answer check — build Skills Booster if needed",type:"skills_booster"}
];

function retiredCampaign(c){ return RETIRED_CAMPAIGN_GIDS.includes(c.gid)||/^volume drivers$/i.test((c.name||"").trim()); }
function campaignHex(c,ix){
  const old=(cfg.campaigns||[]).find(x=>x.gid===c.gid); if(old&&old.color)return old.color;
  if(c.color&&c.color.startsWith("#"))return c.color; return ASANA_CAMPAIGN_COLORS[c.color]||PALETTE[ix%PALETTE.length];
}
function campaignNormalise(c,ix){ return {gid:c.gid,name:c.name||"Untitled campaign",start:c.start_on||c.start||null,due:c.due_on||c.due||null,
  color:campaignHex(c,ix),notes:c.notes||"",url:c.permalink_url||c.url||("https://app.asana.com/0/"+c.gid),
  asanaColor:c.color||HEX_TO_ASANA[campaignHex(c,ix)]||"dark-teal",source:"portfolio"}; }
function offsetISO(anchor,days){ const d=pd(anchor); d.setDate(d.getDate()+Number(days||0)); return iso(d); }
function smartSlug(v){ return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,72)||"item"; }
function smartParse(text){
  const raw=String(text||"").replace(/^```(?:json)?/i,"").replace(/```$/,"" ).trim();
  try{return JSON.parse(raw);}catch{}
  const a=raw.indexOf("{"),b=raw.lastIndexOf("}"); if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1));}catch{}}
  return null;
}
function buildCampaignPlan(name,launch,end,channels,roles){
  if(!launch)return[]; const chosen=channels&&channels.length?channels:CAMPAIGN_CHANNELS.map(c=>c.key);
  const roleTxt=roles&&roles.length?" ("+roles.join(", ")+")":"";
  const rows=CAMPAIGN_PLAN_RULES.filter(r=>r.ch==="all"||chosen.includes(r.ch)).map(r=>({
    id:"base:"+r.id,phase:r.phase,ch:r.ch,due:offsetISO(launch,r.offset),name:r.name.replace(/\{\{name\}\}/g,name)+(r.id==="course-outline"?roleTxt:""),
    on:true,type:r.type,offsetDays:r.offset,why:"Standard Academy runway, calculated from the launch date.",requiresShoot:!!r.requiresShoot,
    sourceNames:["Academy campaign playbook"],audience:roles||[],shots:[]
  }));
  if(end){
    rows.push({id:"base:results",phase:"Wrap-up",ch:"all",due:offsetISO(end,2),name:"Completion and results snapshot",on:true,type:"measurement",why:"Campaign close-out.",sourceNames:["Academy campaign playbook"],audience:[],shots:[]});
    rows.push({id:"base:retro",phase:"Wrap-up",ch:"all",due:offsetISO(end,5),name:"What we would do differently — 15 minute huddle",on:true,type:"planning",why:"Campaign close-out.",sourceNames:["Academy campaign playbook"],audience:[],shots:[]});
    rows.push({id:"base:archive",phase:"Wrap-up",ch:"all",due:offsetISO(end,7),name:"Archive final assets and source of truth",on:true,type:"planning",why:"Campaign close-out.",sourceNames:["Academy campaign playbook"],audience:[],shots:[]});
  }
  return rows;
}
function fileToBase64(file){ return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||"").split(",")[1]||"");r.onerror=()=>reject(r.error||new Error("Could not read file"));r.readAsDataURL(file);}); }
async function analyseCampaignFile(file,category,campaign){
  const data_base64=await fileToBase64(file);
  if(DEMO) return {data_base64,analysis:{name:file.name,category,summary:"Demo analysis of "+file.name+" for "+campaign.name+".",facts:["Source added to the campaign resource library."],recipes:/recipe/i.test(file.name)?[{name:file.name.replace(/\.[^.]+$/,""),important_steps:["Show the method clearly"],ingredients_or_products:[],suggested_shots:["Ingredients and setup","Key method","Final presentation"]}]:[],dates:[],audiences:["Restaurant teams"],risks:[],gaps:[],shoot_ideas:[],output_ideas:[{title:"Create a practical guide from "+file.name,type:"cheat_sheet",audience:["Restaurant teams"],why:"The source should be translated into an accessible job aid."}],analysed_at:new Date().toISOString(),ai_available:true}};
  const r=await fetch("/api/campaign-resource",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"analyse_file",filename:file.name,mime:file.type,category,campaign:{name:campaign.name,launch:campaign.start||campaign.launch,due:campaign.due},data_base64})});
  const j=await r.json().catch(()=>({})); if(!r.ok)throw new Error(j.error||"Source analysis failed"); return {analysis:j.analysis,data_base64};
}
function campaignSourceRecommendations(sourceMap,launch){
  const out=[]; Object.entries(sourceMap||{}).forEach(([gid,src])=>{
    const a=src.analysis||{}, sourceName=src.name||a.name||"Source";
    (a.recipes||[]).forEach((recipe,ix)=>out.push({id:"source:"+gid+":recipe:"+smartSlug(recipe.name||ix),phase:"Pre-launch",due:offsetISO(launch,-28),
      name:"Film: "+(recipe.name||"recipe method and final presentation"),type:"video",requiresShoot:true,why:"The source contains a recipe or method that should be demonstrated.",
      sourceNames:[sourceName],audience:a.audiences||[],shots:recipe.suggested_shots||recipe.important_steps||[],on:true}));
    (a.shoot_ideas||[]).forEach((idea,ix)=>out.push({id:"source:"+gid+":shoot:"+smartSlug(idea.title||ix),phase:"Pre-launch",due:offsetISO(launch,-28),
      name:idea.title||"Capture source-specific demonstration",type:"video",requiresShoot:true,why:idea.why||"Recommended from the source material.",sourceNames:[sourceName],audience:a.audiences||[],shots:idea.shots||[],on:true}));
    (a.output_ideas||[]).forEach((idea,ix)=>{
      const type=idea.type||"other", off=/video|photo/.test(type)?-28:/community/.test(type)?-3:-14;
      out.push({id:"source:"+gid+":output:"+smartSlug(idea.title||ix),phase:"Pre-launch",due:offsetISO(launch,off),name:idea.title||"Create supporting campaign output",
        type,requiresShoot:/video|photo/.test(type),why:idea.why||"Recommended from the source material.",sourceNames:[sourceName],audience:idea.audience||a.audiences||[],shots:idea.shots||[],on:true});
    });
  });
  const seen=new Set(); return out.filter(r=>{const k=smartSlug(r.name);if(seen.has(k))return false;seen.add(k);return true;});
}

async function syncCampaignPortfolio(force){
  if(state.campaignsLoading||(state.campaignsLoaded&&!force))return; state.campaignsLoading=true;state.campaignError=null;
  try{
    const res=await call("get_portfolio_items",{portfolio_gid:CAMPAIGN_PORTFOLIO,opt_fields:"name,start_on,due_on,color,notes,permalink_url",limit:100});
    const items=(res.data||[]).filter(x=>x&&x.gid&&!retiredCampaign(x)).map(campaignNormalise), previous=new Set((cfg.campaigns||[]).map(c=>c.gid));
    cfg.campaigns=items; cfg.projects=(cfg.projects||[]).filter(p=>!RETIRED_CAMPAIGN_GIDS.includes(p.gid)&&!/^volume drivers$/i.test(p.name||"")&&!(p.campaign||previous.has(p.gid)));
    items.forEach(c=>cfg.projects.push({gid:c.gid,name:c.name,color:c.color,on:true,campaign:true})); state.campaignPortfolio=items;
    if(!items.some(c=>c.gid===state.campaignSelected)){const today=todayD(),best=items.find(c=>c.start&&c.due&&pd(c.start)<=today&&pd(c.due)>=today)||items.find(c=>c.due&&pd(c.due)>=today)||items[0];state.campaignSelected=best?best.gid:null;}
    state.campaignsLoaded=true;saveCfg();
  }catch(e){state.campaignError=e.message;cfg.campaigns=(cfg.campaigns||[]).filter(c=>!retiredCampaign(c));state.campaignPortfolio=cfg.campaigns;}
  finally{state.campaignsLoading=false;}
}
function campaignStatus(c){const t=todayD(),s=c.start?pd(c.start):null,e=c.due?pd(c.due):null;if(e&&e<t)return{key:"done",label:"Wrapped"};if(s&&s>t)return{key:"next",label:"Upcoming"};if(s&&e&&s<=t&&e>=t)return{key:"live",label:"Live"};return{key:"plan",label:"Planning"};}
function taskInCampaign(t,gid){return (t.projectGids||[t.projectGid]).includes(gid);}
function campaignTasks(gid){return state.tasks.filter(t=>taskInCampaign(t,gid)&&!t.isKeeper);}
function campaignSmartTask(c){return state.tasks.find(t=>t.isCampaignSmart&&taskInCampaign(t,c.gid));}
function campFmt(d){return d?d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"";}
function campaignDateLabel(c){if(!c.start&&!c.due)return"Dates not set";if(c.start&&c.due)return"Launch "+campFmt(pd(c.start))+" · ends "+campFmt(pd(c.due));return c.start?"Launches "+campFmt(pd(c.start)):"Ends "+campFmt(pd(c.due));}
function defaultCampaignSmart(c){return{version:1,taskGid:null,launchDate:c.start||null,dirty:true,dirtyReason:"Smart plan has not been built yet.",sources:{},summary:"",gaps:[],recommendations:[],lastUpdate:null};}
function getCampaignSmart(c){
  if(state.campaignSmart[c.gid])return state.campaignSmart[c.gid]; const task=campaignSmartTask(c); let smart=defaultCampaignSmart(c);
  if(task&&task.notes){try{smart={...smart,...JSON.parse(task.notes),taskGid:task.gid};}catch{smart.taskGid=task.gid;}}
  state.campaignSmart[c.gid]=smart; return smart;
}
async function ensureCampaignHQ(c){
  let sections=state.campaignSections[c.gid]||[];let hq=sections.find(s=>/^campaign hq$/i.test(s.name));
  if(!hq){const r=await call("create_section",{project_id:c.gid,name:"Campaign HQ"});hq=r.data;sections=[hq,...sections];state.campaignSections[c.gid]=sections;}
  return hq;
}
async function saveCampaignSmartState(c,smart){
  const gid=c.gid,previous=state.campaignSmartSaving[gid]||Promise.resolve();
  // Queue saves instead of dropping a second change while the first Asana write
  // is still running. The JSON is created when this queued turn executes, so it
  // contains the latest categories, dismissals and review edits.
  const run=previous.catch(()=>{}).then(async()=>{
    const hq=await ensureCampaignHQ(c);
    const r=await call("save_campaign_state",{task_id:smart.taskGid||undefined,project_id:gid,section_id:hq&&hq.gid,name:"⚙️ campaign-smart-plan (managed by app)",notes:JSON.stringify(smart)});
    smart.taskGid=r.data&&r.data.gid||smart.taskGid;state.campaignSmart[gid]=smart;
  });
  state.campaignSmartSaving[gid]=run;
  try{await run;}finally{if(state.campaignSmartSaving[gid]===run)delete state.campaignSmartSaving[gid];}
}
async function loadCampaignResources(c,force){
  if(state.campaignResourceLoading[c.gid]||(!force&&state.campaignResources[c.gid]))return;state.campaignResourceLoading[c.gid]=true;renderCampaigns();
  try{const r=await call("get_attachments",{parent_id:c.gid});state.campaignResources[c.gid]=(r.data||[]).sort((a,b)=>String(b.created_at||"").localeCompare(a.created_at||""));}
  catch(e){state.campaignResources[c.gid]=[];toast("Couldn't load campaign resources: "+e.message);}
  finally{state.campaignResourceLoading[c.gid]=false;renderCampaigns();}
}

function renderCampaigns(){
  const list=document.getElementById("campaignList"),detail=document.getElementById("campaignDetail"),summary=document.getElementById("campaignSummary");if(!list||!detail||!summary)return;wireCampaignHeader();
  if(state.campaignsLoading){list.innerHTML='<div class="empty"><span class="spin"></span> loading portfolio…</div>';detail.innerHTML="";return;}
  const camps=(state.campaignPortfolio.length?state.campaignPortfolio:cfg.campaigns||[]).filter(c=>!retiredCampaign(c));
  if(state.campaignError)summary.innerHTML='<div class="campaign-sync-warn">Portfolio refresh failed: '+esc(state.campaignError)+'<br><span>Showing the last saved campaign list.</span></div>';
  else{const live=camps.filter(c=>campaignStatus(c).key==="live").length,upcoming=camps.filter(c=>campaignStatus(c).key==="next").length;summary.innerHTML='<b>'+camps.length+'</b><span>campaign'+(camps.length===1?"":"s")+'</span><i></i><b>'+live+'</b><span>live</span><i></i><b>'+upcoming+'</b><span>upcoming</span>';}
  if(!camps.length){list.innerHTML="";detail.innerHTML='<div class="campaign-empty"><span class="campaign-empty-mark">◎</span><h2>No campaigns in the portfolio</h2><p>Create the next campaign and draft its runway backwards from launch.</p><button class="btn primary" id="campaignEmptyNew">Create a campaign</button></div>';document.getElementById("campaignEmptyNew").onclick=openCampaign;return;}
  if(!camps.some(c=>c.gid===state.campaignSelected))state.campaignSelected=camps[0].gid;
  list.innerHTML=camps.map(c=>{const st=campaignStatus(c),tasks=campaignTasks(c.gid),open=tasks.filter(t=>!t.completed).length,smart=getCampaignSmart(c);return '<button class="campaign-row'+(c.gid===state.campaignSelected?' on':'')+'" data-campaign="'+c.gid+'"><span class="campaign-row-dot" style="background:'+c.color+'"></span><span class="campaign-row-main"><b>'+esc(c.name)+'</b><small>'+esc(campaignDateLabel(c))+'</small></span><span class="campaign-row-side"><em class="campaign-status '+st.key+'">'+st.label+'</em><small>'+open+' open'+(smart.dirty?' · smart update':'')+'</small></span></button>';}).join("");
  list.querySelectorAll("[data-campaign]").forEach(b=>b.onclick=()=>{state.campaignSelected=b.dataset.campaign;renderCampaigns();loadCampaignSections(state.campaignSelected);});renderCampaignDetail(camps.find(c=>c.gid===state.campaignSelected));
}
function wireCampaignHeader(){const fresh=document.getElementById("campaignRefresh"),add=document.getElementById("campaignNew");if(fresh&&!fresh.dataset.wired){fresh.dataset.wired="1";fresh.onclick=async()=>{fresh.disabled=true;fresh.innerHTML='<span class="spin"></span>';state.campaignsLoaded=false;await loadAll();fresh.disabled=false;fresh.textContent="Refresh";toast(state.campaignError?"Portfolio refresh hiccup":"Portfolio refreshed");};}if(add&&!add.dataset.wired){add.dataset.wired="1";add.onclick=openCampaign;}}
async function loadCampaignSections(gid){
  if(!gid||state.campaignSections[gid]||state.campaignSectionLoading[gid])return;state.campaignSectionLoading[gid]=true;renderCampaigns();
  try{const res=await call("get_project",{project_id:gid,include_sections:true,opt_fields:"name,notes,start_on,due_on,color,permalink_url"}),p=res.data||{};state.campaignSections[gid]=(p.sections||[]).map(s=>({gid:s.gid,name:s.name}));const c=(state.campaignPortfolio.length?state.campaignPortfolio:cfg.campaigns).find(x=>x.gid===gid);if(c){if(p.name)c.name=p.name;if(p.notes!=null)c.notes=p.notes;if(p.start_on!==undefined)c.start=p.start_on;if(p.due_on!==undefined)c.due=p.due_on;if(p.permalink_url)c.url=p.permalink_url;}}
  catch{state.campaignSections[gid]=[];}state.campaignSectionLoading[gid]=false;renderCampaigns();
}
function campaignTabs(c,view,smart){return '<div class="campaign-tabs"><button data-campview="overview" class="'+(view==="overview"?'on':'')+'">Plan & tasks</button><button data-campview="resources" class="'+(view==="resources"?'on':'')+'">Resources <span>'+((state.campaignResources[c.gid]||[]).length||"")+'</span></button><button data-campview="smart" class="'+(view==="smart"?'on':'')+'">Smart Plan'+(smart.dirty?' <i></i>':'')+'</button></div>';}
function renderCampaignDetail(c){
  const box=document.getElementById("campaignDetail");if(!box||!c)return;const tasks=campaignTasks(c.gid),done=tasks.filter(t=>t.completed).length,st=campaignStatus(c),smart=getCampaignSmart(c),view=state.campaignView[c.gid]||"overview";
  const sections=state.campaignSections[c.gid];if(!sections&&!state.campaignSectionLoading[c.gid])setTimeout(()=>loadCampaignSections(c.gid),0);
  box.innerHTML='<div class="campaign-detail-head"><div><div class="campaign-kicker"><span class="campaign-status '+st.key+'">'+st.label+'</span><span>'+tasks.length+' tasks · '+done+' done</span></div><h2>'+esc(c.name)+'</h2><p>'+esc(campaignDateLabel(c))+'</p></div><a class="btn ghost sm" href="'+esc(c.url||("https://app.asana.com/0/"+c.gid))+'" target="_blank">Open project ↗</a></div>'+campaignTabs(c,view,smart)+'<div id="campaignViewBody">'+(view==="resources"?renderCampaignResourceView(c,smart):view==="smart"?renderCampaignSmartView(c,smart,tasks):renderCampaignOverview(c,tasks,sections))+'</div>';
  wireCampaignDetail(c,view,smart);
}
function renderCampaignOverview(c,tasks,sections){
  const people='<option value="">Unassigned</option>'+state.users.map(u=>'<option value="'+u.gid+'">'+esc(u.name)+'</option>').join(""),phaseOpts=(sections||[]).filter(s=>!/^campaign hq$/i.test(s.name)).map(s=>'<option value="'+s.gid+'">'+esc(s.name)+'</option>').join("");
  return '<div class="campaign-detail-grid"><div class="campaign-main"><section class="campaign-section"><div class="campaign-section-h"><h3>Campaign details</h3><span>The launch date anchors the whole runway</span></div>'+campaignDetailsForm(c)+'</section><section class="campaign-section"><div class="campaign-section-h"><h3>Tasks</h3><span>Tasks also appear in Calendar and The Girls</span></div>'+campaignTaskComposer(people,phaseOpts,!!sections)+campaignTaskList(tasks,sections)+'</section></div><aside class="campaign-aside"><section class="campaign-section campaign-calendar-section"><div class="campaign-section-h"><h3>Campaign calendar</h3></div>'+campaignCalendar(c,tasks)+'</section>'+campaignNextUp(tasks)+'</aside></div>';
}
function campaignDetailsForm(c){return '<div class="campaign-fields"><label><span>Name</span><input id="campEditName" value="'+esc(c.name)+'"></label><label><span>Launch date</span><input type="date" id="campEditStart" value="'+(c.start||"")+'"></label><label><span>Ends</span><input type="date" id="campEditDue" value="'+(c.due||"")+'"></label></div><label class="campaign-note"><span>Working notes</span><textarea id="campEditNotes" placeholder="Objectives, audience, decisions, links, what cannot change…">'+esc(c.notes||"")+'</textarea></label><div class="campaign-save-line"><span id="campaignSaveState">Changing launch marks the Smart Plan for review.</span><button class="btn primary sm" id="campaignSave">Save campaign</button></div>';}
function campaignTaskComposer(people,phaseOpts,ready){return '<div class="campaign-add"><input id="campTaskName" placeholder="Add a campaign task…"><input type="date" id="campTaskDue"><select id="campTaskPhase" '+(ready?'':'disabled')+'><option value="">'+(ready?'No phase':'Loading phases…')+'</option>'+phaseOpts+'</select><select id="campTaskAssignee">'+people+'</select><button class="btn primary sm" id="campTaskAdd">Add</button></div>';}
function campaignTaskList(tasks,sections){if(!tasks.length)return'<div class="empty campaign-task-empty">No tasks yet. Build the Smart Plan or add one above.</div>';const order=(sections||[]).map(s=>s.name),groups={};tasks.forEach(t=>{const k=t.sectionName||"Other";(groups[k]=groups[k]||[]).push(t);});const keys=[...order.filter(k=>groups[k]&&!/^campaign hq$/i.test(k)),...Object.keys(groups).filter(k=>!order.includes(k))];return'<div class="campaign-task-groups">'+keys.map(k=>{const rows=groups[k].sort((a,b)=>(a.completed-b.completed)||((a.due||"9999").localeCompare(b.due||"9999")));return'<div class="campaign-task-group"><div class="campaign-phase"><span>'+esc(k)+'</span><b>'+rows.filter(x=>!x.completed).length+'</b></div>'+rows.map(campaignTaskRow).join("")+'</div>';}).join("")+'</div>';}
function campaignTaskRow(t){const open=!!state.campaignExpanded[t.gid],subs=state.campaignSubtasks[t.gid];let sub="";if(open){if(subs==="loading")sub='<div class="campaign-subtasks"><span class="spin"></span></div>';else{const arr=Array.isArray(subs)?subs:[];sub='<div class="campaign-subtasks">'+arr.map(s=>'<div class="campaign-subtask'+(s.completed?' done':'')+'"><button class="camp-sub-check" data-subdone="'+s.gid+'" data-parent="'+t.gid+'">'+(s.completed?'✓':'')+'</button><span>'+esc(s.name)+'</span><small>'+(s.due_on?campFmt(pd(s.due_on)):"")+'</small></div>').join("")+'<div class="campaign-sub-add"><input data-subname="'+t.gid+'" placeholder="Add a subtask…"><input type="date" data-subdue="'+t.gid+'"><button class="btn ghost sm" data-subadd="'+t.gid+'">Add</button></div></div>';}}return'<div class="campaign-task-wrap"><div class="campaign-task'+(t.completed?' done':'')+'"><button class="camp-check" data-campdone="'+t.gid+'">'+(t.completed?'✓':'')+'</button><button class="campaign-task-name" data-campopen="'+t.gid+'">'+esc(t.name)+'</button><span class="campaign-task-meta">'+(t.assignee?esc(firstName(t.assignee.name)):"Unassigned")+(t.due?' · '+campFmt(pd(t.due)):"")+'</span><button class="btn ghost sm campaign-sub-btn" data-subtoggle="'+t.gid+'">'+(open?'Hide':'Subtasks')+'</button></div>'+sub+'</div>';}
function campaignNextUp(tasks){const next=tasks.filter(t=>!t.completed&&t.due&&pd(t.due)>=todayD()).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);return'<section class="campaign-section campaign-next"><div class="campaign-section-h"><h3>Next up</h3></div>'+(!next.length?'<div class="empty" style="padding:12px 0">Nothing dated ahead.</div>':next.map(t=>'<button data-campopen="'+t.gid+'"><span>'+campFmt(pd(t.due))+'</span><b>'+esc(t.name)+'</b></button>').join(""))+'</section>';}
function campaignCalendar(c,tasks){let dates=tasks.filter(t=>t.due).map(t=>pd(t.due)),anchor=dates.length?new Date(Math.min(...dates)):c.start?pd(c.start):todayD();let cursor=state.campaignCursor[c.gid]?pd(state.campaignCursor[c.gid]):anchor;cursor=new Date(cursor.getFullYear(),cursor.getMonth(),1);const y=cursor.getFullYear(),m=cursor.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,start=new Date(first);start.setDate(1-offset);let html='<div class="campaign-cal-nav"><button class="btn ghost sm" data-campcal="-1">‹</button><b>'+MO[m]+' '+y+'</b><button class="btn ghost sm" data-campcal="1">›</button></div><div class="campaign-cal-dow">'+DOW.map(d=>'<span>'+d.slice(0,1)+'</span>').join("")+'</div><div class="campaign-cal-grid">';for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const dayTasks=tasks.filter(t=>t.due&&sameDay(pd(t.due),d)),dim=d.getMonth()!==m;html+='<button class="campaign-cal-day'+(dim?' dim':'')+(sameDay(d,todayD())?' today':'')+'" data-campdate="'+iso(d)+'"><span>'+d.getDate()+'</span>'+dayTasks.slice(0,2).map(t=>'<i style="background:'+c.color+'" title="'+esc(t.name)+'"></i>').join("")+(dayTasks.length>2?'<em>+'+(dayTasks.length-2)+'</em>':'')+'</button>';}return html+'</div>';}

function renderCampaignResourceView(c,smart){
  const resources=state.campaignResources[c.gid];if(!resources&&!state.campaignResourceLoading[c.gid])setTimeout(()=>loadCampaignResources(c),0);
  const options=CAMPAIGN_RESOURCE_TYPES.map(x=>'<option>'+x+'</option>').join("");
  let rows;if(state.campaignResourceLoading[c.gid]&&!resources)rows='<div class="empty"><span class="spin"></span> loading resources…</div>';
  else if(!(resources||[]).length)rows='<div class="campaign-resource-empty"><b>No source material yet</b><span>Add recipes, briefs, reference images or existing learning. Originals are stored in Asana Key Resources.</span></div>';
  else rows=(resources||[]).map(a=>{const src=smart.sources&&smart.sources[a.gid],cat=src&&src.category||"Other",analysed=src&&src.analysis;return'<div class="campaign-resource-row"><span class="campaign-resource-icon">'+resourceIcon(a.name)+'</span><span class="campaign-resource-main"><b>'+esc(a.name||"Resource")+'</b><small>'+(analysed?'Analysed · '+esc((analysed.summary||"").slice(0,120)):(src&&src.error?'Needs review · '+esc(src.error):'Not analysed yet'))+'</small></span><select data-resource-cat="'+a.gid+'">'+CAMPAIGN_RESOURCE_TYPES.map(x=>'<option'+(x===cat?' selected':'')+'>'+x+'</option>').join("")+'</select><button class="btn ghost sm" data-resource-analyse="'+a.gid+'">'+(analysed?'Reanalyse':'Analyse')+'</button>'+(a.view_url||a.download_url?'<a class="btn ghost sm" target="_blank" href="'+esc(a.view_url||a.download_url)+'">Open ↗</a>':'')+'<button class="btn ghost sm danger" data-resource-delete="'+a.gid+'">Remove</button></div>';}).join("");
  return '<div class="campaign-resource-layout"><section class="campaign-section"><div class="campaign-section-h"><h3>Campaign Resource Library</h3><span>Add sources now or at any point during the campaign</span></div><div class="campaign-resource-upload"><input id="campaignResourceFiles" type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json,image/*"><select id="campaignResourceType">'+options+'</select><button class="btn primary" id="campaignResourceUpload">Attach and analyse</button></div><p class="hint">PDF, Word, Excel, text and images can be read by the Smart Plan. Files are attached to the Asana project; analysis is stored in the managed Campaign HQ record.</p><div class="campaign-resource-list">'+rows+'</div></section><aside class="campaign-resource-help"><h3>How sources are used</h3><p>The app extracts requirements, recipes, audiences, gaps and shoot ideas. It never creates or moves tasks until you approve the Smart Plan.</p><button class="btn teal" id="resourceSmartUpdate">✨ Smart update whole plan</button>'+(smart.dirty?'<span class="campaign-smart-dirty">Update recommended: '+esc(smart.dirtyReason||"sources changed")+'</span>':'')+'</aside></div>';
}
function resourceIcon(name){const n=String(name||"").toLowerCase();if(n.endsWith(".pdf"))return"PDF";if(/\.docx?$/.test(n))return"DOC";if(/\.xlsx$|\.csv$/.test(n))return"XLS";if(/\.(png|jpe?g|webp|gif)$/.test(n))return"IMG";return"FILE";}
function campaignMarker(t){const m=String(t.notes||"").match(/#campaign-smart-id:([^\n]+)/);return m?m[1].trim():null;}
function compareRecommendations(recs,tasks,previous=[]){
  const oldById=new Map((previous||[]).map(r=>[r.id,r]));
  return recs.map(r=>{
    const old=oldById.get(r.id),remembered={assignee:old&&old.assignee||r.assignee||"",shootId:old&&old.shootId||r.shootId||""};
    let t=tasks.find(x=>campaignMarker(x)===r.id)||tasks.find(x=>smartSlug(x.name.replace(/^「shot」\s*/,"").replace(/ — Shoot Day.*$/i,""))===smartSlug(r.name.replace(/^Film:\s*/i,"")));
    if(t){
      // Completed work is historical fact. A refreshed launch plan may suggest a
      // different date, but it must not silently reopen or move finished work.
      if(t.completed)return{...r,...remembered,existingGid:t.gid,existingName:t.name,action:"covered",selected:false,completed:true,dismissed:false};
      const move=!!r.due&&t.due!==r.due;
      // Dismissing a proposed move means “keep the task where it is”. Retain that
      // choice across Smart Updates until the user explicitly restores it.
      if(move&&old&&old.dismissed)return{...r,...remembered,existingGid:t.gid,existingName:t.name,action:"dismissed",selected:false,dismissed:true};
      return{...r,...remembered,existingGid:t.gid,existingName:t.name,action:move?"update":"covered",selected:move,dismissed:false};
    }
    if(old&&old.dismissed)return{...r,...remembered,action:"dismissed",selected:false,dismissed:true};
    return{...r,...remembered,action:"create",selected:true,dismissed:false};
  });
}
function campaignShoots(){return state.tasks.filter(t=>t.isShoot&&t.due&&!t.completed).sort((a,b)=>a.due.localeCompare(b.due));}
function renderCampaignSmartView(c,smart,tasks){
  const updating=state.campaignSmartUpdating[c.gid],recs=smart.recommendations||[],sections=state.campaignSections[c.gid]||[],shoots=campaignShoots();
  const stats={create:recs.filter(r=>r.action==="create").length,update:recs.filter(r=>r.action==="update").length,covered:recs.filter(r=>r.action==="covered").length,dismissed:recs.filter(r=>r.action==="dismissed").length};
  const people='<option value="">Unassigned</option>'+state.users.map(u=>'<option value="'+u.gid+'">'+esc(u.name)+'</option>').join("");
  const phaseOptions=CAMPAIGN_PHASES.map(p=>'<option>'+p+'</option>').join("");
  const shootOptions='<option value="">Campaign task only</option><option value="__campaign__">Use / create the campaign shoot day</option>'+shoots.map(s=>'<option value="'+s.gid+'">'+esc(s.name)+' · '+esc(campFmt(pd(s.due)))+'</option>').join("");
  const rows=recs.length?recs.map((r,ix)=>'<div class="campaign-smart-row '+r.action+'"><input type="checkbox" data-smart-on="'+ix+'" '+(r.selected?'checked':'')+(/covered|dismissed/.test(r.action)?' disabled':'')+'><span class="campaign-smart-action">'+(r.action==="create"?'NEW':r.action==="update"?'MOVE':r.action==="dismissed"?'DISMISSED':'COVERED')+'</span><div class="campaign-smart-edit"><input data-smart-name="'+ix+'" value="'+esc(r.name)+'" '+(/covered|dismissed/.test(r.action)?'disabled':'')+'><small>'+esc(r.why||"")+(r.sourceNames&&r.sourceNames.length?' · Source: '+esc(r.sourceNames.join(", ")):'')+(r.completed?' · Completed work is preserved':'')+'</small><div class="campaign-smart-fields"><input type="date" data-smart-date="'+ix+'" value="'+(r.due||"")+'" '+(/covered|dismissed/.test(r.action)?'disabled':'')+'><select data-smart-phase="'+ix+'" '+(/covered|dismissed/.test(r.action)?'disabled':'')+'>'+CAMPAIGN_PHASES.map(p=>'<option'+(p===(r.phase||"Pre-launch")?' selected':'')+'>'+p+'</option>').join("")+'</select><select data-smart-owner="'+ix+'" '+(/covered|dismissed/.test(r.action)?'disabled':'')+'>'+people.replace('value="'+(r.assignee||"")+'"','value="'+(r.assignee||"")+'" selected')+'</select>'+(r.requiresShoot?'<select data-smart-shoot="'+ix+'" '+(/covered|dismissed/.test(r.action)?'disabled':'')+'>'+shootOptions.replace('value="'+(r.shootId||"__campaign__")+'"','value="'+(r.shootId||"__campaign__")+'" selected')+'</select>':'')+'</div>'+(r.shots&&r.shots.length?'<details><summary>Suggested shot checklist ('+r.shots.length+')</summary><ul>'+r.shots.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></details>':'')+(r.action!=="covered"?'<button class="campaign-smart-dismiss" data-smart-dismiss="'+ix+'">'+(r.dismissed?'Restore idea':'Dismiss idea')+'</button>':'')+'</div></div>').join(""):'<div class="campaign-smart-empty"><b>No Smart Plan yet</b><span>Run the update to combine the backwards launch runway, current campaign tasks and uploaded source material.</span></div>';
  return '<div class="campaign-smart-layout"><section class="campaign-section"><div class="campaign-smart-hero"><div><span>Launch anchor</span><b>'+(c.start?campFmt(pd(c.start)):"Set a launch date")+'</b><small>Every recommended deadline is calculated backwards or forwards from this date.</small></div><button class="btn teal" id="campaignSmartUpdate" '+(updating?'disabled':'')+'>'+(updating?'<span class="spin"></span> reading & rebuilding…':'✨ Smart update whole plan')+'</button></div>'+(smart.dirty?'<div class="campaign-smart-warning"><b>Plan needs review.</b> '+esc(smart.dirtyReason||"Campaign inputs changed.")+'</div>':'')+(smart.summary?'<div class="campaign-smart-summary"><h3>What the sources say</h3><p>'+esc(smart.summary)+'</p></div>':'')+(smart.gaps&&smart.gaps.length?'<div class="campaign-smart-gaps"><h3>Questions and gaps</h3><ul>'+smart.gaps.map(g=>'<li>'+esc(g)+'</li>').join("")+'</ul></div>':'')+'<div class="campaign-section-h smart-list-head"><h3>Proposed plan</h3><span>'+stats.create+' new · '+stats.update+' date changes · '+stats.covered+' covered'+(stats.dismissed?' · '+stats.dismissed+' dismissed':'')+'</span></div><div class="campaign-smart-list">'+rows+'</div>'+(recs.length?'<div class="campaign-smart-apply"><span>Only checked changes will be written to Asana.</span><button class="btn primary" id="campaignSmartApply">Apply selected changes</button></div>':'')+'</section><aside class="campaign-smart-aside"><h3>Safe refresh</h3><p>Adding a source or changing the launch date marks the plan as out of date. Smart Update compares everything again but preserves completed, dismissed and existing work.</p><p><b>Last updated</b><br>'+(smart.lastUpdate?esc(new Date(smart.lastUpdate).toLocaleString("en-ZA")):"Never")+'</p></aside></div>';
}

function wireCampaignDetail(c,view,smart){
  document.querySelectorAll("[data-campview]").forEach(b=>b.onclick=()=>{state.campaignView[c.gid]=b.dataset.campview;renderCampaigns();});
  if(view==="overview")wireCampaignOverview(c,smart);else if(view==="resources")wireCampaignResources(c,smart);else wireCampaignSmart(c,smart);
}
function wireCampaignOverview(c,smart){
  const save=document.getElementById("campaignSave");if(save)save.onclick=()=>saveCampaignDetails(c,smart);const add=document.getElementById("campTaskAdd");if(add)add.onclick=()=>addCampaignTask(c);
  document.querySelectorAll('[data-campopen]').forEach(b=>b.onclick=()=>openDrawer(b.dataset.campopen));document.querySelectorAll('[data-campdone]').forEach(b=>b.onclick=()=>toggleDone(b.dataset.campdone,!findTask(b.dataset.campdone).completed));document.querySelectorAll('[data-subtoggle]').forEach(b=>b.onclick=()=>toggleCampaignSubtasks(b.dataset.subtoggle));document.querySelectorAll('[data-subadd]').forEach(b=>b.onclick=()=>addCampaignSubtask(b.dataset.subadd));document.querySelectorAll('[data-subdone]').forEach(b=>b.onclick=()=>toggleCampaignSubtask(b.dataset.parent,b.dataset.subdone));document.querySelectorAll('[data-campcal]').forEach(b=>b.onclick=()=>{const current=state.campaignCursor[c.gid]?pd(state.campaignCursor[c.gid]):(c.start?pd(c.start):todayD());current.setDate(1);current.setMonth(current.getMonth()+(+b.dataset.campcal));state.campaignCursor[c.gid]=iso(current);renderCampaigns();});document.querySelectorAll('[data-campdate]').forEach(b=>b.onclick=()=>{const due=document.getElementById("campTaskDue");if(due){due.value=b.dataset.campdate;document.getElementById("campTaskName").focus();}});
}
function wireCampaignResources(c,smart){
  const up=document.getElementById("campaignResourceUpload");if(up)up.onclick=()=>uploadCampaignResources(c,smart);const su=document.getElementById("resourceSmartUpdate");if(su)su.onclick=()=>{state.campaignView[c.gid]="smart";renderCampaigns();setTimeout(()=>smartUpdateCampaign(c),0);};
  document.querySelectorAll("[data-resource-cat]").forEach(el=>el.onchange=async()=>{smart.sources=smart.sources||{};smart.sources[el.dataset.resourceCat]=smart.sources[el.dataset.resourceCat]||{};smart.sources[el.dataset.resourceCat].category=el.value;smart.dirty=true;smart.dirtyReason="A resource category changed.";await saveCampaignSmartState(c,smart);renderCampaigns();});
  document.querySelectorAll("[data-resource-analyse]").forEach(b=>b.onclick=()=>analyseExistingResource(c,smart,b.dataset.resourceAnalyse,b));
  document.querySelectorAll("[data-resource-delete]").forEach(b=>b.onclick=()=>deleteCampaignResource(c,smart,b.dataset.resourceDelete,b));
}
async function uploadCampaignResources(c,smart){
  const input=document.getElementById("campaignResourceFiles"),files=[...(input&&input.files||[])],category=document.getElementById("campaignResourceType").value,btn=document.getElementById("campaignResourceUpload");if(!files.length){toast("Choose at least one source file");return;}
  btn.disabled=true;smart.sources=smart.sources||{};let uploaded=0,analysisErrors=0;
  try{for(const file of files){if(file.size>3*1024*1024){toast(file.name+" is too large for the browser upload (3 MB max)");continue;}btn.textContent="Adding "+file.name+"…";const data_base64=await fileToBase64(file);const r=await call("upload_attachment",{parent_id:c.gid,filename:file.name,mime:file.type||"application/octet-stream",data_base64}),att=r.data||{};uploaded++;let analysis=null,error=null;try{const ar=await fetch("/api/campaign-resource",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"analyse_file",filename:file.name,mime:file.type,category,campaign:{name:c.name,launch:c.start,due:c.due},data_base64})}),aj=await ar.json().catch(()=>({}));if(!ar.ok)throw new Error(aj.error||"Analysis failed");analysis=aj.analysis;}catch(e){error=e.message;analysisErrors++;}smart.sources[att.gid]={gid:att.gid,name:att.name||file.name,category,analysis,error,addedAt:new Date().toISOString()};}
    smart.dirty=true;smart.dirtyReason="New campaign source material was added.";await saveCampaignSmartState(c,smart);await loadCampaignResources(c,true);toast(uploaded+" resource"+(uploaded===1?"":"s")+" added"+(analysisErrors?" · "+analysisErrors+" need manual analysis":""));
  }catch(e){toast("Resource upload failed: "+e.message);}finally{btn.disabled=false;btn.textContent="Attach and analyse";renderCampaigns();}
}
async function analyseExistingResource(c,smart,gid,btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>';try{const a=(state.campaignResources[c.gid]||[]).find(x=>x.gid===gid),category=(smart.sources&&smart.sources[gid]&&smart.sources[gid].category)||"Other";let analysis;if(DEMO)analysis={name:a&&a.name||"Demo source",category,summary:"Demo source analysis completed.",facts:[],recipes:[],dates:[],audiences:["Restaurant teams"],risks:[],gaps:[],shoot_ideas:[],output_ideas:[],analysed_at:new Date().toISOString(),ai_available:true};else{const r=await fetch("/api/campaign-resource",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"analyse_attachment",attachment_id:gid,category,campaign:{name:c.name,launch:c.start,due:c.due}})}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Analysis failed");analysis=j.analysis;}smart.sources=smart.sources||{};smart.sources[gid]={...(smart.sources[gid]||{}),gid,name:a&&a.name||analysis.name,category,analysis,error:null};smart.dirty=true;smart.dirtyReason="A source was analysed or reanalysed.";await saveCampaignSmartState(c,smart);toast("Source analysed");}catch(e){toast(e.message);}finally{renderCampaigns();}}
async function deleteCampaignResource(c,smart,gid,btn){if(!confirm("Remove this resource from the campaign and Asana?"))return;btn.disabled=true;try{await call("delete_attachment",{attachment_id:gid});if(smart.sources)delete smart.sources[gid];smart.dirty=true;smart.dirtyReason="A campaign source was removed.";await saveCampaignSmartState(c,smart);await loadCampaignResources(c,true);toast("Resource removed");}catch(e){toast("Could not remove resource: "+e.message);}finally{renderCampaigns();}}
function wireCampaignSmart(c,smart){
  const up=document.getElementById("campaignSmartUpdate");if(up)up.onclick=()=>smartUpdateCampaign(c);const apply=document.getElementById("campaignSmartApply");if(apply)apply.onclick=()=>applyCampaignSmart(c,smart,apply);
  (smart.recommendations||[]).forEach((r,ix)=>{const bind=(sel,key,prop="value")=>{const el=document.querySelector(sel+'="'+ix+'"]');if(el)el.onchange=()=>{r[key]=prop==="checked"?el.checked:el.value;};};bind('[data-smart-on','selected','checked');bind('[data-smart-name','name');bind('[data-smart-date','due');bind('[data-smart-phase','phase');bind('[data-smart-owner','assignee');bind('[data-smart-shoot','shootId');});
  document.querySelectorAll('[data-smart-dismiss]').forEach(b=>b.onclick=async()=>{const r=smart.recommendations[+b.dataset.smartDismiss];if(!r)return;r.dismissed=!r.dismissed;r.action=r.dismissed?"dismissed":(r.existingGid?"update":"create");r.selected=!r.dismissed;await saveCampaignSmartState(c,smart);renderCampaigns();});
}
async function smartUpdateCampaign(c){
  if(!c.start){toast("Set the campaign launch date first");return;}const smart=getCampaignSmart(c);state.campaignSmartUpdating[c.gid]=true;renderCampaigns();
  try{
    const base=buildCampaignPlan(c.name,c.start,c.due,CAMPAIGN_CHANNELS.map(x=>x.key),[]),sourceFallback=campaignSourceRecommendations(smart.sources,c.start),analyses=Object.values(smart.sources||{}).filter(s=>s.analysis).map(s=>({name:s.name,category:s.category,analysis:s.analysis}));let ai=[],summary="",gaps=[];
    if(analyses.length){try{const text=await askAI("You are building an integrated, source-grounded campaign plan for Ocean Basket Academy. Return ONLY JSON: {\"summary\":\"\",\"gaps\":[\"\"],\"recommendations\":[{\"title\":\"\",\"type\":\"course|skills_booster|manager_support|community_message|infographic|cheat_sheet|video|photo|training|other\",\"phase\":\"Pre-launch|Launch week|In market|Wrap-up\",\"offset_days\":-14,\"why\":\"\",\"source_names\":[\"\"],\"audience\":[\"\"],\"requires_shoot\":false,\"shots\":[\"\"]}]}. Work backwards from launch. Course material must be available 14 days before launch; filming needed for it should normally happen 28 days before launch. Do not repeat the standard runway. Do not invent operational facts. Flag conflicts as gaps.",{campaign:{name:c.name,launch:c.start,end:c.due,notes:c.notes},sources:analyses,existing_tasks:campaignTasks(c.gid).map(t=>({name:t.name,due:t.due,completed:t.completed}))});const parsed=smartParse(text);if(parsed){summary=parsed.summary||"";gaps=parsed.gaps||[];ai=(parsed.recommendations||[]).map((r,ix)=>({id:"ai:"+smartSlug(r.title||ix),phase:CAMPAIGN_PHASES.includes(r.phase)?r.phase:"Pre-launch",due:offsetISO(c.start,Number.isFinite(+r.offset_days)?+r.offset_days:-14),name:r.title||"Create campaign output",type:r.type||"other",requiresShoot:!!r.requires_shoot,why:r.why||"Recommended after reading all campaign sources.",sourceNames:r.source_names||[],audience:r.audience||[],shots:r.shots||[],on:true}));}}catch(e){gaps.push("The integrated AI review could not run: "+e.message);}}
    if(!summary&&analyses.length)summary=analyses.map(x=>x.analysis.summary).filter(Boolean).join(" ").slice(0,1600);
    gaps=[...gaps,...analyses.flatMap(x=>x.analysis.gaps||[])].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,20);
    const all=[...base,...sourceFallback,...ai],seen=new Set(),deduped=all.filter(r=>{const k=smartSlug(r.name);if(seen.has(k))return false;seen.add(k);return true;});
    smart.summary=summary;smart.gaps=gaps;smart.recommendations=compareRecommendations(deduped,campaignTasks(c.gid),smart.recommendations||[]);smart.launchDate=c.start;smart.dirty=false;smart.dirtyReason="";smart.lastUpdate=new Date().toISOString();await saveCampaignSmartState(c,smart);toast("Smart Plan rebuilt — review before applying");
  }catch(e){toast("Smart update failed: "+e.message);}finally{state.campaignSmartUpdating[c.gid]=false;renderCampaigns();}
}
function smartTaskNotes(rec,existingNotes){const marker="#campaign-smart-id:"+rec.id,body=[marker,"Why: "+(rec.why||"Campaign plan"),rec.sourceNames&&rec.sourceNames.length?"Sources: "+rec.sourceNames.join(", "):"",rec.audience&&rec.audience.length?"Audience: "+rec.audience.join(", "):"",rec.shots&&rec.shots.length?"\nSuggested shot checklist:\n"+rec.shots.map(x=>"• "+x).join("\n"):""].filter(Boolean).join("\n");const clean=String(existingNotes||"").replace(/#campaign-smart-id:[^\n]+\n?/g,"").trim();return body+(clean?"\n\nExisting notes:\n"+clean:"");}
async function ensureCampaignShoot(c,rec,phaseSection){
  if(rec.existingGid){
    const t=state.tasks.find(x=>x.gid===rec.existingGid),update={task:rec.existingGid,name:rec.name,due_on:rec.due,notes:smartTaskNotes(rec,t&&t.notes)};
    // An existing Studio shoot may already be multi-homed into the campaign.
    // Only request project membership when it is genuinely missing.
    if(!t||!taskInCampaign(t,c.gid)) update.add_projects=[{project_id:c.gid,section_id:phaseSection}];
    await call("update_shared_tasks",{tasks:[update]});
    return{gid:rec.existingGid,name:rec.name,due:rec.due};
  }
  const made=await call("create_shared_tasks",{tasks:[{name:rec.name,project_id:CC_PROJECT,section_id:SEC_SHOOT,due_on:rec.due,notes:smartTaskNotes(rec,"")}]}),task=made.data&&made.data[0];
  if(!task)throw new Error("Could not create campaign shoot day");
  await call("update_shared_tasks",{tasks:[{task:task.gid,add_projects:[{project_id:c.gid,section_id:phaseSection}]}]});
  return{gid:task.gid,name:rec.name,due:rec.due};
}
async function applyCampaignSmart(c,smart,btn){
  const selected=(smart.recommendations||[]).filter(r=>r.selected&&(r.action==="create"||r.action==="update"));if(!selected.length){toast("Select at least one change");return;}btn.disabled=true;btn.innerHTML='<span class="spin"></span> applying…';
  try{
    const sections=state.campaignSections[c.gid]||[],sectionFor=p=>(sections.find(s=>s.name===p)||{}).gid;let campaignShoot=null,created=0,updated=0;
    const shootRec=selected.find(r=>r.type==="shoot_day");if(shootRec){const wasExisting=!!shootRec.existingGid;campaignShoot=await ensureCampaignShoot(c,shootRec,sectionFor(shootRec.phase));shootRec.action="covered";shootRec.selected=false;shootRec.existingGid=campaignShoot.gid;shootRec.shootId=campaignShoot.gid;shootRec.appliedAt=new Date().toISOString();wasExisting?updated++:created++;}
    for(const rec of selected.filter(r=>r!==shootRec)){
      let shoot=null;if(rec.requiresShoot){if(rec.shootId&&rec.shootId!=="__campaign__")shoot=state.tasks.find(t=>t.gid===rec.shootId);else{if(!campaignShoot){const existing=(smart.recommendations||[]).find(r=>r.type==="shoot_day"&&r.existingGid),t=existing&&state.tasks.find(x=>x.gid===existing.existingGid);campaignShoot=t||await ensureCampaignShoot(c,{id:"base:shoot-day",name:"Shoot Day — "+c.name,due:offsetISO(c.start,-28),why:"Required to create campaign learning assets.",sourceNames:["Smart Plan"],shots:[],phase:"Pre-launch"},sectionFor("Pre-launch"));}shoot=campaignShoot;}}
      const phase=sectionFor(rec.phase),existing=rec.existingGid&&state.tasks.find(t=>t.gid===rec.existingGid),displayName=shoot?'「shot」 '+rec.name.replace(/^Film:\s*/i,"")+" — "+shoot.name:rec.name,due=shoot&&shoot.due||rec.due,notes=smartTaskNotes(rec,existing&&existing.notes);
      let gid=rec.existingGid;if(gid){await call("update_shared_tasks",{tasks:[{task:gid,name:displayName,due_on:due,assignee:rec.assignee||null,notes,add_projects:shoot?[{project_id:CC_PROJECT,section_id:SEC_PLAN}]:[]} ]});updated++;}
      else{const r=await call("create_shared_tasks",{tasks:[{name:displayName,project_id:c.gid,section_id:phase,due_on:due,assignee:rec.assignee||undefined,notes}]}),t=r.data&&r.data[0];if(!t)throw new Error("Could not create "+rec.name);gid=t.gid;created++;if(shoot)await call("update_shared_tasks",{tasks:[{task:gid,add_projects:[{project_id:CC_PROJECT,section_id:SEC_PLAN}]}]});}
      if(shoot&&gid)await call("set_task_parent",{task_id:gid,parent_id:shoot.gid});rec.action="covered";rec.selected=false;rec.existingGid=gid;rec.appliedAt=new Date().toISOString();
    }
    await saveCampaignSmartState(c,smart);toast(created+" created · "+updated+" updated");await loadAll();
  }catch(e){toast("Could not apply the whole plan: "+e.message);}finally{btn.disabled=false;btn.textContent="Apply selected changes";renderCampaigns();}
}

async function saveCampaignDetails(c,smart){const btn=document.getElementById("campaignSave"),stateEl=document.getElementById("campaignSaveState"),name=document.getElementById("campEditName").value.trim(),start=document.getElementById("campEditStart").value||null,due=document.getElementById("campEditDue").value||null,notes=document.getElementById("campEditNotes").value;if(!name){toast("Campaign name required");return;}if(start&&due&&pd(start)>pd(due)){toast("The end date must be after the launch date");return;}const launchChanged=start!==c.start,inputChanged=launchChanged||name!==c.name||due!==c.due||notes!==c.notes;btn.disabled=true;btn.innerHTML='<span class="spin"></span>';try{await call("update_project",{project_id:c.gid,fields:{name,notes,start_on:start,due_on:due}});c.name=name;c.notes=notes;c.start=start;c.due=due;const p=cfg.projects.find(p=>p.gid===c.gid);if(p)p.name=name;const local=cfg.campaigns.find(x=>x.gid===c.gid);if(local)Object.assign(local,c);if(inputChanged){smart.dirty=true;smart.dirtyReason=launchChanged?"The launch date changed, so all relative deadlines must be recalculated.":"Campaign details changed and may affect the plan.";await saveCampaignSmartState(c,smart);}saveCfg();renderCampaigns();renderCalendar();toast(inputChanged?"Campaign saved — Smart Plan needs an update":"Campaign saved ✓");}catch(e){stateEl.textContent="Save failed: "+e.message;btn.disabled=false;btn.textContent="Save campaign";}}
async function addCampaignTask(c){const name=document.getElementById("campTaskName").value.trim();if(!name){toast("Task name required");return;}const btn=document.getElementById("campTaskAdd"),task={name,project_id:c.gid},due=document.getElementById("campTaskDue").value,sec=document.getElementById("campTaskPhase").value,asg=document.getElementById("campTaskAssignee").value;if(due)task.due_on=due;if(sec)task.section_id=sec;if(asg)task.assignee=asg;btn.disabled=true;btn.innerHTML='<span class="spin"></span>';try{await call("create_tasks",{tasks:[task]});toast("Campaign task added");await loadAll();}catch(e){toast("Failed: "+e.message);btn.disabled=false;btn.textContent="Add";}}
async function toggleCampaignSubtasks(parent){const open=!state.campaignExpanded[parent];state.campaignExpanded[parent]=open;if(open&&state.campaignSubtasks[parent]===undefined){state.campaignSubtasks[parent]="loading";renderCampaigns();try{const r=await call("get_subtasks",{parent});state.campaignSubtasks[parent]=r.data||[];}catch{state.campaignSubtasks[parent]=[];toast("Couldn't load subtasks");}}renderCampaigns();}
async function addCampaignSubtask(parent){const nameEl=document.querySelector('[data-subname="'+parent+'"]'),dueEl=document.querySelector('[data-subdue="'+parent+'"]'),name=nameEl&&nameEl.value.trim();if(!name){toast("Subtask name required");return;}const data={name};if(dueEl&&dueEl.value)data.due_on=dueEl.value;try{await call("create_subtask",{parent,data});const r=await call("get_subtasks",{parent});state.campaignSubtasks[parent]=r.data||[];renderCampaigns();toast("Subtask added");}catch(e){toast("Failed: "+e.message);}}
async function toggleCampaignSubtask(parent,gid){const arr=state.campaignSubtasks[parent]||[],sub=arr.find(x=>x.gid===gid);if(!sub)return;sub.completed=!sub.completed;renderCampaigns();try{await call("update_tasks",{tasks:[{task:gid,completed:sub.completed}]});}catch(e){sub.completed=!sub.completed;renderCampaigns();toast("Failed: "+e.message);}}
