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

// ---- Trainers -----------------------------------------------------------
// One stable colour per trainer, shared by the calendar pills and the
// Training tab so a trainer reads the same everywhere. Names come straight
// from the "Trainer" custom field on the Scheduling + Feedback boards.
const TRAINER_COLORS = {
  "Norman":"#0A3D62", "Given":"#009B9E", "Teboho":"#E4784D", "Cameron":"#7A5FB0",
  "Mandla":"#D64545", "Sam":"#2FA36B", "Noni":"#C64B8C", "Mish":"#3A7D9A",
  "Charlotte":"#B5651D", "Lina":"#E85D9E", "Godfrey":"#5B8C2A", "Carlos":"#8E44AD",
  "Jose":"#16A085", "Josh":"#C9A227", "Other":"#7A8B99"
};
const TRAINER_FALLBACK = ["#0A3D62","#009B9E","#E4784D","#7A5FB0","#D64545","#2FA36B",
  "#C64B8C","#3A7D9A","#B5651D","#E85D9E","#5B8C2A","#8E44AD","#16A085","#C9A227"];
// Stable colour for any trainer — known ones from the map, unknown ones hashed
// to a fixed slot so the colour never changes between reloads.
function trainerColor(name){
  if(!name) return "#7A8B99";
  if(TRAINER_COLORS[name]) return TRAINER_COLORS[name];
  let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))>>>0;
  return TRAINER_FALLBACK[h%TRAINER_FALLBACK.length];
}
// RAG buckets from the free-text "Status of Section" values on the Feedback board
const RAG = {
  green: {key:"green", color:"#2FA36B", label:"Green"},
  orange:{key:"orange",color:"#E8952E", label:"Orange"},
  red:   {key:"red",   color:"#D64545", label:"Red"}
};
function ragOf(status){
  const s=(status||"").toLowerCase();
  if(s.startsWith("green")||s.includes("good")) return RAG.green;
  if(s.startsWith("orange")||s.includes("nearly")) return RAG.orange;
  if(s.startsWith("red")||s.includes("needs help")||s.includes("critical")) return RAG.red;
  return null;
}
const ACADEMY_TEAM = "1213626139926485"; // team new campaigns are created in
const CAMPAIGN_PORTFOLIO = "1216656052977768";
const CAMPAIGN_PORTFOLIO_URL = "https://app.asana.com/0/portfolio/1216656052977768/1216677685805996";
const RETIRED_CAMPAIGN_GIDS = ["1216638197844781"]; // hidden from this app; the Asana project itself is not deleted
const SCHEDULE_PROJECT = "1213797897707123"; // Team Scheduling — the forward-looking trainer schedule
const FEEDBACK_PROJECT = VISITS_PROJECT;      // Training Team Feedback — the record of visits that happened
const REVAMP_PROJECT = "1214196027560612"; // store-revamp placeholders
const CURRICULUM_PROJECT = "1216652752864537";
const CURRICULUM_URL = "https://app.asana.com/0/1216652752864537";
// Content Hub — the searchable front door to published content. The app reads
// every project inside this portfolio PLUS the separate Academy Courses project
// and shows them as one library.
const CONTENT_HUB_PORTFOLIO = "1217016448186385";
const CONTENT_HUB_PORTFOLIO_URL = "https://app.asana.com/0/portfolio/1217016448186385/1217016082817449";
const ACADEMY_COURSES_PROJECT = "1214196027650698";
const ACADEMY_COURSES_URL = "https://app.asana.com/0/1214196027650698";

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

