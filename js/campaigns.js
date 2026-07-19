/* ================================================================
   CAMPAIGNS — portfolio-backed campaign operating system
   One portfolio item = one Asana project. Specialist tasks can also
   belong to a campaign without leaving their original board.
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

const CAMPAIGN_PHASES = ["Campaign HQ","Pre-launch","Launch week","In market","Wrap-up"];
const CAMPAIGN_CHANNELS = [
  {key:"courses", label:"Courses"},
  {key:"videos",  label:"Videos / shoot"},
  {key:"training",label:"In-person training"},
  {key:"comms",   label:"Comms"}
];
const CAMPAIGN_TEMPLATES = [
  {key:"menu",label:"Menu launch",desc:"Full runway across courses, shoots, training, comms and restaurant readiness."},
  {key:"learning",label:"Learning programme",desc:"Build, pilot, launch, reinforce and measure a course or pathway."},
  {key:"incentive",label:"Incentive / sales campaign",desc:"Targets, manager enablement, team activation, tracking and recognition."},
  {key:"event",label:"Masterclass / event",desc:"Speakers, venue, invitations, run sheet, delivery and follow-up."},
  {key:"store",label:"Store opening",desc:"Readiness, training, systems, launch support and first-week follow-up."},
  {key:"comms",label:"Small communications campaign",desc:"A lighter plan for a short, focused message or behaviour push."},
  {key:"blank",label:"Blank campaign",desc:"Create the project and phases without generating any tasks."}
];
const CAMPAIGN_DECISION_PREFIX = "◆ Decision — ";
const CAMPAIGN_WRAP_PREFIX = "◆ Wrap-up — ";

/* ---------- shared campaign/task helpers ---------- */
function retiredCampaign(c){
  return RETIRED_CAMPAIGN_GIDS.includes(c.gid) || /^volume drivers$/i.test((c.name||"").trim());
}
function hiddenCampaignSet(){ return new Set(cfg.hiddenCampaigns||[]); }
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
    owner:c.owner&&c.owner.gid?{gid:c.owner.gid,name:c.owner.name||userName(c.owner.gid)}:null,
    archived:!!c.archived,
    url:c.permalink_url||c.url||("https://app.asana.com/0/"+c.gid),
    asanaColor:c.color||HEX_TO_ASANA[campaignHex(c,ix)]||"dark-teal",
    source:"portfolio"
  };
}
function campaignSource(){ return state.campaignPortfolio.length?state.campaignPortfolio:(cfg.campaigns||[]); }
function campaignVisible(c){ return !retiredCampaign(c) && !c.archived && !hiddenCampaignSet().has(c.gid); }
function campaignListSource(){
  const all=campaignSource().filter(c=>!retiredCampaign(c));
  return state.campaignShowHidden?all:all.filter(campaignVisible);
}
function taskProjectGids(t){ return [...new Set(t&&t.projectGids&&t.projectGids.length?t.projectGids:[t&&t.projectGid].filter(Boolean))]; }
function campaignGidSet(){ return new Set((cfg.campaigns||[]).map(c=>c.gid)); }
function taskCampaignGids(t){ const ids=campaignGidSet(); return taskProjectGids(t).filter(g=>ids.has(g)); }
function primaryCampaignForTask(t){ return taskCampaignGids(t)[0]||""; }
function taskInCampaign(t,gid){ return taskProjectGids(t).includes(gid); }
function campaignSectionForTask(t,gid){
  const x=t&&t.sectionsByProject&&t.sectionsByProject[gid];
  if(x&&x.name) return x.name;
  if(t&&t.projectGid===gid) return t.sectionName||"Other";
  return "Linked work";
}
function isCampaignDecision(t){ return (t.name||"").startsWith(CAMPAIGN_DECISION_PREFIX); }
function isCampaignWrapup(t){ return (t.name||"").startsWith(CAMPAIGN_WRAP_PREFIX); }
function campaignAllTasks(gid){ return state.tasks.filter(t=>taskInCampaign(t,gid)&&!t.isKeeper); }
function campaignWorkTasks(gid){ return campaignAllTasks(gid).filter(t=>!isCampaignDecision(t)&&!isCampaignWrapup(t)); }
function campaignDecisionTasks(gid){ return campaignAllTasks(gid).filter(isCampaignDecision).sort((a,b)=>(b.due||"").localeCompare(a.due||"")); }
function campaignWrapupTasks(gid){ return campaignAllTasks(gid).filter(isCampaignWrapup).sort((a,b)=>(b.due||"").localeCompare(a.due||"")); }
function campaignMilestones(gid){ return campaignWorkTasks(gid).filter(t=>t.isMilestone).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999")); }
function campaignNormalTasks(gid){ return campaignWorkTasks(gid).filter(t=>!t.isMilestone); }
function campFmt(d){ return d?d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):""; }
function campaignDateLabel(c){
  if(!c.start&&!c.due) return "Dates not set";
  if(c.start&&c.due) return campFmt(pd(c.start))+" – "+campFmt(pd(c.due));
  return c.start?"Starts "+campFmt(pd(c.start)):"Ends "+campFmt(pd(c.due));
}
function campaignStatus(c){
  const t=todayD(), s=c.start?pd(c.start):null, e=c.due?pd(c.due):null;
  if(c.archived) return {key:"done",label:"Archived"};
  if(e&&e<t) return {key:"done",label:"Wrapped"};
  if(s&&s>t) return {key:"next",label:"Upcoming"};
  if(s&&e&&s<=t&&e>=t) return {key:"live",label:"Live"};
  return {key:"plan",label:"Planning"};
}
function campaignOptionsHTML(selected,noneLabel){
  const all=campaignSource().filter(campaignVisible);
  return '<option value="">'+esc(noneLabel||"No campaign")+'</option>'+all.map(c=>'<option value="'+c.gid+'"'+(selected===c.gid?' selected':'')+'>'+esc(c.name)+'</option>').join("");
}
function fillCampaignSelectById(id,selected,noneLabel){
  const el=document.getElementById(id); if(!el)return;
  const current=selected!==undefined?selected:el.value;
  el.innerHTML=campaignOptionsHTML(current,noneLabel);
  if(current)el.value=current;
}

