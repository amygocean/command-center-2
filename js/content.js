/* ================================================================
   STUDIO — shoot days, shot lists, AI ideas, supplier brief drafting
   ================================================================ */

function occasionsNear(date,win){
  const asana = state.tasks.filter(t=>t.isOccasion&&t.due).map(t=>({name:t.name,d:pd(t.due)}));
  const app = OCCASIONS_APP.map(o=>({name:o.name,d:pd(o.date)}));
  return [...asana,...app].filter(o=>Math.abs((o.d-date)/864e5)<=win).sort((a,b)=>a.d-b.d);
}

let studioAll=false;   // false = only the next upcoming shoot; true = every future and past shoot
function shootMeta(s){
  const loc=(s.notes||"").match(/(?:^|\n)📍\s*(.+)/);
  const tm=(s.notes||"").match(/(?:^|\n)🕐\s*(.+)/);
  return {loc:loc?loc[1].trim():"", time:tm?tm[1].trim():""};
}
function shootNotesClean(s){
  return (s.notes||"").replace(/(?:^|\n)📍\s*.+/g,"").replace(/(?:^|\n)🕐\s*.+/g,"").trim();
}

function renderStudio(){
  const box=document.getElementById("shootList"); if(!box){ return; }
  const today=todayD();
  const allShoots=state.tasks.filter(t=>t.isShoot && t.due).sort((a,b)=>a.due<b.due?-1:1);
  const upcoming=allShoots.filter(t=>pd(t.due)>=today);
  const past=allShoots.filter(t=>pd(t.due)<today).sort((a,b)=>a.due<b.due?1:-1); // most recent past first
  if(!allShoots.length){
    box.innerHTML='<div class="empty">No shoot days on the radar. Hit <b>+ Add shoot</b> and let\'s roll 🎬</div>';
    renderShootTodos(); renderBriefs(); wireStudioAdd(); return;
  }
  const collapsedCount=upcoming.length?1:0;
  const shown=studioAll?[...upcoming,...past]:upcoming.slice(0,1);
  const hiddenCount=studioAll?0:Math.max(0,upcoming.length-1)+past.length;
  let html=!studioAll&&!upcoming.length?'<div class="empty">No upcoming shoot days. Choose <b>Show more</b> to see previous shoots.</div>':"";
  shown.forEach((s,i)=>{
    const d=pd(s.due), days=daysTo(s.due), isPast=days<0;
    const when=isPast?"":days===0?"today":days===1?"tomorrow!":"in "+days+" days";
    const near=occasionsNear(d,14).slice(0,3).map(o=>esc(o.name)).join(", ");
    const meta=shootMeta(s), notes=shootNotesClean(s);
    const metaLine=(meta.time||meta.loc)?'<div class="sc-meta">'+(meta.time?'🕐 '+esc(meta.time):'')+(meta.time&&meta.loc?' · ':'')+(meta.loc?'📍 '+esc(meta.loc):'')+'</div>':'';
    html+='<div class="scard'+(isPast?" past":"")+'" style="animation-delay:'+(i*50)+'ms">'+
      '<div class="sc-date"><span class="sc-dd">'+d.getDate()+'</span><span class="sc-mo">'+MO[d.getMonth()].slice(0,3)+'</span></div>'+
      '<div class="sc-main"><div class="sc-name">🎬 '+esc(s.name)+' <span class="sc-when">'+when+'</span>'+(s.completed?' <span class="sc-done">wrapped ✓</span>':'')+'</div>'+
      metaLine+
      (notes?'<div class="sc-notes">'+esc(notes.slice(0,220))+'</div>':'')+
      (near?'<div class="sc-occ">Around this date: '+near+'</div>':'<div class="sc-occ dimtxt">No occasions nearby</div>')+
      (isPast?'':brainstormHTML(s))+
      plannedHTML(s)+
      '<div class="sc-ideas" id="ideas-'+s.gid+'"></div></div>'+
      '<div class="sc-actions"><button class="btn ghost sm sc-open" data-gid="'+s.gid+'">Open</button>'+
      (isPast?'':'<button class="btn ghost sm sc-shots" data-gid="'+s.gid+'">Shot list'+(shotsFor(s).length?' ('+shotsFor(s).length+')':'')+'</button>'+
             (recipesForShoot(s).recipes.length?'<button class="btn teal sm sc-recipeshots" data-gid="'+s.gid+'" title="Create one shot per recipe on the linked campaign">✨ Shots from recipes</button>':'')+
             '<button class="btn ghost sm sc-run" data-gid="'+s.gid+'">Run sheet</button>'+
             '<button class="btn teal sm sc-sugg" data-gid="'+s.gid+'">✨ Ideas</button>'+
             '<button class="btn ghost sm sc-drop" data-gid="'+s.gid+'" title="Draft a WhatsApp message announcing this content">Queue drop</button>'+
             '<button class="btn primary sm sc-brief" data-gid="'+s.gid+'">'+(briefTaskFor(s)?"Open brief":"Draft brief")+'</button>')+'</div>'+
    '</div>';
  });
  html += studioAll
    ? (allShoots.length>collapsedCount?'<button class="btn ghost sm view-more" id="studioLess">Show only the next shoot</button>':'')
    : (hiddenCount>0?'<button class="btn ghost sm view-more" id="studioMore">View more ('+hiddenCount+' more)</button>':'');
  box.innerHTML=html;
  box.querySelectorAll(".sc-open").forEach(b=>b.onclick=()=>openDrawer(b.dataset.gid));
  box.querySelectorAll(".sc-sugg").forEach(b=>b.onclick=()=>suggestForShoot(b.dataset.gid));
  box.querySelectorAll(".sc-brief").forEach(b=>b.onclick=()=>{
    const s=state.tasks.find(x=>x.gid===b.dataset.gid);
    const bt=s&&briefTaskFor(s);
    if(bt) openBriefModal(bt.gid); else draftBrief(b.dataset.gid);
  });
  box.querySelectorAll(".sc-shots").forEach(b=>b.onclick=()=>openShotList(b.dataset.gid));
  box.querySelectorAll(".sc-recipeshots").forEach(b=>b.onclick=()=>buildShotsFromRecipes(b.dataset.gid,b));
  box.querySelectorAll(".sc-drop").forEach(b=>b.onclick=()=>queueShootDrop(b.dataset.gid));
  wireBrainstorm(box);
  box.querySelectorAll(".sc-run").forEach(b=>b.onclick=()=>openRunSheet(b.dataset.gid));
  const more=document.getElementById("studioMore"); if(more) more.onclick=()=>{ studioAll=true; renderStudio(); };
  const less=document.getElementById("studioLess"); if(less) less.onclick=()=>{ studioAll=false; renderStudio(); };
  renderShootTodos(); renderBriefs(); wireStudioAdd();
}