// ---- OB Academy strategy — "The Cheat Sheet: how we do things" --------
// The yearly strategy, distilled from the 2026 Plans & Processes doc. This is
// the "why & what" layer that sits above the marathon (the "when"). Rendered as
// the collapsible playbook banner at the top of the Curriculum tab.
const OB_STRATEGY = {
  mission:
    "We create good people by giving them the knowledge, skills and coaching they need to succeed in their role. We do not train for completions — we train for behaviour change that delivers business results.",
  model: [
    {k:"Educate",   v:"Give knowledge"},
    {k:"Experience",v:"Practise it"},
    {k:"Expertise", v:"Coach to mastery"}
  ],
  teach: [
    {k:"T", v:"Tell them what & why"},
    {k:"E", v:"Explain / demo"},
    {k:"A", v:"Ask them to try it"},
    {k:"C", v:"Coach & correct"},
    {k:"H", v:"Hold accountable"}
  ],
  actionMapping: [
    "What behaviour do we want?",
    "What must the learner do?",
    "What must they know?",
    "What activity builds confidence?",
    "What workplace activity reinforces it?"
  ],
  strategy: [
    {k:"Diagnose", v:"Build a role recipe & assess each crew member. See exactly where the gaps are."},
    {k:"Train",    v:"Deliver training on WhatsApp — the platform the crew already live on."},
    {k:"Connect",  v:"Link completion to business outcomes to prove impact & add value."}
  ],
  streams: [
    {k:"Stream 1 — OB Fit Programme", tag:"Building the person for the role",
     v:"Every role has a recipe of Knowledge, Skills, Soft Skills and Business Impact. Assess, find the gaps, build a personalised programme.",
     out:"More capable people · Better performance · Career growth"},
    {k:"Stream 2 — Short Courses", tag:"Running the business through the year",
     v:"Business-driven training everyone needs, regardless of role, because the business is always evolving.",
     out:"Menu Launches · Loyalty App · Focus Packs · Campaigns"}
  ],
  principles: "Delivered on WhatsApp · Simple · Practical · Relevant · Measurable"
};