/* Native Asana multi-project membership: create once, show everywhere. */
async function ensureCampaignSection(gid,name){
  if(!gid||!name)return null;
  let sections=state.campaignSections[gid];
  if(!sections){
    try{
      const res=await call("get_project",{project_id:gid,include_sections:true,opt_fields:"name,sections.name"});
      sections=((res.data&&res.data.sections)||[]).map(s=>({gid:s.gid,name:s.name}));
      state.campaignSections[gid]=sections;
    }catch(e){ sections=[]; state.campaignSections[gid]=sections; }
  }
  let hit=sections.find(s=>s.name.toLowerCase()===name.toLowerCase());
  if(hit)return hit.gid;
  try{
    const made=await call("create_section",{project_id:gid,name});
    hit=made.data&&made.data.gid?{gid:made.data.gid,name}:null;
    if(hit)sections.push(hit);
    return hit&&hit.gid;
  }catch(e){ return null; }
}
async function linkTasksToCampaign(gids,campaignGid,phaseName){
  const clean=[...new Set((gids||[]).filter(Boolean))];
  if(!clean.length||!campaignGid)return;
  const sectionId=phaseName?await ensureCampaignSection(campaignGid,phaseName):null;
  await call("update_tasks",{tasks:clean.map(gid=>({task:gid,add_projects:[sectionId?{project_id:campaignGid,section_id:sectionId}:{project_id:campaignGid}]}))});
}
async function createTasksWithCampaign(tasks,campaignGid,phaseName){
  const res=await call("create_tasks",{tasks});
  const created=(res.data||[]).map(x=>x.gid).filter(Boolean);
  const needsLink=campaignGid && tasks.some(t=>t.project_id!==campaignGid);
  if(needsLink&&created.length) await linkTasksToCampaign(created,campaignGid,phaseName);
  return res;
}
async function updateTaskCampaignLink(t,newGid){
  if(!t)return false;
  const existing=taskCampaignGids(t);
  const primaryIsCampaign=campaignGidSet().has(t.projectGid);
  if(primaryIsCampaign && taskProjectGids(t).length===1) return false;
  const add=newGid&&!existing.includes(newGid)?[{project_id:newGid}]:[];
  const remove=existing.filter(g=>g!==newGid&&g!==t.projectGid);
  if(!add.length&&!remove.length)return false;
  const upd={task:t.gid}; if(add.length)upd.add_projects=add;if(remove.length)upd.remove_projects=remove;
  await call("update_tasks",{tasks:[upd]});
  return true;
}

/* ---------- campaign templates ---------- */
function campaignTemplateByKey(key){ return CAMPAIGN_TEMPLATES.find(t=>t.key===key)||CAMPAIGN_TEMPLATES[0]; }
function buildCampaignPlan(name,start,end,channels,roles,templateKey){
  const S=pd(start), E=pd(end), mid=new Date((S.valueOf()+E.valueOf())/2);
  const d=(base,off)=>{ const x=new Date(base);x.setDate(x.getDate()+off);return iso(x); };
  const roleTxt=roles.length?" ("+roles.join(", ")+")":"";
  const rows=[];
  const add=(phase,due,task,opts)=>rows.push({phase,due,name:task,on:true,milestone:!!(opts&&opts.milestone),channel:(opts&&opts.channel)||"all"});
  const ch=(key)=>channels.includes(key);
  switch(templateKey){
    case "blank": break;
    case "learning":
      add("Pre-launch",d(S,-35),"Confirm learning need, audience and success measures"+roleTxt);
      add("Pre-launch",d(S,-28),"Course architecture and learning objectives approved",{milestone:true});
      add("Pre-launch",d(S,-24),"Write and build learning content"+roleTxt,{channel:"courses"});
      if(ch("videos"))add("Pre-launch",d(S,-20),"Brief and schedule supporting video shoot",{channel:"videos"});
      add("Pre-launch",d(S,-12),"Pilot with a small restaurant group");
      add("Pre-launch",d(S,-7),"QA, configure assignments and manager support pack",{channel:"courses"});
      if(ch("comms"))add("Pre-launch",d(S,-3),"Queue launch messages by community",{channel:"comms"});
      add("Launch week",start,"Programme live and assigned",{milestone:true});
      add("Launch week",d(S,4),"First participation and access check");
      add("In market",iso(mid),"Wrong-answer and learner feedback review");
      add("In market",d(mid,2),"Release Skills Booster where needed");
      add("Wrap-up",d(E,2),"Completion, confidence and business signal snapshot",{milestone:true});
      add("Wrap-up",d(E,5),"Learning review and next iteration decisions");
      break;
    case "incentive":
      add("Pre-launch",d(S,-24),"Confirm target behaviour, commercial measure and rules");
      add("Pre-launch",d(S,-18),"Validate baseline and reporting source");
      add("Pre-launch",d(S,-14),"Manager enablement pack and team talking points");
      if(ch("courses"))add("Pre-launch",d(S,-10),"Create the short product / selling refresher",{channel:"courses"});
      if(ch("comms"))add("Pre-launch",d(S,-5),"Teaser and launch messages queued",{channel:"comms"});
      add("Launch week",start,"Campaign launch and targets confirmed",{milestone:true});
      add("Launch week",d(S,3),"Check stores understand the rules and tracking");
      add("In market",iso(mid),"Midpoint performance pulse and coaching focus");
      add("In market",d(mid,1),"Recognise early wins and share examples");
      add("Wrap-up",d(E,1),"Final results and winner validation",{milestone:true});
      add("Wrap-up",d(E,4),"Recognition, lessons and repeat recommendation");
      break;
    case "event":
      add("Pre-launch",d(S,-28),"Confirm event purpose, audience and format");
      add("Pre-launch",d(S,-24),"Speaker / facilitator confirmed",{milestone:true});
      add("Pre-launch",d(S,-21),"Book venue or virtual link");
      add("Pre-launch",d(S,-16),"Draft agenda and participant activity");
      if(ch("comms"))add("Pre-launch",d(S,-14),"Invitation message queued",{channel:"comms"});
      add("Pre-launch",d(S,-7),"Run sheet, slides and speaker notes final");
      add("Pre-launch",d(S,-2),"Attendance reminder and final tech check");
      add("Launch week",start,"Deliver "+name,{milestone:true});
      add("Launch week",d(S,1),"Share recording, resources and follow-up action");
      add("Wrap-up",d(E,2),"Attendance, feedback and actions reviewed",{milestone:true});
      break;
    case "store":
      add("Pre-launch",d(S,-35),"Opening scope, roles and readiness owners confirmed");
      add("Pre-launch",d(S,-28),"Recruitment and role gaps reviewed");
      add("Pre-launch",d(S,-21),"Training plan, trainers and venue confirmed");
      add("Pre-launch",d(S,-14),"Systems, Academy access and learner roster ready");
      add("Pre-launch",d(S,-10),"Product, service and practical training underway");
      add("Pre-launch",d(S,-5),"Manager readiness and sign-offs checked",{milestone:true});
      if(ch("comms"))add("Pre-launch",d(S,-3),"Opening support communication queued",{channel:"comms"});
      add("Launch week",start,"Restaurant opens — launch support live",{milestone:true});
      add("Launch week",d(S,2),"First service coaching and issue sweep");
      add("In market",d(S,7),"First-week readiness review");
      add("Wrap-up",d(E,2),"Opening support handover and lessons",{milestone:true});
      break;
    case "comms":
      add("Pre-launch",d(S,-10),"Confirm audience, single behaviour and call to action");
      add("Pre-launch",d(S,-7),"Source material and message sequence approved");
      add("Pre-launch",d(S,-4),"Assets and links ready");
      add("Pre-launch",d(S,-2),"Messages queued by community",{channel:"comms"});
      add("Launch week",start,"Communications campaign starts",{milestone:true});
      add("In market",iso(mid),"Questions, engagement and misunderstandings checked");
      add("Wrap-up",d(E,1),"Message performance and follow-up decision",{milestone:true});
      break;
    case "menu":
    default:
      add("Pre-launch",d(S,-35),"Menu scope, recipes and operational changes locked",{milestone:true});
      if(ch("courses"))add("Pre-launch",d(S,-28),"Write and build role-based courses"+roleTxt,{channel:"courses"});
      if(ch("courses"))add("Pre-launch",d(S,-10),"QA, configure and assign courses",{channel:"courses"});
      if(ch("courses"))add("Pre-launch",d(S,-7),"Manager launch pack — why, who, deadline, coaching",{channel:"courses"});
      if(ch("videos"))add("Pre-launch",d(S,-24),"Brief to Content Go — "+name+" videos",{channel:"videos"});
      if(ch("videos"))add("Pre-launch",d(S,-16),"Shoot Day — "+name,{channel:"videos"});
      if(ch("videos"))add("Pre-launch",d(S,-6),"Final videos delivered and loaded",{channel:"videos",milestone:true});
      if(ch("training"))add("Pre-launch",d(S,-21),"Book venues and trainers",{channel:"training"});
      if(ch("training"))add("Pre-launch",d(S,-14),"Regional session schedule locked",{channel:"training"});
      if(ch("comms"))add("Pre-launch",d(S,-5),"Teaser messages queued by community",{channel:"comms"});
      if(ch("comms"))add("Pre-launch",d(S,-1),"Launch announcement ready",{channel:"comms"});
      add("Launch week",start,"Menu campaign live",{milestone:true});
      if(ch("courses"))add("Launch week",d(S,4),"First-week participation and confidence check",{channel:"courses"});
      if(ch("training"))add("Launch week",d(S,3),"Run in-person launch sessions",{channel:"training"});
      if(ch("comms"))add("Launch week",d(S,1),"Manager huddle reminder",{channel:"comms"});
      if(ch("comms"))add("In market",iso(mid),"Mid-campaign boost message",{channel:"comms"});
      if(ch("courses"))add("In market",iso(mid),"Wrong-answer check — Skills Booster if needed",{channel:"courses"});
      if(ch("training"))add("In market",iso(mid),"Trainer field check-ins",{channel:"training"});
      add("Wrap-up",d(E,2),"Completion and results snapshot",{milestone:true});
      add("Wrap-up",d(E,5),"What we would do differently — 15 minute huddle");
      add("Wrap-up",d(E,7),"Archive assets and confirm source of truth");
      break;
  }
  return rows;
}