/* ---- the "Shoot to-dos" side slot: every task tied to a shoot ---- */
function renderShootTodos(){
  const box=document.getElementById("shootTodos"); if(!box) return;
  const today=todayD();
  const shoots=state.tasks.filter(t=>t.isShoot&&t.due&&pd(t.due)>=today).sort((a,b)=>a.due<b.due?-1:1);
  if(!shoots.length){ box.innerHTML='<div class="gph">nothing tied to an upcoming shoot yet</div>'; return; }
  let html="";
  shoots.forEach(s=>{
    const rel=state.tasks.filter(t=>t.gid!==s.gid && !t.completed &&
      ((t.notes||"").includes(s.name) || (t.name||"").includes(s.name)))
      .sort((a,b)=>(a.due||"9999")<(b.due||"9999")?-1:1);
    if(!rel.length) return;
    html+='<div class="std-grp"><div class="std-grp-h">🎬 '+esc(s.name)+'</div>'+
      rel.map(t=>'<div class="preprow"><span class="ptxt" data-todo="'+t.gid+'" style="font-size:12px;cursor:pointer">'+esc(t.name)+'</span>'+
        '<select class="std-assign" data-assign="'+t.gid+'" title="Assign someone">'+assigneeOptions(t.assignee?t.assignee.gid:"unassigned","unassigned")+'</select></div>').join("")+
      '</div>';
  });
  box.innerHTML=html||'<div class="gph">nothing tied to an upcoming shoot yet</div>';
  box.querySelectorAll("[data-todo]").forEach(el=>el.onclick=()=>openDrawer(el.dataset.todo));
  box.querySelectorAll("[data-assign]").forEach(sel=>sel.onchange=async e=>{
    e.stopPropagation();
    const gid=sel.dataset.assign,val=sel.value;
    try{
      await call("update_tasks",{tasks:[{task:gid,assignee:val==="unassigned"?null:val}]});
      const t=findTask(gid); if(t)t.assignee=val==="unassigned"?null:{gid:val,name:(state.users.find(u=>u.gid===val)||{}).name||""};
      toast("Assignee updated");
    }catch(err){ toast("Couldn't assign — try the task drawer: "+err.message); }
  });
}

/* ---- add a shoot day (+ invite reminder + call-store-manager for Jess) ---- */
function wireStudioAdd(){
  const btn=document.getElementById("btnAddShoot");
  if(btn && !btn.dataset.wired){ btn.dataset.wired="1";
    btn.onclick=()=>{ const f=document.getElementById("addShootForm"); f.style.display=f.style.display==="none"?"block":"none"; };
  }
  const save=document.getElementById("shSave");
  if(save && !save.dataset.wired){ save.dataset.wired="1";
    save.onclick=addShootDay;
  }
}
async function addShootDay(){
  const name=(document.getElementById("shName").value||"").trim();
  const date=document.getElementById("shDate").value;
  const time=document.getElementById("shTime").value;
  const loc=(document.getElementById("shLoc").value||"").trim();
  if(!name){ toast("Name the shoot"); return; }
  if(!date){ toast("Pick a date"); return; }
  const noteBits=[];
  if(loc) noteBits.push("📍 "+loc);
  if(time) noteBits.push("🕐 "+time);
  const jess=GIRLS.find(g=>g.key==="jess");
  const btn=document.getElementById("shSave"); btn.disabled=true; btn.textContent="Adding…";
  try{
    const tasks=[{name, project_id:CC_PROJECT, section_id:SEC_SHOOT, due_on:date, notes:noteBits.join("\n")}];
    // reminder to send the calendar invite
    tasks.push({name:"📩 Send calendar invite — "+name, project_id:CC_PROJECT, section_id:SEC_PLAN, due_on:date,
      notes:"Reminder: send the shoot invite to the crew for "+name+(loc?" ("+loc+")":"")});
    // call the store manager — assigned to Jess
    tasks.push({name:"Call store manager"+(loc?" — "+loc:""), project_id:CC_PROJECT, section_id:SEC_PLAN, due_on:date,
      assignee:jess?jess.gid:undefined, notes:"For shoot: "+name+(loc?"\nLocation: "+loc:"")});
    await call("create_tasks",{tasks});
    toast("Shoot added — invite reminder + Jess's store call created 🎬");
    // reset + close
    document.getElementById("shName").value=""; document.getElementById("shDate").value="";
    document.getElementById("shTime").value=""; document.getElementById("shLoc").value="";
    document.getElementById("addShootForm").style.display="none";
    loadAll();
  }catch(e){ toast("Failed: "+e.message); }
  finally{ btn.disabled=false; btn.textContent="Add shoot day"; }
}

/* ---- AI content ideas ---- */
async function suggestForShoot(gid){
  const s=state.tasks.find(x=>x.gid===gid); if(!s) return;
  const out=document.getElementById("ideas-"+gid); if(out) out.innerHTML='<span class="spin"></span> cooking…';
  const near=occasionsNear(pd(s.due),21).map(o=>({name:o.name,date:iso(o.d)}));
  const mo=pd(s.due).getMonth(), cur=state.curriculum[mo];
  const win=pd(s.due).valueOf();
  const camps=(cfg.campaigns||[]).filter(c=>{ const a=pd(c.start)-14*864e5, b=pd(c.due)+14*864e5; return win>=a&&win<=b; }).map(c=>({name:c.name,start:c.start,end:c.due}));
  const fuelEl=document.querySelector('.fuel[data-gid="'+gid+'"]');
  const fuel=(fuelEl&&fuelEl.value)||state.keeper.fuel[gid]||"";
  const ownIdeas=(state.keeper.ideas[gid]||[]).map(i=>i.text);
  const already=plannedFor(s).map(t=>t.name);
  const payload={brand:"Ocean Basket — seafood restaurant franchise (South Africa & Cyprus). Warm, family, value, fresh seafood. Content is TRAINING content for restaurant crew, delivered via Articulate courses and WhatsApp.",
    shoot_day:{name:s.name,date:s.due,notes:s.notes||""},
    source_material_from_team:fuel||"(none provided)",
    the_teams_own_brainstorm:ownIdeas,
    ideas_already_planned_do_not_repeat:already,
    nearby_occasions:near,
    ob_fit_curriculum_this_month:{month:MO[mo],focus:cur.t,detail:cur.d,assessment:cur.q||null,business_focus:cur.biz||null},
    active_or_upcoming_campaigns:camps};
  try{
    const res=await askAI(
      "You plan training content for Ocean Basket Academy (learning & development for restaurant crew — NOT consumer marketing). Work backwards from the behaviour we want on shift (action mapping): each idea should make it obvious what the crew must be able to DO differently afterwards. Suggest exactly 3 concrete, specific video ideas to capture on this shoot day. Build on the team's source material and brainstorm where provided — extend their thinking, never repeat an idea already planned. Each idea must tie clearly to the source material, the OB Fit curriculum focus, an active campaign, or the shoot's notes — no generic ideas. One short punchy line each. Return only 3 bullet lines starting with '•'.",
      [payload]);
    const text=typeof res==="string"?res:(res.text||JSON.stringify(res));
    const ideas=text.split("\n").map(l=>l.replace(/^\s*[•\-\*\d.\)]+\s*/,"").trim()).filter(l=>l.length>2);
    if(out){
      if(!ideas.length){ out.innerHTML='<div class="ideabox">'+esc(text).replace(/\n/g,"<br>")+'</div>'; return; }
      out.innerHTML='<div class="ideabox"><div class="ideacap">Approve any idea → it lands as a task on this shoot day:</div>'+
        ideas.map((idea,ix)=>'<div class="idearow"><span>'+esc(idea)+'</span><button class="btn teal sm idea-add" data-ix="'+ix+'">＋ Task</button></div>').join("")+'</div>';
      out.querySelectorAll(".idea-add").forEach(b=>b.onclick=()=>addIdeaTask(gid, ideas[+b.dataset.ix], b));
    }
  }catch(e){ if(out) out.textContent="Couldn't generate: "+e.message; }
}
async function addIdeaTask(shootGid,text,btn){
  const s=state.tasks.find(x=>x.gid===shootGid); if(!s) return;
  if(btn){ btn.disabled=true; btn.textContent="…"; }
  const task={name:text,project_id:s.projectGid,due_on:s.due,notes:"Content idea for "+s.name};
  
  if(s.projectGid===CC_PROJECT) task.section_id=SEC_PLAN;
  try{ await call("create_tasks",{tasks:[task]});
    if(btn){ btn.textContent="✓ Added"; btn.classList.remove("teal"); btn.classList.add("ghost"); }
    toast("Idea locked in");
  }catch(e){ if(btn){ btn.disabled=false; btn.textContent="＋ Task"; } toast("Failed: "+e.message); }
}
async function generateAllUpcoming(){
  const today=todayD();
  const up=state.tasks.filter(t=>t.isShoot&&t.due&&pd(t.due)>=today).sort((a,b)=>a.due<b.due?-1:1);
  if(!up.length){ toast("No upcoming shoot days"); return; }
  toast("Cooking ideas for "+up.length+" shoot days…");
  for(const s of up){ await suggestForShoot(s.gid); }
}

