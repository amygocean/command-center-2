/* ================================================================
   DATA — Asana IDs, defaults, occasions, brief template, curriculum
   ================================================================ */

// ---- Asana object ids -------------------------------------------------
const CC_PROJECT = "1213750988186400";        // Content & Comms
const SEC_SHOOT  = "1213750988168225";        // Shoot Days section
const SEC_OCC    = "1214151068659051";        // Occasion / Holiday section
const SEC_PLAN   = "1213751087660203";        // Planned / Scheduled section

// Personal workspace board (day-to-day tasks, notes, passion projects)
const PB = {
  proj:   "1216637913085208",
  day:    "1216637913202395",   // Day to Day  (real tasks -> lanes + calendar)
  notes:  "1216638289537804",   // Notes       (kept OFF the calendar)
  passion:"1216637913044078"    // Passion Projects (kept OFF the calendar)
};
const WA_PROJECT = "1216476678698201";   // WhatsApp Academy — the software/platform board (X Force)
const COMMUNITIES_PROJECT = "1216476690596926"; // existing shared Communities planning board
const COMMUNITIES_URL = "https://app.asana.com/1/14491666778313/project/1216476690596926/list/1216477106031170";
const PR_PROJECT_NAME = "PR & Positioning";
const BUGS_PROJECT = "1216593621076084";  // X Force bugs & errors board
const VISITS_PROJECT = "1213806179626680";// trainer store-visits board
const AMY_GID = "1213414176761459";
const GIRLS = [
  {key:"amy",     gid:"1213414176761459", name:"Amy"},
  {key:"caitlin", gid:"1213630129003527", name:"Caitlin"},
  {key:"jess",    gid:"1213630128899336", name:"Jess"}
];
const STICKY_COLORS = ["#FFF3B0","#FFD6E0","#D4F0DB","#D6E9FF","#EBDDFF"];
const LAYER = { opening:"#E8A013", visit:"#6C5CE7" };
const ACADEMY_TEAM = "1213626139926485"; // team new campaigns are created in
const CAMPAIGN_PORTFOLIO = "1216656052977768";
const CAMPAIGN_PORTFOLIO_URL = "https://app.asana.com/0/portfolio/1216656052977768/1216677685805996";
const RETIRED_CAMPAIGN_GIDS = ["1216638197844781"]; // hidden from this app; the Asana project itself is not deleted
const REVAMP_PROJECT = "1214196027560612"; // store-revamp placeholders
const CURRICULUM_PROJECT = "1216652752864537";
const CURRICULUM_URL = "https://app.asana.com/0/1216652752864537";

// ---- OB Fit marathon (fallback — live copy is read from the Asana
//      Curriculum board when tasks are named "January: …" etc.) --------
const CURRICULUM_DEFAULT = [
  {t:"Foundations & role standards", d:"Role purpose & service standards · correct setup · Welcome video + checklist", biz:"OB Rewards + Volume Drivers"},
  {t:"Menu & allergen mastery", d:"Order accuracy · flash cards + menu quiz"},
  {t:"Food safety", d:"Clean section management · voice note + photo", q:"Q1 Qualifier (OB Fit Score)"},
  {t:"Speed & product", d:"Speed without errors · screen recordings", biz:"Winter Menu + Volume Drivers"},
  {t:"Guest experience", d:"Guest engagement · scenario voice notes"},
  {t:"Upselling", d:"Suggestive selling · scripts + leaderboard", q:"Q2 Qualifier"},
  {t:"Handling volume", d:"Multi-table/station control · peak shift tips", biz:"Summer Menu + Volume Drivers"},
  {t:"Complaint recovery", d:"Conflict handling · roleplay prompts"},
  {t:"Teamwork", d:"Pressure service · timed challenges", q:"Q3 Qualifier — no surprises by now"},
  {t:"Peak standards", d:"Endurance on shift · daily reminders", biz:"Peak Season + Volume Drivers"},
  {t:"Focus & consistency", d:"Zero-error service · rapid quizzes"},
  {t:"THE DECEMBER MARATHON", d:"Peak playbook · live peak execution · final observation checklist", q:"Final Assessment — Peak Live"}
];