/* ---------- portfolio sync ---------- */
async function syncCampaignPortfolio(force){
  if(state.campaignsLoading)return;
  if(state.campaignsLoaded&&!force)return;
  state.campaignsLoading=true;state.campaignError=null;
  try{
    const res=await call("get_portfolio_items",{portfolio_gid:CAMPAIGN_PORTFOLIO,
      opt_fields:"name,start_on,due_on,color,notes,permalink_url,owner.gid,owner.name,archived",limit:100});
    const items=(res.data||[]).filter(x=>x&&x.gid&&!retiredCampaign(x)).map(campaignNormalise);
    const previousCampaignGids=new Set((cfg.campaigns||[]).map(c=>c.gid));
    cfg.campaigns=items;
    cfg.projects=(cfg.projects||[]).filter(p=>{
      if(RETIRED_CAMPAIGN_GIDS.includes(p.gid)||/^volume drivers$/i.test(p.name||""))return false;
      return !(p.campaign||previousCampaignGids.has(p.gid));
    });
    const hidden=hiddenCampaignSet();
    items.forEach(c=>cfg.projects.push({gid:c.gid,name:c.name,color:c.color,on:!hidden.has(c.gid)&&!c.archived,campaign:true}));
    state.campaignPortfolio=items;
    const selectable=items.filter(campaignVisible);
    if(!selectable.some(c=>c.gid===state.campaignSelected)){
      const today=todayD();
      const best=selectable.find(c=>c.start&&c.due&&pd(c.start)<=today&&pd(c.due)>=today)
        ||selectable.find(c=>c.due&&pd(c.due)>=today)||selectable[0]||items[0];
      state.campaignSelected=best?best.gid:null;
    }
    state.campaignsLoaded=true;saveCfg();
  }catch(e){
    state.campaignError=e.message;
    cfg.campaigns=(cfg.campaigns||[]).filter(c=>!retiredCampaign(c));
    cfg.projects=(cfg.projects||[]).filter(p=>!RETIRED_CAMPAIGN_GIDS.includes(p.gid)&&!/^volume drivers$/i.test(p.name||""));
    state.campaignPortfolio=cfg.campaigns;
  }finally{state.campaignsLoading=false;}
}

/* ---------- clear, rule-based campaign health ---------- */
function campaignHealth(c){
  const tasks=campaignWorkTasks(c.gid),open=tasks.filter(t=>!t.completed),today=todayD();
  const warnings=[];
  const risk=(text,code)=>warnings.push({severity:"risk",text,code});
  const warn=(text,code)=>warnings.push({severity:"warn",text,code});
  const overdue=open.filter(t=>t.due&&pd(t.due)<today);
  const unassigned=open.filter(t=>!t.assignee);
  const undated=open.filter(t=>!t.due);
  const daysStart=c.start?Math.ceil((pd(c.start)-today)/864e5):null;
  const hasComms=tasks.some(t=>t.isComms||/message|announcement|community|comms|promo|teaser/i.test(t.name||""));
  const hasContent=tasks.some(t=>t.isShoot||t.isShot||t.isBrief||/shoot|video|content|brief/i.test(t.name||""));
  if(!c.owner)warn("No campaign owner is set.","owner");
  if(!c.start||!c.due)warn("Campaign dates are incomplete.","dates");
  if(overdue.length)risk(overdue.length+" overdue task"+(overdue.length===1?"":"s")+".","overdue");
  if(c.due&&pd(c.due)<today&&open.length)risk("The campaign has ended with "+open.length+" task"+(open.length===1?"":"s")+" still open.","past-open");
  if(unassigned.length)warn(unassigned.length+" open task"+(unassigned.length===1?" is":"s are")+" unassigned.","unassigned");
  if(undated.length)warn(undated.length+" open task"+(undated.length===1?" has":"s have")+" no date.","undated");
  if(daysStart!==null&&daysStart>=0&&daysStart<=7&&!hasComms)risk("Launch is within 7 days, but no community message is linked.","comms");
  if(daysStart!==null&&daysStart>=0&&daysStart<=14&&!hasContent)warn("Launch is within 14 days, but no shoot, brief or content task is linked.","content");
  if(!campaignMilestones(c.gid).length)warn("No campaign milestones are defined.","milestones");
  if(c.due&&pd(c.due)<today&&!campaignWrapupTasks(c.gid).length)warn("The campaign is wrapped, but no wrap-up has been saved.","wrapup");
  const key=warnings.some(w=>w.severity==="risk")?"risk":warnings.length?"warn":"good";
  return {key,label:key==="risk"?"At risk":key==="warn"?"Needs attention":"On track",warnings,open:open.length,overdue:overdue.length};
}

