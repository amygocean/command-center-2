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

const DEMO_TASKS = [
  // ---- Content & Comms: shoots ----
  _mk(CC_PROJECT,"Shoot Day 14 – Summer Menu heroes",{section:SEC.shoot,due:_d(6),assignee:"u-amy",
    notes:"18 videos: 8 reworked sushi dishes + drinks + comms video. Nasreen only free at 1pm."}),
  _mk(CC_PROJECT,"Shoot Day 15 – Upselling scenarios FOH",{section:SEC.shoot,due:_d(24),assignee:"u-jess",
    notes:"Roleplay clips for the upselling course. Need 2 waiters + manager."}),
  _mk(CC_PROJECT,"Shoot Day 13 – Winter wrap-up",{section:SEC.shoot,due:_d(-9),done:true}),
  // prep kit for shoot 15 (partially done)
  _mk(CC_PROJECT,"「prep」 Lock the shot list — what are we actually filming? — Shoot Day 15 – Upselling scenarios FOH",{section:SEC.plan,due:_d(10),assignee:"u-amy",done:true}),
  _mk(CC_PROJECT,"「prep」 Confirm recipes / source material received & verified — Shoot Day 15 – Upselling scenarios FOH",{section:SEC.plan,due:_d(12),assignee:"u-jess"}),
  _mk(CC_PROJECT,"「prep」 Draft the supplier brief (✨ Studio can help) — Shoot Day 15 – Upselling scenarios FOH",{section:SEC.plan,due:_d(14),assignee:"u-amy"}),
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
  _mk(REVAMP_PROJECT,"Store revamp: Menlyn reopening pack",{due:_d(11)}),
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
  // shot list + brief library samples
  _mk(CC_PROJECT,"「shot」 Golden Crunch Prawn California Roll — plating — Shoot Day 14 – Summer Menu heroes",{section:SEC.plan,due:_d(6),notes:"type: video\npop-up: New winter menu meal — refer to recipe"}),
  _mk(CC_PROJECT,"「shot」 Mojito + Lemon & Mint Cooler build — Shoot Day 14 – Summer Menu heroes",{section:SEC.plan,due:_d(6),notes:"type: video"}),
  _mk(CC_PROJECT,"「shot」 Nasreen comms video (13:00 sharp) — Shoot Day 14 – Summer Menu heroes",{section:SEC.plan,due:_d(6),notes:"type: comms video\nteleprompter script approved — do not change"}),
  _mk(CC_PROJECT,"「brief」 Shoot Day 15 – Upselling scenarios FOH",{section:SEC.plan,due:_d(24),
    notes:"status: sent to Content Go\ndrafted: "+_d(-2)+"\n\nOCEAN BASKET ACADEMY — VIDEO BRIEF\nShoot: Shoot Day 15 – Upselling scenarios FOH\n\n1. THE BIG PICTURE\n• Roleplay clips for the upselling course…"}),
  // ---- Volume Drivers campaign board ----
  _mk("1216638197844781","Volume Drivers: upsell scripts v2",{due:_d(19),assignee:"u-cait"}),
  _mk("1216638197844781","Volume Drivers: leaderboard mechanics",{due:_d(26),assignee:"u-amy"}),
  // ---- WhatsApp communities ----
  _mk(WA_PROJECT,"Menu quiz Friday: win a spot prize 🏆",{section:SEC.foh1,due:_d(1),notes:"#purpose:course"}),
  _mk(WA_PROJECT,"Menu quiz Friday: win a spot prize 🏆",{section:SEC.foh2,due:_d(1),notes:"#purpose:course"}),
  _mk(WA_PROJECT,"Reminder: Summer Menu course closes Sunday",{section:SEC.mgmt,due:_d(2),notes:"#purpose:reminder"}),
  _mk(WA_PROJECT,"Voice note: perfect plating in 40 seconds",{section:SEC.sushi,due:_d(3),notes:"#purpose:practice"}),
  _mk(WA_PROJECT,"Shout-out: Zambezi crew smashed the incentive 🎉",{section:SEC.foh1,due:_d(0),notes:"#purpose:celebrate"}),
  _mk(WA_PROJECT,"Poll: which station needs the next Skills Booster?",{section:SEC.boh,due:_d(4),notes:"#purpose:question"}),
  _mk(WA_PROJECT,"Sauce ladle compliance — 3 common mistakes",{section:SEC.boh,due:_d(6),notes:"#purpose:practice"}),
  _mk(WA_PROJECT,"Masterclass invite: coaching the new menu",{section:SEC.mgmt,due:_d(8),notes:"#purpose:info"}),
  _mk(WA_PROJECT,"Winter menu recap sent ✓",{section:SEC.foh1,due:_d(-3),done:true,notes:"#purpose:info"}),
  _mk(WA_PROJECT,"OB Fit check-in voice note",{section:SEC.sushi,due:_d(-1),done:true,notes:"#purpose:practice"}),
  // deliberately busy day to show the 🔥 flag
  _mk(WA_PROJECT,"Quiz teaser",{section:SEC.foh1,due:_d(5),notes:"#purpose:course"}),
  _mk(WA_PROJECT,"Quiz round 1",{section:SEC.foh1,due:_d(5),notes:"#purpose:course"}),
  _mk(WA_PROJECT,"Quiz round 2",{section:SEC.foh1,due:_d(5),notes:"#purpose:course"}),
  _mk(WA_PROJECT,"Quiz winners announcement",{section:SEC.foh1,due:_d(5),notes:"#purpose:celebrate"})
];

