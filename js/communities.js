/* ================================================================
   COMMUNITIES — per-community planner, mini calendar, insights,
                 weekly export summariser
   ================================================================ */

let commCursor = new Date();   // month shown in the communities mini-cal
let commFilter = null;         // community key or null = all
let commComposeImage = null;   // processed image waiting for task creation

function wireCommunityControls(){
  document.getElementById("waAdd").onclick=addWAMessage;
  document.getElementById("waSummarise").onclick=summariseCommunities;
  document.getElementById("wcPrev").onclick=()=>{ commCursor.setMonth(commCursor.getMonth()-1); renderCommunities(); };
  document.getElementById("wcNext").onclick=()=>{ commCursor.setMonth(commCursor.getMonth()+1); renderCommunities(); };
  const nameInput=document.getElementById("waName");
  if(nameInput) nameInput.onkeydown=e=>{ if(e.key==="Enter"&&!e.shiftKey) addWAMessage(); };
  const fileInput=document.getElementById("waComposeFile");
  if(fileInput) fileInput.onchange=e=>handleComposeImage(e.target);
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
function commValidTime(value){
  const match=String(value||"").match(/^(\d{2}):(\d{2})$/);
  if(!match) return false;
  const hour=Number(match[1]), minute=Number(match[2]);
  return hour>=0&&hour<24&&minute>=0&&minute<60;
}
function commFriendlyTime(value){
  if(!commValidTime(value)) return "";
  const hour=Number(value.slice(0,2)), minute=value.slice(3);
  return (hour%12||12)+":"+minute+" "+(hour<12?"AM":"PM");
}
function commScheduleLabel(t){
  if(!t.due) return "no date";
  return pd(t.due).toDateString().slice(0,10)+(t.sendTime?" · "+t.sendTime:"");
}
function renderCommTimePicker(){
  const input=document.getElementById("waTime");
  const favBox=document.getElementById("waTimeFavs");
  const star=document.getElementById("waTimeStar");
  if(!input||!favBox||!star) return;
  const favs=[...new Set((cfg.commTimeFavourites||[]).filter(commValidTime))].sort();
  favBox.innerHTML=favs.length
    ? favs.map(time=>'<button type="button" class="wa-time-fav'+(input.value===time?' on':'')+'" data-time="'+time+'"><span>★</span>'+time+'</button>').join("")
    : '<span class="hint">No favourite times yet.</span>';
  favBox.querySelectorAll("[data-time]").forEach(button=>button.onclick=()=>{
    input.value=button.dataset.time; renderCommTimePicker();
  });
  const selected=commValidTime(input.value)?input.value:"";
  const isFavourite=selected&&favs.includes(selected);
  star.disabled=!selected;
  star.textContent=isFavourite?"★ Unfavourite":"☆ Favourite";
  input.onchange=renderCommTimePicker;
  star.onclick=()=>{
    const time=input.value; if(!commValidTime(time)) return;
    const next=new Set(cfg.commTimeFavourites||[]);
    if(next.has(time)) next.delete(time); else next.add(time);
    cfg.commTimeFavourites=[...next].filter(commValidTime).sort();
    saveCfg(); renderCommTimePicker();
  };
}
function renderCommComposer(){
  const box=document.getElementById("commTargets"); if(!box) return;
  box.innerHTML = cfg.communities.map(c=>
    '<label class="ctgt" style="--cc:'+c.color+'"><input type="checkbox" value="'+c.key+'"><span>'+esc(c.name)+'</span></label>').join("");
  const pr=document.getElementById("waPurpose");
  if(pr && !pr.dataset.filled){
    pr.innerHTML='<option value="">purpose (optional)</option>'+MSG_PURPOSES.map(p=>'<option value="'+p.key+'">'+p.label+'</option>').join("");
    pr.dataset.filled="1";
  }
  renderCommTimePicker();
  renderComposeImageArea();
}
function renderComposeImageArea(){
  const row=document.getElementById("waComposeImage"); if(!row) return;
  if(commComposeImage){
    row.innerHTML='<div class="wa-thumb compose"><img src="'+esc(commComposeImage.dataUrl)+'" alt="selected image"></div>'+
      '<span class="wa-compose-file">'+esc(commComposeImage.filename)+'</span>'+
      '<button class="btn ghost sm" id="waComposeReplace" type="button">Replace</button>'+
      '<button class="btn ghost sm" id="waComposeRemove" type="button">Remove</button>';
    row.querySelector("#waComposeReplace").onclick=()=>document.getElementById("waComposeFile").click();
    row.querySelector("#waComposeRemove").onclick=()=>{ commComposeImage=null; renderComposeImageArea(); };
  }else{
    row.innerHTML='<button class="btn glow sm" id="waComposeImageBtn" type="button">📷 Add image</button>'+
      '<span class="hint">Attached to every Asana task created.</span>';
    row.querySelector("#waComposeImageBtn").onclick=()=>document.getElementById("waComposeFile").click();
  }
}
function handleComposeImage(fileInput){
  const file=fileInput.files&&fileInput.files[0]; fileInput.value="";
  if(!file) return;
  if(!/^image\//.test(file.type)){ toast("Pick an image file"); return; }
  downscaleImage(file,1280,data=>{ commComposeImage=data; renderComposeImageArea(); });
}
function commTitleFromBody(body){
  const first=String(body||"").split(/\r?\n/).find(line=>line.trim())||"WhatsApp message";
  return first.trim().replace(/\s+/g," ").slice(0,72);
}
async function addWAMessage(){
  const titleEl=document.getElementById("waName");
  const msgEl=document.getElementById("waMessage");
  const dt=document.getElementById("waDate");
  const tm=document.getElementById("waTime");
  const pr=document.getElementById("waPurpose");
  const body=msgEl.value.trim(); if(!body){toast("Write the WhatsApp message first");return;}
  const name=titleEl.value.trim()||commTitleFromBody(body);
  const date=dt.value, time=tm.value;
  if(time&&!date){toast("Pick a send date before choosing a time");return;}
  const targets=[...document.querySelectorAll("#commTargets input:checked")].map(i=>cfg.communities.find(c=>c.key===i.value)).filter(Boolean);
  if(!targets.length){ toast("Pick at least one community"); return; }
  const board = await ensureMsgBoard(); if(!board) return;
  const secMap = await ensureWASections();
  const notes = body+(pr.value?"\n\n#purpose:"+pr.value:"");
  const tasks = targets.map(c=>{
    const t={name, project_id:board, notes};
    if(date&&time) t.due_at=communityDueAt(date,time);
    else if(date) t.due_on=date;
    if(secMap && secMap[c.name]) t.section_id=secMap[c.name];
    else t.name="["+c.name+"] "+name;
    return t;
  });
  const btn=document.getElementById("waAdd"); btn.disabled=true; btn.textContent="Queuing…";
  try{
    const made=await call("create_shared_tasks",{tasks});
    const created=made.data||[], failed=made.failed||[];
    if(!created.length){
      const reason=failed[0]&&failed[0].errors&&failed[0].errors[0]&&failed[0].errors[0].message;
      throw new Error(reason||"No Asana tasks were created");
    }
    let uploadFailures=0;
    if(commComposeImage){
      btn.textContent="Uploading image…";
      const uploads=await Promise.allSettled(created.map(t=>call("upload_attachment",{
        task_id:t.gid, filename:commComposeImage.filename, mime:commComposeImage.mime, data_base64:commComposeImage.base64
      })));
      uploadFailures=uploads.filter(r=>r.status==="rejected").length;
    }
    titleEl.value=""; msgEl.value=""; dt.value=""; tm.value=""; pr.value=""; commComposeImage=null;
    document.querySelectorAll("#commTargets input:checked").forEach(i=>i.checked=false);
    renderCommTimePicker(); renderComposeImageArea();
    let successMessage;
    if(failed.length) successMessage="Created "+created.length+"; "+failed.length+" task"+(failed.length===1?"":"s")+" failed";
    else if(uploadFailures) successMessage="Messages queued; "+uploadFailures+" image upload"+(uploadFailures===1?"":"s")+" failed";
    else successMessage=targets.length>1?"Planned for "+targets.length+" communities":"Message planned";
    try{ await loadAll(); toast(successMessage); }
    catch(_){ toast(successMessage+"; refresh the page to reload the board"); }
  }catch(e){ toast("Failed: "+e.message); }
  finally{ btn.disabled=false; btn.textContent="Queue it"; }
}
async function ensureWASections(){
  if(state.waSections) return state.waSections;
  try{
    const board=await ensureMsgBoard();
    const res=await call("ensure_shared_sections",{project_id:board,names:cfg.communities.map(c=>c.name)});
    const secs=res.data||[];
    const map={};
    for(const c of cfg.communities){
      const hit=secs.find(s=>String(s.name||"").toLowerCase()===c.name.toLowerCase());
      if(hit) map[c.name]=hit.gid;
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
  let html='<div class="dow wc-dow">'+DOW.map(d=>"<div>"+d+"</div>").join("")+'</div><div class="grid wc-grid">';
  for(let i=0;i<42;i++){
    const dt=new Date(gridStart); dt.setDate(gridStart.getDate()+i);
    const dim=dt.getMonth()!==c.getMonth();
    const dstr=iso(dt);
    const dayMsgs=msgs.filter(t=>t.due===dstr).sort((a,b)=>(a.sendTime||"99:99").localeCompare(b.sendTime||"99:99") || String(a.name||"").localeCompare(String(b.name||"")));
    const byComm={};
    dayMsgs.forEach(t=>{ const cm=communityOf(t); const k=cm?cm.name:"?"; byComm[k]=(byComm[k]||0)+1; });
    const busy=Object.values(byComm).some(n=>n>3);
    html+='<div class="cell wc-cell'+(dim?" dim":"")+(sameDay(dt,today)?" today":"")+'" data-date="'+dstr+'">'+
      '<span class="dnum">'+dt.getDate()+(busy?' <span title="More than 3 to one community — easy tiger">🔥</span>':'')+'</span>';
    dayMsgs.forEach(t=>{
      const cm=communityOf(t);
      html+='<button type="button" class="wmsg'+(t.completed?" sent":"")+'" data-gid="'+t.gid+'" style="--cc:'+(cm?cm.color:"#999")+'" title="'+esc(t.name)+(cm?" → "+cm.name:"")+(t.sendTime?" · "+t.sendTime:"")+(t.completed?" · sent ✓":"")+'">'+
        (t.completed?'<span class="wmsg-check">✓</span> ':"")+(t.sendTime?'<b class="wmsg-time">'+t.sendTime+'</b> ':"")+esc(t.name.replace(/^\[.+?\]\s*/,""))+'</button>';
    });
    html+='</div>';
  }
  cal.innerHTML=html+'</div>';
  cal.querySelectorAll(".wmsg").forEach(m=>m.onclick=()=>openCommPreview(m.dataset.gid));
}
/* ---- upcoming list ---- */
function renderCommList(){
  const box=document.getElementById("waList"); if(!box) return;
  const today=todayD();
  let msgs=commMsgs().filter(t=>!commFilter || (communityOf(t)&&communityOf(t).key===commFilter));
  const upcoming=msgs.filter(t=>!t.completed)
    .sort((a,b)=>((a.due||"9999")+"T"+(a.sendTime||"99:99")).localeCompare((b.due||"9999")+"T"+(b.sendTime||"99:99")))
    .slice(0,12);
  if(!upcoming.length){ box.innerHTML='<div class="empty">Nothing queued yet.</div>'; return; }
  box.innerHTML=upcoming.map(t=>{
    const cm=communityOf(t); const pu=purposeOf(t);
    const od=t.due&&pd(t.due)<today;
    return '<div class="warow" data-gid="'+t.gid+'">'+
      '<span class="wc-dot" style="background:'+(cm?cm.color:"#999")+'" title="'+(cm?esc(cm.name):"no community")+'"></span>'+
      '<span class="wa-txt">'+esc(t.name.replace(/^\[.+?\]\s*/,""))+
        '<span class="wa-meta">'+(cm?esc(cm.name):"—")+(pu?" · "+pu.label:"")+(t.due?' · <b class="'+(od?"overdue":"")+'">'+(od?"⚠ ":"")+pd(t.due).toDateString().slice(0,10)+(t.sendTime?" · "+t.sendTime:"")+'</b>':' · no date')+'</span></span>'+
      '<button class="btn teal sm wa-sent" data-gid="'+t.gid+'">Sent ✓</button></div>';
  }).join("");
  box.querySelectorAll(".warow").forEach(r=>r.onclick=e=>{ if(!e.target.closest(".wa-sent")) openCommPreview(r.dataset.gid); });
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

/* ================================================================
   WHATSAPP PREVIEW — click a message to see how it lands (image +
   text in a chat bubble), edit the message text, and attach an image
   that is pushed to the Asana task as a real attachment.
   ================================================================ */

// Notes double as storage: the human message text + a #purpose:x tag.
// Keep them apart so the preview shows only the message, and saving
// preserves the purpose tag.
function commSplitNotes(notes){
  notes=notes||"";
  const m=notes.match(/(?:^|\n)\s*#purpose:([\w-]+)/i);
  const body=notes.replace(/(?:^|\n)\s*#purpose:[\w-]+\s*/i,"\n").trim();
  return { body, purpose:m?m[1]:"" };
}
// Prefer the newest image attachment. Other task attachments remain in Asana
// but are not forced into an image element in the WhatsApp preview.
function commImageAtt(list){
  return [...(list||[])]
    .filter(a=>/\.(png|jpe?g|gif|webp|heic|heif)$/i.test(a.name||"")&&(a.download_url||a.view_url))
    .sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")))[0]||null;
}
function commImgUrl(att){ return att?(att.download_url||att.view_url||null):null; }
function waNow(){ const d=new Date(); let h=d.getHours(); const m=d.getMinutes(); const ap=h<12?"AM":"PM"; h=h%12||12; return h+":"+String(m).padStart(2,"0")+" "+ap; }
function commImgHtml(url){ return url?'<div class="wa-img"><img src="'+esc(url)+'" alt="attachment"></div>':''; }
function commBubbleInner(url,text,sendTime){
  return commImgHtml(url)+
    '<div class="wa-text" id="waText">'+(text?esc(text).replace(/\n/g,"<br>"):'<span class="wa-ph">Your message will appear here…</span>')+'</div>'+
    '<div class="wa-time">'+(sendTime||waNow())+'<span class="wa-tick">✓✓</span></div>';
}

let commPrevAtt=[];      // attachments for the message currently in the preview
let commPreviewGid=null; // prevents a slow response repainting a newer modal
let commPreviewError="";

async function openCommPreview(gid){
  const t=findTask(gid); if(!t) return;
  commPreviewGid=gid; commPrevAtt=[]; commPreviewError="";
  const cm=communityOf(t), pu=purposeOf(t);
  const label=(t.name||"").replace(/^\[.+?\]\s*/,"");
  const {body}=commSplitNotes(t.notes);
  const previewText=body||label;
  showModal(
    '<div class="wa-prev">'+
      '<div class="wa-prev-h"><h2>Message preview</h2><span class="wa-prev-sub">'+
        (cm?'<span class="wa-comm" style="--cc:'+cm.color+'"><i></i>'+esc(cm.name)+'</span>':'')+
        (pu?'<span class="wa-purpose">'+esc(pu.label)+'</span>':'')+
        (t.due?'<span class="wa-purpose">📅 '+esc(commScheduleLabel(t))+'</span>':'')+'</span></div>'+
      '<div class="wa-stage"><div class="wa-bubble" id="waBubble">'+commBubbleInner(null, previewText, t.sendTime)+'</div>'+
        '<div class="wa-stage-label">how it looks on WhatsApp</div></div>'+
      '<div class="fld"><label>Message text</label><textarea id="waMsg" placeholder="Write the message you\'ll send…">'+esc(previewText)+'</textarea></div>'+
      '<div class="wa-imgrow" id="waImgRow"><span class="hint" style="margin:0"><span class="spin"></span> checking for an image…</span></div>'+
      '<input type="file" id="waFile" accept="image/*" style="display:none">'+
      '<div class="drawer-actions">'+
        '<button class="btn primary" id="waSave">Save to Asana</button>'+
        '<button class="btn teal" id="waSent">Sent ✓</button>'+
        '<button class="btn ghost" id="waEdit">Full details</button>'+
        '<button class="btn ghost" data-close>Close</button>'+
      '</div>'+
    '</div>'
  );
  wireModalClose();
  const msg=document.getElementById("waMsg");
  msg.oninput=()=>updateBubbleText(msg.value||label);
  document.getElementById("waSave").onclick=()=>saveCommText(gid,t);
  document.getElementById("waSent").onclick=()=>{ toggleDone(gid,true); closeModal(); };
  document.getElementById("waEdit").onclick=()=>{ closeModal(); openDrawer(gid); };
  document.getElementById("waFile").onchange=e=>handleCommImage(gid,e.target);
  try{
    const res=await call("get_attachments",{task_id:gid});
    if(commPreviewGid!==gid) return;
    commPrevAtt=res.data||[];
  }catch(e){
    if(commPreviewGid!==gid) return;
    commPreviewError=e.message||"Could not load attachments";
  }
  renderCommImageArea(gid);
}

function updateBubbleText(text){
  const el=document.getElementById("waText"); if(!el) return;
  el.innerHTML = text ? esc(text).replace(/\n/g,"<br>") : '<span class="wa-ph">Your message will appear here…</span>';
}

// Paint both the bubble image and the control row from the current attachments.
function renderCommImageArea(gid){
  if(commPreviewGid!==gid) return;
  const att=commImageAtt(commPrevAtt), url=commImgUrl(att);
  const bubble=document.getElementById("waBubble");
  if(bubble){
    const existing=bubble.querySelector(".wa-img");
    if(url){ if(existing) existing.querySelector("img").src=url; else bubble.insertAdjacentHTML("afterbegin", commImgHtml(url)); }
    else if(existing) existing.remove();
  }
  const row=document.getElementById("waImgRow"); if(!row) return;
  if(commPreviewError){
    row.innerHTML='<span class="wa-img-error">Couldn\'t load the Asana image.</span>'+
      '<button class="btn ghost sm" id="waRetryImg">Retry</button>';
    row.querySelector("#waRetryImg").onclick=async()=>{
      commPreviewError="";
      row.innerHTML='<span class="hint"><span class="spin"></span> checking again…</span>';
      try{
        const res=await call("get_attachments",{task_id:gid});
        if(commPreviewGid===gid) commPrevAtt=res.data||[];
      }catch(e){ if(commPreviewGid===gid) commPreviewError=e.message||"Could not load attachments"; }
      renderCommImageArea(gid);
    };
    return;
  }
  if(url){
    row.innerHTML='<div class="wa-thumb"><img src="'+esc(url)+'" alt=""></div>'+
      '<button class="btn ghost sm" id="waReplace">Replace</button>'+
      '<button class="btn ghost sm" id="waRemove">Remove</button>';
    row.querySelector("#waReplace").onclick=()=>document.getElementById("waFile").click();
    row.querySelector("#waRemove").onclick=()=>removeCommImage(gid,att);
  } else {
    row.innerHTML='<button class="btn glow sm" id="waAddImg">📷 Add image</button>'+
      '<span class="hint" style="margin:0">Attaches to the Asana task.</span>';
    row.querySelector("#waAddImg").onclick=()=>document.getElementById("waFile").click();
  }
}

// Downscale in-browser (keeps the upload small and under the request limit),
// then hand back base64 + a data URL for instant preview.
function downscaleImage(file, maxDim, cb){
  const url=URL.createObjectURL(file), img=new Image();
  img.onload=()=>{
    let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
    const scale=Math.min(1, maxDim/Math.max(w,h)); w=Math.max(1,Math.round(w*scale)); h=Math.max(1,Math.round(h*scale));
    const c=document.createElement("canvas"); c.width=w; c.height=h;
    c.getContext("2d").drawImage(img,0,0,w,h);
    URL.revokeObjectURL(url);
    let mime=(file.type==="image/png")?"image/png":"image/jpeg";
    let dataUrl;
    try{
      dataUrl=c.toDataURL(mime,.84);
      // Large PNGs create oversized base64 JSON requests. Flatten to JPEG
      // when needed; the WhatsApp preview is rectangular either way.
      if(dataUrl.length>3600000){ mime="image/jpeg"; dataUrl=c.toDataURL(mime,.78); }
    }catch(e){ toast("Couldn't process that image"); return; }
    const base64=dataUrl.split(",")[1]||"";
    if(!base64||base64.length>3600000){ toast("That image is still too large — choose a smaller one"); return; }
    cb({ base64, mime, dataUrl,
         filename:((file.name||"image").replace(/\.[^.]+$/,"")).replace(/[\\/]/g,"-")+(mime==="image/png"?".png":".jpg") });
  };
  img.onerror=()=>{ URL.revokeObjectURL(url); toast("Couldn't read that image"); };
  img.src=url;
}

function handleCommImage(gid, fileInput){
  const f=fileInput.files&&fileInput.files[0]; fileInput.value="";
  if(!f) return;
  if(!/^image\//.test(f.type)){ toast("Pick an image file"); return; }
  downscaleImage(f, 1280, async ({base64,mime,filename,dataUrl})=>{
    if(commPreviewGid!==gid) return;
    const oldAtt=commImageAtt(commPrevAtt);
    const bubble=document.getElementById("waBubble");
    if(bubble){ const ex=bubble.querySelector(".wa-img"); if(ex) ex.querySelector("img").src=dataUrl; else bubble.insertAdjacentHTML("afterbegin", commImgHtml(dataUrl)); }
    const row=document.getElementById("waImgRow"); if(row) row.innerHTML='<span class="hint" style="margin:0"><span class="spin"></span> uploading to Asana…</span>';
    try{
      const uploaded=await call("upload_attachment",{task_id:gid, filename, mime, data_base64:base64});
      if(commPreviewGid!==gid) return;
      let oldDeleteFailed=false;
      if(oldAtt&&uploaded.data&&uploaded.data.gid!==oldAtt.gid){
        try{ await call("delete_attachment",{attachment_id:oldAtt.gid}); }
        catch(_){ oldDeleteFailed=true; }
      }
      try{
        const res=await call("get_attachments",{task_id:gid});
        if(commPreviewGid===gid) commPrevAtt=res.data||[];
      }catch(_){
        // Keep the new image visible if Asana's immediate attachment refresh
        // has a temporary problem after a successful upload.
        if(uploaded.data) commPrevAtt=[{
          ...uploaded.data,
          name:uploaded.data.name||filename,
          download_url:dataUrl,
          created_at:new Date().toISOString()
        },...commPrevAtt.filter(a=>!oldAtt||a.gid!==oldAtt.gid)];
        commPreviewError="";
      }
      toast(oldDeleteFailed?"New image added; the old Asana attachment could not be removed":(oldAtt?"Image replaced in Asana ✓":"Image added to Asana ✓"));
      renderCommImageArea(gid);
    }catch(e){ toast("Upload failed: "+e.message); renderCommImageArea(gid); }
  });
}

async function removeCommImage(gid, att){
  if(!att||commPreviewGid!==gid) return;
  try{
    await call("delete_attachment",{attachment_id:att.gid});
    commPrevAtt=commPrevAtt.filter(a=>a.gid!==att.gid);
    toast("Image removed"); renderCommImageArea(gid);
  }catch(e){ toast("Couldn't remove: "+e.message); }
}

async function saveCommText(gid, t){
  const body=(document.getElementById("waMsg").value||"").trim();
  const {purpose}=commSplitNotes(t.notes);
  const notes=body+(purpose?(body?"\n":"")+"#purpose:"+purpose:"");
  const btn=document.getElementById("waSave"); if(btn){ btn.disabled=true; btn.textContent="Saving…"; }
  try{
    await call("update_shared_tasks",{tasks:[{task:gid, notes}]});
    t.notes=notes; toast("Saved ✓"); renderCommunities();
  }catch(e){ toast("Failed: "+e.message); }
  if(btn){ btn.disabled=false; btn.textContent="Save to Asana"; }
}

function fillPasteCommSelect(){
  const sel=document.getElementById("waPasteComm");
  if(sel && !sel.dataset.filled){
    sel.innerHTML='<option value="">which community?</option>'+cfg.communities.map(c=>'<option>'+esc(c.name)+'</option>').join("");
    sel.dataset.filled="1";
  }
}
document.addEventListener("DOMContentLoaded",fillPasteCommSelect);