// ---- OB Fit — the recipe per role ------------------------------------
// Verbatim from the 2026 strategy. Every role is a recipe of four columns:
// Knowledge builds confidence · Skills build performance · Soft skills shape
// the experience · Impact shows why it matters. Static reference (no Asana
// dependency) so it renders live and in demo.
const OBFIT_RECIPES = [
  {group:"Leadership, Management & Coordination", role:"Franchise Operator",
   knowledge:["Brand strategy, standards & operating model","Financial performance & profitability drivers","People structure, labour & succession","Customer experience & reputation","Local area marketing & sales growth","Compliance, risk & governance"],
   skills:["Set direction & hold teams accountable","Commercial decision making","Build a strong leadership team","Analyse performance & take action","Drive brand consistency across the business","Create ownership & guest focus"],
   soft:["Strategic thinking","Accountability","Commercial confidence","Influence & alignment","Resilience","Relationship building"],
   impact:["Increased profitability & sustainable growth","Stronger brand consistency","Improved guest loyalty & reputation","Better leadership pipeline","Stronger execution of campaigns","Reduced business risk through compliance"]},
  {group:"Leadership, Management & Coordination", role:"Restaurant / GM",
   knowledge:["Financials: sales, labour, GP, food cost, spend","Product, menu & campaign knowledge","Operational & brand standards","People management","Customer experience & complaint process","Business strategy, targets & priorities"],
   skills:["Coach and develop people","Lead with accountability","Communicate shift direction clearly","Solve problems under pressure","Make decisions using facts & standards","Manage performance and follow up"],
   soft:["Leadership presence","Calm under pressure","Fairness & consistency","Problem-solving mindset","Clear communication","Coaching mindset"],
   impact:["Improved profitability & cost control","Better team performance & accountability","Stronger operational consistency","Improved guest experience scores","Better execution of campaigns","Lower staff turnover"]},
  {group:"Leadership, Management & Coordination", role:"FOH Manager",
   knowledge:["Service sequence & guest experience standards","Waiter, host & runner role expectations","Sales, app sign-up & upselling priorities","Table management & floor flow","Complaint handling & guest recovery","POS, payment & cash-up"],
   skills:["Lead the floor during service","Coach waiters in the moment","Drive upselling & app sign-ups","Manage table turns & guest flow","Handle complaints calmly & confidently","Communicate priorities before & during shift"],
   soft:["Energy & presence","Guest empathy","Composure","Influence","Situational awareness","Encouraging others"],
   impact:["Improved guest satisfaction","Higher sales & average spend","More app sign-ups","Better service consistency","Faster table turns","Improved waiter performance & confidence"]},
  {group:"Leadership, Management & Coordination", role:"Kitchen Manager",
   knowledge:["Kitchen systems, recipes & prep standards","Food safety & compliance","Stock, ordering & waste control","Labour planning & section productivity","Equipment maintenance & safety","Menu launches, campaigns & priorities"],
   skills:["Lead kitchen execution during service","Coach BOH team members","Plan prep & manage readiness","Control quality, portions & waste","Solve bottlenecks quickly","Communicate clearly with FOH & management"],
   soft:["Calm authority","Attention to detail","Discipline","Team leadership","Decision making under pressure","Constructive feedback"],
   impact:["Reduced food cost & wastage","Improved kitchen productivity","Better food quality & consistency","Faster order turnaround times","Improved audit & compliance results","Stronger BOH team performance"]},
  {group:"Leadership, Management & Coordination", role:"Coordinator / Pass",
   knowledge:["Full menu, recipes & plate builds","Ticket reading, sequencing & priority rules","Grill, fryer and line section flow","Plating standards & pass quality checks","Kitchen communication & handover language","Service timing & guest wait expectations"],
   skills:["Call tickets clearly and accurately","Sequence and pace orders during rush","Direct grill, fryer and line sections","Plate, check and organise food at the pass","Spot bottlenecks and redirect quickly","Keep calm, clear communication under pressure"],
   soft:["Confidence","Clear voice & communication","Calm under pressure","Focus & urgency","Team direction","Situational awareness"],
   impact:["Faster ticket times","Smoother grill and fryer flow at peak","Fewer missing items and remake errors","More consistent plate presentation","Better FOH and BOH communication","Improved guest satisfaction through faster food"]},
  {group:"Crew & Station", role:"Waiter",
   knowledge:["Product & menu knowledge","Promotion, LTO & app offer knowledge","Allergy & food safety","Ocean Basket service standards","POS, payments & order process","Upselling: pairings & add-ons"],
   skills:["Guest engagement & rapport building","Confident upselling & recommendations","Clear menu communication","Accurate order taking & follow-through","Time management across tables","Problem resolution & service recovery"],
   soft:["Warmth","Confidence","Listening","Patience","Sales courage","Positive energy"],
   impact:["Higher average spend per transaction","Improved guest satisfaction & returns","Fewer order errors & reduced waste","Stronger app sign-up conversion","Faster, smoother table service","Better service recovery"]},
  {group:"Crew & Station", role:"Hostess",
   knowledge:["Guest greeting & seating standards","Table layout & floor plan","Booking, waitlist & guest flow","Menu, promotion & app basics","Service sequence & handover expectations","Guest complaint escalation process"],
   skills:["Create a warm first impression","Manage guest flow & wait times","Communicate clearly with FOH team","Read the floor & seat smartly","Handle guest pressure calmly","Set the tone for the guest experience"],
   soft:["Warmth","Patience","Confidence","Clear communication","Awareness","Grace under pressure"],
   impact:["Strong first impression for guests","Reduced waiting frustration","Improved table turns","Better guest handover to waiters","Improved guest satisfaction","Increased likelihood of return visits"]},
  {group:"Crew & Station", role:"Sushi Chef",
   knowledge:["Sushi menu & recipe knowledge","Fish, rice & ingredient quality standards","Food safety, cold chain & allergens","Portioning, costing & waste control","Presentation & plating standards","Sushi timing & order flow"],
   skills:["Prepare sushi consistently to standard","Knife handling & precision cutting","Manage sushi section speed & quality","Maintain clean, safe mise en place","Control portions & reduce waste","Communicate order delays / pressure"],
   soft:["Precision","Pride in craft","Focus","Patience","Team communication","Consistency"],
   impact:["Faster sushi ticket times","Consistent sushi quality & presentation","Reduced wastage & improved food cost","Improved guest satisfaction","Increased sushi sales & repeat purchases","Lower food safety risk"]},
  {group:"Crew & Station", role:"Griller / Line Cook",
   knowledge:["Menu, recipe and build knowledge","Grill, fryer and line cooking methods","Portioning, preparation and plating standards","Food safety, allergens and temperature control","Equipment use, cleaning and maintenance basics","Order timing, section flow and pass communication"],
   skills:["Cook items consistently to OB standard","Control timing, temperature and doneness","Plate cleanly and consistently","Maintain organised mise en place during peaks","Coordinate with the pass and kitchen team","Control portions and reduce waste"],
   soft:["Sense of urgency","Focus","Consistency","Teamwork","Clean-as-you-go discipline","Resilience under pressure"],
   impact:["Consistent food quality and presentation","Faster ticket times and smoother service","Fewer remakes, errors and complaints","Reduced waste and improved food cost","Better kitchen flow during peak shifts","Improved guest satisfaction"]},
  {group:"Crew & Station", role:"Bar / Deli",
   knowledge:["Beverage, dessert & deli product knowledge","Recipe & portion standards","Stock rotation & expiry dates","Food safety & hygiene standards","Promotion & add-on knowledge","Equipment use & cleaning procedures"],
   skills:["Prepare drinks & deli items consistently","Work quickly & neatly during peaks","Suggestive selling of drinks & add-ons","Manage stock & communicate shortages","Maintain a clean, guest-ready station","Coordinate timing with FOH & kitchen"],
   soft:["Neatness","Speed with accuracy","Product pride","Communication","Reliability","Guest focus"],
   impact:["Increased beverage & dessert sales","Higher average spend per transaction","Improved product consistency","Reduced wastage & stock losses","Faster service during peak times","Better guest experience via complete orders"]},
  {group:"Crew & Station", role:"Sculler",
   knowledge:["Cleaning chemical & safe usage","Dishwashing & sanitising standards","Hygiene & food safety basics","Waste separation & disposal standards","Equipment handling & care","Restaurant flow & peak-time priorities"],
   skills:["Keep wash-up area clean & organised","Work at speed during busy shifts","Prioritise critical items for service","Follow hygiene routines accurately","Communicate shortages / breakages fast","Support the team without being asked"],
   soft:["Reliability","Pace","Pride in cleanliness","Team support","Discipline","Responsibility"],
   impact:["Improved hygiene & food safety compliance","Better audit outcomes","Reduced breakages & replacement costs","Faster kitchen & FOH turnaround","Cleaner back-of-house environment","Less service disruption at peak"]}
];

