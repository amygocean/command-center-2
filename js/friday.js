/* ================================================================
   THE FRIDAY HUDDLE — week in review + next week, made to project
   ================================================================ */

function weekBounds(offsetWeeks){
  const today=todayD();
  const mon=new Date(today); mon.setDate(mon.getDate()-((mon.getDay()+6)%7)+7*(offsetWeeks||0));
  const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  return [mon,sun];
}
function inRange(dstr,a,b){ if(!dstr) return false; const d=pd(dstr); return d>=a&&d<=b; }

function openFriday(){
  const [mon,sun]=weekBounds(0);
  const [nmon,nsun]=weekBounds(1);
  const all=state.tasks.filter(t=>!t.isOccasion&&!t.isNote&&!t.isPassion&&!t.isKeeper);
  const shipped=all.filter(t=>t.completed&&((t.completedAt&&new Date(t.completedAt)>=mon&&new Date(t.completedAt)<=new Date(sun.valueOf()+864e5))||inRange(t.due,mon,sun)));
  const slipped=all.filter(t=>!t.completed&&t.due&&pd(t.due)<todayD()&&inRange(t.due,new Date(mon.valueOf()-28*864e5),sun));
  const nextWeek=all.filter(t=>!t.completed&&inRange(t.due,nmon,nsun)&&!t.isComms).sort((a,b)=>a.due<b.due?-1:1);
  const nextComms=all.filter(t=>!t.completed&&t.isComms&&inRange(t.due,nmon,nsun)).sort((a,b)=>a.due<b.due?-1:1);
  const nextShoot=state.tasks.filter(t=>t.isShoot&&!t.completed&&t.due&&pd(t.due)>=todayD()).sort((a,b)=>a.due<b.due?-1:1)[0];
  const cur=state.curriculum[todayD().getMonth()];

  const li=(t,showWho)=>'<div class="f-row" data-gid="'+t.gid+'"><span class="dot" style="background:'+t.projectColor+'"></span>'+
    (t.isShoot?"🎬 ":"")+esc(t.name.replace(/^\[.+?\]\s*/,""))+
    '<span class="f-meta">'+(t.due?pd(t.due).toDateString().slice(0,10):"")+(showWho&&t.assignee?" · "+firstName(t.assignee.name):"")+'</span></div>';

  const w=document.getElementById("fridayWrap");
  w.innerHTML=
    '<div class="friday">'+
      '<div class="f-head"><h1>The Friday Huddle</h1>'+
        '<span class="f-sub">'+mon.getDate()+" "+MO[mon.getMonth()].slice(0,3)+" – "+sun.getDate()+" "+MO[sun.getMonth()].slice(0,3)+'</span>'+
        '<span style="margin-left:auto;display:flex;gap:6px">'+
        '<button class="btn ghost" id="fCopy">Copy recap</button>'+
        '<button class="btn ghost" id="fImg">Save image</button>'+
        '<button class="btn ghost" id="fClose">Close ✕</button></span></div>'+
      '<div class="f-grid">'+
        '<div class="f-card win"><h3>Shipped this week <span class="f-count">'+shipped.length+'</span></h3>'+
          (shipped.length?shipped.slice(0,12).map(t=>li(t,true)).join(""):'<div class="empty">Quiet week — or is Asana fibbing?</div>')+
          (shipped.length?'<button class="btn glow" id="fConfetti" style="margin-top:10px">Take a bow</button>':"")+'</div>'+
        '<div class="f-card slip"><h3>Slipped <span class="f-count">'+slipped.length+'</span></h3>'+
          (slipped.length?slipped.slice(0,10).map(t=>li(t,true)).join(""):'<div class="empty">Nothing slipped.</div>')+'</div>'+
        '<div class="f-card next"><h3>Next week\'s lineup <span class="f-count">'+nextWeek.length+'</span></h3>'+
          (nextWeek.length?nextWeek.slice(0,12).map(t=>li(t,true)).join(""):'<div class="empty">Blank canvas.</div>')+'</div>'+
        '<div class="f-card comms"><h3>Comms going out <span class="f-count">'+nextComms.length+'</span></h3>'+
          (nextComms.length?nextComms.map(t=>li(t,false)).join(""):'<div class="empty">Nothing queued for the communities yet.</div>')+'</div>'+
      '</div>'+
      '<div class="f-foot">'+
        (nextShoot?'<span>Next shoot: <b>'+esc(nextShoot.name)+'</b> — '+humanWhen(daysTo(nextShoot.due))+'</span>':"")+
        (cur?'<span>OB Fit this month: <b>'+esc(cur.t)+'</b></span>':"")+
        '<span>Friday ritual: paste the week\'s chat exports in Communities for the room read.</span>'+
      '</div>'+
    '</div>';
  w.style.display="block"; requestAnimationFrame(()=>w.classList.add("open"));
  document.getElementById("fClose").onclick=closeFriday;
  const fc=document.getElementById("fConfetti"); if(fc) fc.onclick=confetti;
  w.querySelectorAll(".f-row").forEach(r=>r.onclick=()=>{ closeFriday(); openDrawer(r.dataset.gid); });

  const range=mon.getDate()+" "+MO[mon.getMonth()].slice(0,3)+" – "+sun.getDate()+" "+MO[sun.getMonth()].slice(0,3);
  const recapText=()=>{
    let t="*The Academy — week of "+range+"*\n\n*Shipped ("+shipped.length+")*\n";
    shipped.slice(0,10).forEach(x=>{ t+="• "+x.name.replace(/^\[.+?\]\s*/,"")+(x.assignee?" — "+firstName(x.assignee.name):"")+"\n"; });
    if(shipped.length>10) t+="…and "+(shipped.length-10)+" more\n";
    t+="\n*Next week:* "+nextWeek.length+" lined up";
    if(nextWeek.length){ t+=" — highlights:\n"; nextWeek.slice(0,4).forEach(x=>{ t+="• "+x.name+"\n"; }); } else t+="\n";
    t+="\n*Comms going out:* "+nextComms.length+" messages queued\n";
    if(nextShoot) t+="\nNext shoot: "+nextShoot.name+" — "+humanWhen(daysTo(nextShoot.due))+"\n";
    return t;
  };
  document.getElementById("fCopy").onclick=()=>{
    navigator.clipboard.writeText(recapText()).then(()=>toast("Recap copied — WhatsApp-ready"));
  };
  document.getElementById("fImg").onclick=()=>{
    const c=document.createElement("canvas"); c.width=1080; c.height=1350;
    const x=c.getContext("2d");
    x.fillStyle="#F5F6F8"; x.fillRect(0,0,1080,1350);
    const g=x.createLinearGradient(0,0,1080,220); g.addColorStop(0,"#0A3D62"); g.addColorStop(1,"#00A8A8");
    x.fillStyle=g; x.fillRect(0,0,1080,220);
    x.fillStyle="#fff"; x.font="700 56px -apple-system, Segoe UI, Arial";
    x.fillText("The Academy — this week",60,110);
    x.font="500 32px -apple-system, Segoe UI, Arial"; x.globalAlpha=.85; x.fillText(range,60,165); x.globalAlpha=1;
    let y=310;
    x.fillStyle="#121A24"; x.font="700 40px -apple-system, Segoe UI, Arial";
    x.fillText("Shipped · "+shipped.length,60,y); y+=60;
    x.font="400 32px -apple-system, Segoe UI, Arial";
    shipped.slice(0,12).forEach(it=>{
      let line="•  "+it.name.replace(/^\[.+?\]\s*/,"");
      if(line.length>58) line=line.slice(0,55)+"…";
      x.fillStyle="#121A24"; x.fillText(line,60,y);
      if(it.assignee){ x.fillStyle="#8E979F"; x.font="400 26px -apple-system, Segoe UI, Arial";
        x.fillText(firstName(it.assignee.name),960,y); x.font="400 32px -apple-system, Segoe UI, Arial"; }
      y+=52;
    });
    y+=40; x.fillStyle="#121A24"; x.font="700 34px -apple-system, Segoe UI, Arial";
    x.fillText("Next week: "+nextWeek.length+" lined up  ·  Comms queued: "+nextComms.length,60,y);
    if(nextShoot){ y+=54; x.fillStyle="#00A8A8";
      x.fillText("Next shoot: "+nextShoot.name.slice(0,40)+" — "+humanWhen(daysTo(nextShoot.due)),60,y); }
    x.fillStyle="#8E979F"; x.font="400 24px -apple-system, Segoe UI, Arial";
    x.fillText("Ocean Basket Academy · Command Center",60,1290);
    const a=document.createElement("a");
    a.download="academy-week-"+iso(todayD())+".png";
    a.href=c.toDataURL("image/png"); a.click();
    toast("Recap image saved");
  };
}
function closeFriday(){
  const w=document.getElementById("fridayWrap");
  w.classList.remove("open");
  setTimeout(()=>{ w.style.display="none"; w.innerHTML=""; },250);
}