/* ---------- campaign rendering ---------- */
function renderCampaigns(){
  const list=document.getElementById("campaignList"),detail=document.getElementById("campaignDetail"),summary=document.getElementById("campaignSummary");
  if(!list||!detail||!summary)return;
  wireCampaignHeader();
  if(state.campaignsLoading){list.innerHTML='<div class="empty"><span class="spin"></span> loading portfolio…</div>';detail.innerHTML="";return;}
  const camps=campaignListSource();
  const hiddenCount=campaignSource().filter(c=>!retiredCampaign(c)&&(!campaignVisible(c))).length;
  const hiddenBtn=document.getElementById("campaignHiddenToggle");
  if(hiddenBtn){hiddenBtn.style.display=hiddenCount?"":"none";hiddenBtn.textContent=state.campaignShowHidden?"Hide archived":"Hidden ("+hiddenCount+")";}
  if(state.campaignError){
    summary.innerHTML='<div class="campaign-sync-warn">Portfolio refresh failed: '+esc(state.campaignError)+'<br><span>Showing the last saved campaign list.</span></div>';
  }else{
    const visible=campaignSource().filter(campaignVisible),live=visible.filter(c=>campaignStatus(c).key==="live").length;
    const attention=visible.filter(c=>campaignHealth(c).key!=="good").length;
    summary.innerHTML='<b>'+visible.length+'</b><span>active</span><i></i><b>'+live+'</b><span>live</span><i></i><b>'+attention+'</b><span>need attention</span>';
  }
  if(!camps.length){
    list.innerHTML="";
    detail.innerHTML='<div class="campaign-empty"><span class="campaign-empty-mark">◎</span><h2>'+(state.campaignShowHidden?'No hidden campaigns':'No campaigns in the portfolio')+'</h2><p>Create the next campaign here and the app will make the Asana project, add it to your portfolio and draft the launch runway.</p><button class="btn primary" id="campaignEmptyNew">Create a campaign</button></div>';
    const b=document.getElementById("campaignEmptyNew");if(b)b.onclick=openCampaign;return;
  }
  if(!camps.some(c=>c.gid===state.campaignSelected))state.campaignSelected=camps[0].gid;
  list.innerHTML=camps.map(c=>{
    const st=campaignStatus(c),health=campaignHealth(c),open=health.open,isHidden=!campaignVisible(c);
    return '<button class="campaign-row'+(c.gid===state.campaignSelected?' on':'')+(isHidden?' hidden':'')+'" data-campaign="'+c.gid+'">'+
      '<span class="campaign-row-dot" style="background:'+c.color+'"></span><span class="campaign-row-main"><b>'+esc(c.name)+'</b><small>'+esc(campaignDateLabel(c))+'</small></span>'+
      '<span class="campaign-row-side"><em class="campaign-health '+health.key+'">'+health.label+'</em><small>'+open+' open · '+st.label+'</small></span></button>';
  }).join("");
  list.querySelectorAll("[data-campaign]").forEach(b=>b.onclick=()=>{state.campaignSelected=b.dataset.campaign;renderCampaigns();loadCampaignSections(state.campaignSelected);});
  renderCampaignDetail(camps.find(c=>c.gid===state.campaignSelected));
}
function wireCampaignHeader(){
  const fresh=document.getElementById("campaignRefresh"),add=document.getElementById("campaignNew"),hidden=document.getElementById("campaignHiddenToggle");
  if(fresh&&!fresh.dataset.wired){fresh.dataset.wired="1";fresh.onclick=async()=>{fresh.disabled=true;fresh.innerHTML='<span class="spin"></span>';state.campaignsLoaded=false;await loadAll();fresh.disabled=false;fresh.textContent="Refresh";toast(state.campaignError?"Portfolio refresh hiccup":"Portfolio refreshed");};}
  if(add&&!add.dataset.wired){add.dataset.wired="1";add.onclick=openCampaign;}
  if(hidden&&!hidden.dataset.wired){hidden.dataset.wired="1";hidden.onclick=()=>{state.campaignShowHidden=!state.campaignShowHidden;renderCampaigns();};}
}
async function loadCampaignSections(gid){
  if(!gid||state.campaignSections[gid]||state.campaignSectionLoading[gid])return;
  state.campaignSectionLoading[gid]=true;renderCampaigns();
  try{
    const res=await call("get_project",{project_id:gid,include_sections:true,opt_fields:"name,notes,start_on,due_on,color,permalink_url,owner.gid,owner.name,archived"});
    const p=res.data||{};
    state.campaignSections[gid]=(p.sections||[]).map(s=>({gid:s.gid,name:s.name}));
    const c=campaignSource().find(x=>x.gid===gid);
    if(c){
      if(p.name)c.name=p.name;if(p.notes!=null)c.notes=p.notes;
      if(p.start_on!==undefined)c.start=p.start_on;if(p.due_on!==undefined)c.due=p.due_on;
      if(p.permalink_url)c.url=p.permalink_url;if(p.owner!==undefined)c.owner=p.owner;
      if(p.archived!==undefined)c.archived=!!p.archived;
    }
  }catch(e){state.campaignSections[gid]=[];}
  state.campaignSectionLoading[gid]=false;renderCampaigns();
}
function renderCampaignDetail(c){
  const box=document.getElementById("campaignDetail");if(!box||!c)return;
  const work=campaignWorkTasks(c.gid),done=work.filter(t=>t.completed).length,st=campaignStatus(c),health=campaignHealth(c);
  const sections=state.campaignSections[c.gid];
  if(!sections&&!state.campaignSectionLoading[c.gid])setTimeout(()=>loadCampaignSections(c.gid),0);
  const people='<option value="">Unassigned</option>'+state.users.map(u=>'<option value="'+u.gid+'">'+esc(u.name)+'</option>').join("");
  const phaseOpts=(sections||[]).filter(s=>s.name!=="Campaign HQ").map(s=>'<option value="'+s.gid+'">'+esc(s.name)+'</option>').join("");
  box.innerHTML=
    '<div class="campaign-detail-head"><div><div class="campaign-kicker"><span class="campaign-status '+st.key+'">'+st.label+'</span><span>'+work.length+' work items · '+done+' done</span><span class="campaign-health '+health.key+'">'+health.label+'</span></div><h2>'+esc(c.name)+'</h2><p>'+esc(campaignDateLabel(c))+(c.owner?' · owner '+esc(firstName(c.owner.name)):'')+'</p></div>'+
      '<a class="btn ghost sm" href="'+esc(c.url||("https://app.asana.com/0/"+c.gid))+'" target="_blank">Open project ↗</a></div>'+
    '<div class="campaign-detail-grid"><div class="campaign-main">'+
      campaignHealthPanel(c,health)+
      '<section class="campaign-section"><div class="campaign-section-h"><h3>Milestones</h3><span>The few moments that tell you whether the campaign is moving</span></div>'+campaignMilestoneStrip(c)+'</section>'+
      '<section class="campaign-section"><div class="campaign-section-h"><h3>Campaign details</h3><span>Saved to the Asana project</span></div>'+campaignDetailsForm(c)+'</section>'+
      '<section class="campaign-section"><div class="campaign-section-h"><h3>Tasks</h3><span>Linked work stays on its specialist board too</span></div>'+campaignTaskComposer(c,people,phaseOpts,!!sections)+campaignTaskList(c,campaignNormalTasks(c.gid),sections)+'</section>'+
      '<section class="campaign-section"><div class="campaign-section-h"><h3>Decision log</h3><span>What changed, who agreed and why</span></div>'+campaignDecisionLog(c)+'</section>'+
    '</div><aside class="campaign-aside">'+
      '<section class="campaign-section campaign-calendar-section"><div class="campaign-section-h"><h3>Campaign calendar</h3></div>'+campaignCalendar(c,work)+'</section>'+
      campaignNextUp(work)+campaignWrapupPanel(c)+campaignManagePanel(c)+
    '</aside></div>';
  wireCampaignDetail(c);
}
function campaignHealthPanel(c,health){
  if(health.key==="good")return '<section class="campaign-section campaign-health-panel good"><div class="campaign-health-title"><span>✓</span><div><b>On track</b><small>No rule-based risks detected. Keep the milestones moving.</small></div></div></section>';
  return '<section class="campaign-section campaign-health-panel '+health.key+'"><div class="campaign-health-title"><span>'+(health.key==="risk"?'!':'△')+'</span><div><b>'+health.label+'</b><small>These are clear workflow rules, not an AI guess.</small></div></div><div class="campaign-warning-list">'+health.warnings.map(w=>'<div class="campaign-warning '+w.severity+'"><span>'+esc(w.text)+'</span>'+campaignWarningAction(c,w)+'</div>').join("")+'</div></section>';
}
function campaignWarningAction(c,w){
  if(w.code==="comms")return '<button class="btn ghost sm" data-campjump="communities" data-cgid="'+c.gid+'">Plan message</button>';
  if(w.code==="content")return '<button class="btn ghost sm" data-campjump="studio" data-cgid="'+c.gid+'">Add shoot</button>';
  if(w.code==="owner"||w.code==="dates")return '<button class="btn ghost sm" data-campfocus="details">Fix</button>';
  if(w.code==="wrapup")return '<button class="btn ghost sm" data-wrapdraft="'+c.gid+'">Draft wrap-up</button>';
  return "";
}
function campaignDetailsForm(c){
  const ownerOpts='<option value="">No owner</option>'+state.users.map(u=>'<option value="'+u.gid+'"'+(c.owner&&c.owner.gid===u.gid?' selected':'')+'>'+esc(u.name)+'</option>').join("");
  return '<div class="campaign-fields"><label><span>Name</span><input id="campEditName" value="'+esc(c.name)+'"></label><label><span>Starts</span><input type="date" id="campEditStart" value="'+(c.start||"")+'"></label><label><span>Ends</span><input type="date" id="campEditDue" value="'+(c.due||"")+'"></label><label><span>Owner</span><select id="campEditOwner">'+ownerOpts+'</select></label></div>'+
    '<label class="campaign-note"><span>Working notes</span><textarea id="campEditNotes" placeholder="Objectives, audience, links, what cannot change…">'+esc(c.notes||"")+'</textarea></label>'+
    '<div class="campaign-save-line"><span id="campaignSaveState">Notes, dates and owner live on the Asana project.</span><button class="btn primary sm" id="campaignSave">Save campaign</button></div>';
}
function campaignMilestoneStrip(c){
  const milestones=campaignMilestones(c.gid);
  if(!milestones.length)return '<div class="campaign-milestone-empty">No milestones yet. Add one with the task composer below by changing <b>Task</b> to <b>Milestone</b>.</div>';
  return '<div class="campaign-milestones">'+milestones.map(m=>'<button class="campaign-milestone'+(m.completed?' done':'')+'" data-campopen="'+m.gid+'"><i style="--mc:'+c.color+'"></i><span><b>'+esc(m.name)+'</b><small>'+(m.due?campFmt(pd(m.due)):"No date")+(m.completed?' · complete':'')+'</small></span></button>').join("")+'</div>';
}
function campaignTaskComposer(c,people,phaseOpts,ready){
  return '<div class="campaign-add"><input id="campTaskName" placeholder="Add a campaign task…"><input type="date" id="campTaskDue">'+
    '<select id="campTaskPhase" '+(ready?'':'disabled')+'><option value="">'+(ready?'No phase':'Loading phases…')+'</option>'+phaseOpts+'</select>'+
    '<select id="campTaskAssignee">'+people+'</select><select id="campTaskType"><option value="default_task">Task</option><option value="milestone">Milestone</option></select><button class="btn primary sm" id="campTaskAdd">Add</button></div>';
}
function campaignTaskList(c,tasks,sections){
  if(!tasks.length)return '<div class="empty campaign-task-empty">No ordinary tasks yet. Add one above, link work from another tab, or use a campaign template.</div>';
  const order=(sections||[]).map(s=>s.name).filter(n=>n!=="Campaign HQ");
  const groups={};tasks.forEach(t=>{const k=campaignSectionForTask(t,c.gid)||"Other";(groups[k]=groups[k]||[]).push(t);});
  const keys=[...order.filter(k=>groups[k]),...Object.keys(groups).filter(k=>!order.includes(k))];
  return '<div class="campaign-task-groups">'+keys.map(k=>{
    const rows=groups[k].sort((a,b)=>(a.completed-b.completed)||((a.due||"9999").localeCompare(b.due||"9999")));
    return '<div class="campaign-task-group"><div class="campaign-phase"><span>'+esc(k)+'</span><b>'+rows.filter(x=>!x.completed).length+'</b></div>'+rows.map(t=>campaignTaskRow(t,c)).join("")+'</div>';
  }).join("")+'</div>';
}
function campaignTaskRow(t,c){
  const open=!!state.campaignExpanded[t.gid],subs=state.campaignSubtasks[t.gid];let sub="";
  if(open){
    if(subs==="loading")sub='<div class="campaign-subtasks"><span class="spin"></span></div>';
    else{
      const arr=Array.isArray(subs)?subs:[];
      sub='<div class="campaign-subtasks">'+arr.map(s=>'<div class="campaign-subtask'+(s.completed?' done':'')+'"><button class="camp-sub-check" data-subdone="'+s.gid+'" data-parent="'+t.gid+'">'+(s.completed?'✓':'')+'</button><span>'+esc(s.name)+'</span><small>'+(s.due_on?campFmt(pd(s.due_on)):"")+'</small></div>').join("")+
        '<div class="campaign-sub-add"><input data-subname="'+t.gid+'" placeholder="Add a subtask…"><input type="date" data-subdue="'+t.gid+'"><button class="btn ghost sm" data-subadd="'+t.gid+'">Add</button></div></div>';
    }
  }
  const linked=t.projectGid!==c.gid?'<span class="campaign-linked" title="This task also lives on '+esc(t.projectName)+'">↗ '+esc(t.projectName)+'</span>':'';
  return '<div class="campaign-task-wrap"><div class="campaign-task'+(t.completed?' done':'')+'">'+
    '<button class="camp-check" data-campdone="'+t.gid+'">'+(t.completed?'✓':'')+'</button><button class="campaign-task-name" data-campopen="'+t.gid+'">'+esc(t.name)+'</button>'+
    '<span class="campaign-task-meta">'+linked+(t.assignee?esc(firstName(t.assignee.name)):"Unassigned")+(t.due?' · '+campFmt(pd(t.due)):"")+'</span>'+
    '<button class="btn ghost sm campaign-sub-btn" data-subtoggle="'+t.gid+'">'+(open?'Hide':'Subtasks')+'</button></div>'+sub+'</div>';
}
function campaignNextUp(tasks){
  const next=tasks.filter(t=>!t.completed&&t.due&&pd(t.due)>=todayD()).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);
  return '<section class="campaign-section campaign-next"><div class="campaign-section-h"><h3>Next up</h3></div>'+(!next.length?'<div class="empty" style="padding:12px 0">Nothing dated ahead.</div>':next.map(t=>'<button data-campopen="'+t.gid+'"><span>'+campFmt(pd(t.due))+'</span><b>'+(t.isMilestone?'◆ ':'')+esc(t.name)+'</b></button>').join(""))+'</section>';
}
function campaignCalendar(c,tasks){
  let cursor=state.campaignCursor[c.gid]?pd(state.campaignCursor[c.gid]):(c.start?pd(c.start):todayD());cursor=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const y=cursor.getFullYear(),m=cursor.getMonth(),first=new Date(y,m,1);let offset=(first.getDay()+6)%7;const start=new Date(first);start.setDate(1-offset);
  const cS=c.start?pd(c.start):null,cE=c.due?pd(c.due):null;
  let html='<div class="campaign-cal-nav"><button class="btn ghost sm" data-campcal="-1">‹</button><b>'+MO[m]+' '+y+'</b><button class="btn ghost sm" data-campcal="1">›</button></div><div class="campaign-cal-dow">'+DOW.map(d=>'<span>'+d.slice(0,1)+'</span>').join("")+'</div><div class="campaign-cal-grid">';
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);const dayTasks=tasks.filter(t=>t.due&&sameDay(pd(t.due),d));
    const inRange=cS&&cE&&d>=cS&&d<=cE,dim=d.getMonth()!==m;
    html+='<button class="campaign-cal-day'+(dim?' dim':'')+(inRange?' in-range':'')+(sameDay(d,todayD())?' today':'')+'" data-campdate="'+iso(d)+'"><span>'+d.getDate()+'</span>'+dayTasks.slice(0,2).map(t=>'<i class="'+(t.isMilestone?'milestone':'')+'" style="background:'+c.color+'" title="'+esc(t.name)+'"></i>').join("")+(dayTasks.length>2?'<em>+'+(dayTasks.length-2)+'</em>':'')+'</button>';
  }
  return html+'</div>';
}
function parseDecision(t){
  const notes=t.notes||"";
  const get=(key)=>{const m=notes.match(new RegExp('^'+key+':\\s*(.*)$','mi'));return m?m[1].trim():"";};
  return {decision:(t.name||"").replace(CAMPAIGN_DECISION_PREFIX,""),by:get("Decided by"),reason:get("Reason"),impact:get("Impact")};
}
function campaignDecisionLog(c){
  const decisions=campaignDecisionTasks(c.gid);
  return '<div class="campaign-decision-add"><input id="campDecision" placeholder="Decision — e.g. launch moves to 18 August"><input id="campDecisionWhy" placeholder="Reason"><input id="campDecisionImpact" placeholder="Impact / what changes"><button class="btn primary sm" id="campDecisionAdd">Log</button></div>'+
    (!decisions.length?'<div class="empty" style="padding:16px 0">No decisions logged yet.</div>':'<div class="campaign-decisions">'+decisions.map(t=>{const x=parseDecision(t);return '<button data-campopen="'+t.gid+'"><span>'+campFmt(pd(t.due||iso(todayD())))+'</span><b>'+esc(x.decision)+'</b><small>'+(x.by?esc(x.by)+' · ':'')+esc(x.reason||"No reason recorded")+(x.impact?' · Impact: '+esc(x.impact):'')+'</small></button>';}).join("")+'</div>');
}
function campaignWrapupPanel(c){
  const wrap=campaignWrapupTasks(c.gid)[0];
  if(wrap)return '<section class="campaign-section campaign-wrap"><div class="campaign-section-h"><h3>Campaign wrap-up</h3><span>Saved in Asana</span></div><button class="campaign-wrap-card" data-campopen="'+wrap.gid+'"><b>'+esc(wrap.name.replace(CAMPAIGN_WRAP_PREFIX,""))+'</b><span>'+esc((wrap.notes||"").slice(0,220))+(wrap.notes&&wrap.notes.length>220?'…':'')+'</span></button><button class="btn ghost sm" data-wrapdraft="'+c.gid+'">Generate a fresh version</button></section>';
  return '<section class="campaign-section campaign-wrap"><div class="campaign-section-h"><h3>Campaign wrap-up</h3></div><p class="hint">Turn the campaign history into a clean results-and-lessons record.</p><button class="btn ghost sm" data-wrapdraft="'+c.gid+'">✨ Draft from campaign history</button></section>';
}
function campaignManagePanel(c){
  const hidden=!campaignVisible(c);
  return '<section class="campaign-section campaign-manage"><div class="campaign-section-h"><h3>Manage campaign</h3><span>Safe actions first</span></div>'+
    '<button class="campaign-manage-row" data-camphide="'+c.gid+'"><span><b>'+(hidden?'Restore in Command Center':'Hide from Command Center')+'</b><small>'+(hidden?'Bring this campaign back into normal views.':'Keeps the Asana project and portfolio item untouched.')+'</small></span><i>›</i></button>'+
    '<button class="campaign-manage-row" data-campremove="'+c.gid+'"><span><b>Remove from portfolio</b><small>The Asana project survives; it simply leaves this portfolio.</small></span><i>›</i></button>'+
    '<button class="campaign-manage-row" data-camparchive="'+c.gid+'"><span><b>Archive Asana project</b><small>Read-only history, hidden from active work.</small></span><i>›</i></button>'+
    '<div class="campaign-danger"><b>Danger zone</b><p>Permanent deletion removes the Asana project. You will have to type its exact name.</p><button class="btn warn sm" data-campdelete="'+c.gid+'">Permanently delete project</button></div></section>';
}

