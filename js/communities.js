/* ================================================================
   COMMUNITIES — per-community planner, mini calendar, insights,
                 weekly export summariser
   ================================================================ */

let commCursor = new Date();   // month shown in the communities mini-cal
let commFilter = null;         // community key or null = all

function wireCommunityControls(){
  document.getElementById("waAdd").onclick=addWAMessage;
  document.getElementById("waSummarise").onclick=summariseCommunities;
  document.getElementById("wcPrev").onclick=()=>{ commCursor.setMonth(commCursor.getMonth()-1); renderCommunities(); };
  document.getElementById("wcNext").onclick=()=>{ commCursor.setMonth(commCursor.getMonth()+1); renderCommunities(); };
  const nameInput=document.getElementById("waName");
  if(nameInput) nameInput.onkeydown=e=>{ if(e.key==="Enter") addWAMessage(); };
}

function commMsgs(){
  return state.tasks.filter(t=>t.isComms && !t.isKeeper);
}

/* The Communities planner uses the existing shared Asana board.  The board
   id is fixed in data.js so every browser opens the same source of truth and
   the app never offers to create a duplicate project. */
async function ensureMsgBoard(){
  if(DEMO) return cfg.msgBoard||"demo-msg";
  if(cfg.msgBoard!==COMMUNITIES_PROJECT){ cfg.msgBoard=COMMUNITIES_PROJECT; saveCfg(); }
  return COMMUNITIES_PROJECT;
}
function renderMsgSetup(){
  const setup=document.getElementById("msgSetup");
  if(setup) setup.style.display="none";
  const link=document.getElementById("communitiesAsanaLink");
  if(link) link.href=DEMO?"https://app.asana.com/demo":COMMUNITIES_URL;
  return false;
}

function renderCommunities(){
  renderMsgSetup();
  renderCommLegend(); renderCommComposer(); renderCommCalendar(); renderCommList(); renderCommInsights();
}

/* ---- legend / filter chips ---- */
function renderCommLegend(){
  const box=document.getElementById("commLegend"); if(!box) return;
  box.innerHTML = '<span class="ptog'+(commFilter===null?" on":"")+'" data-c="">All</span>'+
    cfg.communities.map(c=>'<span class="ptog cdot'+(commFilter===c.key?" on":"")+'" data-c="'+c.key+'" style="--cc:'+c.color+'">'+esc(c.name)+'</span>').join("");
  box.querySelectorAll(".ptog").forEach(el=>el.onclick=()=>{
    commFilter = el.dataset.c || null; renderCommunities();
  });
}

/* ---- composer ---- */
function renderCommComposer(){
  const box=document.getElementById("commTargets"); if(!box) return;
  box.innerHTML = cfg.communities.map(c=>
    '<label class="ctgt" style="--cc:'+c.color+'"><input type="checkbox" value="'+c.key+'"><span>'+esc(c.name)+'</span></label>').join("");
  const pr=document.getElementById("waPurpose");
  if(pr && !pr.dataset.filled){
    pr.innerHTML='<option value="">purpose (optional)</option>'+MSG_PURPOSES.map(p=>'<option value="'+p.key+'">'+p.label+'</option>').join("");
    pr.dataset.filled="1";
  }
}
async function addWAMessage(){
  const inp=document.getElementById("waName"), dt=document.getElementById("waDate"), pr=document.getElementById("waPurpose");
  const name=inp.value.trim(); if(!name){toast("Type the message first");return;}
  const targets=[...document.querySelectorAll("#commTargets input:checked")].map(i=>cfg.communities.find(c=>c.key===i.value)).filter(Boolean);
  if(!targets.length){ toast("Pick at least one community"); return; }
  const board = await ensureMsgBoard(); if(!board) return;
  const secMap = await ensureWASections();
  const notes = pr.value ? "#purpose:"+pr.value : "";
  const tasks = targets.map(c=>{
    const t={name, project_id:board, notes};
    if(dt.value) t.due_on=dt.value;
    if(secMap && secMap[c.name]) t.section_id=secMap[c.name];
    else t.name="["+c.name+"] "+name;
    return t;
  });
  try{
    await call("create_tasks",{tasks});
    inp.value=""; pr.value="";
    toast(targets.length>1?"Planned for "+targets.length+" communities":"Message planned");
    loadAll();
  }catch(e){ toast("Failed: "+e.message); }
}
async function ensureWASections(){
  if(state.waSections) return state.waSections;
  try{
    const board=await ensureMsgBoard();
    const res=await call("get_project",{project_id:board,include_sections:true,opt_fields:"sections.name"});
    const secs=(res.data&&res.data.sections)||[];
    const map={};
    for(const c of cfg.communities){
      const hit=secs.find(s=>s.name.toLowerCase()===c.name.toLowerCase());
      if(hit) map[c.name]=hit.gid;
      else{
        try{ const made=await call("create_section",{project_id:board,name:c.name});
          if(made.data&&made.data.gid) map[c.name]=made.data.gid;
        }catch(e){ /* fall back to [Name] prefix */ }
      }
    }
    state.waSections=map; return map;
  }catch(e){ return null; }
}

