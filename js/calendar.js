/* ================================================================
   CALENDAR — zoom control, month/week/day, quarter agenda,
              scrollable year, layers (comms, occasions, campaigns)
   ================================================================ */

const VIEWS = ["day","week","month","quarter","year"];

function wireCalendarControls(){
  const sl=document.getElementById("zoomSlider");
  if(sl){
    sl.addEventListener("input",()=>setView(VIEWS[+sl.value]));
    sl.value=VIEWS.indexOf(state.view);
  }
  document.querySelectorAll(".ztick").forEach(t=>t.onclick=()=>setView(t.dataset.v));
  document.getElementById("navPrev").onclick=()=>stepCursor(-1);
  document.getElementById("navNext").onclick=()=>stepCursor(1);
  document.getElementById("navToday").onclick=()=>{ state.cursor=new Date(); renderCalendar(); };
  const commsToggle=document.getElementById("showCommunityMessages");
  if(commsToggle){
    commsToggle.checked=cfg.showComms!==false;
    commsToggle.onchange=()=>{
      cfg.showComms=commsToggle.checked;
      saveCfg();
      renderCalendar();
    };
  }
}
function setView(v){
  const from=VIEWS.indexOf(state.view), to=VIEWS.indexOf(v);
  if(from===to) return;
  state.view=v; cfg.view=v; saveCfg();
  renderCalendar(to>from?"zout":"zin");
}
function stepCursor(dir){
  const c=state.cursor;
  if(state.view==="month")c.setMonth(c.getMonth()+dir);
  else if(state.view==="week")c.setDate(c.getDate()+7*dir);
  else if(state.view==="day")c.setDate(c.getDate()+dir);
  else if(state.view==="quarter")c.setMonth(c.getMonth()+3*dir);
  else if(state.view==="year")c.setFullYear(c.getFullYear()+dir);
  state.cursor=new Date(c); renderCalendar(dir);
}

function renderChips(){
  const box=document.getElementById("projectChips"); if(!box) return;
  box.innerHTML='<div class="chip-group chip-project-group"><span class="chip-group-label">Projects</span><div class="chip-row" data-chip-row="projects"></div></div>'+
    '<div class="chip-group chip-layer-group"><span class="chip-group-label">Layers</span><div class="chip-row" data-chip-row="layers"></div></div>';
  const projectRow=box.querySelector('[data-chip-row="projects"]');
  const layerRow=box.querySelector('[data-chip-row="layers"]');

  const makeButton=(className,on,html,label,fn)=>{
    const c=document.createElement("button");
    c.type="button";
    c.className=className+(on?"":" off");
    c.setAttribute("aria-pressed",String(!!on));
    c.setAttribute("aria-label",label);
    c.innerHTML=html;
    c.onclick=fn;
    return c;
  };

  cfg.projects.forEach(p=>{
    projectRow.appendChild(makeButton(
      "chip project-chip",p.on,
      '<span class="dot" style="background:'+p.color+'"></span><span>'+esc(p.name)+'</span>',
      (p.on?"Hide ":"Show ")+p.name,
      ()=>{ p.on=!p.on; saveCfg(); renderChips(); loadAll(); }
    ));
  });

  const layer=(icon,label,on,fn)=>layerRow.appendChild(makeButton(
    "chip layer",on,
    '<span class="chip-icon" aria-hidden="true">'+icon+'</span><span>'+esc(label)+'</span>',
    (on?"Hide ":"Show ")+label,
    fn
  ));
  layer("🎉","Occasions",cfg.showOccasions,()=>{ cfg.showOccasions=!cfg.showOccasions; saveCfg(); renderChips(); renderCalendar(); });
  layer("📍","Stores & visits",cfg.showStores,()=>{ cfg.showStores=!cfg.showStores; saveCfg(); renderChips(); renderCalendar(); });
}

