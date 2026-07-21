import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

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
assert.match(core,/const ASSIGNEE_SUGGESTIONS=\[[\s\S]*key:"amy"[\s\S]*key:"jess"[\s\S]*key:"caitlin"/,"Preferred assignees are missing or in the wrong order");
assert.match(core,/function assigneeOptions\(/,"Shared assignee-option helper is missing");
const assigneeStart=core.indexOf("const ASSIGNEE_SUGGESTIONS=");
const assigneeEnd=core.indexOf("// Who is running this visit?",assigneeStart);
assert.ok(assigneeStart>=0&&assigneeEnd>assigneeStart,"Could not isolate assignee helper for runtime test");
const assigneeContext=vm.createContext({
  state:{users:[
    {gid:"u-z",name:"Zola Ndlovu",email:"zola@example.com"},
    {gid:"u-c",name:"Caitlin Smith",email:"caitlin.smith@example.com"},
    {gid:"u-j",name:"Jessica Pallister",email:"jessica@example.com"},
    {gid:"u-a",name:"Amy Gray",email:"amy.gray@example.com"},
    {gid:"u-b",name:"Brian Adams",email:"brian@example.com"}
  ]},
  esc:value=>String(value??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]))
});
vm.runInContext(core.slice(assigneeStart,assigneeEnd),assigneeContext);
const assigneeHtml=vm.runInContext('assigneeOptions("u-b","")',assigneeContext);
assert.ok(assigneeHtml.indexOf("Amy Gray")<assigneeHtml.indexOf("Jessica Pallister")&&assigneeHtml.indexOf("Jessica Pallister")<assigneeHtml.indexOf("Caitlin Smith"),"Suggested assignees are not ordered Amy, Jess, Caitlin");
assert.ok(assigneeHtml.indexOf("Caitlin Smith")<assigneeHtml.indexOf("Brian Adams"),"Suggested assignees do not appear before everyone else");
assert.match(assigneeHtml,/value="u-b" selected/,"A current non-suggested assignee is not preserved");

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
assert.match(drawer,/call\("get_mentions",\{[\s\S]*days:MENTION_SCAN_DAYS[\s\S]*project_ids:projectIds[\s\S]*tasks:loadedTasks/,"Mentions view does not run the deeper Asana scan");
assert.match(drawer,/Notice it, deal with it, or show the original task in your to-do list\./,"Mentions panel does not explain its triage workflow");
assert.match(drawer,/async function openMentionTask\([\s\S]*call\("get_task"[\s\S]*openDrawer\(String\(group\.taskGid\)\)/,"Mention references do not open the original task inside the app");
assert.match(drawer,/ob-asana-mentions-v3:/,"Mentions are not cached per user with the incremental scanner");
assert.match(drawer,/ob-mention-triage-v1:/,"Mention seen and hidden states are not saved per user");
assert.match(drawer,/Show in My To-Do/,"Mentions are missing the My To-Do action");
assert.match(drawer,/function addMentionReference\(/,"Mention references cannot be added to The Girls");
assert.match(drawer,/function setMentionsHidden\(/,"Mentions cannot be hidden and restored");
assert.match(drawer,/function startMentionWatcher\(/,"Mentions do not refresh in the background");
assert.match(drawer,/data-mention-filter="all"[\s\S]*data-mention-filter="hidden"/,"Mentions panel is missing All and Hidden views");
assert.doesNotMatch(drawer,/data-mention-filter="new"/,"Separate New mentions tab returned");
assert.match(drawer,/mention-section-label[\s\S]*New[\s\S]*Earlier/,"All mentions view does not group new mentions above earlier mentions");
assert.match(drawer,/after_iso:afterIso/,"Mention refreshes do not use incremental scan dates");
assert.match(drawer,/assigneeOptions\(t\.assignee\?t\.assignee\.gid:"unassigned","unassigned"\)/,"Task editing does not use preferred assignee suggestions");
assert.match(drawer,/const peopleOpts=assigneeOptions\("",""\)/,"Quick task creation does not use preferred assignee suggestions");
assert.match(core,/projectGid:\(t\.projects&&t\.projects\[0\]&&t\.projects\[0\]\.gid\)\|\|null/,"The Girls tasks do not retain their current Asana project ID");
assert.match(core,/externalTasks: \{\}/,"Tasks opened from Mentions are not retained for the normal drawer");
assert.match(core,/k\.mentionRefs/,"Shared dashboard state does not retain My To-Do mention references");

// Exercise the personal mention triage state and the safe Girls reference.
const mentionStart=drawer.indexOf("const MENTION_SCAN_DAYS=180;");
assert.ok(mentionStart>=0,"Could not isolate the mention triage implementation");
const mentionStorage=new Map();
const mentionKeeper={mentions:[],mentionRefs:{},girls:{amy:{sections:[{id:"top3",name:"Top 3",taskIds:[]}],order:[],hidden:[],private:[]}}};
const mentionContext=vm.createContext({
  console,Date,Map,Set,Promise,setTimeout,clearTimeout,setInterval:()=>1,
  localStorage:{getItem:key=>mentionStorage.get(key)||null,setItem:(key,value)=>mentionStorage.set(key,value)},
  document:{visibilityState:"visible",getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){}},
  window:{open(){}},
  state:{me:{gid:"amy-1",name:"Amy Gray"},keeper:mentionKeeper,myTasks:{amy:[]},tasks:[],externalTasks:{},users:[]},
  GIRLS:[{key:"amy",gid:"amy-1",name:"Amy Gray"}],DEMO:false,
  cfg:{projects:[]},PB:{},CC_PROJECT:null,WA_PROJECT:null,COMMUNITIES_PROJECT:null,BUGS_PROJECT:null,VISITS_PROJECT:null,SCHEDULE_PROJECT:null,REVAMP_PROJECT:null,CURRICULUM_PROJECT:null,
  findTask:()=>null,girlCfg:key=>mentionKeeper.girls[key],myKey:()=>"amy",saveKeeper(){},renderGirls(){},toast(){},
  esc:value=>String(value??""),call:async()=>({data:{}}),closeModal(){},openDrawer(){},showModal(){},wireModalClose(){}
});
vm.runInContext(drawer.slice(mentionStart),mentionContext,{filename:"mention-triage.js"});
vm.runInContext(`asanaMentions.items=[
  {storyGid:"story-1",taskGid:"task-1",taskName:"Recipe review",taskUrl:"https://app.asana.com/task-1",projectName:"Campaign",from:"Jess",text:"@Amy please review",at:"2026-07-21T10:00:00Z"},
  {storyGid:"story-2",taskGid:"task-1",taskName:"Recipe review",taskUrl:"https://app.asana.com/task-1",projectName:"Campaign",from:"Caitlin",text:"@Amy adding the latest file",at:"2026-07-21T11:00:00Z"}
]`,mentionContext);
assert.equal(vm.runInContext("mentionCounts().new",mentionContext),2,"New mention count is incorrect");
vm.runInContext("markMentionsSeen([asanaMentions.items[0]])",mentionContext);
assert.equal(vm.runInContext("mentionCounts().new",mentionContext),1,"Acknowledging one mention marks the entire inbox seen");
vm.runInContext("setMentionsHidden([asanaMentions.items[1]],true)",mentionContext);
assert.equal(vm.runInContext("mentionCounts().hidden",mentionContext),1,"Hidden mentions are not retained");
vm.runInContext("addMentionReference(allMentionGroups()[0])",mentionContext);
assert.equal(vm.runInContext("mentionRefsForUser().length",mentionContext),1,"Show in My To-Do did not create a reference");
assert.equal(vm.runInContext("mentionReferenceTask(mentionRefsForUser()[0]).sourceTaskGid",mentionContext),"task-1","The Girls reference lost the original task link");
assert.equal(vm.runInContext("mentionReferenceTask(mentionRefsForUser()[0]).isMentionRef",mentionContext),true,"The Girls reference is not distinguishable from a real Asana task");
vm.runInContext("removeMentionReference('task-1',true)",mentionContext);
assert.equal(vm.runInContext("mentionRefsForUser().length",mentionContext),0,"Removing a mention reference failed");
vm.runInContext(`asanaMentions.items=[
  {storyGid:"sort-unseen",taskGid:"task-unseen",taskName:"Older but new",from:"Jess",text:"@Amy new",at:"2026-07-21T09:00:00Z"},
  {storyGid:"sort-seen",taskGid:"task-seen",taskName:"Newer but seen",from:"Caitlin",text:"@Amy seen",at:"2026-07-21T12:00:00Z"}
]; mentionPanel.filter="all"; markMentionsSeen([asanaMentions.items[1]])`,mentionContext);
assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(mentionGroupsForPanel().map(group=>group.taskGid))",mentionContext)),["task-unseen","task-seen"],"All mentions does not place unacknowledged threads above newer seen threads");

const campaigns=fs.readFileSync(path.join(root,"js/campaigns.js"),"utf8");
assert.match(campaigns,/const people=assigneeOptions\("",""\)/,"Campaign task creation does not use preferred assignee suggestions");
assert.match(campaigns,/assigneeOptions\(r\.assignee\|\|"",""\)/,"Smart Plan ownership does not use preferred assignee suggestions");

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
assert.match(styles,/\.modal-wrap\.mention-mode \.modal/,"Mentions do not open as a dedicated side panel");
assert.match(styles,/\.mention-list\{flex:1;min-height:0;max-height:none;overflow-y:auto/,"Mentions list is not independently scrollable");
assert.match(styles,/\.mention-ref-card/,"Mention references are not visually distinct in The Girls");
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
assert.match(asana,/case "get_mentions"/,"Asana mention scan endpoint is missing");
assert.match(asana,/"followers\.any":"me"/,"Mention scan does not search tasks followed by the signed-in user");
assert.match(asana,/mentionsFromTaskStories/,"Mention scan does not parse structured Asana rich text");
assert.match(asana,/\/batch/,"Mention story loading is not batched");


const people=fs.readFileSync(path.join(root,"js/people.js"),"utf8");
assert.match(people,/await call\("update_tasks"[\s\S]*celebrateCompletion\(t/,"The Girls completion path does not celebrate after a successful save");
const content=fs.readFileSync(path.join(root,"js/content.js"),"utf8");
assert.match(content,/finalShot[\s\S]*suppressCelebration:finalShot[\s\S]*Shot list complete\. That's a wrap\./,"Final shoot shots can still trigger overlapping completion effects");

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

const mentionHelpers=await import(pathToFileURL(path.join(root,"api/_mentions.js")).href);
const mentionHtml='<body>Hello <a href="https://app.asana.com/0/123/list" data-asana-dynamic="true" data-asana-gid="amy-1" data-asana-type="user">@Amy Gray</a>, please review.</body>';
assert.equal(mentionHelpers.htmlMentionsUser(mentionHtml,"amy-1"),true,"Structured Asana user mention was not detected");
assert.equal(mentionHelpers.htmlMentionsUser(mentionHtml,"other-user"),false,"Mention parser matched the wrong user");
assert.equal(mentionHelpers.htmlMentionsUser('<body><a data-asana-gid="amy-1">@Amy Gray</a></body>',"amy-1"),true,"Mention parser did not support Asana rich text without an explicit type attribute");
const parsedMentions=mentionHelpers.mentionsFromTaskStories(
  {gid:"task-1",name:"Recipe review",permalink_url:"https://app.asana.com/task-1",memberships:[{project:{gid:"12345",name:"Campaign"}}]},
  [{gid:"story-1",type:"comment",resource_subtype:"comment_added",created_at:"2026-07-20T12:00:00Z",created_by:{gid:"jess-1",name:"Jess"},html_text:mentionHtml,text:"Hello @Amy Gray, please review."}],
  "amy-1","2026-01-01T00:00:00Z"
);
assert.equal(parsedMentions.length,1,"Real task-comment mention was not returned");
assert.equal(parsedMentions[0].taskName,"Recipe review","Mention lost its task context");
assert.match(parsedMentions[0].text,/Hello @Amy Gray, please review\./,"Mention comment excerpt was not cleaned correctly");

// Exercise the server endpoint contract with mocked Asana responses.
const [{default:asanaHandler},{packSession}]=await Promise.all([
  import(pathToFileURL(path.join(root,"api/asana.js")).href),
  import(pathToFileURL(path.join(root,"api/_lib.js")).href)
]);
const realFetch=globalThis.fetch;
const fetched=[];
globalThis.fetch=async(url,opts={})=>{
  const href=String(url); fetched.push({url:href,opts});
  if(href.includes("/users/me")) return new Response(JSON.stringify({data:{gid:"amy-1",name:"Amy"}}),{status:200});
  if(href.includes("/tasks/search")){
    const u=new URL(href);
    const isSub=u.searchParams.get("is_subtask")==="true";
    const isProject=!!u.searchParams.get("projects.any");
    if(isSub) return new Response(JSON.stringify({data:[{gid:"sub-1",name:"Recipe subtask",permalink_url:"https://app.asana.com/sub-1",modified_at:new Date().toISOString(),parent:{gid:"task-1",name:"Recipe review"},memberships:[]}]}),{status:200});
    return new Response(JSON.stringify({data:[{gid:"task-1",name:"Recipe review",permalink_url:"https://app.asana.com/task-1",modified_at:new Date().toISOString(),memberships:[{project:{gid:"12345",name:isProject?"Campaign":"Campaign"}}]}]}),{status:200});
  }
  if(href.endsWith("/batch")){
    return new Response(JSON.stringify({data:[{status_code:200,body:{data:[{gid:"sub-1",name:"Recipe subtask",permalink_url:"https://app.asana.com/sub-1",modified_at:new Date().toISOString(),parent:{gid:"task-1",name:"Recipe review"},memberships:[]}]}}]}),{status:200});
  }
  if(href.includes("/tasks/task-1/stories")) return new Response(JSON.stringify({data:[]}),{status:200});
  if(href.includes("/tasks/sub-1/stories")) return new Response(JSON.stringify({data:[{gid:"story-1",type:"comment",resource_subtype:"comment_added",created_at:new Date().toISOString(),created_by:{gid:"jess-1",name:"Jess"},html_text:mentionHtml,text:"Hello @Amy Gray, please review."}]}),{status:200});
  throw new Error("Unexpected mocked Asana request: "+url);
};
let mentionResponse=null,statusCode=200;
const req={method:"POST",body:{tool:"get_mentions",args:{days:180,task_limit:20,project_ids:["12345"],tasks:[{gid:"task-1",name:"Recipe review",projectGid:"12345",projectName:"Campaign"}]}},headers:{cookie:"ob_session="+encodeURIComponent(packSession({access_token:"token",expires_at:Date.now()+60000,user:{gid:"amy-1",name:"Amy"}}))}};
const res={setHeader(){},status(code){statusCode=code;return this;},json(value){mentionResponse=value;return value;}};
try{ await asanaHandler(req,res); }finally{ globalThis.fetch=realFetch; }
assert.equal(statusCode,200,"Mention endpoint returned a failure");
assert.equal(mentionResponse.data.length,1,"Mention endpoint did not return the parsed subtask mention");
assert.equal(mentionResponse.data[0].isSubtask,true,"Subtask context was lost");
assert.equal(mentionResponse.data[0].parentName,"Recipe review","Subtask parent context was lost");
assert.ok(fetched.some(x=>x.url.includes("followers.any=me")&&x.url.includes("is_subtask=false")),"Mention endpoint did not search followed top-level tasks");
assert.ok(fetched.some(x=>x.url.includes("followers.any=me")&&x.url.includes("is_subtask=true")),"Mention endpoint did not search followed subtasks");
assert.ok(fetched.some(x=>x.url.includes("projects.any=12345")),"Mention endpoint did not scan loaded Academy projects");
assert.ok(fetched.some(x=>x.url.endsWith("/batch")),"Mention endpoint did not discover ordinary subtasks");
assert.ok(fetched.some(x=>x.url.includes("/tasks/sub-1/stories")),"Mention endpoint did not read subtask comments");
assert.ok(mentionResponse.scanned_subtasks>=1,"Mention diagnostics did not report subtasks");

console.log(`Verified ${files.length} code files, preferred assignee suggestions, shared UI safeguards, real Asana mentions, Communities scheduling, and launch-anchored Smart Campaign workflows.`);