/* ---- supplier brief drafting ---- */
function draftBrief(shootGid){
  const s=state.tasks.find(x=>x.gid===shootGid); if(!s) return;
  showModal(
    '<h2>Supplier brief — '+esc(s.name)+'</h2>'+
    '<p class="hint">If this shoot is linked to a campaign, its <b>recipes are pulled in automatically</b> — you don\'t need to paste them. Add anything extra below (script notes, presenter times, what\'s changing). The draft is finished and shareable as a PDF; you approve before saving.</p>'+
    '<div class="fld"><label>Source material / notes (optional but makes it way better)</label>'+
    '<textarea id="briefSrc" style="min-height:110px" placeholder="e.g. 8 reworked sushi dishes, cucumber replaces zucchini, pop-up text needed, Nasreen only available at 1pm…"></textarea></div>'+
    '<div class="drawer-actions"><button class="btn primary" id="briefGen">✨ Draft it</button>'+
    '<button class="btn ghost" id="briefBlank">Use blank template</button>'+
    '<button class="btn ghost" data-close>Cancel</button></div>'+
    '<div id="briefOut" style="display:none"><div class="fld" style="margin-top:14px"><label>The draft — edit freely</label>'+
    '<textarea id="briefText" style="min-height:320px;font-family:ui-monospace,Menlo,monospace;font-size:12px"></textarea></div>'+
    '<div class="drawer-actions"><button class="btn primary" id="briefSave">Save to shoot task</button>'+
    '<button class="btn teal" id="briefPdf">⬇︎ Download PDF</button>'+
    '<button class="btn ghost" id="briefCopy">Copy</button>'+
    '<button class="btn ghost" data-close>Close</button></div></div>');
  wireModalClose();
  const campForShoot=(cfg.campaigns||[]).find(c=>(s.projectGids||[s.projectGid]).includes(c.gid))||null;
  // Auto-pull the linked campaign's analysed recipes so the brief is built from
  // the real recipe detail without anyone pasting anything.
  const linkedRecipes=(()=>{
    if(!campForShoot||typeof getCampaignSmart!=="function")return [];
    try{ const sm=getCampaignSmart(campForShoot);
      return Object.values(sm.sources||{}).flatMap(src=>((src.analysis||{}).recipes||[]).map(r=>({
        name:r.name,station:r.prepared_by||r.station||null,ingredients:r.ingredients_or_products||[],
        steps:r.important_steps||[],pop_ups:r.pop_ups||[],shots:r.suggested_shots||[]})));
    }catch(_){ return []; }
  })();
  const showOut=(text)=>{ document.getElementById("briefOut").style.display="block";
    document.getElementById("briefText").value=text;
    document.getElementById("briefText").scrollIntoView({behavior:"smooth",block:"nearest"}); };
  document.getElementById("briefBlank").onclick=()=>showOut(
    BRIEF_TEMPLATE.replace("{{SHOOT_NAME}}",s.name).replace("{{SHOOT_DATE}}",s.due||"TBC").replace("{{PROJECT}}", (s.projectName||"Academy").replace(/\s+/g,"")));
  document.getElementById("briefGen").onclick=async()=>{
    const btn=document.getElementById("briefGen"); btn.disabled=true; btn.innerHTML='<span class="spin"></span> drafting…';
    const src=document.getElementById("briefSrc").value.trim();
    const mo=pd(s.due||iso(todayD())).getMonth(), cur=state.curriculum[mo];
    const near=occasionsNear(pd(s.due||iso(todayD())),21).map(o=>({name:o.name,date:iso(o.d)}));
    const camps=(cfg.campaigns||[]).map(c=>({name:c.name,start:c.start,end:c.due}));
    try{
      const shots=shotsFor(s).map(sh=>({name:sh.name.replace(/^「shot」\s*/,"").replace(" — "+s.name,""), notes:sh.notes||""}));
      const text=await askAI(
        "You write video-production briefs for Ocean Basket Academy to send to their external video supplier (Content Go). Produce a FINISHED, ready-to-send brief in the template's structure and headings. HARD RULES: (1) Never output placeholder prompts, form hints, parentheticals like '(choose one)' / '(Y/N)', or blank '—' lines — if you don't have real information for a line or subsection, OMIT it entirely. (2) One deliverable video per recipe. For each recipe use its real detail: exact on-screen pop-ups/subtitles from the ingredient names & quantities (e.g. '4pc Rock Shrimp Tempura', '1 Lemon wedge', '200g chips — bottom-left of box'), the plating/method steps as instructional subtitles, and 'who's on camera' = the recipe's station (Grill Line / Sushi team). (3) Keep it practical and specific: call time, running order, MP4/landscape, delivery to Google Drive, file naming OceanBasket_<project>_<name>_final. Training content goes to Articulate courses and WhatsApp. Return ONLY the finished brief text.\n\nTEMPLATE (structure only):\n"+
        BRIEF_TEMPLATE.replace("{{SHOOT_NAME}}",s.name).replace("{{SHOOT_DATE}}",s.due||"TBC").replace("{{PROJECT}}",(s.projectName||"Academy").replace(/\s+/g,"")),
        [{shoot:{name:s.name,date:s.due,notes:s.notes||""}, recipes:linkedRecipes, shot_list:shots, source_material:src||"(none pasted)",
          campaign:campForShoot?{name:campForShoot.name,launch:campForShoot.start}:null,
          curriculum_this_month:cur, nearby_occasions:near, campaigns:camps,
          house_rules:{delivery:"Google Drive unless urgent (then WeTransfer/WhatsApp)", file_naming:"OceanBasket_<project>_<name>_final", brand:"Academy brand elements throughout — titles, colours, logo; steps as subtitles on instructional videos; teleprompter for scripted pieces"}}]);
      showOut(typeof text==="string"?text:JSON.stringify(text));
    }catch(e){ toast("Couldn't draft: "+e.message); }
    btn.disabled=false; btn.innerHTML="✨ Draft it";
  };
  document.getElementById("briefSave").onclick=async()=>{
    const text=document.getElementById("briefText").value;
    try{
      const existing=briefTaskFor(s);
      const notes="status: drafted\ndrafted: "+iso(todayD())+"\n\n"+text;
      if(existing){ await call("update_tasks",{tasks:[{task:existing.gid, notes}]}); existing.notes=notes; }
      else{
        const t={name:"「brief」 "+s.name, project_id:s.projectGid, notes};
        if(s.projectGid===CC_PROJECT) t.section_id=SEC_PLAN;
        await call("create_tasks",{tasks:[t]});
      }
      dismissSuggestion("brief-"+s.gid);
      confetti(); toast("Saved to the brief library"); closeModal(); loadAll();
    }catch(e){ toast("Failed: "+e.message); }
  };
  document.getElementById("briefCopy").onclick=()=>{
    navigator.clipboard.writeText(document.getElementById("briefText").value).then(()=>toast("Copied"));
  };
  document.getElementById("briefPdf").onclick=()=>printBriefPDF(s.name,document.getElementById("briefText").value);
}
/* Branded, print-ready PDF of a brief — opens a clean styled page and triggers
   the browser's Save-as-PDF. No dependencies. Shareable with Content Go. */
