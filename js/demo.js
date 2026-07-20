/* ================================================================
   DEMO MODE (?demo=1) — canned data so the dashboard can be
   previewed, demoed and designed without Asana. No writes happen.
   ================================================================ */

const DEMO_USERS = [
  {gid:"u-amy",  name:"Amy Gray",          email:"amy@oceanbasket.com"},
  {gid:"u-cait", name:"Caitlin Fourie",    email:"caitlin@oceanbasket.com"},
  {gid:"u-jess", name:"Jessica Pallister", email:"jess@oceanbasket.com"}
];

function _d(offsetDays){ const t=new Date(); t.setDate(t.getDate()+offsetDays); return iso(t); }
let _dgid=1000;
function _mk(proj, name, opts){
  opts=opts||{};
  return { gid:"demo-"+(_dgid++), name,
    notes:opts.notes||"", assignee:opts.assignee?DEMO_USERS.find(u=>u.gid===opts.assignee):null,
    due_on:opts.due||null, start_on:null, completed:!!opts.done, completed_at:opts.done?_d(-1)+"T10:00:00Z":null,
    memberships:[{section:opts.section||{gid:"s-none",name:opts.sectionName||""}}],
    permalink_url:"https://app.asana.com/demo", _proj:proj };
}
const SEC = {
  shoot:{gid:SEC_SHOOT,name:"Shoot Days"}, occ:{gid:SEC_OCC,name:"Occasions"},
  plan:{gid:SEC_PLAN,name:"Planned"},
  day:{gid:PB.day,name:"Day to Day"}, notes:{gid:PB.notes,name:"Notes"}, passion:{gid:PB.passion,name:"Passion Projects"},
  mgmt:{gid:"s-mgmt",name:"Management"}, foh1:{gid:"s-foh1",name:"Front of House 1"},
  foh2:{gid:"s-foh2",name:"Front of House 2"}, boh:{gid:"s-boh",name:"Back of House"}, sushi:{gid:"s-sushi",name:"Sushi"}
};

const DEMO_CAMPAIGN_SECTIONS = {
  pre:{gid:"dc-pre",name:"Pre-launch"}, launch:{gid:"dc-launch",name:"Launch week"},
  market:{gid:"dc-market",name:"In market"}, wrap:{gid:"dc-wrap",name:"Wrap-up"}
};
const DEMO_CAMPAIGNS = [
  {gid:"demo-camp-summer",name:"Summer Menu 2026",start_on:_d(-12),due_on:_d(34),color:"dark-teal",notes:"Launch confidence across FOH, BOH and Sushi. Keep every asset practical, mobile-first and focused on what changed.",permalink_url:"https://app.asana.com/demo/summer"},
  {gid:"demo-camp-peak",name:"Peak Readiness 2026",start_on:_d(55),due_on:_d(118),color:"dark-blue",notes:"Build December readiness through coaching, pace, consistency and zero-error service.",permalink_url:"https://app.asana.com/demo/peak"}
];
const DEMO_PROJECTS = Object.fromEntries(DEMO_CAMPAIGNS.map(c=>[c.gid,{...c,sections:Object.values(DEMO_CAMPAIGN_SECTIONS)}]));
const DEMO_SUBTASKS = {};