function renderPersonToggles(){
  const box=document.getElementById("personToggles"); if(!box) return;
  const pf=state.peopleFilter;
  const chip=(label,val,active)=>'<span class="ptog'+(active?" on":"")+'" data-val="'+val+'">'+esc(label)+'</span>';
  let html=chip("Everyone","",pf.length===0);
  cfg.people.forEach(g=>html+=chip(firstName(userName(g)),g,pf.includes(g)));
  html+=chip("Unassigned","unassigned",pf.includes("unassigned"));
  box.innerHTML=html;
  box.querySelectorAll(".ptog").forEach(el=>el.onclick=()=>{
    const v=el.dataset.val;
    if(v===""){ state.peopleFilter=[]; }
    else { const i=state.peopleFilter.indexOf(v); if(i>=0) state.peopleFilter.splice(i,1); else state.peopleFilter.push(v); }
    renderPersonToggles(); renderCalendar();
  });
}

function renderCurriculumBar(){
  const el=document.getElementById("curriculumBar"); if(!el) return;
  const cur=state.curriculum[state.cursor.getMonth()]; if(!cur){ el.style.display="none"; return; }
  el.style.display="flex";
  el.innerHTML='<span class="cur-tag">OB FIT · '+MO[state.cursor.getMonth()].slice(0,3).toUpperCase()+'</span>'+
    '<span class="cur-body"><strong>'+esc(cur.t)+'</strong> — '+esc(cur.d)+
      (cur.q?' <span class="cur-q">⚑ '+esc(cur.q)+'</span>':'')+
      (cur.biz?' <span class="cur-biz">'+esc(cur.biz)+'</span>':'')+'</span>'+
    '<a class="cur-link" href="'+CURRICULUM_URL+'" target="_blank">Full marathon ↗</a>';
}

function renderCalendar(dir){
  const commsToggle=document.getElementById("showCommunityMessages");
  if(commsToggle) commsToggle.checked=cfg.showComms!==false;
  const sl=document.getElementById("zoomSlider");
  if(sl && +sl.value!==VIEWS.indexOf(state.view)) sl.value=VIEWS.indexOf(state.view);
  document.querySelectorAll(".ztick").forEach(t=>t.classList.toggle("on",t.dataset.v===state.view));
  renderCurriculumBar(); renderTrainerToggles();
  const cal=document.getElementById("calendar");
  const lbl=document.getElementById("periodLabel");
  const c=state.cursor;
  cal.classList.remove("slide-l","slide-r","fade-in","zoom-in","zoom-out"); void cal.offsetWidth;
  if(dir===1) cal.classList.add("slide-l");
  else if(dir===-1) cal.classList.add("slide-r");
  else if(dir==="zin") cal.classList.add("zoom-in");
  else if(dir==="zout") cal.classList.add("zoom-out");
  else cal.classList.add("fade-in");
  if(state.view==="month"){ lbl.textContent=MO[c.getMonth()]+" "+c.getFullYear(); cal.innerHTML=monthHTML(c); wireMonth(); }
  else if(state.view==="week"){ renderWeek(cal,lbl,c); }
  else if(state.view==="day"){ renderDay(cal,lbl,c); }
  else if(state.view==="quarter"){ renderQuarter(cal,lbl,c); }
  else if(state.view==="year"){ renderYear(cal,lbl,c); }
}

/* stores layers: openings (amber) + trainer visits (coloured per trainer).
   Visits come from the SCHEDULE board — the forward plan of who goes where.
   A trainer filter, when set, hides everyone else's visits (openings stay). */