/* ---- mini calendar ---- */
function renderCommCalendar(){
  const cal=document.getElementById("commCal"); if(!cal) return;
  const c=commCursor;
  document.getElementById("wcLabel").textContent=MO[c.getMonth()]+" "+c.getFullYear();
  const first=new Date(c.getFullYear(),c.getMonth(),1);
  let start=(first.getDay()+6)%7;
  const gridStart=new Date(first); gridStart.setDate(1-start);
  const today=todayD();
  const msgs=commMsgs().filter(t=>!commFilter || (communityOf(t)&&communityOf(t).key===commFilter));
  let html='<div class="dow">'+DOW.map(d=>"<div>"+d+"</div>").join("")+'</div><div class="grid wc-grid">';
  for(let i=0;i<42;i++){
    const dt=new Date(gridStart); dt.setDate(gridStart.getDate()+i);
    const dim=dt.getMonth()!==c.getMonth();
    const dstr=iso(dt);
    const dayMsgs=msgs.filter(t=>t.due===dstr);
    const byComm={};
    dayMsgs.forEach(t=>{ const cm=communityOf(t); const k=cm?cm.name:"?"; byComm[k]=(byComm[k]||0)+1; });
    const busy=Object.values(byComm).some(n=>n>3);
    html+='<div class="cell wc-cell'+(dim?" dim":"")+(sameDay(dt,today)?" today":"")+'" data-date="'+dstr+'">'+
      '<span class="dnum">'+dt.getDate()+(busy?' <span title="More than 3 to one community — easy tiger">🔥</span>':'')+'</span>';
    dayMsgs.slice(0,3).forEach(t=>{
      const cm=communityOf(t);
      html+='<span class="wmsg'+(t.completed?" sent":"")+'" data-gid="'+t.gid+'" style="--cc:'+(cm?cm.color:"#999")+'" title="'+esc(t.name)+(cm?" → "+cm.name:"")+(t.completed?" · sent ✓":"")+'">'+
        (t.completed?"✓ ":"")+esc(t.name.replace(/^\[.+?\]\s*/,""))+'</span>';
    });
    if(dayMsgs.length>3) html+='<span class="more">+'+(dayMsgs.length-3)+'</span>';
    html+='</div>';
  }
  cal.innerHTML=html+'</div>';
  cal.querySelectorAll(".wmsg").forEach(m=>m.onclick=()=>openDrawer(m.dataset.gid));
}

/* ---- upcoming list ---- */
function renderCommList(){
  const box=document.getElementById("waList"); if(!box) return;
  const today=todayD();
  let msgs=commMsgs().filter(t=>!commFilter || (communityOf(t)&&communityOf(t).key===commFilter));
  const upcoming=msgs.filter(t=>!t.completed).sort((a,b)=>(a.due||"9999")<(b.due||"9999")?-1:1).slice(0,12);
  if(!upcoming.length){ box.innerHTML='<div class="empty">Nothing queued yet.</div>'; return; }
  box.innerHTML=upcoming.map(t=>{
    const cm=communityOf(t); const pu=purposeOf(t);
    const od=t.due&&pd(t.due)<today;
    return '<div class="warow" data-gid="'+t.gid+'">'+
      '<span class="wc-dot" style="background:'+(cm?cm.color:"#999")+'" title="'+(cm?esc(cm.name):"no community")+'"></span>'+
      '<span class="wa-txt">'+esc(t.name.replace(/^\[.+?\]\s*/,""))+
        '<span class="wa-meta">'+(cm?esc(cm.name):"—")+(pu?" · "+pu.label:"")+(t.due?' · <b class="'+(od?"overdue":"")+'">'+(od?"⚠ ":"")+pd(t.due).toDateString().slice(0,10)+'</b>':' · no date')+'</span></span>'+
      '<button class="btn teal sm wa-sent" data-gid="'+t.gid+'">Sent ✓</button></div>';
  }).join("");
  box.querySelectorAll(".warow").forEach(r=>r.onclick=e=>{ if(!e.target.closest(".wa-sent")) openDrawer(r.dataset.gid); });
  box.querySelectorAll(".wa-sent").forEach(b=>b.onclick=e=>{ e.stopPropagation(); toggleDone(b.dataset.gid,true); });
}