function printBriefPDF(shootName,text){
  const safe=str=>String(str||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
  // Turn the plain-text brief into tidy HTML: numbered "1. HEADING" lines become
  // section headings, "• " lines become list items, blank lines break blocks.
  const lines=String(text||"").split("\n");
  let html="",inList=false;
  const closeList=()=>{ if(inList){ html+="</ul>"; inList=false; } };
  lines.forEach(raw=>{
    const line=raw.replace(/\s+$/,"");
    if(/^\s*\d+\.\s+[A-Z0-9 ,&/'-]{3,}$/.test(line)){ closeList(); html+="<h2>"+safe(line.trim())+"</h2>"; return; }
    const bullet=line.match(/^\s*[•\-]\s+(.*)$/);
    if(bullet){ if(!inList){ html+="<ul>"; inList=true; } html+="<li>"+safe(bullet[1])+"</li>"; return; }
    closeList();
    if(line.trim()==="") html+="<div class='sp'></div>";
    else html+="<p>"+safe(line)+"</p>";
  });
  closeList();
  const w=window.open("","_blank");
  if(!w){ toast("Allow pop-ups to download the PDF"); return; }
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>OB Academy Brief — '+safe(shootName)+
    '</title><style>@page{margin:18mm}body{font:13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#12222e;max-width:760px;margin:0 auto;padding:8px}'+
    '.hdr{display:flex;align-items:center;gap:10px;border-bottom:3px solid #0A3D62;padding-bottom:10px;margin-bottom:16px}'+
    '.logo{width:34px;height:34px;border-radius:8px;background:#0A3D62;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px}'+
    '.hdr b{font-size:16px;color:#0A3D62}.hdr span{color:#5b7386;font-size:11px;display:block}'+
    'h2{font-size:12px;letter-spacing:.4px;text-transform:uppercase;color:#0A3D62;border-bottom:1px solid #e3e9ee;padding-bottom:4px;margin:20px 0 8px}'+
    'p{margin:3px 0}ul{margin:4px 0 4px 18px;padding:0}li{margin:2px 0}.sp{height:6px}'+
    '@media print{.noprint{display:none}}</style></head><body>'+
    '<div class="hdr"><div class="logo">OB</div><div><b>Ocean Basket Academy — Video Brief</b><span>'+safe(shootName)+' · generated '+new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})+'</span></div></div>'+
    html+
    '<div class="noprint" style="margin-top:24px;text-align:center"><button onclick="window.print()" style="padding:10px 18px;border:0;border-radius:8px;background:#0A3D62;color:#fff;font-weight:700;cursor:pointer">Save as PDF</button></div>'+
    '</body></html>');
  w.document.close();
  setTimeout(()=>{ try{ w.print(); }catch(_){} },350);
}

/* ================================================================
   SHOT LISTS — the deliverables for a shoot, as checkable tasks
   ================================================================ */
function shotsFor(s){
  return state.tasks.filter(t=>t.isShot && t.name.includes(s.name));
}
function shotLabel(t,s){ return t.name.replace(/^「shot」\s*/,"").replace(" — "+s.name,""); }

// Pull the linked campaign's analysed recipes and turn each into a shot task on
// this shoot — so the shot list builds itself instead of being hand-typed.
function recipesForShoot(s){
  const camp=(cfg.campaigns||[]).find(c=>(s.projectGids||[s.projectGid]).includes(c.gid));
  if(!camp||typeof getCampaignSmart!=="function") return {camp:null,recipes:[]};
  let recipes=[];
  try{ const sm=getCampaignSmart(camp);
    recipes=Object.values(sm.sources||{}).flatMap(src=>((src.analysis||{}).recipes||[]));
  }catch(_){ recipes=[]; }
  return {camp,recipes};
}
async function buildShotsFromRecipes(shootGid,btn){
  const s=state.tasks.find(x=>x.gid===shootGid); if(!s) return;
  const {camp,recipes}=recipesForShoot(s);
  if(!camp){ toast("Link this shoot to a campaign first (the Smart Plan does this)"); return; }
  if(!recipes.length){ toast("No analysed recipes on "+camp.name+" yet — add them in the campaign's Resources tab"); return; }
  const existing=new Set(shotsFor(s).map(t=>shotLabel(t,s).toLowerCase().trim()));
  const fresh=recipes.filter(r=>r.name && !existing.has(String(r.name).toLowerCase().trim()));
  if(!fresh.length){ toast("Every recipe is already on the shot list ✓"); return; }
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="spin"></span>'; }
  const tasks=fresh.map(r=>{
    const noteBits=["type: video"];
    if(r.prepared_by||r.station) noteBits.push("On camera: "+(r.prepared_by||r.station));
    (r.pop_ups||[]).slice(0,8).forEach(p=>noteBits.push("pop-up: "+p));
    if(!(r.pop_ups||[]).length) (r.ingredients_or_products||[]).slice(0,6).forEach(p=>noteBits.push("pop-up: "+p));
    const t={name:"「shot」 "+r.name+" — "+s.name, project_id:s.projectGid, due_on:s.due, notes:noteBits.join("\n")};
    if(s.projectGid===CC_PROJECT) t.section_id=SEC_PLAN;
    return t;
  });
  try{
    await call("create_tasks",{tasks});
    toast(fresh.length+" shot"+(fresh.length===1?"":"s")+" added from "+camp.name+"'s recipes 🎬");
    await loadAll();
  }catch(e){ toast("Couldn't build the shot list: "+e.message); if(btn){ btn.disabled=false; btn.textContent="Shots from recipes"; } }
}

