/* ================================================================
   TRAINING & NEW STORES — trainer-first oversight.

   Two Asana boards feed this tab, each doing one job:
     • Team Scheduling  (isSchedule) — the PLAN: who visits which store,
                                       when. Date = normal Asana due date.
     • Training Feedback (isVisit)   — the RECORD: what the trainer found.
                                       Date lives in the "Date of Training"
                                       custom field (visitDateOf handles it),
                                       plus a RAG "Status of Section".
   Openings (isOpening) come off the Revamp board and stay amber.

   The tab is built so you can see, at a glance: which trainer is where,
   how the last visits scored (red/orange/green), and which stores have
   gone quiet. Everything is read-only — trainers book it all in Asana.
   ================================================================ */

function renderStores(){
  const box=document.getElementById("storesBody"); if(!box) return;
  const today=todayD();
  const y=today.getFullYear();

  // ---- the three streams -------------------------------------------------
  const openings=state.tasks.filter(t=>t.isOpening&&!t.completed&&t.due).sort((a,b)=>a.due<b.due?-1:1);
  const upcomingOpen=openings.filter(o=>pd(o.due)>=today);
  const schedule=state.tasks.filter(t=>t.isSchedule&&t.due);
  const upcomingVisits=schedule.filter(v=>!v.completed&&pd(v.due)>=today).sort((a,b)=>a.due<b.due?-1:1);
  // feedback records — the visit actually happened; date is on the custom field
  const feedback=state.tasks.filter(t=>t.isVisit).map(t=>({t,d:visitDateOf(t)})).filter(x=>x.d);
  const feedbackThisYear=feedback.filter(x=>pd(x.d).getFullYear()===y);

  // ---- trainer roster ----------------------------------------------------
  // Everyone who appears on either board, with their next stop + scoreboard.
  const roster={};
  const touch=n=>{ if(!roster[n]) roster[n]={name:n,upcoming:[],doneYear:0,rag:{green:0,orange:0,red:0},last:null}; return roster[n]; };
  upcomingVisits.forEach(v=>{ const n=trainerOf(v); if(n) touch(n).upcoming.push(v); });
  feedbackThisYear.forEach(({t})=>{ const n=trainerOf(t); if(!n) return; touch(n).doneYear++; const r=ragOf(t.rag); if(r) touch(n).rag[r.key]++; });
  feedback.forEach(({t,d})=>{ const n=trainerOf(t); if(!n) return; const r=touch(n); if(!r.last||r.last<d) r.last=d; });
  const trainers=Object.values(roster).sort((a,b)=>(b.upcoming.length-a.upcoming.length)||(b.doneYear-a.doneYear));

  // ---- coverage: stores whose last feedback was 8+ months ago -----------
  const byStore={};
  feedback.forEach(({t,d})=>{ const key=(t.restaurant||t.name||"").trim(); if(!key) return;
    if(!byStore[key]||byStore[key]<d) byStore[key]=d; });
  const cutoff=new Date(today); cutoff.setMonth(cutoff.getMonth()-8);
  const overdueStores=Object.entries(byStore).filter(([,last])=>pd(last)<cutoff).sort((a,b)=>a[1]<b[1]?-1:1);

  // ---- headline tiles ----------------------------------------------------
  const ragTot=feedbackThisYear.reduce((a,{t})=>{ const r=ragOf(t.rag); if(r)a[r.key]++; return a; },{green:0,orange:0,red:0});
  box.innerHTML=
    '<div class="ins-tiles" style="grid-template-columns:repeat(4,1fr);max-width:720px">'+
      '<div class="tile"><b>'+trainers.length+'</b><span>trainers active</span></div>'+
      '<div class="tile"><b>'+upcomingVisits.length+'</b><span>visits scheduled ahead</span></div>'+
      '<div class="tile"><b>'+feedbackThisYear.length+'</b><span>visits logged · '+y+'</span></div>'+
      '<div class="tile"><b>'+overdueStores.length+'</b><span>stores 8+ months unseen</span></div>'+
    '</div>'+

    // ---- trainer roster strip -------------------------------------------
    '<div class="stud-h"><span>The trainers</span><span class="hint" style="margin:0;font-weight:400">who’s out where · '+y+' scoreboard</span></div>'+
    (trainers.length?'<div class="trainer-roster">'+trainers.map(tr=>{
      const col=trainerColor(tr.name);
      const next=tr.upcoming.slice().sort((a,b)=>a.due<b.due?-1:1)[0];
      const ragBar=(tr.rag.green+tr.rag.orange+tr.rag.red)?
        '<div class="trs-rag">'+
          (tr.rag.green?'<span style="flex:'+tr.rag.green+';background:'+RAG.green.color+'" title="'+tr.rag.green+' green"></span>':'')+
          (tr.rag.orange?'<span style="flex:'+tr.rag.orange+';background:'+RAG.orange.color+'" title="'+tr.rag.orange+' orange"></span>':'')+
          (tr.rag.red?'<span style="flex:'+tr.rag.red+';background:'+RAG.red.color+'" title="'+tr.rag.red+' red"></span>':'')+
        '</div>':'<div class="trs-rag empty"></div>';
      const active=state.trainerFilter.includes(tr.name);
      return '<button class="trs-card'+(active?' on':'')+'" data-trainer="'+esc(tr.name)+'" style="--tc:'+col+'">'+
        '<div class="trs-top"><span class="trs-dot"></span><b>'+esc(tr.name)+'</b></div>'+
        '<div class="trs-next">'+(next?'next: '+esc(next.name)+' · '+humanWhen(daysTo(next.due)):'nothing scheduled')+'</div>'+
        '<div class="trs-stats"><span>'+tr.upcoming.length+' ahead</span><span>'+tr.doneYear+' done</span></div>'+
        ragBar+'</button>';
    }).join('')+'</div>':'<div class="empty">No trainer visits found on either board yet.</div>')+

    // ---- openings --------------------------------------------------------
    '<div class="stud-h"><span>Openings — handover dates</span></div>'+
    (upcomingOpen.length?upcomingOpen.map(o=>{
      const d=pd(o.due);
      return '<div class="ev-row" data-gid="'+o.gid+'">'+
        '<span class="ev-date" style="color:'+LAYER.opening+'"><b style="color:'+LAYER.opening+'">'+d.getDate()+'</b>'+MO[d.getMonth()].slice(0,3)+'</span>'+
        '<span class="news-main"><span class="news-t">'+esc(o.name)+'</span>'+
        '<span class="news-meta">HO '+humanWhen(daysTo(o.due))+' · trainers on site from '+(()=>{const t3=new Date(d);t3.setDate(t3.getDate()-3);return t3.toDateString().slice(0,10);})()+'</span></span>'+
        hoIndicator(o,schedule)+'</div>';
    }).join(''):'<div class="empty">No openings on the Revamp board with dates.</div>')+

    // ---- upcoming visits (trainer-coloured) -----------------------------
    '<div class="stud-h"><span>Trainer visits coming up</span>'+
      (state.trainerFilter.length?'<button class="btn ghost sm" id="storeClearTrainer">Showing '+state.trainerFilter.join(", ")+' ×</button>':'')+'</div>'+
    (()=>{
      const list=upcomingVisits.filter(v=>!state.trainerFilter.length||state.trainerFilter.includes(trainerOf(v)));
      if(!list.length) return '<div class="empty">Nothing scheduled'+(state.trainerFilter.length?' for '+state.trainerFilter.join(", "):'')+'. Trainers book these in Asana; they surface here and on the calendar.</div>';
      return list.slice(0,20).map(v=>{
        const d=pd(v.due), tr=trainerOf(v), col=trainerColor(tr);
        const sup=(v.trainerSupport||[]).filter(Boolean);
        return '<div class="ev-row" data-gid="'+v.gid+'">'+
          '<span class="ev-date" style="color:'+col+'"><b style="color:'+col+'">'+d.getDate()+'</b>'+MO[d.getMonth()].slice(0,3)+'</span>'+
          '<span class="tr-chip" style="--tc:'+col+'"><i></i>'+esc(tr||"—")+'</span>'+
          '<span class="news-main"><span class="news-t">'+esc(v.name)+'</span>'+
          '<span class="news-meta">'+(v.sectionName?esc(v.sectionName)+' · ':'')+humanWhen(daysTo(v.due))+(sup.length?' · + '+esc(sup.join(", ")):'')+'</span></span></div>';
      }).join('');
    })()+

    // ---- recent feedback (RAG) ------------------------------------------
    '<div class="stud-h"><span>Latest feedback</span><span class="hint" style="margin:0;font-weight:400">most recent visits · '+
      '<span class="rag-key"><i style="background:'+RAG.green.color+'"></i>'+ragTot.green+' <i style="background:'+RAG.orange.color+'"></i>'+ragTot.orange+' <i style="background:'+RAG.red.color+'"></i>'+ragTot.red+' this year</span></span></div>'+
    (()=>{
      const recent=feedback.slice().sort((a,b)=>a.d<b.d?1:-1)
        .filter(({t})=>!state.trainerFilter.length||state.trainerFilter.includes(trainerOf(t)))
        .slice(0,14);
      if(!recent.length) return '<div class="empty">No feedback logged yet.</div>';
      return recent.map(({t,d})=>{
        const r=ragOf(t.rag), tr=trainerOf(t), col=trainerColor(tr);
        const snip=t.notes||t.rag||'';
        return '<div class="fb-row" data-gid="'+t.gid+'">'+
          '<span class="fb-rag" style="background:'+(r?r.color:'#B8C2CC')+'" title="'+esc(t.rag||'no status')+'"></span>'+
          '<span class="fb-main"><span class="fb-t">'+esc(t.restaurant||t.name)+
            (t.trainSection?' <span class="fb-sec">'+esc(t.trainSection)+'</span>':'')+'</span>'+
          '<span class="news-meta"><span class="tr-chip mini" style="--tc:'+col+'"><i></i>'+esc(tr||'—')+'</span> '+
            pd(d).toDateString().slice(4,10)+(t.region?' · '+esc(t.region):'')+'</span></span>'+
          (r?'<span class="fb-tag" style="color:'+r.color+'">'+r.label+'</span>':'')+'</div>';
      }).join('');
    })()+

    // ---- coverage --------------------------------------------------------
    '<div class="stud-h"><span>Coverage — not seen in 8 months</span></div>'+
    (overdueStores.length?overdueStores.slice(0,15).map(([store,last])=>
      '<div class="ev-row"><span class="news-main"><span class="news-t">'+esc(store)+'</span>'+
      '<span class="news-meta">last visit '+pd(last).toDateString().slice(4)+'</span></span></div>').join('')
    :'<div class="empty">Every store with a record has been seen in the last 8 months. Tidy.</div>');

  // ---- wiring ------------------------------------------------------------
  box.querySelectorAll(".ev-row[data-gid],.fb-row[data-gid]").forEach(r=>r.onclick=()=>openDrawer(r.dataset.gid));
  box.querySelectorAll(".trs-card").forEach(c=>c.onclick=()=>{
    const n=c.dataset.trainer, i=state.trainerFilter.indexOf(n);
    if(i>=0) state.trainerFilter.splice(i,1); else state.trainerFilter.push(n);
    renderStores(); renderTrainerToggles(); renderCalendar();
  });
  const clr=document.getElementById("storeClearTrainer");
  if(clr) clr.onclick=()=>{ state.trainerFilter=[]; renderStores(); renderTrainerToggles(); renderCalendar(); };
}

// Does an opening have a trainer visit booked near its handover date?
function hoIndicator(o,schedule){
  const oWords=(o.name||"").toLowerCase().split(/\W+/).filter(x=>x.length>3);
  const hasVisit=schedule.some(v=>!v.completed&&v.due&&Math.abs(pd(v.due)-pd(o.due))<21*864e5&&
    oWords.some(wd=>(v.name||"").toLowerCase().includes(wd)));
  if(hasVisit) return '<span class="ev-ok">training scheduled</span>';
  if(daysTo(o.due)<=31) return '<span class="ev-warn">no training scheduled</span>';
  return '<span class="news-meta" style="white-space:nowrap">not yet due</span>';
}
