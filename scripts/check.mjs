import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const codeDirs=["js","api"];
const files=codeDirs.flatMap(dir=>fs.readdirSync(path.join(root,dir))
  .filter(name=>name.endsWith(".js"))
  .map(name=>path.join(root,dir,name)));
files.push(path.join(root,"serve.cjs"));

for(const file of files){
  const result=spawnSync(process.execPath,["--check",file],{encoding:"utf8"});
  assert.equal(result.status,0,`${path.relative(root,file)} failed syntax check:\n${result.stderr}`);
}

const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
assert.match(html,/data-tab="pr">PR<\/button>/,"PR tab must remain visible");
assert.doesNotMatch(html,/data-tab="pr"[^>]*display\s*:\s*none/,"PR tab is hidden");
assert.match(html,/https:\/\/app\.asana\.com\/1\/14491666778313\/project\/1216476690596926\/list\/1216477106031170/,"Communities link changed");
assert.doesNotMatch(html,/Create the Community Messages board/i,"Old Communities board creator returned");
assert.match(html,/id="waMessage"/,"Communities message-body field is missing");
assert.match(html,/id="waComposeFile"[^>]*accept="image\/\*"/,"Communities image picker is missing");
assert.match(html,/type="time" id="waTime"/,"Communities send-time picker is missing");
assert.match(html,/id="waTimeFavs"/,"Favourite send-time controls are missing");

const versions=[...html.matchAll(/\?v=([0-9a-z]+)/g)].map(match=>match[1]);
assert.ok(versions.length>0,"No asset cache-busters found");
assert.equal(new Set(versions).size,1,"Asset cache-busters are inconsistent");

