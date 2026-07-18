/* ================================================================
   NEWS — a weekly, web-searched reading list for the team.
   Cached per ISO week in localStorage; Refresh forces a new sweep.
   ================================================================ */

function isoWeekKey(){
  const d=new Date(); const jan=new Date(d.getFullYear(),0,1);
  const week=Math.ceil((((d-jan)/864e5)+jan.getDay()+1)/7);
  return "ob_news_"+d.getFullYear()+"w"+week;
}

let newsLoaded=false;

function wireNews(){
  const tab=document.querySelector('[data-tab="news"]');
  if(tab) tab.addEventListener("click",()=>{ if(!newsLoaded) loadNews(false); });
  const btn=document.getElementById("newsRefresh");
  if(btn) btn.onclick=()=>loadNews(true);
}
document.addEventListener("DOMContentLoaded",wireNews);

async function loadNews(force){
  const box=document.getElementById("newsBody"); if(!box) return;
  newsLoaded=true;
  const key=isoWeekKey();
  if(!force){
    try{ const cached=JSON.parse(localStorage.getItem(key));
      if(cached && cached.picks){ renderNews(cached); return; } }catch(e){}
  }
  box.innerHTML='<div class="empty" style="padding:40px 0"><span class="spin"></span>&nbsp; sweeping the internet — this takes a moment…</div>';
  try{
    let data;
    if(DEMO){ data=demoNews(); await new Promise(r=>setTimeout(r,900)); }
    else{
      const r=await fetch("/api/news",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      data=await r.json();
      if(!r.ok) throw new Error(data.error||("HTTP "+r.status));
      if(data.off) throw new Error(data.error);
    }
    localStorage.setItem(key,JSON.stringify(data));
    renderNews(data);
  }catch(e){
    box.innerHTML='<div class="empty" style="padding:40px 0">Couldn\'t fetch the news: '+esc(e.message)+'</div>';
  }
}

function renderNews(data){
  const box=document.getElementById("newsBody"); if(!box) return;
  const types={article:"Articles",video:"Videos",podcast:"Podcasts"};
  const groups={};
  (data.picks||[]).forEach(p=>{ const t=types[p.type]?p.type:"article"; (groups[t]=groups[t]||[]).push(p); });
  let html='';
  if(data.summary) html+='<div class="news-sum"><div class="ins-h">The week in short</div><p>'+esc(data.summary)+'</p></div>';
  const order=["article","video","podcast"];
  order.forEach(t=>{
    const items=groups[t]; if(!items||!items.length) return;
    html+='<div class="ins-h" style="margin-top:24px">'+types[t]+'</div>';
    items.forEach(p=>{
      html+='<a class="news-row" href="'+esc(p.url)+'" target="_blank" rel="noopener">'+
        '<span class="news-main"><span class="news-t">'+esc(p.title)+'</span>'+
        '<span class="news-meta">'+esc(p.source||"")+(p.topic?' · '+esc(p.topic):'')+'</span>'+
        (p.blurb?'<span class="news-b">'+esc(p.blurb)+'</span>':'')+'</span>'+
        '<span class="news-go">↗</span></a>';
    });
  });
  if(!html) html='<div class="empty" style="padding:40px 0">Nothing this week. Hit Refresh to sweep again.</div>';
  if(data.fetched) html+='<div class="hint" style="margin-top:20px">Fetched '+new Date(data.fetched).toLocaleString()+' · refreshes weekly, or on demand.</div>';
  box.innerHTML=html;
}

function demoNews(){
  return { fetched:new Date().toISOString(),
    summary:"Busy fortnight: everyone is arguing about how much of onboarding AI should actually run, two big pieces landed on training deskless teams through the phone they already have, and internal comms people are quietly killing the all-staff email. The frontline-first thread running through all of it will feel very familiar to this team.",
    picks:[
      {title:"Why frontline training fails (and the 3 fixes that stick)",url:"https://example.com/1",source:"Chief Learning Officer",type:"article",topic:"L&D",blurb:"Their fix list is basically your WhatsApp model — validating and worth quoting."},
      {title:"AI copilots for L&D teams: what's actually working",url:"https://example.com/2",source:"Josh Bersin",type:"article",topic:"AI at work",blurb:"Honest breakdown of where AI saves L&D time and where it makes slop."},
      {title:"The deskless learning stack in 2026",url:"https://example.com/3",source:"Learning Technologies",type:"article",topic:"Frontline",blurb:"Benchmarks mobile-first training across retail and hospitality chains."},
      {title:"How McDonald's trains 2 million people a year",url:"https://example.com/4",source:"WorkLife",type:"video",topic:"Hospitality",blurb:"20 minutes; steal the practical assessment cadence."},
      {title:"Internal comms is having a moment",url:"https://example.com/5",source:"The Rebooting",type:"podcast",topic:"Internal comms",blurb:"Why the best internal comms now looks like consumer media — sound familiar?"},
      {title:"Manager-led coaching beats content libraries",url:"https://example.com/6",source:"HBR IdeaCast",type:"podcast",topic:"Org dev",blurb:"Evidence for your TEACH model, straight from the research."}
    ]};
}