/* ---------- campaign interactions ---------- */
function wireCampaignDetail(c){
  const save=document.getElementById("campaignSave");if(save)save.onclick=()=>saveCampaignDetails(c);
  const add=document.getElementById("campTaskAdd");if(add)add.onclick=()=>addCampaignTask(c);
  const dadd=document.getElementById("campDecisionAdd");if(dadd)dadd.onclick=()=>addCampaignDecision(c);
  document.querySelectorAll('[data-campopen]').forEach(b=>b.onclick=()=>openDrawer(b.dataset.campopen));
  document.querySelectorAll('[data-campdone]').forEach(b=>b.onclick=()=>{const t=findTask(b.dataset.campdone);if(t)toggleDone(t.gid,!t.completed);});
  document.querySelectorAll('[data-subtoggle]').forEach(b=>b.onclick=()=>toggleCampaignSubtasks(b.dataset.subtoggle));
  document.querySelectorAll('[data-subadd]').forEach(b=>b.onclick=()=>addCampaignSubtask(b.dataset.subadd));
  document.querySelectorAll('[data-subdone]').forEach(b=>b.onclick=()=>toggleCampaignSubtask(b.dataset.parent,b.dataset.subdone));
  document.querySelectorAll('[data-campcal]').forEach(b=>b.onclick=()=>{const current=state.campaignCursor[c.gid]?pd(state.campaignCursor[c.gid]):(c.start?pd(c.start):todayD());current.setDate(1);current.setMonth(current.getMonth()+(+b.dataset.campcal));state.campaignCursor[c.gid]=iso(current);renderCampaigns();});
  document.querySelectorAll('[data-campdate]').forEach(b=>b.onclick=()=>{const due=document.getElementById("campTaskDue");if(due){due.value=b.dataset.campdate;document.getElementById("campTaskName").focus();}});
  document.querySelectorAll('[data-campjump]').forEach(b=>b.onclick=()=>jumpToCampaignCreation(b.dataset.campjump,b.dataset.cgid));
  document.querySelectorAll('[data-campfocus]').forEach(b=>b.onclick=()=>{const x=document.getElementById("campEditName");if(x)x.scrollIntoView({behavior:"smooth",block:"center"});});
  document.querySelectorAll('[data-wrapdraft]').forEach(b=>b.onclick=()=>openCampaignWrapupDraft(c));
  document.querySelectorAll('[data-camphide]').forEach(b=>b.onclick=()=>toggleCampaignHidden(c));
  document.querySelectorAll('[data-campremove]').forEach(b=>b.onclick=()=>confirmRemoveFromPortfolio(c));
  document.querySelectorAll('[data-camparchive]').forEach(b=>b.onclick=()=>confirmArchiveCampaign(c));
  document.querySelectorAll('[data-campdelete]').forEach(b=>b.onclick=()=>confirmDeleteCampaign(c));
}
function jumpToCampaignCreation(tab,gid){
  switchTab(tab);
  setTimeout(()=>{
    const id=tab==="communities"?"waCampaign":"shCampaign";fillCampaignSelectById(id,gid,"Link to campaign…");
    const el=document.getElementById(id);if(el)el.value=gid;
    if(tab==="studio"){const f=document.getElementById("addShootForm");if(f)f.style.display="block";const n=document.getElementById("shName");if(n)n.focus();}
    else{const n=document.getElementById("waName");if(n)n.focus();}
  },80);
}
async function saveCampaignDetails(c){
  const btn=document.getElementById("campaignSave"),stateEl=document.getElementById("campaignSaveState");
  const name=document.getElementById("campEditName").value.trim(),start=document.getElementById("campEditStart").value||null,due=document.getElementById("campEditDue").value||null;
  const notes=document.getElementById("campEditNotes").value,owner=document.getElementById("campEditOwner").value||null;
  if(!name){toast("Campaign name required");return;}if(start&&due&&pd(start)>pd(due)){toast("The end date must be after the start date");return;}
  btn.disabled=true;btn.innerHTML='<span class="spin"></span>';
  try{
    await call("update_project",{project_id:c.gid,fields:{name,notes,start_on:start,due_on:due,owner}});
    c.name=name;c.notes=notes;c.start=start;c.due=due;c.owner=owner?{gid:owner,name:userName(owner)}:null;
    const p=cfg.projects.find(p=>p.gid===c.gid);if(p)p.name=name;const local=cfg.campaigns.find(x=>x.gid===c.gid);if(local)Object.assign(local,c);
    saveCfg();renderCampaigns();renderCalendar();toast("Campaign saved ✓");
  }catch(e){stateEl.textContent="Save failed: "+e.message;btn.disabled=false;btn.textContent="Save campaign";}
}
async function addCampaignTask(c){
  const name=document.getElementById("campTaskName").value.trim();if(!name){toast("Task name required");return;}
  const btn=document.getElementById("campTaskAdd"),task={name,project_id:c.gid};
  const due=document.getElementById("campTaskDue").value,sec=document.getElementById("campTaskPhase").value,asg=document.getElementById("campTaskAssignee").value,type=document.getElementById("campTaskType").value;
  if(due)task.due_on=due;if(sec)task.section_id=sec;if(asg)task.assignee=asg;if(type==="milestone")task.resource_subtype="milestone";
  btn.disabled=true;btn.innerHTML='<span class="spin"></span>';
  try{await call("create_tasks",{tasks:[task]});toast(type==="milestone"?"Milestone added ◆":"Campaign task added");await loadAll();}
  catch(e){toast("Failed: "+e.message);btn.disabled=false;btn.textContent="Add";}
}
async function addCampaignDecision(c){
  const decision=document.getElementById("campDecision").value.trim(),reason=document.getElementById("campDecisionWhy").value.trim(),impact=document.getElementById("campDecisionImpact").value.trim();
  if(!decision){toast("Write the decision first");return;}
  const section=await ensureCampaignSection(c.gid,"Campaign HQ");
  const notes="Decision log\nDate: "+iso(todayD())+"\nDecided by: "+((state.me&&state.me.name)||"Team")+"\nReason: "+(reason||"—")+"\nImpact: "+(impact||"—");
  const task={name:CAMPAIGN_DECISION_PREFIX+decision,project_id:c.gid,due_on:iso(todayD()),notes};if(section)task.section_id=section;
  try{await call("create_tasks",{tasks:[task]});toast("Decision logged");loadAll();}
  catch(e){toast("Failed: "+e.message);}
}
async function toggleCampaignSubtasks(parent){
  const open=!state.campaignExpanded[parent];state.campaignExpanded[parent]=open;
  if(open&&state.campaignSubtasks[parent]===undefined){state.campaignSubtasks[parent]="loading";renderCampaigns();try{const r=await call("get_subtasks",{parent});state.campaignSubtasks[parent]=r.data||[];}catch(e){state.campaignSubtasks[parent]=[];toast("Couldn't load subtasks");}}
  renderCampaigns();
}
async function addCampaignSubtask(parent){
  const nameEl=document.querySelector('[data-subname="'+parent+'"]'),dueEl=document.querySelector('[data-subdue="'+parent+'"]');const name=nameEl&&nameEl.value.trim();if(!name){toast("Subtask name required");return;}
  const data={name};if(dueEl&&dueEl.value)data.due_on=dueEl.value;
  try{await call("create_subtask",{parent,data});const r=await call("get_subtasks",{parent});state.campaignSubtasks[parent]=r.data||[];renderCampaigns();toast("Subtask added");}catch(e){toast("Failed: "+e.message);}
}
async function toggleCampaignSubtask(parent,gid){
  const arr=state.campaignSubtasks[parent]||[],sub=arr.find(x=>x.gid===gid);if(!sub)return;sub.completed=!sub.completed;renderCampaigns();
  try{await call("update_tasks",{tasks:[{task:gid,completed:sub.completed}]});}catch(e){sub.completed=!sub.completed;renderCampaigns();toast("Failed: "+e.message);}
}