function storesOn(dt){
  if(!cfg.showStores) return [];
  const tf=state.trainerFilter;
  return state.tasks.filter(t=>(t.isSchedule||t.isOpening) && !t.completed && t.due && sameDay(pd(t.due),dt))
    .filter(t=> t.isOpening || !tf.length || tf.includes(trainerOf(t)));
}
function storePillHTML(t){
  if(t.isOpening){
    const tr=trainerOf(t);
    return '<span class="pill store open-store" data-gid="'+t.gid+'" style="--pc:'+LAYER.opening+'" title="'+esc(t.name)+' · handover'+(tr?" · "+esc(tr):"")+'">'+
      '<i class="pdot"></i><b class="st-tag">HO</b>'+esc(t.name)+'</span>';
  }
  const tr=trainerOf(t), col=trainerColor(tr);
  const sup=(t.trainerSupport||[]).filter(Boolean);
  const supDot=sup.length?'<i class="pdot2" style="background:'+trainerColor(sup[0])+'"></i>':'';
  const tip=(tr||"visit")+" → "+t.name+(sup.length?" (+ "+sup.join(", ")+")":"");
  return '<span class="pill store" data-gid="'+t.gid+'" style="--pc:'+col+'" title="'+esc(tip)+'">'+
    '<i class="pdot"></i>'+supDot+'<b class="st-tag">'+esc(tr?firstName(tr):"visit")+'</b>'+esc(t.name)+'</span>';
}
/* the row of trainer filter chips under the calendar toolbar */
function renderTrainerToggles(){
  const box=document.getElementById("trainerBar"); if(!box) return;
  if(!cfg.showStores){ box.style.display="none"; return; }
  const names=[...new Set(state.tasks.filter(t=>t.isSchedule&&!t.completed&&t.due)
    .map(trainerOf).filter(Boolean))].sort();
  if(!names.length){ box.style.display="none"; return; }
  box.style.display="flex";
  const tf=state.trainerFilter;
  const chip=(label,val,active,col)=>'<span class="ttog'+(active?" on":"")+'" data-val="'+esc(val)+'"'+
    (col?' style="--tc:'+col+'"':'')+'>'+(col?'<i class="tdot"></i>':'')+esc(label)+'</span>';
  let html='<span class="trainer-bar-label">Trainers</span>'+chip("All","",tf.length===0,"");
  names.forEach(n=>html+=chip(n,n,tf.includes(n),trainerColor(n)));
  box.innerHTML=html;
  box.querySelectorAll(".ttog").forEach(el=>el.onclick=()=>{
    const v=el.dataset.val;
    if(v===""){ state.trainerFilter=[]; }
    else { const i=state.trainerFilter.indexOf(v); if(i>=0) state.trainerFilter.splice(i,1); else state.trainerFilter.push(v); }
    renderTrainerToggles(); renderCalendar();
  });
}

/* quarter: three months side by side, same mini grids as the year */
function renderQuarter(cal,lbl,c){
  const y=c.getFullYear();
  const startM=Math.floor(c.getMonth()/3)*3;
  lbl.textContent="Q"+(startM/3+1)+" "+y+" · "+MO[startM].slice(0,3)+"–"+MO[startM+2].slice(0,3);
  let html='<div class="quarter-grid">';
  for(let m=startM;m<startM+3;m++) html+=miniMonthHTML(y,m);
  cal.innerHTML=html+'</div>';
  cal.querySelectorAll(".mini h4").forEach(h=>h.onclick=()=>{
    state.cursor=new Date(y,+h.dataset.m,1); setView("month");
  });
  cal.querySelectorAll(".mini .md").forEach(d=>{
    if(d.dataset.date) d.onclick=()=>{ state.cursor=pd(d.dataset.date); setView("day"); };
  });
}

/* ---- pills ---- */
function pillHTML(t){
  const camp=isCampaignTask(t);
  const cls="pill"+(t.isShoot?" shoot":"")+(t.isEvent?" event":"")+(camp?" camp":"")+(t.isPlaceholder?" place":"")+(t.completed?" done":"");
  const icon=t.isShoot?"🎬 ":t.isEvent?"⭐ ":t.isPlaceholder?"":"";
  return '<span class="'+cls+'" draggable="true" data-gid="'+t.gid+'" style="--pc:'+(t.isPlaceholder?"#6B7A8F":t.projectColor)+'" title="'+esc(t.name)+'">'+
    '<i class="pdot"></i>'+icon+esc(t.name)+'</span>';
}
function commsPillHTML(t){
  const c=communityOf(t);
  return '<span class="pill wa'+(t.completed?" done":"")+'" draggable="true" data-gid="'+t.gid+'" style="--pc:'+(c?c.color:"#7A5FB0")+'" title="'+esc(t.name)+(c?' → '+c.name:'')+(t.sendTime?' · '+t.sendTime:'')+'">'+
    (t.sendTime?'<b class="pill-time">'+t.sendTime+'</b> ':'')+esc(t.name.replace(/^\[.+?\]\s*/,""))+'</span>';
}

