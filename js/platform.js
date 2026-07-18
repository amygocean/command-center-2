/* ================================================================
   WHATSAPP ACADEMY — the software side. Our management board and
   the X Force bugs board side by side, with age on every open item,
   a quick log, and an AI "state of the platform" readout.
   ================================================================ */

function ageDays(t){
  const ref=t.due?pd(t.due):null;
  if(ref) return Math.max(0,Math.round((todayD()-ref)/864e5));
  return null;
}

function platRow(t){
  const a=ageDays(t);
  const stale=a!==null&&a>=14;
  return '<div class="ev-row" data-gid="'+t.gid+'">'+
    '<span class="news-main"><span class="news-t">'+esc(t.name)+'</span>'+
    '<span class="news-meta">'+(t.assignee?esc(firstName(t.assignee.name))+' · ':'')+
    (t.due?'due '+pd(t.due).toDateString().slice(4,10):'no date')+'</span></span>'+
    (a!==null?'<span class="'+(stale?"ev-warn":"news-meta")+'" style="white-space:nowrap">'+(stale?"stuck ":"")+a+'d</span>':'')+
    '</div>';
}

function renderPlatform(){
  const box=document.getElementById("platformBody"); if(!box) return;
  const ours=state.tasks.filter(t=>t.isPlatform&&!t.completed&&!t.isKeeper).sort((a,b)=>(a.due||"9999")<(b.due||"9999")?-1:1);
  const bugs=state.tasks.filter(t=>t.isBug&&!t.completed).sort((a,b)=>(a.due||"9999")<(b.due||"9999")?-1:1);
  box.innerHTML=
    '<div class="comm-grid">'+
      '<div class="comm-col"><h3 class="comm-h">Our board — managing the platform ('+ours.length+' open)</h3>'+
        '<div class="qadd" style="margin:0 0 10px"><input class="qadd-name" id="platName" placeholder="Log a complaint, issue or request…">'+
        '<button class="qadd-btn" id="platAdd">Log it</button></div>'+
        (ours.length?ours.map(platRow).join(""):'<div class="empty">'+pick(EMPTY_LINES)+'</div>')+
      '</div>'+
      '<div class="comm-col"><h3 class="comm-h">X Force bugs &amp; errors ('+bugs.length+' open)</h3>'+
        (bugs.length?bugs.map(platRow).join(""):'<div class="empty">No open bugs. Frame this screen.</div>')+
        '<div style="margin-top:16px"><button class="btn glow" id="platPulse">State of the platform</button></div>'+
        '<div id="platPulseOut" class="ideabox" style="margin-top:10px;display:none"></div>'+
      '</div>'+
    '</div>';
  box.querySelectorAll(".ev-row[data-gid]").forEach(r=>r.onclick=()=>openDrawer(r.dataset.gid));
  document.getElementById("platAdd").onclick=async()=>{
    const inp=document.getElementById("platName"); const n=inp.value.trim(); if(!n){toast("Describe it first");return;}
    try{ await call("create_tasks",{tasks:[{name:n,project_id:WA_PROJECT,notes:"Logged from the Command Center, "+iso(todayD())}]});
      inp.value=""; toast("Logged"); loadAll();
    }catch(e){ toast("Failed: "+e.message); }
  };
  const inpEl=document.getElementById("platName");
  if(inpEl) inpEl.onkeydown=e=>{ if(e.key==="Enter") document.getElementById("platAdd").click(); };
  document.getElementById("platPulse").onclick=async()=>{
    const out=document.getElementById("platPulseOut");
    out.style.display="block"; out.innerHTML='<span class="spin"></span> taking the pulse…';
    try{
      const text=await askAI(
        "You brief the Ocean Basket Academy team on the state of their WhatsApp training platform (built by external provider X Force). From the two open-item lists (their own management board and the provider's bug board), write: one-sentence overall health call, the 2-3 things to chase the provider on first (oldest/stuck items), and anything that looks like a pattern. Under 120 words, direct, minimal fluff — this gets read before a call with the provider.",
        [{our_board:ours.map(t=>({name:t.name,due:t.due,age_days:ageDays(t)})),
          bugs:bugs.map(t=>({name:t.name,due:t.due,age_days:ageDays(t)}))}]);
      out.innerHTML=esc(text).replace(/\n/g,"<br>");
    }catch(e){ out.textContent="Couldn't summarise: "+e.message; }
  };
}