/* ---- insights ---- */
function renderCommInsights(){
  const box=document.getElementById("commInsights"); if(!box) return;
  const msgs=commMsgs();
  if(!msgs.length){ box.innerHTML='<div class="empty">Plan a few messages and the numbers show up here.</div>'; return; }
  const y=commCursor.getFullYear(), m=commCursor.getMonth();
  const inMonth=msgs.filter(t=>t.due&&pd(t.due).getFullYear()===y&&pd(t.due).getMonth()===m);
  const sent=inMonth.filter(t=>t.completed).length;
  // per community
  const per=cfg.communities.map(c=>({c, n:inMonth.filter(t=>{const cm=communityOf(t);return cm&&cm.key===c.key;}).length}));
  const maxPer=Math.max(1,...per.map(p=>p.n));
  // busiest weekday (all time)
  const wd=[0,0,0,0,0,0,0];
  msgs.filter(t=>t.due).forEach(t=>{ wd[(pd(t.due).getDay()+6)%7]++; });
  const busiest=wd.indexOf(Math.max(...wd));
  // purpose mix (all time)
  const pmix=MSG_PURPOSES.map(p=>({p,n:msgs.filter(t=>{const x=purposeOf(t);return x&&x.key===p.key;}).length})).filter(x=>x.n>0);
  const maxP=Math.max(1,...pmix.map(x=>x.n));
  box.innerHTML=
    '<div class="ins-tiles">'+
      '<div class="tile"><b>'+inMonth.length+'</b><span>planned · '+MO[m].slice(0,3)+'</span></div>'+
      '<div class="tile"><b>'+sent+'</b><span>sent ✓</span></div>'+
      '<div class="tile"><b>'+(inMonth.length?Math.round(sent/inMonth.length*100):0)+'%</b><span>sent rate</span></div>'+
      '<div class="tile"><b>'+DOW[busiest]+'</b><span>busiest day</span></div>'+
    '</div>'+
    '<div class="ins-h">Per community — '+MO[m]+'</div>'+
    per.map(({c,n})=>'<div class="bar-row"><span class="bar-lbl">'+esc(c.name)+'</span>'+
      '<span class="bar"><i style="width:'+(n/maxPer*100)+'%;background:'+c.color+'"></i></span><span class="bar-n">'+n+'</span></div>').join("")+
    (pmix.length?'<div class="ins-h">What we send (purpose mix)</div>'+
      pmix.map(({p,n})=>'<div class="bar-row"><span class="bar-lbl">'+p.label+'</span>'+
        '<span class="bar"><i style="width:'+(n/maxP*100)+'%"></i></span><span class="bar-n">'+n+'</span></div>').join("")
      :'<div class="hint" style="margin-top:8px">Tip: pick a purpose when planning a message and you\'ll get a mix chart here — zero admin, real insight.</div>');
}

/* ---- weekly export summariser ---- */
async function summariseCommunities(){
  const txt=document.getElementById("waPaste").value.trim();
  const out=document.getElementById("waSummary");
  const commSel=document.getElementById("waPasteComm");
  if(!txt){ toast("Paste a chat export first"); return; }
  out.style.display="block"; out.innerHTML='<span class="spin"></span> reading the room…';
  const cName = commSel && commSel.value ? commSel.value : "unspecified community";
  try{
    const res=await askAI(
      "You summarise WhatsApp community activity for the Ocean Basket Academy team (internal, friendly, concise). This export is from the '"+cName+"' community. Return: (1) a 2-3 sentence TL;DR, (2) key themes & recurring questions as short bullets, (3) anything that needs a reply or action — flag misunderstandings about training content especially, (4) one line on the vibe/engagement level. Keep it tight.",
      [{community:cName, chat_export:txt.slice(0,12000)}]);
    const s=typeof res==="string"?res:(res.text||JSON.stringify(res));
    out.innerHTML=esc(s).replace(/\n/g,"<br>");
  }catch(e){ out.textContent="Couldn't summarise: "+e.message; }
}

function fillPasteCommSelect(){
  const sel=document.getElementById("waPasteComm");
  if(sel && !sel.dataset.filled){
    sel.innerHTML='<option value="">which community?</option>'+cfg.communities.map(c=>'<option>'+esc(c.name)+'</option>').join("");
    sel.dataset.filled="1";
  }
}
document.addEventListener("DOMContentLoaded",fillPasteCommSelect);