/* ---- MONTH ---- */
function monthHTML(c){
  const first=new Date(c.getFullYear(),c.getMonth(),1);
  let start=first.getDay(); start=(start+6)%7;
  const gridStart=new Date(first); gridStart.setDate(1-start);
  const today=todayD();
  let html='<div class="dow">'+DOW.map(d=>"<div>"+d+"</div>").join("")+'</div><div class="grid">';
  for(let i=0;i<42;i++){
    const dt=new Date(gridStart); dt.setDate(gridStart.getDate()+i);
    const dim=dt.getMonth()!==c.getMonth();
    const occ=occasionsOn(dt), tks=tasksOn(dt).sort((a,b)=>b.isShoot-a.isShoot);
    const comms=cfg.showComms?commsOn(dt):[];
    html+='<div class="cell'+(dim?" dim":"")+(sameDay(dt,today)?" today":"")+'" data-date="'+iso(dt)+'">';
    html+='<span class="dnum">'+dt.getDate()+'</span>';
    campaignsOn(dt).forEach(c2=>{ const showName=sameDay(dt,pd(c2.start))||i%7===0;
      html+='<div class="cbar" style="background:'+c2.color+'" title="'+esc(c2.name)+'">'+(showName?esc(c2.name):"&nbsp;")+'</div>'; });
    occ.slice(0,2).forEach(o=>html+='<span class="occ" title="'+esc(o.name)+(o.reg?' · '+o.reg:'')+'">'+esc(o.name)+'</span>');
    const busy = cfg.showComms && commsBusy(dt);
    if(busy) html+='<span class="busyflag" title="More than 3 messages to one community today">🔥 busy comms day</span>';
    storesOn(dt).slice(0,2).forEach(t=>html+=storePillHTML(t));
    tks.slice(0,4).forEach(t=>html+=pillHTML(t));
    comms.slice(0,2).forEach(t=>html+=commsPillHTML(t));
    const extra=(tks.length-4)+(comms.length>2?comms.length-2:0);
    if(extra>0) html+='<span class="more" data-more="'+iso(dt)+'">+'+extra+' more</span>';
    html+='</div>';
  }
  return html+'</div>';
}
function commsBusy(dt){
  const byComm={};
  commsOn(dt).forEach(t=>{ const c=communityOf(t); const k=c?c.name:"?"; byComm[k]=(byComm[k]||0)+1; });
  return Object.values(byComm).some(n=>n>3);
}
function wireMonth(){
  document.querySelectorAll(".pill").forEach(p=>{
    p.onclick=e=>{ e.stopPropagation(); if(p.classList.contains("wa")) openCommPreview(p.dataset.gid); else openDrawer(p.dataset.gid); };
    p.ondragstart=e=>{ e.dataTransfer.setData("text/gid",p.dataset.gid); p.classList.add("lift"); };
    p.ondragend=()=>p.classList.remove("lift");
  });
  document.querySelectorAll("[data-more]").forEach(m=>{
    m.onclick=()=>{ state.cursor=pd(m.dataset.more); setView("day"); };
  });
  document.querySelectorAll(".cell,[data-date].col").forEach(cell=>{
    cell.ondragover=e=>{ e.preventDefault(); cell.classList.add("dragover"); };
    cell.ondragleave=()=>cell.classList.remove("dragover");
    cell.ondrop=e=>{ e.preventDefault(); cell.classList.remove("dragover");
      const gid=e.dataTransfer.getData("text/gid"); if(gid) reschedule(gid,cell.dataset.date); };
  });
}

