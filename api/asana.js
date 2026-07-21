// ------------------------------------------------------------------
//  /api/asana  —  the data proxy.
//  The frontend calls one endpoint with { tool, args }, exactly the
//  same verb names the original prototype used. This maps each verb to
//  the Asana REST API, either as the logged-in user or through the
//  authenticated shared-board identity described below.
//  Keeping this shape means the dashboard's own logic barely changed.
// ------------------------------------------------------------------
import { asanaFetch, getAsanaAccessToken, readSession, WORKSPACE } from "./_lib.js";

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

      // ---- campaigns portfolio ----
      case "get_portfolio_items":
        out = await sharedFetch(req,res,`/portfolios/${args.portfolio_gid}/items?${qs({opt_fields:args.opt_fields||"name,start_on,due_on,color,notes,permalink_url",limit:args.limit||100})}`);
        break;

      case "add_to_portfolio":
        out = await asanaFetch(req,res,`/portfolios/${args.portfolio_gid}/addItem`, { method:"POST", body:{ data:{ item: args.item } } });
        break;

      case "update_project":
        out = await asanaFetch(req,res,`/projects/${args.project_id}`, { method:"PUT", body:{ data: args.fields||{} } });
        break;

      case "create_subtask":
        out = await asanaFetch(req,res,`/tasks/${args.parent}/subtasks`, { method:"POST", body:{ data: args.data||{} } });
        break;

      case "get_subtasks":
        out = await sharedFetch(req,res,`/tasks/${args.parent}/subtasks?${qs({opt_fields:"name,completed,due_on,assignee.name"})}`);
        break;

      case "create_section":
        out = await asanaFetch(req,res,`/projects/${args.project_id}/sections`, { method:"POST", body:{ data:{ name: args.name } } });
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

      // ---- attachments (image push to Asana) ----
      // List a task's attachments so the WhatsApp preview can show the image.
      case "get_attachments":
        if(!args.task_id){ res.status(400).json({error:"task_id required"}); return; }
        out = await sharedFetch(req,res,`/attachments?${qs({
          parent:args.task_id,
          opt_fields:"name,download_url,view_url,permanent_url,resource_subtype,host,created_at",
          limit:100
        })}`);
        break;

      // Upload a real file to Asana. The tool proxy only speaks JSON, so the
      // browser sends the image base64-encoded; here we decode it and forward
      // it to Asana's /attachments endpoint as proper multipart form-data,
      // using the shared board identity so every teammate sees it.
      case "upload_attachment": {
        if(!readSession(req)){ res.status(401).json({error:"not authenticated"}); return; }
        if(!args.task_id || !args.data_base64){ res.status(400).json({error:"task_id and data_base64 required"}); return; }
        if(!/^image\/[a-z0-9.+-]+$/i.test(args.mime||"")){ res.status(400).json({error:"Only image uploads are supported"}); return; }
        let buf;
        try{ buf = Buffer.from(String(args.data_base64), "base64"); }
        catch{ res.status(400).json({error:"Invalid image data"}); return; }
        // The frontend downsizes images before sending them. Keep a server-side
        // guard too so a malformed request cannot exceed the serverless body
        // and memory budget.
        if(!buf.length || buf.length>3*1024*1024){ res.status(413).json({error:"Image is too large after processing"}); return; }
        const token = SHARED_PAT || await getAsanaAccessToken(req,res);
        const safeName=String(args.filename||"community-image.jpg")
          .replace(/[^\x20-\x7E]/g,"_").replace(/[\\/]/g,"-").slice(0,180);
        const form = new FormData();
        form.append("parent", String(args.task_id));
        form.append("file", new Blob([buf], { type: args.mime }), safeName||"community-image.jpg");
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
