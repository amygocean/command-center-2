/* ================================================================
   TRAINING & NEW STORES — openings (HO dates, amber) + trainer
   visits (violet), coverage, and the visited-this-year count.
   Openings live on the Revamp board; visits on the Store Visits board.
   ================================================================ */

function renderStores(){
  const box=document.getElementById("storesBody"); if(!box) return;
  const today=todayD();
  const openings=state.tasks.filter(t=>t.isOpening&&!t.completed).sort((a,b)=>a.due<b.due?-1:1);
  const visits=state.tasks.filter(t=>t.isVisit&&t.due);
  const upcomingOpen=openings.filter(t=>pd(t.due)>=today);
  const upcomingVisits=visits.filter(t=>!t.completed&&pd(t.due)>=today).sort((a,b)=>a.due<b.due?-1:1);
  const y=today.getFullYear();
  const visitedThisYear=visits.filter(t=>t.completed&&t.due&&pd(t.due).getFullYear()===y);

  // coverage: stores whose last visit was 8+ months ago
  const byStore={};
  visits.forEach(v=>{
    const key=(v.name||"").trim(); if(!key) return;
    if(!byStore[key]||byStore[key]<v.due) byStore[key]=v.due;
  });
  const cutoff=new Date(today); cutoff.setMonth(cutoff.getMonth()-8);
  const overdueStores=Object.entries(byStore).filter(([,last])=>pd(last)<cutoff)
    .sort((a,b)=>a[1]<b[1]?-1:1);

  const hoIndicator=(o)=>{
    const d=daysTo(o.due);
    const oWords=(o.name||"").toLowerCase().split(/\W+/).filter(x=>x.length>3);
    const hasVisit=visits.some(v=>!v.completed&&v.due&&Math.abs(pd(v.due)-pd(o.due))<21*864e5&&
      oWords.some(wd=>(v.name||"").toLowerCase().includes(wd)));
    if(hasVisit) return '<span class="ev-ok">training scheduled</span>';
    if(d<=31) return '<span class="ev-warn">no training scheduled</span>';
    return '<span class="news-meta" style="white-space:nowrap">not yet due</span>';
  };

  box.innerHTML=
    '<div class="ins-tiles" style="grid-template-columns:repeat(3,1fr);max-width:560px">'+
      '<div class="tile"><b>'+upcomingOpen.length+'</b><span>openings ahead</span></div>'+
      '<div class="tile"><b>'+visitedThisYear.length+'</b><span>visits done · '+y+'</span></div>'+
      '<div class="tile"><b>'+overdueStores.length+'</b><span>stores 8+ months unseen</span></div>'+
    '</div>'+
    '<div class="stud-h"><span>Openings — handover dates</span></div>'+
    (upcomingOpen.length?upcomingOpen.map(o=>{
      const d=pd(o.due);
      return '<div class="ev-row" data-gid="'+o.gid+'">'+
        '<span class="ev-date" style="color:'+LAYER.opening+'"><b style="color:'+LAYER.opening+'">'+d.getDate()+'</b>'+MO[d.getMonth()].slice(0,3)+'</span>'+
        '<span class="news-main"><span class="news-t">'+esc(o.name)+'</span>'+
        '<span class="news-meta">HO '+humanWhen(daysTo(o.due))+' · trainers on site from '+(()=>{const t3=new Date(d);t3.setDate(t3.getDate()-3);return t3.toDateString().slice(0,10);})()+'</span></span>'+
        hoIndicator(o)+'</div>';
    }).join(""):'<div class="empty">No openings on the Revamp board with dates.</div>')+
    '<div class="stud-h"><span>Trainer visits coming up</span></div>'+
    (upcomingVisits.length?upcomingVisits.slice(0,12).map(v=>{
      const d=pd(v.due);
      return '<div class="ev-row" data-gid="'+v.gid+'">'+
        '<span class="ev-date" style="color:'+LAYER.visit+'"><b style="color:'+LAYER.visit+'">'+d.getDate()+'</b>'+MO[d.getMonth()].slice(0,3)+'</span>'+
        '<span class="news-main"><span class="news-t">'+esc(v.name)+'</span>'+
        '<span class="news-meta">'+(v.assignee?esc(v.assignee.name):"unassigned")+' · '+humanWhen(daysTo(v.due))+'</span></span></div>';
    }).join(""):'<div class="empty">Nothing scheduled. The trainers book these in Asana; they show up here and on the calendar.</div>')+
    '<div class="stud-h"><span>Coverage — not seen in 8 months</span></div>'+
    (overdueStores.length?overdueStores.slice(0,15).map(([store,last])=>
      '<div class="ev-row"><span class="news-main"><span class="news-t">'+esc(store)+'</span>'+
      '<span class="news-meta">last visit '+pd(last).toDateString().slice(4)+'</span></span></div>').join("")
    :'<div class="empty">Every store has been seen in the last 8 months. Tidy.</div>');

  box.querySelectorAll(".ev-row[data-gid]").forEach(r=>r.onclick=()=>openDrawer(r.dataset.gid));
}