/* ---- WEEK ---- */
function renderWeek(cal,lbl,c){
  let start=new Date(c); let d=(start.getDay()+6)%7; start.setDate(start.getDate()-d);
  const end=new Date(start); end.setDate(start.getDate()+6);
  lbl.textContent=start.getDate()+" "+MO[start.getMonth()].slice(0,3)+" – "+end.getDate()+" "+MO[end.getMonth()].slice(0,3);
  const today=todayD(); let html='<div class="wk">';
  for(let i=0;i<7;i++){
    const dt=new Date(start); dt.setDate(start.getDate()+i);
    const occ=occasionsOn(dt), tks=tasksOn(dt).sort((a,b)=>b.isShoot-a.isShoot);
    const comms=cfg.showComms?commsOn(dt):[];
    html+='<div class="col'+(sameDay(dt,today)?" today":"")+'" data-date="'+iso(dt)+'"><h4>'+DOW[i]+" "+dt.getDate()+'</h4><div class="body">';
    campaignsOn(dt).forEach(c2=>html+='<div class="cbar" style="background:'+c2.color+'">'+esc(c2.name)+'</div>');
    occ.forEach(o=>html+='<span class="occ">'+esc(o.name)+'</span>');
    storesOn(dt).forEach(t=>html+=storePillHTML(t));
    tks.forEach(t=>html+=pillHTML(t));
    comms.forEach(t=>html+=commsPillHTML(t));
    if(!occ.length&&!tks.length&&!comms.length&&!storesOn(dt).length) html+='<span class="empty">—</span>';
    html+='</div></div>';
  }
  cal.innerHTML=html+'</div>';
  wireMonth();
}

/* ---- DAY ---- */
function renderDay(cal,lbl,c){
  lbl.textContent=DOW[(c.getDay()+6)%7]+" "+c.getDate()+" "+MO[c.getMonth()];
  const occ=occasionsOn(c), tks=tasksOn(c).sort((a,b)=>b.isShoot-a.isShoot);
  const comms=cfg.showComms?commsOn(c):[];
  let html='<div class="daylist">';
  campaignsOn(c).forEach(c2=>html+='<div class="cbar" style="background:'+c2.color+'">Campaign: '+esc(c2.name)+'</div>');
  occ.forEach(o=>html+='<span class="occ">'+esc(o.name)+'</span>');
  storesOn(c).forEach(t=>html+=storePillHTML(t));
  if(!tks.length&&!comms.length&&!storesOn(c).length) html+='<div class="empty">'+pick(EMPTY_LINES)+'</div>';
  tks.forEach(t=>html+=cardHTML(t));
  comms.forEach(t=>html+=commsPillHTML(t));
  cal.innerHTML=html+'</div>';
  wireCards(cal); wireMonth();
}

/* ---- QUARTER agenda ---- */
function renderRange(cal,lbl,c,months,label){
  const start=new Date(c.getFullYear(),c.getMonth(),1);
  const end=new Date(c.getFullYear(),c.getMonth()+months,0);
  lbl.textContent=MO[start.getMonth()].slice(0,3)+"–"+MO[end.getMonth()].slice(0,3)+" "+c.getFullYear();
  const items=[...visibleTasks(),...state.tasks.filter(t=>t.isOccasion)]
    .filter(t=>t.due).map(t=>({t,d:pd(t.due)}))
    .filter(x=>x.d>=start&&x.d<=end);
  (cfg.campaigns||[]).forEach(cc=>{ const s=pd(cc.start); if(s&&s>=start&&s<=end) items.push({t:{__campaign:cc,name:cc.name},d:s}); });
  items.sort((a,b)=>a.d-b.d);
  let html='<div class="agenda">'; let curMo=-1;
  if(!items.length) html+='<div class="empty">'+pick(EMPTY_LINES)+'</div>';
  items.forEach(({t,d})=>{
    if(d.getMonth()!==curMo){ curMo=d.getMonth(); html+='<h3>'+MO[curMo]+" "+d.getFullYear()+'</h3>'; }
    html+='<div class="arow" data-gid="'+(t.isOccasion||t.__campaign?"":t.gid)+'"><span class="adate">'+d.getDate()+" "+MO[d.getMonth()].slice(0,3)+'</span>'+
      (t.__campaign?'<span class="cbar inline" style="background:'+t.__campaign.color+'">Campaign: '+esc(t.name)+'</span>'
      :t.isOccasion?'<span class="occ">'+esc(t.name)+'</span>'
        :'<span class="dot" style="background:'+(t.isShoot?"#00A8A8":t.projectColor)+'"></span> '+
         (t.isShoot?"🎬 ":"")+esc(t.name)+' <span class="cmeta">'+esc(t.projectName)+(t.assignee?" · "+esc(firstName(t.assignee.name)):"")+'</span>')+'</div>';
  });
  cal.innerHTML=html+'</div>';
  cal.querySelectorAll(".arow[data-gid]").forEach(r=>{ if(r.dataset.gid) r.onclick=()=>openDrawer(r.dataset.gid); });
}