function openShotList(shootGid){
  const s=state.tasks.find(x=>x.gid===shootGid); if(!s) return;
  const shots=shotsFor(s);
  const row=(t)=>{
    const meta=(t.notes||"").split("\n").filter(l=>l.trim()).join(" · ");
    return '<div class="preprow'+(t.completed?" done":"")+'"><button class="pchk'+(t.completed?" on":"")+'" data-sg="'+t.gid+'">'+(t.completed?"✓":"")+'</button>'+
      '<span class="ptxt">'+esc(shotLabel(t,s))+(meta?'<span class="wa-meta">'+esc(meta)+'</span>':'')+'</span></div>';
  };
  showModal('<h2>Shot list — '+esc(s.name)+'</h2>'+
    '<p class="hint">Every deliverable to capture on the day. This list feeds the brief word-for-word and becomes the run sheet.</p>'+
    '<div class="preplist" id="shotRows">'+(shots.length?shots.map(row).join(""):'<div class="empty">No shots yet — add the first one below.</div>')+'</div>'+
    '<div class="ins-h">Add a deliverable</div>'+
    '<div class="row"><div class="fld" style="flex:2"><label>Name</label><input id="shName" placeholder="e.g. Golden Crunch Prawn California Roll — plating"></div>'+
    '<div class="fld"><label>Type</label><select id="shType"><option>video</option><option>photo</option><option>voxpop</option><option>comms video</option></select></div></div>'+
    '<div class="fld"><label>On-screen text / pop-ups / notes (optional)</label><input id="shPop" placeholder="e.g. pop-up: Now with cucumber. No longer zucchini"></div>'+
    '<div class="drawer-actions"><button class="btn primary" id="shAdd">Add to shot list</button>'+
    '<button class="btn ghost" data-close>Done</button></div>');
  wireModalClose();
  document.querySelectorAll("#shotRows .pchk").forEach(b=>b.onclick=async()=>{
    const t=state.tasks.find(x=>x.gid===b.dataset.sg); if(!t) return;
    await toggleDone(t.gid,!t.completed); openShotList(shootGid);
  });
  document.getElementById("shAdd").onclick=async()=>{
    const nm=document.getElementById("shName").value.trim(); if(!nm){toast("Name the deliverable");return;}
    const type=document.getElementById("shType").value, pop=document.getElementById("shPop").value.trim();
    const t={name:"「shot」 "+nm+" — "+s.name, project_id:s.projectGid, due_on:s.due,
      notes:"type: "+type+(pop?"\n"+pop:"")};
    if(s.projectGid===CC_PROJECT) t.section_id=SEC_PLAN;
    try{ await call("create_tasks",{tasks:[t]}); toast("On the shot list");
      await loadAll(); openShotList(shootGid);
    }catch(e){ toast("Failed: "+e.message); }
  };
}

/* ================================================================
   RUN SHEET — the on-set view for shoot day
   ================================================================ */
function openRunSheet(shootGid){
  const s=state.tasks.find(x=>x.gid===shootGid); if(!s) return;
  const shots=shotsFor(s), bt=briefTaskFor(s);
  const done=shots.filter(t=>t.completed).length;
  const w=document.getElementById("runWrap");
  w.innerHTML=
    '<div class="run">'+
      '<div class="f-head"><div><div class="run-kicker">Shoot day · '+(s.due?pd(s.due).toDateString():"")+'</div>'+
        '<h1>'+esc(s.name)+'</h1></div>'+
        '<button class="btn ghost" id="runClose">Close ✕</button></div>'+
      (s.notes?'<div class="run-notes">'+esc(s.notes)+'</div>':'')+
      '<div class="run-grid">'+
        '<div><h3 class="run-h">The shot list <span class="f-count">'+done+'/'+shots.length+'</span></h3>'+
          (shots.length?shots.map(t=>{
            const meta=(t.notes||"").split("\n").filter(l=>l.trim()).join(" · ");
            return '<div class="run-shot'+(t.completed?" done":"")+'" data-rg="'+t.gid+'">'+
              '<span class="run-chk">'+(t.completed?"✓":"")+'</span>'+
              '<span class="run-txt">'+esc(shotLabel(t,s))+(meta?'<span class="run-meta">'+esc(meta)+'</span>':'')+'</span></div>';
          }).join(""):'<div class="empty">No shot list yet — build one in Studio before the day.</div>')+
        '</div>'+
        '<div><h3 class="run-h">Brief</h3>'+
          (bt?'<div class="run-prep">Status: '+esc(briefStatusOf(bt))+' · <a href="#" id="runBrief" style="color:var(--teal);font-weight:700">open</a></div>'
             :'<div class="empty">No brief for this shoot yet — draft one in Studio.</div>')+
        '</div>'+
      '</div>'+
    '</div>';
  w.style.display="block"; requestAnimationFrame(()=>w.classList.add("open"));
  document.getElementById("runClose").onclick=closeRunSheet;
  const rb=document.getElementById("runBrief"); if(rb) rb.onclick=(e)=>{e.preventDefault(); closeRunSheet(); openBriefModal(bt.gid);};
  w.querySelectorAll(".run-shot").forEach(r=>r.onclick=async()=>{
    const t=state.tasks.find(x=>x.gid===r.dataset.rg); if(!t) return;
    const completing=!t.completed;
    const finalShot=completing&&shotsFor(s).filter(x=>!x.completed).length===1;
    const saved=await toggleDone(t.gid,completing,{suppressCelebration:finalShot});
    const remaining=shotsFor(s).filter(x=>!x.completed).length;
    openRunSheet(shootGid);
    if(saved&&finalShot&&remaining===0) celebrateCompletion({name:s.name,isShoot:true},{phrase:"Shot list complete. That's a wrap."});
  });
}
function closeRunSheet(){
  const w=document.getElementById("runWrap");
  w.classList.remove("open");
  setTimeout(()=>{ w.style.display="none"; w.innerHTML=""; },250);
}

/* ================================================================
   EVENTS — masterclasses, workshops, webinars, forums
   ================================================================ */
function eventHasPromo(ev){
  const evDate=pd(ev.due); if(!evDate) return false;
  const words=(ev.name||"").toLowerCase().split(/\W+/).filter(x=>x.length>4);
  return state.tasks.some(t=>{
    if(!t.isComms||t.isKeeper||!t.due) return false;
    const d=pd(t.due); if(d>evDate || (evDate-d)>14*864e5) return false;
    const n=(t.name||"").toLowerCase();
    return words.some(wd=>n.includes(wd));
  });
}
function queuePromoFor(gid){
  const ev=state.tasks.find(x=>x.gid===gid); if(!ev) return;
  switchTab("communities");
  const nm=document.getElementById("waName"), dt=document.getElementById("waDate"), pr=document.getElementById("waPurpose");
  if(nm) nm.value="Reminder: "+ev.name;
  if(dt&&ev.due){ const d=pd(ev.due); d.setDate(d.getDate()-3); dt.value=iso(d); }
  if(pr) pr.value="info";
  toast("Promo drafted — pick the communities and queue it");
  if(nm) nm.focus();
}
// Smart connection: from a shoot, draft the Communities message that announces
// the content once it lands. Dates it a few days after the shoot.
function queueShootDrop(gid){
  const s=state.tasks.find(x=>x.gid===gid); if(!s) return;
  switchTab("communities");
  const nm=document.getElementById("waName"), msg=document.getElementById("waMessage"), dt=document.getElementById("waDate"), pr=document.getElementById("waPurpose");
  const clean=(s.name||"").replace(/^shoot day[^—-]*[—-]\s*/i,"").replace(/^shoot day\s*/i,"").trim()||s.name;
  if(nm) nm.value="New content: "+clean;
  if(msg) msg.value="🎬 Fresh content is on the way from our latest shoot — keep an eye out!";
  if(dt&&s.due){ const d=pd(s.due); d.setDate(d.getDate()+3); dt.value=iso(d); }
  if(pr) pr.value="info";
  toast("Content drop drafted — pick the communities and queue it");
  if(nm) nm.focus();
}
/* The Events tab (js/events.js) owns masterclasses & webinars now.
   eventHasPromo() and queuePromoFor() above are still used there. */