const DEMO_TASKS = [
  // ---- Content & Comms: shoots ----
  _mk(CC_PROJECT,"Shoot Day 14 – Summer Menu heroes",{section:SEC.shoot,due:_d(6),assignee:"u-amy",
    notes:"18 videos: 8 reworked sushi dishes + drinks + comms video. Nasreen only free at 1pm."}),
  _mk(CC_PROJECT,"Shoot Day 15 – Upselling scenarios FOH",{section:SEC.shoot,due:_d(24),assignee:"u-jess",
    notes:"Roleplay clips for the upselling course. Need 2 waiters + manager."}),
  _mk(CC_PROJECT,"Shoot Day 13 – Winter wrap-up",{section:SEC.shoot,due:_d(-9),done:true}),
  // planned content
  _mk(CC_PROJECT,"Edit brief: Mojito + Lemon & Mint Cooler clips",{section:SEC.plan,due:_d(2),assignee:"u-amy"}),
  _mk(CC_PROJECT,"Storyboard: Golden Crunch California Roll pop-ups",{section:SEC.plan,due:_d(4),assignee:"u-jess"}),
  _mk(CC_PROJECT,"Manager Masterclass: coaching the new menu",{section:SEC.plan,due:_d(13),assignee:"u-jess"}),
  _mk(CC_PROJECT,"Q3 Franchisee Forum voxpops edit",{section:SEC.plan,due:_d(-2),assignee:"u-amy"}),
  // occasions kept in Asana
  _mk(CC_PROJECT,"Nelson Mandela Day activation",{section:SEC.occ,due:_d(1)}),
  // ---- Team Scheduling ----
  _mk("1213797897707123","Trainer visits: Gauteng cluster",{due:_d(3),assignee:"u-cait"}),
  _mk("1213797897707123","Coach check-in: Cyprus stores",{due:_d(9),assignee:"u-jess"}),
  // ---- Menu Training ----
  _mk("1214196027560535","Summer Menu FOH course — final QA",{due:_d(5),assignee:"u-amy"}),
  _mk("1214196027560535","Allergen flashcards refresh",{due:_d(8),assignee:"u-cait"}),
  _mk("1214196027560535","Sushi course: chopstick plating reshoots list",{due:_d(15),assignee:"u-jess"}),
  _mk("1214196027560535","Wrong-answer analysis: menu quiz",{due:_d(-1),assignee:"u-amy"}),
  // ---- Revamp ----
  _mk(REVAMP_PROJECT,"Menlyn Park — new store",{due:_d(12)}),
  _mk(REVAMP_PROJECT,"Ballito Junction — new store",{due:_d(27)}),
  // ---- Day to Day ----
  _mk(PB.proj,"Chase LMS provider re: completion bug",{section:SEC.day,due:_d(0),assignee:"u-cait"}),
  _mk(PB.proj,"Send OB Fit July report to EXCO",{section:SEC.day,due:_d(0),assignee:"u-jess"}),
  _mk(PB.proj,"Upload new recipes from culinary email",{section:SEC.day,due:_d(1),assignee:"u-amy"}),
  _mk(PB.proj,"Book studio lights for Shoot Day 14",{section:SEC.day,due:_d(2),assignee:"u-amy"}),
  _mk(PB.proj,"Fix duplicate learner records (Max)",{section:SEC.day,due:_d(7),assignee:"u-jess"}),
  _mk(PB.proj,"Speaker bio photos shortlist",{section:SEC.day,due:_d(16),assignee:"u-jess"}),
  _mk(PB.proj,"Order teleprompter stand",{section:SEC.day,assignee:"u-amy"}),
  // notes & passions
  _mk(PB.proj,"Idea: NFC tap-in for practical sign-offs",{section:SEC.notes,assignee:"u-amy"}),
  _mk(PB.proj,"Masterclass series on coaching",{section:SEC.passion,assignee:"u-jess"}),
  _mk(PB.proj,"Academy meme library 👀",{section:SEC.passion,assignee:"u-cait"}),
  // an approved content idea, living under its shoot
  _mk(CC_PROJECT,"Golden Crunch 'guess what changed' teaser",{section:SEC.plan,due:_d(6),
    notes:"Content idea for Shoot Day 14 – Summer Menu heroes\nParked by Amy, approved "+_d(-1)}),
  // Skills Boosters — ship one to a community from the Curriculum tab
  _mk(CC_PROJECT,"Skills Booster: Sauce ladle sizes — the 15ml rule",{section:SEC.plan,due:_d(9),notes:"From the wrong-answer digest"}),
  _mk(CC_PROJECT,"Skills Booster: Reworked sushi — what changed in 60 seconds",{section:SEC.plan,due:_d(12)}),
  // shot list + brief library samples
  _mk(CC_PROJECT,"「shot」 Golden Crunch Prawn California Roll — plating — Shoot Day 14 – Summer Menu heroes",{section:SEC.plan,due:_d(6),notes:"type: video\npop-up: New winter menu meal — refer to recipe"}),
  _mk(CC_PROJECT,"「shot」 Mojito + Lemon & Mint Cooler build — Shoot Day 14 – Summer Menu heroes",{section:SEC.plan,due:_d(6),notes:"type: video"}),
  _mk(CC_PROJECT,"「shot」 Nasreen comms video (13:00 sharp) — Shoot Day 14 – Summer Menu heroes",{section:SEC.plan,due:_d(6),notes:"type: comms video\nteleprompter script approved — do not change"}),
  _mk(CC_PROJECT,"「brief」 Shoot Day 15 – Upselling scenarios FOH",{section:SEC.plan,due:_d(24),
    notes:"status: sent to Content Go\ndrafted: "+_d(-2)+"\n\nOCEAN BASKET ACADEMY — VIDEO BRIEF\nShoot: Shoot Day 15 – Upselling scenarios FOH\n\n1. THE BIG PICTURE\n• Roleplay clips for the upselling course…"}),
  // ---- Campaign portfolio projects ----
  _mk("demo-camp-summer","Manager launch pack — what changed and how to coach it",{section:DEMO_CAMPAIGN_SECTIONS.pre,due:_d(-3),assignee:"u-jess"}),
  _mk("demo-camp-summer","Summer Menu courses live + assigned",{section:DEMO_CAMPAIGN_SECTIONS.launch,due:_d(2),assignee:"u-amy"}),
  _mk("demo-camp-summer","FOH confidence pulse",{section:DEMO_CAMPAIGN_SECTIONS.market,due:_d(12),assignee:"u-cait"}),
  _mk("demo-camp-summer","Wrong-answer check — Skills Booster if needed",{section:DEMO_CAMPAIGN_SECTIONS.market,due:_d(18),assignee:"u-amy"}),
  _mk("demo-camp-summer","Campaign results snapshot",{section:DEMO_CAMPAIGN_SECTIONS.wrap,due:_d(36),assignee:"u-jess"}),
  _mk("demo-camp-peak","Peak playbook scope",{section:DEMO_CAMPAIGN_SECTIONS.pre,due:_d(62),assignee:"u-amy"}),
  _mk("demo-camp-peak","Book peak coaching masterclass",{section:DEMO_CAMPAIGN_SECTIONS.pre,due:_d(70),assignee:"u-jess"}),
  // ---- WhatsApp Academy: the software board ----
  _mk(WA_PROJECT,"Learners in Cyprus can't open module 3 videos",{due:_d(-11),assignee:"u-jess"}),
  _mk(WA_PROJECT,"Completion data not syncing for two stores",{due:_d(-4),assignee:"u-jess"}),
  _mk(WA_PROJECT,"Request: add Bar/Deli role to menu navigation",{due:_d(3)}),
  // ---- X Force bugs board ----
  _mk(BUGS_PROJECT,"Quiz score shows 0% when learner passes on retry",{due:_d(-18)}),
  _mk(BUGS_PROJECT,"Certificates render with wrong store name",{due:_d(-6)}),
  _mk(BUGS_PROJECT,"Menu button unresponsive on older Androids",{due:_d(-2)}),
  // ---- trainer visits board ----
  _mk(VISITS_PROJECT,"Menlyn Park — opening training",{due:_d(9),assignee:"u-cait",notes:"trainer: Cameron"}),
  _mk(VISITS_PROJECT,"Gateway — follow-up visit",{due:_d(4),notes:"trainer: Charlotte"}),
  _mk(VISITS_PROJECT,"Canal Walk — assessment visit",{due:_d(16),notes:"trainer: Norman"}),
  _mk(VISITS_PROJECT,"Zambezi — training visit",{due:_d(-40),done:true,notes:"trainer: Given"}),
  _mk(VISITS_PROJECT,"Eastgate — training visit",{due:_d(-300),done:true,notes:"trainer: Mandla"}),
  _mk(VISITS_PROJECT,"Sea Point — training visit",{due:_d(-260),done:true,notes:"trainer: Tebogo"}),
  // ---- community messages (the new board) ----
  _mk("demo-msg","Menu quiz Friday: win a spot prize 🏆",{section:SEC.foh1,due:_d(1),notes:"#purpose:course"}),
  _mk("demo-msg","Menu quiz Friday: win a spot prize 🏆",{section:SEC.foh2,due:_d(1),notes:"#purpose:course"}),
  _mk("demo-msg","Reminder: Summer Menu course closes Sunday",{section:SEC.mgmt,due:_d(2),notes:"#purpose:reminder"}),
  _mk("demo-msg","Voice note: perfect plating in 40 seconds",{section:SEC.sushi,due:_d(3),notes:"#purpose:practice"}),
  _mk("demo-msg","Shout-out: Zambezi crew smashed the incentive 🎉",{section:SEC.foh1,due:_d(0),notes:"#purpose:celebrate"}),
  _mk("demo-msg","Poll: which station needs the next Skills Booster?",{section:SEC.boh,due:_d(4),notes:"#purpose:question"}),
  _mk("demo-msg","Sauce ladle compliance — 3 common mistakes",{section:SEC.boh,due:_d(6),notes:"#purpose:practice"}),
  _mk("demo-msg","Masterclass invite: coaching the new menu",{section:SEC.mgmt,due:_d(8),notes:"#purpose:info"}),
  _mk("demo-msg","Winter menu recap sent ✓",{section:SEC.foh1,due:_d(-3),done:true,notes:"#purpose:info"}),
  _mk("demo-msg","Quiz teaser",{section:SEC.foh1,due:_d(5),notes:"#purpose:course"}),
  _mk("demo-msg","Quiz round 1",{section:SEC.foh1,due:_d(5),notes:"#purpose:course"}),
  _mk("demo-msg","Quiz round 2",{section:SEC.foh1,due:_d(5),notes:"#purpose:course"}),
  _mk("demo-msg","Quiz winners announcement",{section:SEC.foh1,due:_d(5),notes:"#purpose:celebrate"}),
  // ---- Amy's PR pipeline ----
  _mk("demo-pr","Pitch: CLO magazine — WhatsApp-first frontline learning",{section:{gid:"pr-1",name:"Pitched"}}),
  _mk("demo-pr","Jess speaker one-pager + photos",{section:{gid:"pr-2",name:"In progress"}}),
  _mk("demo-pr","HR Indaba CFP — From Courses to Capability",{section:{gid:"pr-0",name:"Idea"}}),
  _mk("demo-pr","L&D podcast guest spot (delivered June)",{section:{gid:"pr-3",name:"Delivered"}})
];