/* ---------- wrap-up ---------- */
function fallbackCampaignWrapup(c){
  const tasks=campaignWorkTasks(c.gid),done=tasks.filter(t=>t.completed),open=tasks.filter(t=>!t.completed),late=open.filter(t=>t.due&&pd(t.due)<todayD()),decisions=campaignDecisionTasks(c.gid).map(t=>parseDecision(t).decision);
  return 'CAMPAIGN WRAP-UP — '+c.name+'\n\nPERIOD\n'+campaignDateLabel(c)+'\n\nWHAT SHIPPED\n'+(done.length?done.map(t=>'• '+t.name).join('\n'):'• No completed work was found in the loaded campaign history.')+'\n\nWHAT SLIPPED / REMAINS OPEN\n'+(open.length?open.map(t=>'• '+t.name+(t.due?' — '+t.due:'')).join('\n'):'• Nothing remains open.')+'\n\nKEY DECISIONS\n'+(decisions.length?decisions.map(x=>'• '+x).join('\n'):'• No decisions were logged.')+'\n\nRESULTS / BUSINESS SIGNALS\n• Add the outcome measures, learner response, operational signal or commercial result.\n\nWHAT WORKED\n• Add the strongest choices or assets worth repeating.\n\nWHAT WE WOULD CHANGE\n• '+(late.length?late.length+' item(s) were overdue at wrap-up; review timing and ownership.':'Add the most useful lesson for the next campaign.')+'\n\nFOLLOW-UPS\n'+(open.length?open.map(t=>'• '+t.name).join('\n'):'• None currently open.');
}
async function openCampaignWrapupDraft(c){
  showModal('<h2>Campaign wrap-up — '+esc(c.name)+'</h2><p class="hint">The sidekick uses the actual campaign tasks, milestones and decision log. Review everything before it is saved to Asana.</p><div id="campWrapLoading"><span class="spin"></span> drafting from campaign history…</div><div id="campWrapEditor" style="display:none"><div class="fld"><label>Editable wrap-up</label><textarea id="campWrapText" style="min-height:360px"></textarea></div><div class="drawer-actions"><button class="btn primary" id="campWrapSave">Save wrap-up to Asana</button><button class="btn ghost" data-close>Cancel</button></div></div>');
  wireModalClose();
  const tasks=campaignWorkTasks(c.gid).map(t=>({name:t.name,due:t.due,completed:t.completed,assignee:t.assignee&&t.assignee.name,milestone:t.isMilestone,source:t.projectName}));
  const decisions=campaignDecisionTasks(c.gid).map(t=>({date:t.due,...parseDecision(t)}));
  let text;
  try{
    text=await askAI("Write a concise, honest campaign wrap-up for Ocean Basket Academy. Use only the supplied facts. Include these exact headings: WHAT SHIPPED, WHAT SLIPPED / REMAINS OPEN, KEY DECISIONS, RESULTS / BUSINESS SIGNALS, WHAT WORKED, WHAT WE WOULD CHANGE, FOLLOW-UPS. Do not invent results; clearly leave a prompt where a result is missing. Keep it useful for a Friday Huddle or leadership update.",[{campaign:{name:c.name,start:c.start,due:c.due,owner:c.owner&&c.owner.name,notes:c.notes},tasks,decisions}]);
  }catch(e){text=fallbackCampaignWrapup(c);toast("AI unavailable — built a factual fallback instead");}
  document.getElementById("campWrapLoading").style.display="none";document.getElementById("campWrapEditor").style.display="block";document.getElementById("campWrapText").value=typeof text==="string"?text:fallbackCampaignWrapup(c);
  document.getElementById("campWrapSave").onclick=async()=>{
    const body=document.getElementById("campWrapText").value.trim();if(!body){toast("Wrap-up is empty");return;}
    const section=await ensureCampaignSection(c.gid,"Campaign HQ");const task={name:CAMPAIGN_WRAP_PREFIX+c.name,project_id:c.gid,due_on:iso(todayD()),notes:body};if(section)task.section_id=section;
    try{await call("create_tasks",{tasks:[task]});closeModal();confetti();toast("Wrap-up saved to the campaign");loadAll();}catch(e){toast("Failed: "+e.message);}
  };
}