// ---- WhatsApp communities --------------------------------------------
// Messages live in the Academy WhatsApp board; each community is a section
// there (sections are created automatically the first time they're needed).
const COMMUNITIES_DEFAULT = [
  {key:"mgmt", name:"Management",     color:"#0A3D62"},
  {key:"foh1", name:"Front of House 1", color:"#00A8A8"},
  {key:"foh2", name:"Front of House 2", color:"#5BC4BF"},
  {key:"boh",  name:"Back of House",  color:"#E4784D"},
  {key:"sushi",name:"Sushi",          color:"#7A5FB0"}
];
const MSG_PURPOSES = [
  {key:"course",   label:"Course push"},
  {key:"reminder", label:"Reminder"},
  {key:"practice", label:"Practice prompt"},
  {key:"celebrate",label:"Celebration"},
  {key:"question", label:"Question / poll"},
  {key:"info",     label:"Info / update"}
];

// ---- Occasions layer ---------------------------------------------------
// Lives in the app (not Asana) exactly as requested — placeholders for
// things worth looking out for. ZA + CY + UK + the fun ones.
// flag: emoji marker · reg: region label
function _fixedOccasions(year){
  return [
    ["01-01","New Year's Day","🎆","ZA · CY · UK"],
    ["01-06","Epiphany","✨","CY"],
    ["02-14","Valentine's Day","💘","Global"],
    ["03-08","International Women's Day","💐","Global"],
    ["03-21","Human Rights Day","🇿🇦","ZA"],
    ["03-25","Greek Independence Day","🇬🇷","CY"],
    ["04-01","Cyprus National Day","🇨🇾","CY"],
    ["04-22","Earth Day","🌍","Global"],
    ["04-27","Freedom Day","🇿🇦","ZA"],
    ["05-01","Workers' Day","🛠","ZA · CY"],
    ["05-25","Africa Day","🌍","ZA"],
    ["06-08","World Oceans Day","🌊","Global"],
    ["06-16","Youth Day","🇿🇦","ZA"],
    ["06-18","International Sushi Day","🍣","Global"],
    ["07-18","Mandela Day","🤝","ZA"],
    ["08-09","National Women's Day","🇿🇦","ZA"],
    ["08-15","Assumption Day","⛪","CY"],
    ["09-01","Spring Day","🌸","ZA"],
    ["09-24","Heritage Day (Braai Day)","🔥","ZA"],
    ["10-01","Cyprus Independence Day · Intl Coffee Day","🇨🇾","CY · Global"],
    ["10-16","World Food Day","🍽","Global"],
    ["10-28","Ochi Day","🇬🇷","CY"],
    ["10-31","Halloween","🎃","Global"],
    ["12-16","Day of Reconciliation","🇿🇦","ZA"],
    ["12-25","Christmas Day","🎄","ZA · CY · UK"],
    ["12-26","Day of Goodwill / Boxing Day","🎁","ZA · CY · UK"]
  ].map(([md,name,flag,reg])=>({date:`${year}-${md}`,name,flag,reg}));
}
const OCCASIONS_APP = [
  ..._fixedOccasions(2026), ..._fixedOccasions(2027),
  // movable feasts & one-offs
  {date:"2026-08-10", name:"Women's Day (observed)",  flag:"🇿🇦", reg:"ZA"},
  {date:"2026-08-31", name:"Summer Bank Holiday",     flag:"🇬🇧", reg:"UK"},
  {date:"2026-11-27", name:"Black Friday",            flag:"🛍",  reg:"Global"},
  {date:"2026-11-30", name:"Cyber Monday",            flag:"💻",  reg:"Global"},
  {date:"2027-03-14", name:"Mothering Sunday",        flag:"💐", reg:"UK"},
  {date:"2027-03-26", name:"Good Friday",             flag:"✝️", reg:"ZA · UK"},
  {date:"2027-03-29", name:"Family Day / Easter Monday", flag:"🐣", reg:"ZA · UK"},
  {date:"2027-03-15", name:"Green Monday",            flag:"🪁", reg:"CY"},
  {date:"2027-05-02", name:"Orthodox Easter",         flag:"🕊", reg:"CY"},
  {date:"2027-05-03", name:"Early May Bank Holiday",  flag:"🇬🇧", reg:"UK"},
  {date:"2027-05-09", name:"Mother's Day (ZA)",       flag:"💐", reg:"ZA"},
  {date:"2027-05-31", name:"Spring Bank Holiday",     flag:"🇬🇧", reg:"UK"},
  {date:"2027-06-20", name:"Father's Day",            flag:"👔", reg:"ZA · UK"},
  {date:"2027-06-04", name:"Fish & Chip Day",         flag:"🐟", reg:"UK"},
  {date:"2027-08-30", name:"Summer Bank Holiday",     flag:"🇬🇧", reg:"UK"},
  {date:"2027-11-26", name:"Black Friday",            flag:"🛍",  reg:"Global"}
];