/* ================================================================
   BRIEF LIBRARY — every brief, with a status you can advance
   ================================================================ */
const BRIEF_STATUSES=["drafted","sent to Content Go","delivered"];
function briefTaskFor(s){ return state.tasks.find(t=>t.isBrief && t.name.includes(s.name)); }
function briefStatusOf(bt){
  const m=(bt.notes||"").match(/^status:\s*(.+)$/m);
  return m?m[1].trim():"drafted";
}
function renderBriefs(){
  const box=document.getElementById("briefList"); if(!box) return;
  const briefs=state.tasks.filter(t=>t.isBrief).sort((a,b)=>(b.due||"")<(a.due||"")?-1:1);
  if(!briefs.length){ box.innerHTML='<div class="empty">No briefs yet. Draft one from any shoot above — it lands here with a status you can walk from drafted to delivered.</div>'; return; }
  box.innerHTML=briefs.map(bt=>{
    const st=briefStatusOf(bt);
    const shootName=bt.name.replace(/^「brief」\s*/,"");
    const shoot=state.tasks.find(t=>t.isShoot&&bt.name.includes(t.name));
    const dm=(bt.notes||"").match(/^drafted:\s*(.+)$/m);
    return '<div class="ev-row brief-row" data-gid="'+bt.gid+'">'+
      '<span class="news-main"><span class="news-t">'+esc(shootName)+'</span>'+
      '<span class="news-meta">'+(dm?'drafted '+esc(dm[1]):'')+(shoot&&shoot.due?' · shoot '+pd(shoot.due).toDateString().slice(4,10):'')+'</span></span>'+
      '<button class="st st-'+BRIEF_STATUSES.indexOf(st)+'" data-st="'+bt.gid+'" title="Click to advance">'+esc(st)+'</button>'+
      '</div>';
  }).join("");
  box.querySelectorAll(".brief-row").forEach(r=>r.onclick=e=>{ if(!e.target.closest(".st")) openBriefModal(r.dataset.gid); });
  box.querySelectorAll(".st").forEach(b=>b.onclick=e=>{ e.stopPropagation(); advanceBriefStatus(b.dataset.st); });
}
async function advanceBriefStatus(gid){
  const bt=state.tasks.find(x=>x.gid===gid); if(!bt) return;
  const cur=briefStatusOf(bt);
  const next=BRIEF_STATUSES[(BRIEF_STATUSES.indexOf(cur)+1)%BRIEF_STATUSES.length];
  const notes=/^status:/m.test(bt.notes||"") ? bt.notes.replace(/^status:\s*.+$/m,"status: "+next) : "status: "+next+"\n"+(bt.notes||"");
  bt.notes=notes; renderBriefs();
  try{ await call("update_tasks",{tasks:[{task:gid,notes}]}); toast("Brief: "+next); if(next==="delivered") confetti(); }
  catch(e){ toast("Failed: "+e.message); }
}
function openBriefModal(gid){
  const bt=state.tasks.find(x=>x.gid===gid); if(!bt) return;
  const body=(bt.notes||"").replace(/^status:.*\n?/m,"").replace(/^drafted:.*\n?/m,"").replace(/^\n+/,"");
  showModal('<h2>'+esc(bt.name.replace(/^「brief」\s*/,""))+'</h2>'+
    '<div class="cmeta" style="margin-bottom:12px">Status: '+esc(briefStatusOf(bt))+'</div>'+
    '<div class="fld"><label>The brief — edit freely</label>'+
    '<textarea id="blText" style="min-height:340px;font-family:ui-monospace,Menlo,monospace;font-size:12px">'+esc(body)+'</textarea></div>'+
    '<div class="drawer-actions"><button class="btn primary" id="blSave">Save</button>'+
    '<button class="btn teal" id="blCopy">Copy</button>'+
    '<button class="btn ghost" data-close>Close</button></div>');
  wireModalClose();
  document.getElementById("blSave").onclick=async()=>{
    const head="status: "+briefStatusOf(bt)+"\n"+((bt.notes||"").match(/^drafted:.*$/m)||[""])[0];
    const notes=head.trim()+"\n\n"+document.getElementById("blText").value;
    try{ await call("update_tasks",{tasks:[{task:gid,notes}]}); bt.notes=notes; toast("Saved"); closeModal(); }
    catch(e){ toast("Failed: "+e.message); }
  };
  document.getElementById("blCopy").onclick=()=>{
    navigator.clipboard.writeText(document.getElementById("blText").value).then(()=>toast("Copied"));
  };
}

/* ================================================================
   WRONG-ANSWER DIGEST — paste a Max / quiz export, get insight
   plus Skills Booster suggestions to approve
   ================================================================ */
function wireMaxDigest(){
  const btn=document.getElementById("maxDigest");
  if(!btn || btn.dataset.wired) return; btn.dataset.wired="1";
  btn.onclick=runMaxDigest;
}
async function runMaxDigest(){
  const txt=document.getElementById("maxPaste").value.trim();
  const out=document.getElementById("maxOut");
  if(!txt){ toast("Paste the export first"); return; }
  out.style.display="block"; out.innerHTML='<span class="spin"></span> reading the wrong answers…';
  try{
    const res=await askAI(
      "You analyse learning assessment data for Ocean Basket Academy (restaurant crew training). The paste below is a wrong-answer / quiz results export (from their Max dashboard or an LMS). Return: (1) 'TOP WRONG ANSWERS' — the 3-5 most-missed questions or topics with the likely misunderstanding, one line each; (2) 'PATTERN' — one or two sentences on what connects them; (3) then for each recommended intervention a line starting exactly 'BOOSTER: ' followed by a short Skills Booster task name (these become tasks the team can approve). Max 4 boosters. Plain text, no markdown headers beyond the labels given.",
      [{export:txt.slice(0,12000)}]);
    const text=typeof res==="string"?res:(res.text||"");
    const boosters=text.split("\n").filter(l=>/^BOOSTER:/i.test(l.trim())).map(l=>l.replace(/^BOOSTER:\s*/i,"").trim()).filter(Boolean);
    const rest=text.split("\n").filter(l=>!/^BOOSTER:/i.test(l.trim())).join("\n").trim();
    let html='<div style="white-space:pre-wrap;font-size:13px;line-height:1.6">'+esc(rest)+'</div>';
    if(boosters.length){
      html+='<div class="ins-h" style="margin-top:14px">Suggested Skills Boosters — approve to create</div>'+
        boosters.map((b,ix)=>'<div class="idearow"><span>'+esc(b)+'</span><button class="btn teal sm mx-add" data-ix="'+ix+'">+ Task</button></div>').join("");
    }
    out.innerHTML=html;
    out.querySelectorAll(".mx-add").forEach(btn2=>btn2.onclick=async()=>{
      btn2.disabled=true; btn2.textContent="…";
      const due=new Date(); due.setDate(due.getDate()+14);
      try{ await call("create_tasks",{tasks:[{name:"Skills Booster: "+boosters[+btn2.dataset.ix], project_id:"1214196027560535", due_on:iso(due), notes:"From the wrong-answer digest, "+iso(todayD())}]});
        btn2.textContent="✓ Added"; btn2.classList.remove("teal"); btn2.classList.add("ghost"); toast("Booster on the board");
      }catch(e){ btn2.disabled=false; btn2.textContent="+ Task"; toast("Failed: "+e.message); }
    });
  }catch(e){ out.textContent="Couldn't digest: "+e.message; }
}