// Curriculum board
const DEMO_CURRICULUM = MO.map((m,i)=>{
  const c=CURRICULUM_DEFAULT[i];
  return { gid:"demo-cur-"+i, name:m+": "+c.t, notes:c.d, memberships:[{section:null}] };
});

async function demoCall(tool,args){
  await new Promise(r=>setTimeout(r,120)); // let the spinners breathe
  switch(tool){
    case "get_users": return {data:DEMO_USERS};
    case "get_tasks":
      if(args.project===CURRICULUM_PROJECT) return {data:DEMO_CURRICULUM};
      return {data:DEMO_TASKS.filter(t=>t._proj===args.project).map(t=>({...t}))};
    case "get_project": return {data:{name:"Demo board",sections:[SEC.mgmt,SEC.foh1,SEC.foh2,SEC.boh,SEC.sushi].map(s=>({gid:s.gid,name:s.name}))}};
    case "get_task": {
      const t=DEMO_TASKS.find(x=>x.gid===args.task_id)||{};
      return {data:{notes:t.notes||"",comments:[{text:"Looks great — let's lock it in 🎬",created_at:new Date().toISOString(),created_by:{name:"Jessica Pallister"}}]}};
    }
    case "update_tasks": {
      (args.tasks||[]).forEach(u=>{ const t=DEMO_TASKS.find(x=>x.gid===u.task); if(!t) return;
        if("completed" in u) t.completed=u.completed;
        if("due_on" in u) t.due_on=u.due_on;
        if("notes" in u) t.notes=u.notes;
        if("name" in u) t.name=u.name;
        if("assignee" in u) t.assignee=u.assignee?DEMO_USERS.find(x=>x.gid===u.assignee)||null:null;
      });
      return {data:(args.tasks||[]).map(t=>({gid:t.task}))};
    }
    case "create_tasks": {
      const made=(args.tasks||[]).map(t=>{
        const nt=_mk(t.project_id||CC_PROJECT,t.name,{due:t.due_on,notes:t.notes,assignee:t.assignee,
          section: t.section_id ? Object.values(SEC).find(s=>s.gid===t.section_id) : null});
        DEMO_TASKS.push(nt); return {gid:nt.gid,name:nt.name};
      });
      return {data:made};
    }
    case "delete_task": {
      const i=DEMO_TASKS.findIndex(x=>x.gid===args.task); if(i>=0) DEMO_TASKS.splice(i,1);
      return {data:{}};
    }
    case "create_section": return {data:{gid:"s-new-"+Date.now(),name:args.name}};
    case "create_project": return {data:{gid:"demo-proj-"+Date.now(),name:args.name}};
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