/* ---------- archive / portfolio safety ---------- */
function toggleCampaignHidden(c){
  const set=hiddenCampaignSet();if(set.has(c.gid))set.delete(c.gid);else set.add(c.gid);cfg.hiddenCampaigns=[...set];
  const p=cfg.projects.find(x=>x.gid===c.gid);if(p)p.on=!set.has(c.gid)&&!c.archived;saveCfg();
  if(set.has(c.gid)){const next=campaignSource().find(x=>campaignVisible(x)&&x.gid!==c.gid);state.campaignSelected=next?next.gid:null;toast("Hidden from Command Center — Asana is untouched");}else{state.campaignSelected=c.gid;toast("Campaign restored");loadAll();}
  renderCampaigns();renderCalendar();
}
function actionConfirm(title,body,label,action,warn){
  showModal('<h2>'+esc(title)+'</h2><p class="hint">'+body+'</p><div class="drawer-actions"><button class="btn '+(warn?'warn':'primary')+'" id="campaignConfirmAction">'+esc(label)+'</button><button class="btn ghost" data-close>Cancel</button></div>');wireModalClose();document.getElementById("campaignConfirmAction").onclick=action;
}
function confirmRemoveFromPortfolio(c){
  actionConfirm("Remove from portfolio?",'The project <b>'+esc(c.name)+'</b> will remain in Asana with every task intact. It will simply stop appearing in this campaign portfolio.',"Remove from portfolio",async()=>{
    try{await call("remove_from_portfolio",{portfolio_gid:CAMPAIGN_PORTFOLIO,item:c.gid});closeModal();cfg.campaigns=cfg.campaigns.filter(x=>x.gid!==c.gid);cfg.projects=cfg.projects.filter(x=>x.gid!==c.gid);state.campaignPortfolio=state.campaignPortfolio.filter(x=>x.gid!==c.gid);state.campaignsLoaded=false;toast("Removed from portfolio — project preserved");loadAll();}catch(e){toast("Failed: "+e.message);}
  });
}
function confirmArchiveCampaign(c){
  actionConfirm("Archive Asana project?",'This makes <b>'+esc(c.name)+'</b> an archived Asana project. Its history stays available, but it leaves active work.',"Archive project",async()=>{
    try{await call("update_project",{project_id:c.gid,fields:{archived:true}});closeModal();c.archived=true;const set=hiddenCampaignSet();set.add(c.gid);cfg.hiddenCampaigns=[...set];saveCfg();toast("Campaign archived");state.campaignsLoaded=false;loadAll();}catch(e){toast("Failed: "+e.message);}
  });
}
function confirmDeleteCampaign(c){
  showModal('<h2>Permanently delete project</h2><p class="hint">This cannot be undone here. Type the exact campaign name to confirm:</p><div class="campaign-delete-name">'+esc(c.name)+'</div><div class="fld"><label>Campaign name</label><input id="campaignDeleteConfirm" autocomplete="off"></div><div class="drawer-actions"><button class="btn warn" id="campaignDeleteGo" disabled>Delete permanently</button><button class="btn ghost" data-close>Cancel</button></div>');
  wireModalClose();const inp=document.getElementById("campaignDeleteConfirm"),go=document.getElementById("campaignDeleteGo");inp.oninput=()=>{go.disabled=inp.value!==c.name;};go.onclick=async()=>{
    try{await call("delete_project",{project_id:c.gid});closeModal();cfg.campaigns=cfg.campaigns.filter(x=>x.gid!==c.gid);cfg.projects=cfg.projects.filter(x=>x.gid!==c.gid);state.campaignPortfolio=state.campaignPortfolio.filter(x=>x.gid!==c.gid);state.campaignSelected=null;saveCfg();toast("Project permanently deleted");renderCampaigns();renderCalendar();}catch(e){toast("Failed: "+e.message);}
  };
}