/* ================================================================
   THE BRAINSTORM — your own placeholder ideas per shoot, shared
   with the girls, approved into tasks when you meet.
   Plus the planned list: every idea task stays under its shoot.
   ================================================================ */
function plannedFor(s){
  return state.tasks.filter(t=>(t.notes||"").startsWith("Content idea for "+s.name));
}
function plannedHTML(s){
  const planned=plannedFor(s);
  if(!planned.length) return "";
  return '<div class="ins-h" style="margin-top:12px">Planned for this shoot</div>'+
    '<div class="planned">'+planned.map(t=>
      '<div class="preprow'+(t.completed?" done":"")+'" style="padding:6px 2px">'+
      '<button class="pchk'+(t.completed?" on":"")+'" data-pl="'+t.gid+'">'+(t.completed?"✓":"")+'</button>'+
      '<span class="ptxt" style="font-size:12.5px;cursor:pointer" data-plopen="'+t.gid+'">'+esc(t.name)+'</span></div>').join("")+'</div>';
}
function brainstormHTML(s){
  const ideas=state.keeper.ideas[s.gid]||[];
  const fuel=state.keeper.fuel[s.gid]||"";
  return '<div class="ins-h" style="margin-top:12px">The brainstorm</div>'+
    (ideas.length?ideas.map(i=>
      '<div class="idearow"><span>'+esc(i.text)+' <span class="news-meta" style="display:inline">— '+esc(i.by)+'</span></span>'+
      '<span style="display:flex;gap:4px;flex-shrink:0">'+
      '<button class="btn teal sm bs-approve" data-gid="'+s.gid+'" data-id="'+i.id+'">+ Task</button>'+
      '<button class="btn ghost sm bs-del" data-gid="'+s.gid+'" data-id="'+i.id+'">✕</button></span></div>').join("")
    :'<div class="gph" style="margin:4px 0">no ideas parked yet — jot them here, approve them when you meet</div>')+
    '<div class="additem" style="margin:8px 0 0"><input class="witem-input bs-input" data-gid="'+s.gid+'" placeholder="Park an idea…">'+
    '<button class="witem-add bs-add" data-gid="'+s.gid+'">Park it</button></div>'+
    '<textarea class="fuel" data-gid="'+s.gid+'" placeholder="Fuel for ✨ Ideas — paste recipes, source material or rough thoughts…">'+esc(fuel)+'</textarea>';
}
function wireBrainstorm(box){
  box.querySelectorAll(".bs-add").forEach(b=>{
    const inp=box.querySelector('.bs-input[data-gid="'+b.dataset.gid+'"]');
    const go=()=>{
      const txt=inp.value.trim(); if(!txt) return;
      if(!state.keeper.ideas[b.dataset.gid]) state.keeper.ideas[b.dataset.gid]=[];
      state.keeper.ideas[b.dataset.gid].push({id:"i"+Date.now(),text:txt,
        by:firstName(state.me&&state.me.name)||"someone",at:iso(todayD())});
      saveKeeper(); renderStudio(); toast("Parked");
    };
    b.onclick=go; inp.onkeydown=e=>{ if(e.key==="Enter") go(); };
  });
  box.querySelectorAll(".bs-del").forEach(b=>b.onclick=()=>{
    state.keeper.ideas[b.dataset.gid]=(state.keeper.ideas[b.dataset.gid]||[]).filter(i=>i.id!==b.dataset.id);
    saveKeeper(); renderStudio();
  });
  box.querySelectorAll(".bs-approve").forEach(b=>b.onclick=async()=>{
    const list=state.keeper.ideas[b.dataset.gid]||[];
    const idea=list.find(i=>i.id===b.dataset.id); if(!idea) return;
    b.disabled=true; b.textContent="…";
    const s=state.tasks.find(x=>x.gid===b.dataset.gid); if(!s) return;
    const task={name:idea.text,project_id:s.projectGid,due_on:s.due,notes:"Content idea for "+s.name+"\nParked by "+idea.by+", approved "+iso(todayD())};
    if(s.projectGid===CC_PROJECT) task.section_id=SEC_PLAN;
    try{
      await call("create_tasks",{tasks:[task]});
      state.keeper.ideas[b.dataset.gid]=list.filter(i=>i.id!==b.dataset.id);
      saveKeeper(); toast("Approved — it's a task now"); confetti(); loadAll();
    }catch(e){ b.disabled=false; b.textContent="+ Task"; toast("Failed: "+e.message); }
  });
  box.querySelectorAll(".fuel").forEach(f=>{
    f.onchange=()=>{ state.keeper.fuel[f.dataset.gid]=f.value; saveKeeper(); };
  });
  box.querySelectorAll("[data-plopen]").forEach(el=>el.onclick=()=>openDrawer(el.dataset.plopen));
  box.querySelectorAll("[data-pl]").forEach(b=>b.onclick=()=>{
    const t=findTask(b.dataset.pl); if(t) toggleDone(t.gid,!t.completed);
  });
}


/* ================================================================
   CURRICULUM — the OB Fit marathon, Skills Boosters (ship to a
   community), and the wrong-answer digest. Course planning home.
   ================================================================ */
const SB_PROJECT="1214196027560535";   // Skills Boosters board (also used by the digest)
function isBooster(t){ return /^\s*(?:\[[^\]]*\]\s*)?skills?\s*booster\b/i.test(t.name||""); }

function renderCurriculum(){
  renderPlaybook();
  renderRecipe();
  const grid=document.getElementById("curriculumGrid");
  const link=document.getElementById("curLink");
  if(link) link.href=CURRICULUM_URL;
  if(grid){
    const nowMo=todayD().getMonth();
    grid.innerHTML=state.curriculum.map((c,i)=>
      '<div class="cur-cell'+(i===nowMo?" now":"")+'">'+
        '<div class="cur-mo">'+MO[i].slice(0,3)+(i===nowMo?' · now':'')+'</div>'+
        '<div class="cur-t">'+esc(c.t)+'</div>'+
        (c.d?'<div class="cur-d">'+esc(c.d)+'</div>':'')+
        (c.q?'<div class="cur-q">⚑ '+esc(c.q)+'</div>':'')+
        (c.biz?'<div class="cur-biz">'+esc(c.biz)+'</div>':'')+
      '</div>').join("")+
      '<button class="cur-cell cur-edit" id="curEdit">✎ Edit the marathon<span class="cur-d">Opens the editor — changes sync to the Asana Curriculum board</span></button>';
    const ed=document.getElementById("curEdit"); if(ed) ed.onclick=()=>openSettings();
  }
  renderBoosters(); wireBoosterAdd(); wireMaxDigest();
}