const core=fs.readFileSync(path.join(root,"js/core.js"),"utf8");
assert.match(core,/save_dashboard_state/,"Shared dashboard-state sync is missing");
assert.match(core,/Saved on this browser; Asana sync will retry automatically/,"Automatic retry notice is missing");
assert.match(core,/due_on,due_at/,"Timed Asana tasks are not loaded");
assert.match(core,/Africa\/Johannesburg/,"Communities times are not converted in the intended timezone");
assert.match(core,/due_at:t\.dueAt,due_on:null/,"Dragging a timed Communities message does not preserve its time safely");
assert.match(core,/t\.isComms\?"update_shared_tasks":"update_tasks"[\s\S]*completed:val/,"Marking a Communities message sent does not use the shared Asana identity");
assert.match(core,/t\.isComms\?"update_shared_tasks":"update_tasks"/,"Communities rescheduling does not use the shared Asana identity");
assert.match(core,/await call\(t\.isComms\?"update_shared_tasks":"update_tasks"[\s\S]*if\(val && !options\.suppressCelebration\) celebrateCompletion/,"Task celebration does not wait for Asana to confirm completion");
assert.match(core,/function celebrateCompletion\(/,"Shared task-completion celebration is missing");
assert.match(core,/prefers-reduced-motion: reduce/,"Completion celebrations do not respect reduced-motion preferences");
assert.match(core,/completionPending=new Set\(\)/,"Rapid completion clicks are not guarded against duplicate writes");

const drawer=fs.readFileSync(path.join(root,"js/drawer.js"),"utf8");
assert.match(drawer,/create_shared_project/,"Campaign projects are not created through the shared Academy identity");
assert.match(drawer,/create_shared_tasks/,"Campaign runway tasks are not created through the shared Academy identity");
assert.match(drawer,/r\.dismissed=!r\.selected/,"Unticked creation-plan ideas are not preserved as dismissed");
assert.match(drawer,/id="dTime"[\s\S]*t\.sendTime/,"Communities task drawer cannot edit the send time");
assert.match(drawer,/upd\.due_at=communityDueAt\(due,sendTime\); upd\.due_on=null/,"Timed drawer edits do not clear due_on");
assert.match(drawer,/upd\.due_on=due; upd\.due_at=null/,"Date-only drawer edits do not clear due_at");
assert.match(drawer,/id="dMoveBoard"/,"Task drawer is missing the explicit move-board control");
assert.match(drawer,/The board will not change unless you tick this\./,"Task drawer does not explain the safe board behaviour");
assert.match(drawer,/const wantsMove=d\.querySelector\("#dMoveBoard"\)\.checked/,"Saving a task does not require explicit move intent");
assert.match(drawer,/const proj=wantsMove\?d\.querySelector\("#dProject"\)\.value:""/,"The destination board can still default implicitly");
assert.match(drawer,/if\(wantsMove&&!proj\)\{ toast\("Choose the board you want to move this task to"\)/,"Move mode does not require a destination board");
assert.match(drawer,/if\(t\.projectGid\) upd\.remove_projects=\[t\.projectGid\]/,"Tasks without a current project are not handled safely");
assert.doesNotMatch(drawer,/p\.gid===t\.projectGid\?" selected"/,"Current board is still being selected through the unsafe destination dropdown");
assert.match(drawer,/id="sCelebrate"/,"Settings are missing the task-celebration preference");
assert.match(drawer,/cfg\.completionCelebrations=document\.getElementById\("sCelebrate"\)\.checked/,"Task-celebration preference is not saved");
assert.match(core,/projectGid:\(t\.projects&&t\.projects\[0\]&&t\.projects\[0\]\.gid\)\|\|null/,"The Girls tasks do not retain their current Asana project ID");

const communities=fs.readFileSync(path.join(root,"js/communities.js"),"utf8");
assert.match(communities,/create_shared_tasks/,"Communities tasks are not created through the shared identity");
assert.match(communities,/upload_attachment/,"New Communities images are not uploaded to Asana");
assert.match(communities,/delete_attachment[\s\S]*oldAtt/,"Image replacement does not remove the previous attachment");
assert.match(communities,/openCommPreview\(m\.dataset\.gid\)/,"Communities calendar messages do not open the WhatsApp preview");
assert.match(communities,/openCommPreview\(r\.dataset\.gid\)/,"Communities list messages do not open the WhatsApp preview");
assert.match(communities,/commTimeFavourites/,"Favourite send times are not persisted");
assert.match(communities,/dayMsgs\.forEach\(t=>/,"Communities calendar does not render every message in a day");
assert.doesNotMatch(communities,/dayMsgs\.slice\(0,3\)/,"Communities calendar still truncates busy days");
assert.match(communities,/t\.due_at=communityDueAt\(date,time\)/,"Selected times are not saved to Asana due_at");

const data=fs.readFileSync(path.join(root,"js/data.js"),"utf8");
assert.match(data,/name:"Bar \/ Deli"/,"Bar / Deli is missing from Communities roles");
assert.match(data,/commTimeFavourites: \["10:00","15:00","18:00"\]/,"Default favourite times are incorrect");
assert.match(data,/completionCelebrations: true/,"Task completion celebrations are not enabled by default");
assert.doesNotMatch(data,/Rise and brine/i,"Retired greeting returned");
assert.match(data,/Still here, \{n\}\? Iconic\./,"Updated evening greeting pack is missing");

const styles=fs.readFileSync(path.join(root,"styles.css"),"utf8");
assert.match(styles,/\.wc-grid\{grid-auto-rows:minmax\(88px,auto\)/,"Communities calendar rows do not grow with message volume");
assert.match(styles,/#commCal \.wc-dow,#commCal \.wc-grid\{width:max\(100%,760px\)/,"Communities calendar is not responsive on narrow screens");
assert.match(styles,/\.completion-moment\{/,"Completion success card styling is missing");
assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/,"Reduced-motion styling for completions is missing");

const asana=fs.readFileSync(path.join(root,"api/asana.js"),"utf8");
assert.match(asana,/const parent=args\.parent_id\|\|args\.task_id[\s\S]*`\/attachments\?\$\{qs\(\{[\s\S]*parent,/,"Attachment listing does not use Asana's parent query");
assert.doesNotMatch(asana,/\/tasks\/\$\{args\.task_id\}\/attachments/,"Obsolete task attachment-list route returned");
assert.match(asana,/new FormData\(\)/,"Attachment upload is not multipart form data");
assert.match(asana,/method:"POST"[\s\S]*body: form/,"Attachment upload is not posted to Asana");
assert.match(asana,/projects\.gid,projects\.name/,"My Tasks loading does not request the current board ID");


const people=fs.readFileSync(path.join(root,"js/people.js"),"utf8");
assert.match(people,/await call\("update_tasks"[\s\S]*celebrateCompletion\(t/,"The Girls completion path does not celebrate after a successful save");
const content=fs.readFileSync(path.join(root,"js/content.js"),"utf8");
assert.match(content,/finalShot[\s\S]*suppressCelebration:finalShot[\s\S]*Shot list complete\. That's a wrap\./,"Final shoot shots can still trigger overlapping completion effects");

const campaigns=fs.readFileSync(path.join(root,"js/campaigns.js"),"utf8");
assert.match(campaigns,/toggleCampaignSubtask[\s\S]*celebrateCompletion\(\{name:sub\.name,isSubtask:true\},\{compact:true\}\)/,"Campaign subtasks do not use the compact completion celebration");
assert.match(campaigns,/offset:-14,name:"Course material sent out and available to teams"/,"Course delivery is not anchored 14 days before launch");
assert.match(campaigns,/offset:-28,name:"Shoot Day — \{\{name\}\}"/,"Shoot day is not anchored 28 days before launch");
assert.match(campaigns,/Smart update whole plan/i,"Campaign Smart Update control is missing");
assert.match(campaigns,/parent_id:c\.gid[\s\S]*upload_attachment/,"Campaign resources are not uploaded to the Asana project");
assert.match(campaigns,/save_campaign_state/,"Campaign intelligence is not persisted in shared Asana state");
assert.match(campaigns,/set_task_parent/,"Campaign shoot deliverables are not linked to shoot days");
assert.match(campaigns,/Only checked changes will be written to Asana/,"Smart Plan does not require approval before writes");
const resourceApi=fs.readFileSync(path.join(root,"api/campaign-resource.js"),"utf8");
assert.match(resourceApi,/getDocument\(/,"PDF campaign sources are not supported");
assert.match(resourceApi,/mammoth\.extractRawText/,"Word campaign sources are not supported");
assert.match(resourceApi,/readExcelFile\(buf\)/,"Spreadsheet campaign sources are not supported");
assert.match(resourceApi,/Do not invent operational facts/,"Source analysis is not guarded against invented operational facts");
assert.match(core,/state\.campaignSmart = \{\}/,"Fresh Asana loads do not invalidate the shared Smart Plan cache");
assert.match(campaigns,/inputChanged=launchChanged\|\|name!==c\.name\|\|due!==c\.due\|\|notes!==c\.notes/,"Campaign detail changes do not mark the Smart Plan for refresh");
assert.match(campaigns,/old&&old\.dismissed/,"Smart Update does not preserve deliberately dismissed recommendations");
assert.match(campaigns,/if\(t\.completed\)return\{[\s\S]*action:"covered"/,"Smart Update can still move completed campaign work");

// Exercise the launch arithmetic and safe-refresh decisions dynamically.
const campaignContext=vm.createContext({
  console,Date,Map,Set,Promise,
  pd:value=>{const [y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d);},
  iso:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
});
vm.runInContext(campaigns,campaignContext,{filename:"js/campaigns.js"});
const backwards=JSON.parse(vm.runInContext('JSON.stringify(buildCampaignPlan("Summer Menu","2026-10-01","2026-10-31",["courses","videos"],["FOH"]))',campaignContext));
assert.equal(backwards.find(x=>x.id==="base:course-material-live").due,"2026-09-17","Course material is not scheduled two weeks before launch");
assert.equal(backwards.find(x=>x.id==="base:shoot-day").due,"2026-09-03","Shoot day is not scheduled two weeks before course release");
const sourceRows=JSON.parse(vm.runInContext('JSON.stringify(campaignSourceRecommendations({a:{name:"Mussels recipe.pdf",analysis:{recipes:[{name:"Whole-shell mussels",suggested_shots:["Boil","Discard closed shells"]}]}}},"2026-10-01"))',campaignContext));
assert.equal(sourceRows[0].due,"2026-09-03","Recipe filming is not attached to the campaign shoot window");
const safeRefresh=JSON.parse(vm.runInContext(`JSON.stringify(compareRecommendations(
  [{id:"one",name:"Existing output",due:"2026-09-10"},{id:"two",name:"Rejected idea",due:"2026-09-12"},{id:"three",name:"Finished output",due:"2026-09-15"}],
  [{gid:"t1",name:"Existing output",due:"2026-09-01",completed:false,notes:"#campaign-smart-id:one"},{gid:"t3",name:"Finished output",due:"2026-09-01",completed:true,notes:"#campaign-smart-id:three"}],
  [{id:"one",dismissed:true},{id:"two",dismissed:true}]
))`,campaignContext));
assert.equal(safeRefresh.find(x=>x.id==="one").action,"dismissed","A dismissed date move is not preserved");
assert.equal(safeRefresh.find(x=>x.id==="two").action,"dismissed","A dismissed new idea is not preserved");
assert.equal(safeRefresh.find(x=>x.id==="three").action,"covered","Completed work is not protected during refresh");

// Exercise the composer logic without a browser. This catches the important
// integration contract: description -> task notes, then image -> attachment.
const calls=[];
const elements={
  waName:{value:"Mussels reminder"},
  waMessage:{value:"Hello team!\nPlease review the new method."},
  waDate:{value:"2026-07-24"},
  waTime:{value:"18:00",onchange:null},
  waTimeFavs:{innerHTML:"",querySelectorAll(){return[];}},
  waTimeStar:{disabled:false,textContent:"",onclick:null},
  waPurpose:{value:"info"},
  waAdd:{disabled:false,textContent:"Queue it"},
  waComposeFile:{click(){}},
  waComposeImage:{innerHTML:"",querySelector(){ return {onclick:null}; }},
  wcLabel:{textContent:""},
  commCal:{innerHTML:"",querySelectorAll(){return[];}}
};
const target={value:"mgmt",checked:true};
const context=vm.createContext({
  console, Date, Promise, setTimeout, clearTimeout,
  document:{
    getElementById:id=>elements[id]||null,
    querySelectorAll:sel=>sel==="#commTargets input:checked"?[target]:[],
    addEventListener(){}
  },
  state:{waSections:{Management:"section-1"},tasks:[]},
  cfg:{msgBoard:"communities-project",communities:[{key:"mgmt",name:"Management",color:"#000"}],commTimeFavourites:["10:00","15:00","18:00"]},
  COMMUNITIES_PROJECT:"communities-project", DEMO:false,
  MO:["January","February","March","April","May","June","July","August","September","October","November","December"],
  DOW:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
  todayD:()=>new Date(2026,6,21),
  iso:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
  sameDay:(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(),
  pd:value=>{const [y,m,d]=value.split("-").map(Number);return new Date(y,m-1,d);},
  communityOf:t=>({key:"mgmt",name:"Management",color:"#000"}),
  saveCfg(){}, toast(){}, esc:s=>String(s||""),
  communityDueAt:(date,time)=>new Date(date+"T"+time+":00+02:00").toISOString(),
  loadAll:async()=>{},
  call:async(tool,args)=>{
    calls.push({tool,args});
    if(tool==="create_shared_tasks") return {data:[{gid:"task-1",name:"Mussels reminder"}],failed:[]};
    if(tool==="upload_attachment") return {data:{gid:"att-1",name:args.filename}};
    return {data:[]};
  }
});
vm.runInContext(communities,context,{filename:"js/communities.js"});
vm.runInContext('commComposeImage={filename:"guide.jpg",mime:"image/jpeg",base64:"eA==",dataUrl:"data:image/jpeg;base64,eA=="}',context);
await vm.runInContext("addWAMessage()",context);
const createCall=calls.find(x=>x.tool==="create_shared_tasks");
const uploadCall=calls.find(x=>x.tool==="upload_attachment");
assert.ok(createCall,"Composer did not create an Asana task");
assert.equal(createCall.args.tasks[0].notes,"Hello team!\nPlease review the new method.\n\n#purpose:info","WhatsApp copy was not saved in the Asana description");
assert.equal(createCall.args.tasks[0].section_id,"section-1","Community section was not retained");
assert.equal(createCall.args.tasks[0].due_at,"2026-07-24T16:00:00.000Z","Selected send time was not stored as Asana due_at");
assert.equal("due_on" in createCall.args.tasks[0],false,"Timed messages incorrectly send both due_on and due_at");
assert.ok(uploadCall,"Composer did not attach the selected image");
assert.equal(uploadCall.args.task_id,"task-1","Image was attached to the wrong task");

const parsed=vm.runInContext('commSplitNotes("Line one\\n\\n#purpose:course")',context);
assert.deepEqual({...parsed},{body:"Line one",purpose:"course"},"Purpose metadata leaks into the WhatsApp preview");
const newest=vm.runInContext('commImageAtt([{gid:"old",name:"old.jpg",download_url:"old",created_at:"2026-01-01"},{gid:"new",name:"new.jpg",download_url:"new",created_at:"2026-07-01"}])',context);
assert.equal(newest.gid,"new","Preview does not prefer the newest image attachment");

vm.runInContext(`
  commCursor=new Date(2026,6,1);
  state.tasks=[
    {gid:"m18",name:"Evening",isComms:true,isKeeper:false,due:"2026-07-24",sendTime:"18:00",completed:false},
    {gid:"m10",name:"Morning",isComms:true,isKeeper:false,due:"2026-07-24",sendTime:"10:00",completed:false},
    {gid:"m15",name:"Afternoon",isComms:true,isKeeper:false,due:"2026-07-24",sendTime:"15:00",completed:false},
    {gid:"m12",name:"Lunch",isComms:true,isKeeper:false,due:"2026-07-24",sendTime:"12:00",completed:false},
    {gid:"m09",name:"Early",isComms:true,isKeeper:false,due:"2026-07-24",sendTime:"09:00",completed:false}
  ];
  renderCommCalendar();
`,context);
const calendarHtml=elements.commCal.innerHTML;
for(const gid of ["m18","m10","m15","m12","m09"]) assert.match(calendarHtml,new RegExp(`data-gid="${gid}"`),`Calendar omitted ${gid}`);
assert.ok(calendarHtml.indexOf("09:00")<calendarHtml.indexOf("10:00") && calendarHtml.indexOf("10:00")<calendarHtml.indexOf("18:00"),"Calendar messages are not sorted by send time");
assert.doesNotMatch(calendarHtml,/\+2 more|\+\d+ more/,"Calendar still collapses messages behind a more counter");

console.log(`Verified ${files.length} code files, shared UI safeguards, Communities scheduling, and launch-anchored Smart Campaign workflows.`);
