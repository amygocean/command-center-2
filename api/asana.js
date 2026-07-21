// ------------------------------------------------------------------
//  /api/asana  —  the data proxy.
//  The frontend calls one endpoint with { tool, args }, exactly the
//  same verb names the original prototype used. This maps each verb to
//  the Asana REST API, either as the logged-in user or through the
//  authenticated shared-board identity described below.
//  Keeping this shape means the dashboard's own logic barely changed.
// ------------------------------------------------------------------
import { asanaFetch, getAsanaAccessToken, readSession, WORKSPACE } from "./_lib.js";
import { dedupeTasks, mentionsFromTaskStories } from "./_mentions.js";

// Reads and writes for explicitly shared app data go through ONE service token so every
// signed-in teammate sees the same boards, regardless of what their own
// Asana account has been shared into. Ordinary task edits still run as the
// logged-in person through asanaFetch(). Defaults to AMY_PAT; set a dedicated
// ASANA_SHARED_PAT in Vercel if you'd rather not reuse a personal token.
const SHARED_PAT = process.env.ASANA_SHARED_PAT || process.env.AMY_PAT;
async function serviceFetch(req, res, path, opts={}){
  // Still require a real app login — the service token is only a consistent
  // Asana identity for shared dashboard data, never anonymous access.
  if(!readSession(req)){ const e = new Error("not authenticated"); e.status = 401; throw e; }
  if(!SHARED_PAT) return asanaFetch(req, res, path, opts); // graceful fallback
  const r = await fetch("https://app.asana.com/api/1.0"+path, {
    method: opts.method || "GET",
    headers: { Authorization: "Bearer "+SHARED_PAT, "Content-Type":"application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await r.text();
  let json; try { json = text?JSON.parse(text):{}; } catch { json = { raw:text }; }
  if(!r.ok){ const e = new Error((json.errors&&json.errors[0]&&json.errors[0].message)||("Asana "+r.status)); e.status=r.status; throw e; }
  return json;
}
const sharedFetch = (req,res,path) => serviceFetch(req,res,path);

async function readBody(req){
  if(req.body && typeof req.body === "object") return req.body;
  const chunks=[]; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString()||"{}"); } catch { return {}; }
}
const qs = o => Object.entries(o).filter(([,v])=>v!=null&&v!=="").map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join("&");


function parseBatchResultBody(body){
  if(!body) return {};
  if(typeof body==="string"){ try{return JSON.parse(body);}catch{return {};} }
  return body;
}

function compactTask(task,extra={}){
  if(!task||!task.gid) return null;
  return {
    gid:String(task.gid),name:task.name||"Untitled task",permalink_url:task.permalink_url||null,
    modified_at:task.modified_at||null,memberships:task.memberships||[],parent:task.parent||null,...extra
  };
}

async function mentionTaskSearch(fetcher,filters,taskLimit){
  const fields="name,permalink_url,modified_at,memberships.project.gid,memberships.project.name,parent.gid,parent.name";
  const result=await fetcher(`/workspaces/${WORKSPACE}/tasks/search?${qs({
    ...filters,sort_by:"modified_at",sort_ascending:false,limit:taskLimit,opt_fields:fields
  })}`);
  return (result.data||[]).map(compactTask).filter(Boolean);
}

async function batchSubtasks(req,res,parents){
  const out=[];
  const fields="name,permalink_url,modified_at,memberships.project.gid,memberships.project.name,parent.gid,parent.name";
  for(let i=0;i<parents.length;i+=10){
    const chunk=parents.slice(i,i+10);
    let batch=null;
    try{
      batch=await serviceFetch(req,res,"/batch",{method:"POST",body:{data:{actions:chunk.map(task=>({
        method:"get",relative_path:`tasks/${task.gid}/subtasks?${qs({limit:100,opt_fields:fields})}`
      }))}}});
    }catch(_){ batch=null; }
    if(batch){
      (batch.data||[]).forEach((result,index)=>{
        if(!result||result.status_code<200||result.status_code>=300) return;
        const body=parseBatchResultBody(result.body);
        (body.data||[]).forEach(task=>{
          const item=compactTask(task,{parent:task.parent||{gid:chunk[index].gid,name:chunk[index].name}});
          if(item) out.push(item);
        });
      });
      continue;
    }
    for(const parent of chunk){
      try{
        const page=await serviceFetch(req,res,`/tasks/${parent.gid}/subtasks?${qs({limit:100,opt_fields:fields})}`);
        (page.data||[]).forEach(task=>{ const item=compactTask(task,{parent:task.parent||{gid:parent.gid,name:parent.name}}); if(item)out.push(item); });
      }catch(_){ /* inaccessible parent; other discovery paths may still find it */ }
    }
  }
  return out;
}

async function storyPages(req,res,task,fields){
  const stories=[];
  let offset=null,pages=0,usedShared=false,lastError=null;
  do{
    const path=`/tasks/${task.gid}/stories?${qs({limit:100,offset,opt_fields:fields})}`;
    let page=null;
    try{ page=await asanaFetch(req,res,path); }
    catch(e){
      lastError=e;
      try{ page=await serviceFetch(req,res,path); usedShared=true; }
      catch(sharedError){ lastError=sharedError; break; }
    }
    stories.push(...(page.data||[]));
    offset=page.next_page&&page.next_page.offset||null;
    pages++;
  }while(offset&&pages<4);
  return {stories,usedShared,error:lastError&&stories.length===0?lastError:null,pages};
}

async function mapWithConcurrency(items,limit,fn){
  const results=new Array(items.length);
  let cursor=0;
  async function worker(){
    while(true){
      const index=cursor++;
      if(index>=items.length) return;
      results[index]=await fn(items[index],index);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return results;
}

async function ensureTeamProjectMembership(req,res,projectId,teamId){
  if(!projectId||!teamId) return null;
  const current=await sharedFetch(req,res,`/memberships?${qs({
    parent:projectId,
    member:teamId,
    opt_fields:"member.gid,parent.gid,access_level",
    limit:100
  })}`);
  const found=(current.data||[]).find(m=>String(m.member&&m.member.gid)===String(teamId));
  if(found) return found;
  const made=await serviceFetch(req,res,"/memberships",{
    method:"POST",
    body:{data:{parent:projectId,member:teamId}}
  });
  return made.data;
}

export default async function handler(req, res){
  if(req.method !== "POST"){ res.status(405).json({error:"POST only"}); return; }
  let tool, args;
  try { ({tool, args={}} = await readBody(req)); } catch { res.status(400).json({error:"bad body"}); return; }

  try {
    let out;
    switch(tool){

      // The Girls layout and Corkboard are shared app state.  Saving them with
      // the service token avoids permission-dependent failures when a teammate
      // can use the app but cannot edit Amy's Day-to-Day project directly.
      case "save_dashboard_state": {
        const data={ name:args.name||"⚙️ dashboard-state (do not delete)", notes:args.notes||"{}" };
        let task;
        if(args.task_id){
          const r=await serviceFetch(req,res,`/tasks/${args.task_id}`,{method:"PUT",body:{data}});
          task=r.data;
        }else{
          if(!args.project_id){ res.status(400).json({error:"project_id required"}); return; }
          const r=await serviceFetch(req,res,"/tasks",{method:"POST",body:{data:{...data,projects:[args.project_id]}}});
          task=r.data;
          if(args.section_id) await serviceFetch(req,res,`/sections/${args.section_id}/addTask`,{method:"POST",body:{data:{task:task.gid}}});
        }
        out={data:task};
        break;
      }

      // One hidden task per campaign stores the shared source index, AI plan
      // and review statuses. It is deliberately saved through the shared
      // identity so Amy, Caitlin and Jess see the same intelligence.
      case "save_campaign_state": {
        const data={ name:args.name||"⚙️ campaign-smart-plan (managed by app)", notes:args.notes||"{}" };
        let task;
        if(args.task_id){
          const r=await serviceFetch(req,res,`/tasks/${args.task_id}`,{method:"PUT",body:{data}});
          task=r.data;
        }else{
          if(!args.project_id){ res.status(400).json({error:"project_id required"}); return; }
          const r=await serviceFetch(req,res,"/tasks",{method:"POST",body:{data:{...data,projects:[args.project_id]}}});
          task=r.data;
          if(args.section_id) await serviceFetch(req,res,`/sections/${args.section_id}/addTask`,{method:"POST",body:{data:{task:task.gid}}});
        }
        out={data:task};
        break;
      }

      case "find_project_by_name": {
        const wanted=String(args.name||"").trim().toLowerCase();
        if(!wanted){ res.status(400).json({error:"name required"}); return; }
        let offset=null, hit=null, pages=0;
        do{
          const page=await sharedFetch(req,res,`/workspaces/${WORKSPACE}/projects?${qs({archived:false,opt_fields:"name,permalink_url,privacy_setting,team.gid",limit:100,offset})}`);
          hit=(page.data||[]).find(p=>String(p.name||"").trim().toLowerCase()===wanted)||null;
          offset=hit?null:(page.next_page&&page.next_page.offset);
        }while(offset&&++pages<5);
        out={data:hit};
        break;
      }

      case "create_shared_project": {
        const {sections,team,privacy_setting,...fields}=args;
        const projectData={
          ...fields,
          workspace:fields.workspace||WORKSPACE,
          // private_to_team is deprecated. Create privately, then share by
          // adding the Academy team as a project member below.
          privacy_setting:privacy_setting&&privacy_setting!=="private_to_team"?privacy_setting:"private"
        };
        let proj;
        try{
          proj=await serviceFetch(req,res,"/projects",{method:"POST",body:{data:projectData}});
        }catch(e){
          // Some Asana organisations still require the legacy team field at
          // project creation time. Keep this compatibility fallback, then use
          // the current Memberships endpoint to establish durable team access.
          if(!team) throw e;
          proj=await serviceFetch(req,res,"/projects",{method:"POST",body:{data:{...projectData,team}}});
        }
        const membership=team?await ensureTeamProjectMembership(req,res,proj.data.gid,team):null;
        const made=[];
        for(const section of (sections||[])){
          const sec=await serviceFetch(req,res,`/projects/${proj.data.gid}/sections`,{method:"POST",body:{data:{name:section.sectionName}}});
          made.push(sec.data);
        }
        out={data:{...proj.data,team_membership:membership,sections_created:{succeeded:made}}};
        break;
      }

      case "ensure_shared_project_access": {
        if(!args.project_id||!args.team_id){ res.status(400).json({error:"project_id and team_id required"}); return; }
        const membership=await ensureTeamProjectMembership(req,res,args.project_id,args.team_id);
        out={data:membership};
        break;
      }

      case "ensure_shared_sections": {
        if(!args.project_id){ res.status(400).json({error:"project_id required"}); return; }
        const wanted=(args.names||[]).map(name=>String(name||"").trim()).filter(Boolean);
        const current=await sharedFetch(req,res,`/projects/${args.project_id}/sections?${qs({opt_fields:"name",limit:100})}`);
        const sections=[...(current.data||[])];
        for(const name of wanted){
          if(sections.some(s=>String(s.name||"").trim().toLowerCase()===name.toLowerCase())) continue;
          const made=await serviceFetch(req,res,`/projects/${args.project_id}/sections`,{
            method:"POST",
            body:{data:{name}}
          });
          sections.push(made.data);
        }
        out={data:sections};
        break;
      }

      case "create_shared_tasks": {
        const created=[], failed=[];
        for(const t of (args.tasks||[])){
          try{
            const {project_id,section_id,...rest}=t;
            const data={...rest};
            const proj=project_id||args.default_project;
            if(proj) data.projects=[proj]; else data.workspace=WORKSPACE;
            const c=await serviceFetch(req,res,"/tasks",{method:"POST",body:{data}});
            if(section_id) await serviceFetch(req,res,`/sections/${section_id}/addTask`,{method:"POST",body:{data:{task:c.data.gid}}});
            created.push(c.data);
          }catch(e){ failed.push({name:t.name,errors:[{message:e.message}]}); }
        }
        out={data:created,failed,summary:`Created ${created.length} of ${(args.tasks||[]).length} tasks.`};
        break;
      }

      case "update_shared_tasks": {
        const succeeded=[], failed=[];
        for(const t of (args.tasks||[])){
          try{
            const {task,add_projects,remove_projects,...fields}=t;
            if(Object.keys(fields).length) await serviceFetch(req,res,`/tasks/${task}`,{method:"PUT",body:{data:fields}});
            for(const rp of (remove_projects||[])) await serviceFetch(req,res,`/tasks/${task}/removeProject`,{method:"POST",body:{data:{project:rp}}});
            for(const ap of (add_projects||[])) await serviceFetch(req,res,`/tasks/${task}/addProject`,{method:"POST",body:{data:{project:ap.project_id,section:ap.section_id||undefined}}});
            succeeded.push({gid:task});
          }catch(e){ failed.push({gid:t.task,errors:[{message:e.message}]}); }
        }
        out={data:succeeded,failed,summary:`Updated ${succeeded.length} of ${(args.tasks||[]).length} tasks.`};
        break;
      }

      case "get_users":
        out = await sharedFetch(req,res,`/users?${qs({workspace:WORKSPACE, opt_fields:"name,email", limit:args.limit||100})}`);
        break;

      case "get_tasks":
        out = await sharedFetch(req,res,`/tasks?${qs({project:args.project, opt_fields:args.opt_fields, limit:args.limit||100, offset:args.offset})}`);
        break;

      case "get_project": {
        const p = await sharedFetch(req,res,`/projects/${args.project_id}?${qs({opt_fields:args.opt_fields||"name"})}`);
        if(args.include_sections){
          const s = await sharedFetch(req,res,`/projects/${args.project_id}/sections?${qs({opt_fields:"name"})}`);
          p.data.sections = s.data;
        }
        out = p; break;
      }

      case "update_tasks": {
        const succeeded=[], failed=[];
        for(const t of (args.tasks||[])){
          try {
            const { task, add_projects, remove_projects, ...fields } = t;
            if(Object.keys(fields).length){
              await asanaFetch(req,res,`/tasks/${task}`, { method:"PUT", body:{ data: fields } });
            }
            for(const rp of (remove_projects||[])) await asanaFetch(req,res,`/tasks/${task}/removeProject`, { method:"POST", body:{ data:{ project: rp } } });
            for(const ap of (add_projects||[])) await asanaFetch(req,res,`/tasks/${task}/addProject`, { method:"POST", body:{ data:{ project: ap.project_id, section: ap.section_id||undefined } } });
            succeeded.push({ gid: task });
          } catch(e){ failed.push({ gid: t.task, errors:[{message:e.message}] }); }
        }
        out = { data: succeeded, failed, summary:`Updated ${succeeded.length} of ${(args.tasks||[]).length} tasks.` };
        break;
      }

      case "create_tasks": {
        const created=[], failed=[];
        for(const t of (args.tasks||[])){
          try {
            const { project_id, section_id, ...rest } = t;
            const data = { ...rest };
            const proj = project_id || args.default_project;
            if(proj) data.projects = [proj]; else data.workspace = WORKSPACE;
            const c = await asanaFetch(req,res,`/tasks`, { method:"POST", body:{ data } });
            if(section_id) await asanaFetch(req,res,`/sections/${section_id}/addTask`, { method:"POST", body:{ data:{ task: c.data.gid } } });
            created.push(c.data);
          } catch(e){ failed.push({ name:t.name, errors:[{message:e.message}] }); }
        }
        out = { data: created, failed, summary:`Created ${created.length} of ${(args.tasks||[]).length} tasks.` };
        break;
      }

      case "delete_task":
        await asanaFetch(req,res,`/tasks/${args.task}`, { method:"DELETE" });
        out = { data:{} }; break;

      case "create_project": {
        const { sections, ...pf } = args;
        const proj = await asanaFetch(req,res,`/projects`, { method:"POST", body:{ data: pf } });
        const gid = proj.data.gid;
        const made=[];
        for(const s of (sections||[])){
          const sec = await asanaFetch(req,res,`/projects/${gid}/sections`, { method:"POST", body:{ data:{ name: s.sectionName } } });
          made.push(sec.data);
        }
        out = { data: { gid, name: proj.data.name, sections_created:{ succeeded: made } } };
        break;
      }

      case "get_task": {
        const p = await sharedFetch(req,res,`/tasks/${args.task_id}?${qs({opt_fields:args.opt_fields||"name,notes"})}`);
        // Asana comments are "stories" of type 'comment'
        const st = await sharedFetch(req,res,`/tasks/${args.task_id}/stories?${qs({opt_fields:"text,type,created_at,created_by.name"})}`);
        p.data.comments = (st.data||[]).filter(s=>s.type==="comment").map(s=>({ text:s.text, created_at:s.created_at, created_by:s.created_by }));
        out = p; break;
      }

      // Asana does not expose its Inbox through the public API. Reconstruct
      // mentions from several reliable task-discovery paths instead of assuming
      // every mention lives on one of the user's 60 most recent top-level tasks.
      case "get_mentions": {
        const days=Math.max(7,Math.min(Number(args.days)||180,365));
        const taskLimit=Math.max(20,Math.min(Number(args.task_limit)||100,100));
        const mentionLimit=Math.max(10,Math.min(Number(args.mention_limit)||100,100));
        const afterIso=new Date(Date.now()-days*86400000).toISOString();
        const me=await asanaFetch(req,res,`/users/me?${qs({opt_fields:"name,email"})}`);
        const diagnostics={followedTop:0,followedSubtasks:0,projectTasks:0,discoveredSubtasks:0,storyTasks:0,comments:0,storyErrors:0,sharedFallbacks:0,pages:0};
        const warnings=[];
        const candidates=[];
        const userFetcher=path=>asanaFetch(req,res,path);

        // Explicitly run top-level and subtask searches. Asana exposes
        // is_subtask as a distinct search filter; relying on the default was
        // the main reason genuine subtask mentions could disappear.
        try{
          const top=await mentionTaskSearch(userFetcher,{"followers.any":"me","modified_at.after":afterIso,is_subtask:false},taskLimit);
          diagnostics.followedTop=top.length; candidates.push(...top);
          const subs=await mentionTaskSearch(userFetcher,{"followers.any":"me","modified_at.after":afterIso,is_subtask:true},taskLimit);
          diagnostics.followedSubtasks=subs.length; candidates.push(...subs);
        }catch(e){
          if(e.status===402) warnings.push("Asana task search is unavailable for this account; using the Academy-board scan instead.");
          else warnings.push("The personal collaborator-task scan failed: "+e.message);
        }

        // Scan the actual Academy projects loaded by the app as a second path.
        // This catches comments where an @mention produced a notification but
        // the task was not returned by followers.any=me.
        const projectIds=[...new Set((args.project_ids||[]).map(String).filter(id=>/^\d+$/.test(id)))].slice(0,80);
        if(projectIds.length){
          for(let i=0;i<projectIds.length;i+=20){
            const ids=projectIds.slice(i,i+20).join(",");
            for(const isSubtask of [false,true]){
              try{
                const rows=await mentionTaskSearch(path=>serviceFetch(req,res,path),{"projects.any":ids,"modified_at.after":afterIso,is_subtask:isSubtask},taskLimit);
                diagnostics.projectTasks+=rows.length; candidates.push(...rows);
              }catch(e){
                if(!warnings.some(w=>w.startsWith("The Academy-project scan"))) warnings.push("The Academy-project scan could not read every board: "+e.message);
              }
            }
          }
        }

        // Tasks already loaded in the browser are useful parent seeds even if
        // Asana search has not indexed a recent change yet.
        for(const task of (args.tasks||[]).slice(0,180)){
          const item=compactTask({
            gid:task.gid,name:task.name,permalink_url:task.permalink_url||task.url,modified_at:task.modified_at,
            memberships:task.projectGid?[{project:{gid:task.projectGid,name:task.projectName||""}}]:[],parent:task.parent||null
          });
          if(item)candidates.push(item);
        }

        // Discover ordinary subtasks from recent parent tasks. Subtasks do not
        // always inherit project membership, so a projects.any search alone is
        // not enough. Keep this bounded for serverless reliability.
        const firstPass=dedupeTasks(candidates).sort((a,b)=>new Date(b.modified_at||0)-new Date(a.modified_at||0));
        const parentSeeds=firstPass.filter(task=>!task.parent).slice(0,80);
        if(parentSeeds.length){
          const found=await batchSubtasks(req,res,parentSeeds);
          diagnostics.discoveredSubtasks=found.length; candidates.push(...found);
        }

        const tasks=dedupeTasks(candidates)
          .sort((a,b)=>new Date(b.modified_at||0)-new Date(a.modified_at||0))
          .slice(0,Math.max(taskLimit*2,120));
        const fields="gid,type,resource_subtype,created_at,created_by.gid,created_by.name,text,html_text";
        const all=[];
        const storyResults=await mapWithConcurrency(tasks,6,task=>storyPages(req,res,task,fields));
        storyResults.forEach((result,index)=>{
          if(!result)return;
          diagnostics.storyTasks++; diagnostics.pages+=result.pages||0;
          if(result.usedShared)diagnostics.sharedFallbacks++;
          if(result.error){ diagnostics.storyErrors++; return; }
          diagnostics.comments+=(result.stories||[]).filter(story=>story&&((story.type==="comment")||(story.resource_subtype==="comment_added"))).length;
          all.push(...mentionsFromTaskStories(tasks[index],result.stories||[],me.data.gid,afterIso));
        });
        if(diagnostics.storyErrors){
          warnings.push(`Could not read comments on ${diagnostics.storyErrors} task${diagnostics.storyErrors===1?"":"s"}. This is usually an Asana permission or Stories-scope issue.`);
        }
        all.sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
        out={
          data:all.slice(0,mentionLimit),scanned_tasks:tasks.length,scanned_subtasks:tasks.filter(t=>t.parent).length,
          scanned_comments:diagnostics.comments,window_days:days,generated_at:new Date().toISOString(),
          warning:warnings.length?warnings.join(" "):null,diagnostics
        };
        break;
      }

      // ---- campaigns portfolio ----
      case "get_portfolio_items":
        out = await sharedFetch(req,res,`/portfolios/${args.portfolio_gid}/items?${qs({opt_fields:args.opt_fields||"name,start_on,due_on,color,notes,permalink_url",limit:args.limit||100})}`);
        break;

      case "add_to_portfolio":
        out = await serviceFetch(req,res,`/portfolios/${args.portfolio_gid}/addItem`, { method:"POST", body:{ data:{ item: args.item } } });
        break;

      case "update_project":
        out = await serviceFetch(req,res,`/projects/${args.project_id}`, { method:"PUT", body:{ data: args.fields||{} } });
        break;

      case "create_subtask":
        out = await asanaFetch(req,res,`/tasks/${args.parent}/subtasks`, { method:"POST", body:{ data: args.data||{} } });
        break;

      case "set_task_parent":
        if(!args.task_id){ res.status(400).json({error:"task_id required"}); return; }
        out = await serviceFetch(req,res,`/tasks/${args.task_id}/setParent`, { method:"POST", body:{ data:{ parent:args.parent_id||null } } });
        break;

      case "get_subtasks":
        out = await sharedFetch(req,res,`/tasks/${args.parent}/subtasks?${qs({opt_fields:"name,completed,due_on,assignee.name"})}`);
        break;

      case "create_section":
        out = await serviceFetch(req,res,`/projects/${args.project_id}/sections`, { method:"POST", body:{ data:{ name: args.name } } });
        break;

      case "add_comment": {
        const data = args.html
          ? { html_text: "<body>" + args.text + "</body>" }
          : { text: args.text };
        out = await asanaFetch(req,res,`/tasks/${args.task_id}/stories`, { method:"POST", body:{ data } });
        break;
      }

      // Each person's real Asana "My Tasks", read with their own PAT
      // (AMY_PAT / CAITLIN_PAT / JESS_PAT env vars — never in the code).
      case "get_my_tasks": {
        const pats = { amy: process.env.AMY_PAT, caitlin: process.env.CAITLIN_PAT, jess: process.env.JESS_PAT };
        const pat = pats[args.person];
        if(!pat){ out = { data: [], no_pat: true }; break; }
        const patFetch = async (path) => {
          const r = await fetch(`https://app.asana.com/api/1.0${path}`, { headers: { Authorization: `Bearer ${pat}` } });
          const j = await r.json();
          if(!r.ok) throw Object.assign(new Error((j.errors&&j.errors[0]&&j.errors[0].message)||"Asana error"), { status: r.status });
          return j;
        };
        const utl = await patFetch(`/users/me/user_task_list?workspace=${WORKSPACE}`);
        const listGid = utl.data && utl.data.gid;
        if(!listGid){ out = { data: [] }; break; }
        const fields = "name,due_on,completed,completed_at,notes,permalink_url,projects.gid,projects.name";
        const q = args.completed_since
          ? `?completed_since=${encodeURIComponent(args.completed_since)}&limit=100&opt_fields=${fields}`
          : `?completed_since=now&limit=100&opt_fields=${fields}`;
        let tasks = [], offset = null, pages = 0;
        do {
          const page = await patFetch(`/user_task_lists/${listGid}/tasks${q}${offset?`&offset=${offset}`:""}`);
          tasks = tasks.concat(page.data || []);
          offset = page.next_page ? page.next_page.offset : null;
        } while(offset && ++pages < 5);
        out = { data: tasks };
        break;
      }

      // ---- attachments / campaign resources ----
      // A parent can be a task or a project. Project attachments appear in
      // Asana's Key resources area; task attachments continue to power the
      // Communities WhatsApp preview.
      case "get_attachments": {
        const parent=args.parent_id||args.task_id;
        if(!parent){ res.status(400).json({error:"parent_id required"}); return; }
        out = await sharedFetch(req,res,`/attachments?${qs({
          parent,
          opt_fields:"name,download_url,view_url,permanent_url,resource_subtype,host,created_at",
          limit:100
        })}`);
        break;
      }

      // The browser sends files base64-encoded because this proxy otherwise
      // speaks JSON. Keep a strict server-side size guard for Vercel.
      case "upload_attachment": {
        if(!readSession(req)){ res.status(401).json({error:"not authenticated"}); return; }
        const parent=args.parent_id||args.task_id;
        if(!parent || !args.data_base64){ res.status(400).json({error:"parent_id and data_base64 required"}); return; }
        const mime=String(args.mime||"application/octet-stream").toLowerCase();
        if(/application\/(x-msdownload|x-dosexec)|application\/x-sh|application\/x-bat|application\/java-archive/.test(mime)){
          res.status(400).json({error:"This file type is not allowed"}); return;
        }
        let buf;
        try{ buf = Buffer.from(String(args.data_base64), "base64"); }
        catch{ res.status(400).json({error:"Invalid file data"}); return; }
        if(!buf.length || buf.length>8*1024*1024){ res.status(413).json({error:"Files must be smaller than 8 MB"}); return; }
        const token = SHARED_PAT || await getAsanaAccessToken(req,res);
        const safeName=String(args.filename||"campaign-resource")
          .replace(/[^\x20-\x7E]/g,"_").replace(/[\\/]/g,"-").slice(0,180);
        const form = new FormData();
        form.append("parent", String(parent));
        form.append("file", new Blob([buf], { type: mime }), safeName||"campaign-resource");
        const r = await fetch("https://app.asana.com/api/1.0/attachments", {
          method:"POST", headers:{ Authorization:"Bearer "+token, Accept:"application/json" }, body: form
        });
        const text = await r.text(); let json; try{ json = text?JSON.parse(text):{}; }catch{ json = { raw:text }; }
        if(!r.ok){ res.status(r.status).json({ error:(json.errors&&json.errors[0]&&json.errors[0].message)||("Asana "+r.status) }); return; }
        out = json;
        break;
      }

      case "delete_attachment":
        if(!args.attachment_id){ res.status(400).json({error:"attachment_id required"}); return; }
        await serviceFetch(req,res,`/attachments/${args.attachment_id}`, { method:"DELETE" });
        out = { data:{} }; break;

      default:
        res.status(400).json({ error:"unknown tool: "+tool }); return;
    }
    res.status(200).json(out);
  } catch(e){
    res.status(e.status||500).json({ error: e.message });
  }
}