// One-line "why this matters" per WhatsApp community, drawn from the role
// recipes' Business Impact column — surfaced when shipping to a community so a
// message carries its purpose (TEACH: tell them what & WHY).
const COMMUNITY_PURPOSE = {
  mgmt: "Better team performance, accountability & campaign execution",
  foh1: "Higher average spend, more app sign-ups & smoother service",
  foh2: "Higher average spend, more app sign-ups & smoother service",
  boh:  "Faster tickets, better food consistency & less waste",
  bar:  "More beverage & dessert sales, faster peak service",
  sushi:"Faster sushi tickets, consistent quality & repeat sushi sales"
};

// ---- WhatsApp communities --------------------------------------------
// Messages live in the Academy WhatsApp board; each community is a section
// there (sections are created automatically the first time they're needed).
const COMMUNITIES_DEFAULT = [
  {key:"mgmt", name:"Management",     color:"#0A3D62"},
  {key:"foh1", name:"Front of House 1", color:"#00A8A8"},
  {key:"foh2", name:"Front of House 2", color:"#5BC4BF"},
  {key:"boh",  name:"Back of House",  color:"#E4784D"},
  {key:"bar",  name:"Bar / Deli",     color:"#C64B8C"},
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

1. THE BIG PICTURE (build backwards — start with the behaviour)
   • What behaviour do we want on shift? —
   • What must the crew be able to DO after this? —
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
  morning:[
    "Morning, {n}. Let's make something good.",
    "Hey {n} ☀️ Ready when you are.",
    "New day, fresh ideas. Hi, {n}.",
    "Morning, {n}. Let's get into it.",
    "Big plans, good energy. Morning, {n}.",
    "Hello, {n}. Let's make today useful."
  ],
  afternoon:[
    "Hey {n} — look at you making moves.",
    "Afternoon, {n}. Plenty of day left.",
    "Round two, {n}. Let's go.",
    "Hey {n}. What's getting shipped today?",
    "Back at it, {n}. Excellent choice.",
    "Afternoon, {n}. Keep the good stuff moving."
  ],
  evening:[
    "Evening, {n}. Let's land this.",
    "Still here, {n}? Iconic.",
    "Late-shift energy, {n}.",
    "Hey {n} — one last good move.",
    "Evening, {n}. Finish strong, then log off.",
    "Look at you, {n}. Quietly getting it done."
  ]
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
  prBoard: null,                // resolved from shared dashboard state / Asana by name
  commTimeFavourites: ["10:00","15:00","18:00"],
  completionCelebrations: true // personal browser preference; Asana data is unaffected
};
