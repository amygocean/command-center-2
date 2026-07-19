// ------------------------------------------------------------------
//  /api/asana  —  the data proxy.
//  The frontend calls one endpoint with { tool, args }, exactly the
//  same verb names the original prototype used. This maps each verb to
//  the Asana REST API, running as the logged-in user (see _lib.js).
//  Keeping this shape means the dashboard's own logic barely changed.
// ------------------------------------------------------------------
import { asanaFetch, WORKSPACE } from "./_lib.js";

async function readBody(req){
  if(req.body && typeof req.body === "object") return req.body;
  const chunks=[]; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString()||"{}"); } catch { return {}; }
}
const qs = o => Object.entries(o).filter(([,v])=>v!=null&&v!=="").map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join("&");

export default async function handler(req, res){
  if(req.method !== "POST"){ res.status(405).json({error:"POST only"}); return; }
  let tool, args;
  try { ({tool, args={}} = await readBody(req)); } catch { res.status(400).json({error:"bad body"}); return; }

  try {
    let out;
    switch(tool){

      case "get_users":
        out = await asanaFetch(req,res,`/users?${qs({workspace:WORKSPACE, opt_fields:"name,email", limit:args.limit||100})}`);
        break;

      case "get_tasks":
        out = await asanaFetch(req,res,`/tasks?${qs({project:args.project, opt_fields:args.opt_fields, limit:args.limit||100, offset:args.offset})}`);
        break;

      case "get_project": {
        const p = await asanaFetch(req,res,`/projects/${args.project_id}?${qs({opt_fields:args.opt_fields||"name"})}`);
        if(args.include_sections){
          const s = await asanaFetch(req,res,`/projects/${args.project_id}/sections?${qs({opt_fields:"name"})}`);
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
        const p = await asanaFetch(req,res,`/tasks/${args.task_id}?${qs({opt_fields:args.opt_fields||"name,notes"})}`);
        // Asana comments are "stories" of type 'comment'
        const st = await asanaFetch(req,res,`/tasks/${args.task_id}/stories?${qs({opt_fields:"text,type,created_at,created_by.name"})}`);
        p.data.comments = (st.data||[]).filter(s=>s.type==="comment").map(s=>({ text:s.text, created_at:s.created_at, created_by:s.created_by }));
        out = p; break;
      }

      // ---- campaigns portfolio ----
      case "get_portfolio_items":
        out = await asanaFetch(req,res,`/portfolios/${args.portfolio_gid}/items?${qs({opt_fields:args.opt_fields||"name,start_on,due_on,color,notes,permalink_url"})}`);
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
        out = await asanaFetch(req,res,`/tasks/${args.parent}/subtasks?${qs({opt_fields:"name,completed,due_on,assignee.name"})}`);
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
        const fields = "name,due_on,completed,completed_at,notes,permalink_url,projects.name";
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

      default:
        res.status(400).json({ error:"unknown tool: "+tool }); return;
    }
    res.status(200).json(out);
  } catch(e){
    res.status(e.status||500).json({ error: e.message });
  }
}
