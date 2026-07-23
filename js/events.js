/* ================================================================
   EVENTS — Masterclasses & Webinars.
   Each event is a real Asana task (name + date) in Content & Comms.
   Its logistics (type, format, sessions, roles, contacts, goal,
   campaign link) live as JSON in one managed task, ⚙️ events-data,
   shared through the service identity like the dashboard state and
   campaign smart plans.  The checklist is real Asana subtasks so it
   can be assigned and shows up on the boards.
   ================================================================ */

const EVENTS_DATA_NAME = "⚙️ events-data (managed by app)";
const EVENT_ROLES = ["FOH", "BOH", "Sushi", "Mgmt", "Bar/Deli"];
const EVENT_KINDS = [
  { key: "masterclass", label: "Masterclass" },
  { key: "webinar", label: "Webinar" }
];
const EVENT_FORMATS = [
  { key: "in_person", label: "In person", hint: "A venue, kit and often food" },
  { key: "online", label: "Online (Teams)", hint: "Hosted on Teams ourselves" },
  { key: "live_shot", label: "Live-shot", hint: "A crew films/streams it live" }
];
const EVENT_HOSTS = [
  { key: "teams", label: "We host on Teams" },
  { key: "crew", label: "Bring in a crew to shoot live" },
  { key: "other", label: "Other" }
];

function defaultEventLogistics(){
  return {
    kind: "masterclass", format: "in_person", host: null,
    sessions: [], food: false, roles: [], goal: "",
    campaignGid: null, contacts: [], smart: null
  };
}

/* ---- load & save the managed events-data task ---- */
function readEventsData(){
  const task = state.tasks.find(t => t.isEventsData);
  state.eventsDataTask = task ? task.gid : state.eventsDataTask;
  let parsed = {};
  if(task){ try{ parsed = JSON.parse(task.notes || "{}") || {}; }catch(_){ parsed = {}; } }
  const map = (parsed && typeof parsed === "object" && parsed.events && typeof parsed.events === "object") ? parsed.events : {};
  const clean = {};
  Object.keys(map).forEach(gid => {
    const l = map[gid] && typeof map[gid] === "object" ? map[gid] : {};
    clean[String(gid)] = { ...defaultEventLogistics(), ...l,
      sessions: Array.isArray(l.sessions) ? l.sessions : [],
      roles: Array.isArray(l.roles) ? l.roles : [],
      contacts: Array.isArray(l.contacts) ? l.contacts : [] };
  });
  state.eventsData = clean;
  // Any task we hold logistics for is an event, even if its name doesn't match
  // the legacy masterclass/webinar wording — so it stars on the calendar too.
  state.tasks.forEach(t => { if(clean[String(t.gid)]) t.isEvent = true; });
}

let eventsSaveTimer = null, eventsSaving = false, eventsDirty = false;
function saveEventsData(){
  eventsDirty = true;
  clearTimeout(eventsSaveTimer);
  eventsSaveTimer = setTimeout(flushEventsData, 200);
}
async function flushEventsData(){
  if(DEMO || eventsSaving || !eventsDirty) return;
  eventsSaving = true; eventsDirty = false;
  try{
    const notes = JSON.stringify({ version: 1, events: state.eventsData });
    const r = await call("save_campaign_state", {
      task_id: state.eventsDataTask || undefined,
      project_id: CC_PROJECT, section_id: SEC_PLAN,
      name: EVENTS_DATA_NAME, notes
    });
    if(r && r.data && r.data.gid) state.eventsDataTask = r.data.gid;
  }catch(e){
    eventsDirty = true;
    toast("Saved here; event details will sync to Asana shortly");
    setTimeout(flushEventsData, 4000);
  }finally{
    eventsSaving = false;
    if(eventsDirty){ clearTimeout(eventsSaveTimer); eventsSaveTimer = setTimeout(flushEventsData, 400); }
  }
}