// Curriculum board
const DEMO_CURRICULUM = MO.map((m,i)=>{
  const c=CURRICULUM_DEFAULT[i];
  return { gid:"demo-cur-"+i, name:m+": "+c.t, notes:c.d, memberships:[{section:null}] };
});

async function demoCall(tool,args){
  await new Promise(r=>setTimeout(r,120)); // let the spinners breathe
  switch(tool){
    case "save_dashboard_state": return {data:{gid:args.task_id||"demo-keeper"}};
    case "find_project_by_name": return {data:{gid:"demo-pr",name:"PR & Positioning",permalink_url:"https://app.asana.com/demo/pr"}};
    case "ensure_shared_project_access": return {data:{gid:"demo-membership",member:{gid:args.team_id}}};
    case "ensure_shared_sections": return {data:[["pr-0","Idea"],["pr-1","Pitched"],["pr-2","In progress"],["pr-3","Delivered"]].map(([gid,name])=>({gid,name}))};
    case "get_users": return {data:DEMO_USERS};
    case "get_tasks":
      if(args.project===CURRICULUM_PROJECT) return {data:DEMO_CURRICULUM};
      return {data:DEMO_TASKS.filter(t=>t._proj===args.project).map(t=>({...t}))};
    case "get_project": {
      if(args.project_id==="demo-pr") return {data:{name:"PR & Positioning",sections:[["pr-0","Idea"],["pr-1","Pitched"],["pr-2","In progress"],["pr-3","Delivered"]].map(([g,n])=>({gid:g,name:n}))}};
      if(DEMO_PROJECTS[args.project_id]) return {data:{...DEMO_PROJECTS[args.project_id],sections:DEMO_PROJECTS[args.project_id].sections.map(x=>({...x}))}};
      return {data:{name:"Demo board",sections:[SEC.mgmt,SEC.foh1,SEC.foh2,SEC.boh,SEC.sushi].map(s=>({gid:s.gid,name:s.name}))}};
    }
    case "get_my_tasks": {
      const mt=DEMO_MYTASKS[args.person]||[];
      if(args.completed_since) return {data:DEMO_DONE[args.person]||[]};
      return {data:mt};
    }
    case "get_task": {
      const t=DEMO_TASKS.find(x=>x.gid===args.task_id)||{};
      return {data:{notes:t.notes||"",comments:[{text:"Looks great — let's lock it in 🎬",created_at:new Date().toISOString(),created_by:{name:"Jessica Pallister"}}]}};
    }
    case "update_shared_tasks":
    case "update_tasks": {
      (args.tasks||[]).forEach(u=>{ let t=DEMO_TASKS.find(x=>x.gid===u.task);
        if(!t){ for(const arr of Object.values(DEMO_SUBTASKS)){ t=arr.find(x=>x.gid===u.task); if(t)break; } }
        if(!t) return;
        if("completed" in u) t.completed=u.completed;
        if("due_on" in u) t.due_on=u.due_on;
        if("notes" in u) t.notes=u.notes;
        if("name" in u) t.name=u.name;
        if("assignee" in u) t.assignee=u.assignee?DEMO_USERS.find(x=>x.gid===u.assignee)||null:null;
      });
      return {data:(args.tasks||[]).map(t=>({gid:t.task}))};
    }
    case "create_shared_tasks":
    case "create_tasks": {
      const made=(args.tasks||[]).map(t=>{
        const allSections=[...Object.values(SEC),...Object.values(DEMO_PROJECTS).flatMap(p=>p.sections||[])];
        const nt=_mk(t.project_id||CC_PROJECT,t.name,{due:t.due_on,notes:t.notes,assignee:t.assignee,
          section: t.section_id ? allSections.find(s=>s.gid===t.section_id) : null});
        DEMO_TASKS.push(nt); return {gid:nt.gid,name:nt.name};
      });
      return {data:made};
    }
    case "delete_task": {
      const i=DEMO_TASKS.findIndex(x=>x.gid===args.task); if(i>=0) DEMO_TASKS.splice(i,1);
      return {data:{}};
    }
    case "create_section": return {data:{gid:"s-new-"+Date.now(),name:args.name}};
    case "create_shared_project":
    case "create_project": {
      const gid="demo-proj-"+Date.now();
      const made=(args.sections||[]).map((sc,i)=>({gid:gid+"-s"+i,name:sc.sectionName}));
      DEMO_PROJECTS[gid]={gid,name:args.name,start_on:args.start_on||null,due_on:args.due_on||null,color:args.color||"dark-teal",notes:args.notes||"",permalink_url:"https://app.asana.com/demo/"+gid,sections:made};
      return {data:{gid,name:args.name,sections_created:{succeeded:made}}};
    }
    case "get_portfolio_items": return {data:DEMO_CAMPAIGNS.map(c=>({...c}))};
    case "add_to_portfolio": {
      const proj=DEMO_PROJECTS[args.item];
      if(proj&&!DEMO_CAMPAIGNS.some(c=>c.gid===proj.gid)) DEMO_CAMPAIGNS.push({...proj});
      return {data:{}};
    }
    case "update_project": {
      const proj=DEMO_PROJECTS[args.project_id];
      if(proj){ Object.assign(proj,args.fields||{}); const c=DEMO_CAMPAIGNS.find(x=>x.gid===proj.gid); if(c)Object.assign(c,args.fields||{}); }
      return {data:proj||{}};
    }
    case "get_subtasks": return {data:(DEMO_SUBTASKS[args.parent]||[]).map(x=>({...x}))};
    case "create_subtask": {
      const st={gid:"demo-sub-"+(_dgid++),name:(args.data&&args.data.name)||"Subtask",completed:false,due_on:(args.data&&args.data.due_on)||null,assignee:null};
      (DEMO_SUBTASKS[args.parent]=DEMO_SUBTASKS[args.parent]||[]).push(st); return {data:st};
    }
    case "add_comment": return {data:{}};
    default: return {data:[]};
  }
}
async function demoAI(prompt){
  await new Promise(r=>setTimeout(r,700));
  if(/morning brief|ops sidekick/i.test(prompt))
    return "**The headline:** Shoot Day 14 is in 6 days and the brief isn't out yet — that's the one to move today. 🎬\n\nToday: 2 due (LMS chase, OB Fit report) and 1 shout-out going to FOH 1.\n\nThe week ahead:\n• Edit brief for drink clips — Wed\n• Storyboard California Roll pop-ups — Fri\n• Summer Menu FOH QA — Mon\n• Trainer visits Gauteng — Thu\n\nNudge: the Franchisee Forum voxpops edit slipped 2 days — quick win to clear it 🫡";
  if(/video-production briefs/i.test(prompt))
    return BRIEF_TEMPLATE.replace("{{SHOOT_NAME}}","Shoot Day 14 – Summer Menu heroes").replace("{{SHOOT_DATE}}",_d(6)).replace("{{PROJECT}}","SummerMenu2026")
      .replace("• What are we making? —","• What are we making? — 18 training videos: 8 reworked sushi dishes, 2 drinks, 1 comms video (Nasreen)")
      .replace("• The goal —","• The goal — crew can plate every reworked dish correctly before the Summer Menu goes live")
      .replace("• Draft due —","• Draft due — 7 days after shoot")
      .replace("• Running order & any hard time windows (presenters with limited time!) —","• Running order — Nasreen films at 13:00 SHARP (limited window); sushi dishes before lunch service");
  if(/wrong-answer|assessment data/i.test(prompt))
    return "TOP WRONG ANSWERS\n• Chilli salt still selected for the Tempura Prawn Roll — 41% picked the old recipe (change not landed)\n• Sauce ladle size on Panko Futomaki — 33% chose 30ml instead of 15ml\n• Cucumber vs zucchini swap — 28% still answer zucchini\n\nPATTERN\nAll three misses are recipe *changes*, not new dishes — crew learned the original and the delta didn't stick. Reinforce what changed, not the whole recipe.\n\nBOOSTER: Reworked sushi — what changed in 60 seconds\nBOOSTER: Sauce ladle sizes — the 15ml rule\nBOOSTER: Flashcard round: old ingredient vs new";
  if(/WhatsApp community activity/i.test(prompt))
    return "TL;DR: Lively week in this community — the menu quiz drove the most replies, and three crew members asked the same question about the new futomaki prep.\n\nThemes:\n• Confusion: cucumber vs zucchini swap (asked 3×)\n• High energy on the quiz + prize\n• Two stores asked for the plating video link again\n\nNeeds action:\n• Post a pinned answer on the futomaki swap\n• Re-share the plating video link\n\nVibe: engaged and upbeat 🔥";
  return "• Film a 40-second 'perfect plate' hero clip for each reworked dish, pop-up text on every swapped ingredient\n• Upselling side-by-side: same table, two takes — scripted vs natural, crew vote on which lands\n• 15-second teaser for WhatsApp: 'guess what changed on this plate' with Friday reveal";
}