// ---- Supplier brief template -------------------------------------------
// Distilled from real briefs (Zambezi incentive, Franchisee Forum,
// Winter Menu sushi rework). This is both the AI scaffold and the
// blank template shown to humans.
const BRIEF_TEMPLATE = `OCEAN BASKET ACADEMY — VIDEO BRIEF
Shoot: {{SHOOT_NAME}}
Shoot date: {{SHOOT_DATE}}

1. THE BIG PICTURE
   • What are we making? —
   • The goal —
   • Key message —
   • Why now (campaign / curriculum / occasion tie-in) —

2. WHAT WE NEED CAPTURED
   • Video list (name each deliverable) —
   • For each: what changes / what must be crystal clear on screen —
   • Pop-ups & subtitles needed (exact wording) —
   • Stills needed? —
   • Voxpops? (list the questions) —

3. CREATIVE DIRECTION
   • Look & feel — clean · educational · good lighting · not too close up
   • Academy brand elements throughout (titles, colours, logo)
   • Steps as subtitles where instructional
   • Hook / script — (attach or paste; teleprompter? Y/N)
   • CTA —
   • Logo — OB / Academy logo at end

4. TECHNICAL SPECS
   • Format — MP4
   • Shape — landscape / portrait
   • Length —
   • Max file size / destination — (WhatsApp / Articulate course / presentation)

5. LOGISTICS
   • Location + address —
   • Call time / set-up time —
   • Running order & any hard time windows (presenters with limited time!) —
   • Who's on camera —
   • Teleprompter needed —

6. DEADLINES & DELIVERY
   • Draft due —
   • Final delivery —
   • Delivery method — (Google Drive / WeTransfer / WhatsApp)
   • File naming — OceanBasket_{{PROJECT}}_{{name}}_final

7. SOURCE MATERIAL ATTACHED
   • Recipes / SOPs / decks — (list what's attached & what's still missing)`;

// ---- Copy deck — the fun stuff -----------------------------------------
const GREETINGS = {
  morning:["Morning, {n} ☀️","Rise and brine, {n}","Good morning, {n}"],
  afternoon:["Afternoon, {n}","Back at it, {n}","Hey {n}, the ocean's calm"],
  evening:["Evening, {n}","Late one, {n}? Respect","Golden hour, {n}"]
};
const EMPTY_LINES = [
  "Nothing here. Suspiciously peaceful.",
  "All clear. Go make a coffee.",
  "Zero. Zip. Zilch. Enjoy it."
];
const DONE_LINES = ["Boom.","Nailed it.","One less thing.","Chef's kiss."];
const SENT_LINES = ["Wooohooo, it's out!","Message away.","Sent — the people rejoice."];

const MO = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const PALETTE = ["#0A3D62","#00A8A8","#F7C325","#5BC4BF","#7A5FB0","#E4784D","#3A7D44","#8D6E63"];

// ---- Default config -----------------------------------------------------
const DEFAULT_CFG = {
  projects: [
    {gid:CC_PROJECT,           name:"Content & Comms",                 color:"#0A3D62", on:true},
    {gid:"1213797897707123",   name:"Team Scheduling",                 color:"#00A8A8", on:true},
    {gid:"1214196027560535",   name:"Menu Training",                   color:"#F7C325", on:true},
    {gid:"1214196027560612",   name:"New/Revamped Restaurant Training",color:"#5BC4BF", on:true},
    {gid:WA_PROJECT,           name:"Academy WhatsApp",                color:"#7A5FB0", on:true},
    {gid:PB.proj,              name:"Day to Day",                      color:"#E4784D", on:true}
  ],
  campaigns: [],
  people: ["1213414176761459","1213630129003527","1213630128899336"], // Amy, Caitlin, Jess
  communities: COMMUNITIES_DEFAULT,
  pageCap: 6,
  view: "month",
  showComms: true,
  showOccasions: true,
  showStores: true,
  msgBoard: COMMUNITIES_PROJECT, // fixed existing Communities board; never created by the app
  prBoard: null                 // resolved from shared dashboard state / Asana by name
};