/* ---- Layer A: the strategy cheat sheet (collapsed by default) ---- */
function renderPlaybook(){
  const el=document.getElementById("curPlaybook"); if(!el || typeof OB_STRATEGY==="undefined") return;
  const s=OB_STRATEGY;
  const block=(title,inner)=>'<div class="pb-block"><h5>'+esc(title)+'</h5><div class="pb-row">'+inner+'</div></div>';
  const chips=arr=>arr.map(x=>'<span class="pb-chip"><b>'+esc(x.k)+'</b> '+esc(x.v)+'</span>').join("");
  el.innerHTML=
    '<details class="pb-det">'+
      '<summary class="pb-sum"><span class="pb-eyebrow">The cheat sheet</span> How we do things'+
        '<span class="pb-note"> — mission, method &amp; the two streams</span></summary>'+
      '<div class="pb-body">'+
        '<p class="pb-mission">'+esc(s.mission)+'</p>'+
        block("The learning model", chips(s.model))+
        block("When we teach — the TEACH method", chips(s.teach))+
        block("How we design — build backwards", s.actionMapping.map((x,i)=>
          '<span class="pb-step"><i>'+(i+1)+'</i>'+esc(x)+'</span>').join(""))+
        block("Our strategy — diagnose · train · connect", chips(s.strategy))+
        '<div class="pb-streams">'+s.streams.map(st=>
          '<div class="pb-stream"><div class="pb-stream-h">'+esc(st.k)+'</div>'+
          '<div class="pb-stream-tag">'+esc(st.tag)+'</div>'+
          '<div class="pb-stream-v">'+esc(st.v)+'</div>'+
          '<div class="pb-stream-out">→ '+esc(st.out)+'</div></div>').join("")+'</div>'+
        '<div class="pb-principles">'+esc(s.principles)+'</div>'+
      '</div>'+
    '</details>';
}

/* ---- Layer B: OB Fit — the recipe per role ---- */
let _recipeRole = (typeof OBFIT_RECIPES!=="undefined" && OBFIT_RECIPES[0]) ? OBFIT_RECIPES[0].role : "";
function renderRecipe(){
  const el=document.getElementById("curRecipe"); if(!el || typeof OBFIT_RECIPES==="undefined") return;
  const groups=[...new Set(OBFIT_RECIPES.map(r=>r.group))];
  const picker=groups.map(g=>
    '<div class="rc-group"><div class="rc-group-h">'+esc(g)+'</div><div class="rc-chips">'+
      OBFIT_RECIPES.filter(r=>r.group===g).map(r=>
        '<button class="rc-chip'+(r.role===_recipeRole?' on':'')+'" data-role="'+esc(r.role)+'">'+esc(r.role)+'</button>'
      ).join("")+
    '</div></div>').join("");
  const r=OBFIT_RECIPES.find(x=>x.role===_recipeRole)||OBFIT_RECIPES[0];
  const col=(title,cls,note,arr)=>
    '<div class="rc-col '+cls+'"><div class="rc-col-h">'+esc(title)+'<span>'+esc(note)+'</span></div><ol>'+
      arr.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ol></div>';
  el.innerHTML=
    '<div class="rc-pick">'+picker+'</div>'+
    '<div class="rc-card"><div class="rc-card-h">'+esc(r.role)+'</div><div class="rc-cols">'+
      col("Knowledge","k","builds confidence",r.knowledge)+
      col("Skills","s","builds performance",r.skills)+
      col("Soft skills","sf","shape the experience",r.soft)+
      col("Business impact","im","why it matters",r.impact)+
    '</div></div>';
  el.querySelectorAll(".rc-chip").forEach(b=>b.onclick=()=>{ _recipeRole=b.dataset.role; renderRecipe(); });
}

function renderBoosters(){
  const box=document.getElementById("boosterList"); if(!box) return;
  const boosters=state.tasks.filter(t=>isBooster(t)&&!t.completed)
    .sort((a,b)=>(a.due||"9999")<(b.due||"9999")?-1:1);
  if(!boosters.length){ box.innerHTML='<div class="empty">No Skills Boosters yet. Add one above, or generate some from the wrong-answer digest below.</div>'; return; }
  box.innerHTML=boosters.map(t=>{
    const nm=t.name.replace(/^skills?\s*booster:?\s*/i,"");
    const opts='<option value="">ship to…</option>'+cfg.communities.map(c=>'<option value="'+c.key+'">'+esc(c.name)+'</option>').join("");
    return '<div class="bst-row"><span class="bst-name" data-open="'+t.gid+'">💪 '+esc(nm)+'</span>'+
      '<span class="bst-ship"><select class="bst-comm" data-gid="'+t.gid+'">'+opts+'</select>'+
      '<button class="btn teal sm bst-go" data-gid="'+t.gid+'">Ship</button></span></div>';
  }).join("");
  box.querySelectorAll(".bst-name").forEach(el=>el.onclick=()=>openDrawer(el.dataset.open));
  box.querySelectorAll(".bst-go").forEach(b=>b.onclick=()=>shipBooster(b.dataset.gid,box));
}
async function shipBooster(gid,box){
  const t=state.tasks.find(x=>x.gid===gid); if(!t) return;
  const sel=box.querySelector('.bst-comm[data-gid="'+gid+'"]');
  const cKey=sel&&sel.value; if(!cKey){ toast("Pick a community to ship to"); return; }
  const c=cfg.communities.find(x=>x.key===cKey); if(!c) return;
  const nm=t.name.replace(/^skills?\s*booster:?\s*/i,"");
  const btn=box.querySelector('.bst-go[data-gid="'+gid+'"]'); if(btn){ btn.disabled=true; btn.textContent="…"; }
  try{
    const board=await ensureMsgBoard(); if(!board){ toast("Connect a Communities board first"); return; }
    const secMap=await ensureWASections();
    const why=(typeof COMMUNITY_PURPOSE!=="undefined" && COMMUNITY_PURPOSE[cKey]) ? "\nWhy it matters: "+COMMUNITY_PURPOSE[cKey] : "";
    const msg={name:"New Skills Booster: "+nm+" 💪", project_id:board, notes:"#purpose:practice\nFrom the curriculum — Skills Booster for "+esc(c.name)+why};
    if(secMap&&secMap[c.name]) msg.section_id=secMap[c.name]; else msg.name="["+c.name+"] "+msg.name;
    await call("create_tasks",{tasks:[msg]});
    toast("Shipped to "+c.name+" — drafted in Communities"); confetti(); loadAll();
    switchTab("communities");
  }catch(e){ toast("Failed: "+e.message); if(btn){ btn.disabled=false; btn.textContent="Ship"; } }
}
function wireBoosterAdd(){
  const b=document.getElementById("sbAdd");
  if(!b || b.dataset.wired) return; b.dataset.wired="1";
  const go=async()=>{
    const inp=document.getElementById("sbName"); const nm=(inp.value||"").trim();
    if(!nm){ toast("Name the booster"); return; }
    try{
      await call("create_tasks",{tasks:[{name:"Skills Booster: "+nm, project_id:SB_PROJECT, notes:"Added from the Curriculum tab, "+iso(todayD())}]});
      inp.value=""; toast("Booster added"); loadAll();
    }catch(e){ toast("Failed: "+e.message); }
  };
  b.onclick=go;
  const inp=document.getElementById("sbName"); if(inp) inp.onkeydown=e=>{ if(e.key==="Enter") go(); };
}
