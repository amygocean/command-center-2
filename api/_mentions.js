// Pure helpers for reconstructing real Asana @mentions from task stories.
// Asana's public API does not expose the user's Inbox directly, so the app
// searches accessible tasks and inspects rich-text comment links.

function escapeRegExp(value){
  return String(value||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

export function htmlMentionsUser(html,userGid){
  if(!html||!userGid) return false;
  const gid=escapeRegExp(userGid);
  const anchors=String(html).match(/<a\b[^>]*>/gi)||[];
  const gidRe=new RegExp(`data-asana-gid=["']${gid}["']`,`i`);
  // Asana currently returns data-asana-type="user" for user mentions, but
  // GIDs are globally unique. Matching the user's exact GID is a safe fallback
  // for older comments or workspaces where the type attribute is omitted.
  return anchors.some(tag=>gidRe.test(tag));
}

function decodeEntities(value){
  return String(value||"")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'");
}

export function plainTextFromAsanaHtml(html,fallback=""){
  const source=String(html||"")
    .replace(/<br\s*\/?\s*>/gi,"\n")
    .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi,"\n")
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi,"$1")
    .replace(/<[^>]+>/g,"");
  return decodeEntities(source||fallback).replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}

export function mentionsFromTaskStories(task,stories,userGid,afterIso){
  const after=afterIso?new Date(afterIso).getTime():0;
  const membership=(task.memberships||[]).find(m=>m&&m.project)||null;
  return (stories||[]).filter(story=>{
    const isComment=story&&((story.type==="comment")||(story.resource_subtype==="comment_added"));
    const recent=!after||new Date(story&&story.created_at||0).getTime()>=after;
    return isComment&&recent&&htmlMentionsUser(story.html_text,userGid);
  }).map(story=>({
    gid:String(story.gid),storyGid:String(story.gid),source:"asana",
    taskGid:String(task.gid),taskName:task.name||"Untitled task",
    taskUrl:task.permalink_url||null,
    isSubtask:!!task.parent,
    parentGid:task.parent&&String(task.parent.gid)||null,
    parentName:task.parent&&task.parent.name||null,
    projectGid:membership&&membership.project&&String(membership.project.gid)||null,
    projectName:membership&&membership.project&&membership.project.name||task.projectName||null,
    fromGid:story.created_by&&String(story.created_by.gid)||null,
    from:story.created_by&&story.created_by.name||"Someone",
    text:plainTextFromAsanaHtml(story.html_text,story.text||""),
    at:story.created_at
  }));
}

export function dedupeTasks(tasks){
  const map=new Map();
  for(const task of tasks||[]){
    if(!task||!task.gid) continue;
    const gid=String(task.gid);
    const prior=map.get(gid)||{};
    map.set(gid,{...prior,...task,
      memberships:(task.memberships&&task.memberships.length)?task.memberships:(prior.memberships||[]),
      parent:task.parent||prior.parent||null
    });
  }
  return [...map.values()];
}