/* ---- YEAR: scrollable months ---- */
function renderYear(cal,lbl,c){
  lbl.textContent=String(c.getFullYear());
  const y=c.getFullYear();
  let html='<div class="year-scroll">';
  for(let m=0;m<12;m++){
    html+=miniMonthHTML(y,m);
  }
  cal.innerHTML=html+'</div>';
  // click month header -> zoom into that month
  cal.querySelectorAll(".mini h4").forEach(h=>h.onclick=()=>{
    state.cursor=new Date(y,+h.dataset.m,1); setView("month");
  });
  cal.querySelectorAll(".mini .md").forEach(d=>{
    if(d.dataset.date) d.onclick=()=>{ state.cursor=pd(d.dataset.date); setView("day"); };
  });
  // scroll current month into view
  const cur=cal.querySelector('.mini[data-m="'+new Date().getMonth()+'"]');
  if(cur && y===new Date().getFullYear()) setTimeout(()=>cur.scrollIntoView({block:"nearest"}),60);
}
function miniMonthHTML(y,m){
  const first=new Date(y,m,1);
  let start=(first.getDay()+6)%7;
  const dim=new Date(y,m+1,0).getDate();
  const today=todayD();
  const vt=visibleTasks();
  let cells="";
  for(let i=0;i<start;i++) cells+='<span class="md pad"></span>';
  for(let d=1;d<=dim;d++){
    const dt=new Date(y,m,d), dstr=iso(dt);
    const dayTasks=vt.filter(t=>t.due===dstr);
    const shoots=dayTasks.filter(t=>t.isShoot).length;
    const comms=cfg.showComms?state.tasks.filter(t=>t.isComms&&!t.isKeeper&&t.due===dstr).length:0;
    const stores=cfg.showStores?state.tasks.filter(t=>(t.isSchedule||t.isOpening)&&!t.completed&&t.due===dstr).length:0;
    const occ=cfg.showOccasions&&(OCCASIONS_APP.some(o=>o.date===dstr)||state.tasks.some(t=>t.isOccasion&&t.due===dstr));
    const camp=campaignsOn(dt).length>0;
    let cls="md"; if(sameDay(dt,today)) cls+=" now"; if(camp) cls+=" camp";
    let dots="";
    if(shoots) dots+='<i class="yd shoot"></i>';
    else if(dayTasks.length) dots+='<i class="yd t'+Math.min(3,dayTasks.length)+'"></i>';
    if(comms) dots+='<i class="yd wa"></i>';
    if(stores) dots+='<i class="yd store"></i>';
    if(occ) dots+='<i class="yd occ"></i>';
    cells+='<span class="'+cls+'" data-date="'+dstr+'" title="'+dstr+(dayTasks.length?' · '+dayTasks.length+' task(s)':'')+(shoots?' · 🎬':'')+'">'+d+dots+'</span>';
  }
  const monthTasks=vt.filter(t=>t.due&&pd(t.due).getFullYear()===y&&pd(t.due).getMonth()===m);
  const nShoots=monthTasks.filter(t=>t.isShoot).length;
  const cur=state.curriculum[m];
  return '<div class="mini" data-m="'+m+'"><h4 data-m="'+m+'">'+MO[m]+' <span class="mini-meta">'+
    (nShoots?('🎬×'+nShoots+' · '):'')+monthTasks.length+' tasks</span></h4>'+
    (cur?'<div class="mini-cur">'+esc(cur.t)+'</div>':'')+
    '<div class="mgrid"><span class="mh">M</span><span class="mh">T</span><span class="mh">W</span><span class="mh">T</span><span class="mh">F</span><span class="mh">S</span><span class="mh">S</span>'+cells+'</div></div>';
}