/* ---- helpers ---- */
function eventLogistics(gid){
  const g = String(gid);
  if(!state.eventsData[g]) state.eventsData[g] = defaultEventLogistics();
  return state.eventsData[g];
}
function eventTasks(){
  return state.tasks
    .filter(t => t && !t.isComms && !t.isKeeper && (t.isEvent || state.eventsData[String(t.gid)]))
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
}
function eventKindLabel(l){ return (EVENT_KINDS.find(k => k.key === l.kind) || EVENT_KINDS[0]).label; }
function eventFormatLabel(l){ return (EVENT_FORMATS.find(f => f.key === l.format) || EVENT_FORMATS[0]).label; }
function eventRolesLabel(l){
  if(!l.roles || !l.roles.length || l.roles.length === EVENT_ROLES.length) return "All roles";
  return l.roles.join(" · ");
}
function eventCampaign(l){
  if(!l.campaignGid) return null;
  return (state.campaignPortfolio || []).find(c => String(c.gid) === String(l.campaignGid))
      || (cfg.campaigns || []).find(c => String(c.gid) === String(l.campaignGid)) || null;
}
function eventCampaignOptions(){
  const seen = new Map();
  [...(state.campaignPortfolio || []), ...(cfg.campaigns || [])].forEach(c => {
    if(c && c.gid && !seen.has(String(c.gid))) seen.set(String(c.gid), c);
  });
  return [...seen.values()];
}
function uid(prefix){ return prefix + Math.random().toString(36).slice(2, 9); }

/* ---- list + detail render ---- */
function renderEventsTab(){
  const listBox = document.getElementById("evList");
  if(!listBox) return;
  const events = eventTasks();
  if(state.eventSelected && !events.some(e => String(e.gid) === String(state.eventSelected))) state.eventSelected = null;
  if(!state.eventSelected && events.length) state.eventSelected = events[0].gid;
  // Lazily load the selected event's checklist (real subtasks) once.
  if(state.eventSelected && state.eventSubtasks[state.eventSelected] === undefined) loadEventSubtasks(state.eventSelected);

  if(!events.length){
    listBox.innerHTML = '<div class="empty">No masterclasses or webinars yet. Hit <b>+ New event</b> to plan one.</div>';
  }else{
    const today = todayD();
    listBox.innerHTML = events.map(ev => {
      const l = eventLogistics(ev.gid);
      const sel = String(ev.gid) === String(state.eventSelected);
      const past = ev.due && pd(ev.due) < today;
      const when = ev.due ? pd(ev.due).toDateString().slice(4, 10) : "No date";
      return '<button class="ev-item' + (sel ? ' on' : '') + (past ? ' past' : '') + '" data-ev="' + esc(String(ev.gid)) + '">' +
        '<span class="ev-item-kind ' + l.kind + '">' + esc(eventKindLabel(l)) + '</span>' +
        '<span class="ev-item-name">' + esc(ev.name || "Untitled event") + '</span>' +
        '<span class="ev-item-meta">' + esc(when + ' · ' + eventFormatLabel(l)) + '</span>' +
        '</button>';
    }).join("");
    listBox.querySelectorAll("[data-ev]").forEach(b => b.onclick = () => selectEvent(b.dataset.ev));
  }
  renderEventDetail();

  const nb = document.getElementById("evNew");
  if(nb && !nb.dataset.wired){ nb.dataset.wired = "1"; nb.onclick = newEvent; }
}

function selectEvent(gid){
  state.eventSelected = String(gid);
  loadEventSubtasks(gid);
  renderEventsTab();
}