/* ---- demo My Tasks (per girl) ---- */
function _mt(name,due,project){ return {gid:"mt-"+(_dgid++),name,due_on:due||null,completed:false,notes:"",permalink_url:"https://app.asana.com/demo",projects:[{name:project||"Content & Comms"}]}; }
const DEMO_MYTASKS={
  amy:[
    _mt("Edit brief: Mojito + Lemon & Mint Cooler clips",_d(2)),
    _mt("Send OB Fit July report to EXCO",_d(0),"Day to Day"),
    _mt("Upload new recipes from culinary email",_d(1),"Day to Day"),
    _mt("Book studio lights for Shoot Day 14",_d(2),"Day to Day"),
    _mt("Speaker website wireframe",_d(9),"PR"),
    _mt("Placeholder: quarterly planning doc",null,"Day to Day"),
    _mt("Order teleprompter stand",null,"Day to Day")
  ],
  caitlin:[
    _mt("Chase X Force re: completion bug",_d(0),"WhatsApp Academy"),
    _mt("Queue next week's community messages",_d(1),"Community Messages"),
    _mt("Allergen flashcards refresh",_d(8),"Menu Training"),
    _mt("Summer Menu: FOH confidence pulse",_d(12),"Summer Menu 2026")
  ],
  jess:[
    _mt("Storyboard: Golden Crunch pop-ups",_d(3)),
    _mt("Approve trainer schedule for Menlyn opening",_d(4),"Store Visits"),
    _mt("Manager Masterclass: coaching the new menu",_d(13)),
    _mt("Fix duplicate learner records (Max)",_d(7),"Day to Day"),
    _mt("Sushi course: chopstick plating reshoots",_d(15),"Menu Training")
  ]
};
function _dn(name,daysAgo){ const d=new Date(); d.setDate(d.getDate()-daysAgo); return {gid:"dn-"+(_dgid++),name,completed:true,completed_at:d.toISOString()}; }
const DEMO_DONE={
  amy:[_dn("Winter Menu FOH course shipped",8),_dn("Q2 EXCO report delivered",35),_dn("Shoot Day 13 wrapped & delivered",9),_dn("OB Rewards launch comms",70)],
  caitlin:[_dn("June community calendar executed",12),_dn("Menu quiz series (4 weeks)",20),_dn("X Force certificate bug chased to fix",28)],
  jess:[_dn("Winter Menu sushi courses QA'd",11),_dn("Trainer onboarding pack",45),_dn("Max data health pass",18)]
};

function demoPitch(){
  return {picks:[
    {outlet:"Chief Learning Officer",type:"publication",url:"https://example.com/clo",angle:"How a 3-person team trains 2,000 frontline workers through WhatsApp",why:"Runs frontline-learning features monthly"},
    {outlet:"The Learning & Development Podcast",type:"podcast",url:"https://example.com/ldpod",angle:"From Courses to Capability — Jess on deskless learning that reaches the floor",why:"Host actively booking S2 guests"},
    {outlet:"HR Future (SA)",type:"publication",url:"https://example.com/hrfuture",angle:"December-readiness: how OB makes crew peak-fit",why:"SA audience, loves franchise stories"},
    {outlet:"ATD International Conference CFP",type:"conference",url:"https://example.com/atd",angle:"WhatsApp as an LMS: inclusive learning for multilingual crews",why:"CFP closes next month"}
  ]};
}