function renderEventDetail(){
  const box = document.getElementById("evDetail");
  if(!box) return;
  const ev = eventTasks().find(e => String(e.gid) === String(state.eventSelected));
  if(!ev){ box.innerHTML = '<div class="ev-detail-empty">Select or create an event to plan it.</div>'; return; }
  const l = eventLogistics(ev.gid);
  const camp = eventCampaign(l);
  const running = !!state.eventSmartRunning[ev.gid];
  const subs = state.eventSubtasks[ev.gid];

  const sessionsHtml = (l.sessions.length ? l.sessions.map((s, i) =>
    '<div class="ev-session" data-sid="' + esc(s.id) + '">' +
      '<span class="ev-session-n">' + (i + 1) + '</span>' +
      '<input type="date" data-sfield="date" data-sid="' + esc(s.id) + '" value="' + esc(s.date || "") + '">' +
      '<input type="time" data-sfield="time" data-sid="' + esc(s.id) + '" value="' + esc(s.time || "") + '">' +
      '<input placeholder="' + (l.format === "online" ? "Link / channel" : "Location") + '" data-sfield="location" data-sid="' + esc(s.id) + '" value="' + esc(s.location || "") + '">' +
      '<button class="ev-x" data-session-remove="' + esc(s.id) + '" title="Remove session">✕</button>' +
    '</div>').join("") : '<p class="hint" style="margin:2px 0">No sessions yet. Add one below.</p>');

  const contactsHtml = (l.contacts.length ? l.contacts.map(c =>
    '<div class="ev-contact" data-cid="' + esc(c.id) + '">' +
      '<input placeholder="Name" data-cfield="name" data-cid="' + esc(c.id) + '" value="' + esc(c.name || "") + '">' +
      '<input placeholder="Role / org" data-cfield="role" data-cid="' + esc(c.id) + '" value="' + esc(c.role || "") + '">' +
      '<input placeholder="Phone / email" data-cfield="detail" data-cid="' + esc(c.id) + '" value="' + esc(c.detail || "") + '">' +
      '<button class="ev-x" data-contact-remove="' + esc(c.id) + '" title="Remove contact">✕</button>' +
    '</div>').join("") : '<p class="hint" style="margin:2px 0">No contacts yet.</p>');

  let checklistHtml;
  if(subs === "loading") checklistHtml = '<div class="ev-checklist"><span class="spin"></span></div>';
  else{
    const arr = Array.isArray(subs) ? subs : [];
    checklistHtml = '<div class="ev-checklist">' + (arr.length ? arr.map(s =>
      '<div class="ev-check' + (s.completed ? ' done' : '') + '">' +
        '<button class="ev-check-box" data-check-toggle="' + esc(String(s.gid)) + '">' + (s.completed ? '✓' : '') + '</button>' +
        '<span>' + esc(s.name) + '</span>' +
        (s.assignee ? '<small>' + esc(firstName(s.assignee.name)) + '</small>' : '') +
      '</div>').join("") : '<p class="hint" style="margin:2px 0">No checklist items yet. Add the real to-dos below — each becomes an Asana subtask.</p>') +
      '<div class="ev-check-add"><input id="evCheckInput" placeholder="Add a checklist item…"><button class="btn ghost sm" id="evCheckAdd">Add</button></div>' +
    '</div>';
  }

  const smart = l.smart;
  const smartHtml =
    '<div class="ev-smart-head"><div><b>Smart plan</b>' + (camp ? ' <span class="ev-linked">linked to ' + esc(camp.name) + '</span>' : '') + '</div>' +
      '<button class="btn teal sm" id="evSmartBtn"' + (running ? ' disabled' : '') + '>' + (running ? '<span class="spin"></span> thinking…' : '✨ ' + (smart ? 'Rebuild' : 'Plan this event')) + '</button></div>' +
    (smart ?
      '<div class="ev-smart-body">' +
        (smart.summary ? '<p class="ev-smart-summary">' + esc(smart.summary) + '</p>' : '') +
        (smart.runOfShow && smart.runOfShow.length ? '<div class="ev-smart-block"><h4>Suggested run of show</h4><ul>' + smart.runOfShow.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></div>' : '') +
        (smart.checklist && smart.checklist.length ? '<div class="ev-smart-block"><h4>Suggested checklist</h4>' + smart.checklist.map((x, i) =>
          '<div class="ev-smart-sug"><span>' + esc(x) + '</span><button class="btn ghost sm" data-smart-add="' + i + '">+ Add</button></div>').join("") +
          '<button class="btn ghost sm" id="evSmartAddAll" style="margin-top:6px">Add all to checklist</button></div>' : '') +
        (smart.ideas && smart.ideas.length ? '<div class="ev-smart-block"><h4>Content & promo ideas</h4><ul>' + smart.ideas.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></div>' : '') +
        (smart.builtAt ? '<small class="ev-smart-when">Built ' + esc(new Date(smart.builtAt).toLocaleString("en-ZA")) + '</small>' : '') +
      '</div>'
      : '<p class="hint" style="margin:6px 0 0">Get AI suggestions for sessions, a logistics checklist and promo — tailored to the format' + (camp ? ' and the linked campaign' : '') + '.</p>');

  box.innerHTML =
    '<div class="ev-detail-head">' +
      '<input class="ev-title" id="evName" value="' + esc(ev.name || "") + '" placeholder="Event name">' +
      '<div class="ev-head-actions">' +
        (ev.url ? '<a class="btn ghost sm" href="' + esc(ev.url) + '" target="_blank" rel="noopener">Open in Asana ↗</a>' : '') +
        '<button class="btn ghost sm" id="evPromo">Queue promo</button>' +
        '<button class="btn ghost sm danger" id="evDelete">Delete</button>' +
      '</div>' +
    '</div>' +

    '<div class="ev-grid">' +
      '<section class="ev-card">' +
        '<h3>Overview</h3>' +
        '<div class="ev-row2">' +
          '<label><span>Type</span><select id="evKind">' + EVENT_KINDS.map(k => '<option value="' + k.key + '"' + (k.key === l.kind ? ' selected' : '') + '>' + k.label + '</option>').join("") + '</select></label>' +
          '<label><span>Date</span><input type="date" id="evDate" value="' + esc(ev.due || "") + '"></label>' +
        '</div>' +
        '<label class="ev-full"><span>Format</span><div class="ev-seg" id="evFormat">' + EVENT_FORMATS.map(f =>
          '<button type="button" class="' + (f.key === l.format ? 'on' : '') + '" data-format="' + f.key + '" title="' + esc(f.hint) + '">' + esc(f.label) + '</button>').join("") + '</div></label>' +
        (l.format !== "in_person" ?
          '<label class="ev-full"><span>Webinar hosting</span><div class="ev-seg" id="evHost">' + EVENT_HOSTS.map(h =>
            '<button type="button" class="' + (h.key === l.host ? 'on' : '') + '" data-host="' + h.key + '">' + esc(h.label) + '</button>').join("") + '</div></label>' : '') +
        '<label class="ev-check-inline"><input type="checkbox" id="evFood"' + (l.food ? ' checked' : '') + '> Food / catering provided</label>' +
      '</section>' +

      '<section class="ev-card">' +
        '<h3>Who it\'s for</h3>' +
        '<div class="ev-roles" id="evRoles">' +
          '<button type="button" class="ev-role' + (!l.roles.length || l.roles.length === EVENT_ROLES.length ? ' on' : '') + '" data-role="__all">All roles</button>' +
          EVENT_ROLES.map(r => '<button type="button" class="ev-role' + (l.roles.includes(r) && l.roles.length !== EVENT_ROLES.length ? ' on' : '') + '" data-role="' + esc(r) + '">' + esc(r) + '</button>').join("") +
        '</div>' +
        '<label class="ev-full"><span>Goal</span><textarea id="evGoal" placeholder="What do we want this to achieve?">' + esc(l.goal || "") + '</textarea></label>' +
        '<label class="ev-full"><span>Linked campaign</span><select id="evCampaign"><option value="">Not linked</option>' +
          eventCampaignOptions().map(c => '<option value="' + esc(String(c.gid)) + '"' + (String(c.gid) === String(l.campaignGid) ? ' selected' : '') + '>' + esc(c.name) + '</option>').join("") + '</select></label>' +
      '</section>' +

      '<section class="ev-card">' +
        '<h3>Sessions & locations <span class="ev-count">' + l.sessions.length + '</span></h3>' +
        '<div class="ev-sessions">' + sessionsHtml + '</div>' +
        '<button class="btn ghost sm" id="evSessionAdd">+ Add session</button>' +
      '</section>' +

      '<section class="ev-card">' +
        '<h3>Checklist</h3>' + checklistHtml +
      '</section>' +

      '<section class="ev-card">' +
        '<h3>Contacts</h3>' +
        '<div class="ev-contacts">' + contactsHtml + '</div>' +
        '<button class="btn ghost sm" id="evContactAdd">+ Add contact</button>' +
      '</section>' +

      '<section class="ev-card ev-smart">' + smartHtml + '</section>' +
    '</div>';

  wireEventDetail(ev, l);
}

/* ---- wiring ---- */
function wireEventDetail(ev, l){
  const gid = ev.gid;
  const patch = (fn) => { fn(); saveEventsData(); renderEventsTab(); };

  const nameEl = document.getElementById("evName");
  if(nameEl) nameEl.onchange = () => renameEvent(gid, nameEl.value.trim());
  const dateEl = document.getElementById("evDate");
  if(dateEl) dateEl.onchange = () => setEventDate(gid, dateEl.value || null);

  const kind = document.getElementById("evKind");
  if(kind) kind.onchange = () => patch(() => { eventLogistics(gid).kind = kind.value; });

  document.querySelectorAll("#evFormat [data-format]").forEach(b => b.onclick = () =>
    patch(() => { eventLogistics(gid).format = b.dataset.format; }));
  document.querySelectorAll("#evHost [data-host]").forEach(b => b.onclick = () =>
    patch(() => { const lo = eventLogistics(gid); lo.host = lo.host === b.dataset.host ? null : b.dataset.host; }));

  const food = document.getElementById("evFood");
  if(food) food.onchange = () => patch(() => { eventLogistics(gid).food = food.checked; });

  document.querySelectorAll("#evRoles [data-role]").forEach(b => b.onclick = () => patch(() => {
    const lo = eventLogistics(gid), role = b.dataset.role;
    if(role === "__all"){ lo.roles = []; return; }
    const set = new Set(lo.roles);
    set.has(role) ? set.delete(role) : set.add(role);
    lo.roles = EVENT_ROLES.filter(r => set.has(r));
  }));

  const goal = document.getElementById("evGoal");
  if(goal) goal.onchange = () => { eventLogistics(gid).goal = goal.value; saveEventsData(); };

  const campaign = document.getElementById("evCampaign");
  if(campaign) campaign.onchange = () => { eventLogistics(gid).campaignGid = campaign.value || null; saveEventsData(); renderEventsTab(); };

  // sessions
  const sAdd = document.getElementById("evSessionAdd");
  if(sAdd) sAdd.onclick = () => patch(() => {
    eventLogistics(gid).sessions.push({ id: uid("s"), date: ev.due || "", time: "", location: "" });
  });
  document.querySelectorAll("[data-session-remove]").forEach(b => b.onclick = () => patch(() => {
    const lo = eventLogistics(gid); lo.sessions = lo.sessions.filter(s => s.id !== b.dataset.sessionRemove);
  }));
  document.querySelectorAll("[data-sfield]").forEach(inp => inp.onchange = () => {
    const lo = eventLogistics(gid), s = lo.sessions.find(x => x.id === inp.dataset.sid);
    if(s){ s[inp.dataset.sfield] = inp.value; saveEventsData(); }
  });

  // contacts
  const cAdd = document.getElementById("evContactAdd");
  if(cAdd) cAdd.onclick = () => patch(() => {
    eventLogistics(gid).contacts.push({ id: uid("c"), name: "", role: "", detail: "" });
  });
  document.querySelectorAll("[data-contact-remove]").forEach(b => b.onclick = () => patch(() => {
    const lo = eventLogistics(gid); lo.contacts = lo.contacts.filter(c => c.id !== b.dataset.contactRemove);
  }));
  document.querySelectorAll("[data-cfield]").forEach(inp => inp.onchange = () => {
    const lo = eventLogistics(gid), c = lo.contacts.find(x => x.id === inp.dataset.cid);
    if(c){ c[inp.dataset.cfield] = inp.value; saveEventsData(); }
  });

  // checklist (real subtasks)
  const chkAdd = document.getElementById("evCheckAdd"), chkInput = document.getElementById("evCheckInput");
  if(chkAdd && chkInput){
    const add = () => addEventChecklistItem(gid, chkInput.value.trim());
    chkAdd.onclick = add;
    chkInput.onkeydown = e => { if(e.key === "Enter"){ e.preventDefault(); add(); } };
  }
  document.querySelectorAll("[data-check-toggle]").forEach(b => b.onclick = () => toggleEventChecklistItem(gid, b.dataset.checkToggle));

  // head actions
  const del = document.getElementById("evDelete");
  if(del) del.onclick = () => deleteEvent(gid);
  const promo = document.getElementById("evPromo");
  if(promo) promo.onclick = () => { if(typeof queuePromoFor === "function") queuePromoFor(gid); };

  // smart plan
  const sb = document.getElementById("evSmartBtn");
  if(sb) sb.onclick = () => buildEventSmartPlan(gid);
  document.querySelectorAll("[data-smart-add]").forEach(b => b.onclick = () => {
    const item = l.smart && l.smart.checklist && l.smart.checklist[Number(b.dataset.smartAdd)];
    if(item) addEventChecklistItem(gid, item);
  });
  const addAll = document.getElementById("evSmartAddAll");
  if(addAll) addAll.onclick = () => addEventChecklistItems(gid, (l.smart && l.smart.checklist) || []);
}

/* ---- create / rename / delete ---- */
async function newEvent(){
  const name = "New masterclass";
  if(DEMO){
    const gid = "ev-" + Date.now();
    state.tasks.push({ gid, name, notes: "", due: null, completed: false, url: null,
      projectGid: CC_PROJECT, projectName: "Content & Comms", projectColor: "#0A3D62", assignee: null, isEvent: true });
    state.eventsData[gid] = defaultEventLogistics();
    state.eventSelected = gid; state.eventSubtasks[gid] = [];
    renderEventsTab(); toast("Event created — fill in the details"); return;
  }
  try{
    const r = await call("create_tasks", { tasks: [{ name, project_id: CC_PROJECT, section_id: SEC_PLAN }] });
    const t = (r.data || [])[0];
    if(!t || !t.gid) throw new Error("Asana did not return the new task");
    state.tasks.push({ gid: String(t.gid), name: t.name || name, notes: "", due: null, completed: false,
      url: t.permalink_url || null, projectGid: CC_PROJECT, projectName: "Content & Comms", projectColor: "#0A3D62",
      assignee: null, isEvent: true });
    state.eventsData[String(t.gid)] = defaultEventLogistics();
    state.eventSelected = String(t.gid); state.eventSubtasks[String(t.gid)] = [];
    saveEventsData();
    renderEventsTab(); renderCalendar();
    toast("Event created — fill in the details");
    const nameEl = document.getElementById("evName"); if(nameEl){ nameEl.focus(); nameEl.select(); }
  }catch(e){ toast("Couldn't create the event: " + e.message); }
}
async function renameEvent(gid, name){
  if(!name) return;
  const t = findTask(gid); if(t) t.name = name;
  renderEventsTab();
  if(DEMO) return;
  try{ await call("update_tasks", { tasks: [{ task: gid, name }] }); }
  catch(e){ toast("Rename didn't save: " + e.message); }
}
async function setEventDate(gid, due){
  const t = findTask(gid); if(t) t.due = due;
  renderEventsTab(); renderCalendar();
  if(DEMO) return;
  try{ await call("update_tasks", { tasks: [{ task: gid, due_on: due }] }); }
  catch(e){ toast("Date didn't save: " + e.message); }
}
async function deleteEvent(gid){
  if(!confirm("Delete this event? Its Asana task and subtasks will be removed.")) return;
  delete state.eventsData[String(gid)];
  state.tasks = state.tasks.filter(t => String(t.gid) !== String(gid));
  if(String(state.eventSelected) === String(gid)) state.eventSelected = null;
  saveEventsData(); renderEventsTab(); renderCalendar();
  if(DEMO) return;
  try{ await call("delete_task", { task: gid }); toast("Event deleted"); }
  catch(e){ toast("Removed here, but Asana delete failed: " + e.message); }
}

/* ---- checklist = real Asana subtasks ---- */
async function loadEventSubtasks(gid, force){
  if(!force && state.eventSubtasks[gid] !== undefined) return;
  state.eventSubtasks[gid] = "loading";
  renderEventDetail();
  try{
    const r = await call("get_subtasks", { parent: gid });
    state.eventSubtasks[gid] = r.data || [];
  }catch(_){ state.eventSubtasks[gid] = []; }
  renderEventDetail();
}
async function addEventChecklistItem(gid, name){
  if(!name) return;
  try{
    await call("create_subtask", { parent: gid, data: { name } });
    await loadEventSubtasks(gid, true);
    const input = document.getElementById("evCheckInput"); if(input){ input.value = ""; input.focus(); }
  }catch(e){ toast("Couldn't add: " + e.message); }
}
async function addEventChecklistItems(gid, items){
  const list = (items || []).filter(Boolean);
  if(!list.length) return;
  try{
    for(const name of list) await call("create_subtask", { parent: gid, data: { name } });
    await loadEventSubtasks(gid, true);
    toast(list.length + " added to the checklist");
  }catch(e){ toast("Couldn't add all: " + e.message); }
}
async function toggleEventChecklistItem(gid, subGid){
  const arr = state.eventSubtasks[gid]; if(!Array.isArray(arr)) return;
  const sub = arr.find(s => String(s.gid) === String(subGid)); if(!sub) return;
  const now = !sub.completed; sub.completed = now;
  renderEventDetail();
  try{ await call("update_tasks", { tasks: [{ task: subGid, completed: now }] }); }
  catch(e){ sub.completed = !now; renderEventDetail(); toast("Couldn't update: " + e.message); }
}

/* ---- AI smart plan ---- */
function jsonFromAI(text){
  if(!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if(start < 0 || end <= start) return null;
  try{ return JSON.parse(raw.slice(start, end + 1)); }catch(_){ return null; }
}
async function buildEventSmartPlan(gid){
  const ev = findTask(gid); if(!ev) return;
  const l = eventLogistics(gid);
  state.eventSmartRunning[gid] = true; renderEventDetail();
  const camp = eventCampaign(l);
  const prompt =
    "You are helping Ocean Basket's Academy team plan a staff " + eventKindLabel(l).toLowerCase() +
    " titled \"" + (ev.name || "Untitled") + "\".\n" +
    "Format: " + eventFormatLabel(l) + (l.host ? " (" + l.host + ")" : "") + ". " +
    "Audience roles: " + eventRolesLabel(l) + ". " +
    "Food provided: " + (l.food ? "yes" : "no") + ". " +
    "Sessions planned: " + l.sessions.length + ". " +
    (ev.due ? "Date: " + ev.due + ". " : "") +
    (l.goal ? "Goal: " + l.goal + ". " : "") +
    (camp ? "It supports the campaign \"" + camp.name + "\"" + (camp.notes ? " — " + camp.notes : "") + ". " : "") +
    "\nReturn ONLY JSON: {\"summary\": string, \"runOfShow\": [string], \"checklist\": [string], \"ideas\": [string]}. " +
    "checklist = concrete logistics/prep to-dos suited to the format (venue, kit, catering, comms, Teams setup or crew booking as relevant). " +
    "ideas = content and promo angles" + (camp ? " tied to the campaign" : "") + ".";
  try{
    const text = await askAI(prompt, { event: ev.name, format: l.format, roles: eventRolesLabel(l) });
    const parsed = jsonFromAI(text) || {};
    l.smart = {
      summary: String(parsed.summary || "").trim(),
      runOfShow: Array.isArray(parsed.runOfShow) ? parsed.runOfShow.map(String) : [],
      checklist: Array.isArray(parsed.checklist) ? parsed.checklist.map(String) : [],
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas.map(String) : [],
      builtAt: new Date().toISOString()
    };
    if(!l.smart.summary && !l.smart.checklist.length && !l.smart.ideas.length)
      l.smart.summary = String(text || "").slice(0, 400) || "The AI didn't return a structured plan — try again.";
    saveEventsData();
    toast("Smart plan ready");
  }catch(e){ toast("Smart plan failed: " + e.message); }
  finally{ state.eventSmartRunning[gid] = false; renderEventDetail(); }
}
