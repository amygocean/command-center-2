// Campaign resource analysis: reads uploaded source files and returns
// structured, source-grounded campaign intelligence. Originals remain in Asana.
import { getAsanaAccessToken, readSession } from "./_lib.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";
import readExcelFile from "read-excel-file/node";

const MAX_BYTES = 8 * 1024 * 1024;
const SHARED_PAT = process.env.ASANA_SHARED_PAT || process.env.AMY_PAT;

async function readBody(req){
  if(req.body && typeof req.body === "object") return req.body;
  const chunks=[]; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString()||"{}"); } catch { return {}; }
}
async function tokenFor(req,res){ return SHARED_PAT || await getAsanaAccessToken(req,res); }
async function asanaGet(req,res,path){
  const token=await tokenFor(req,res);
  const r=await fetch("https://app.asana.com/api/1.0"+path,{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
  const text=await r.text(); let j; try{j=text?JSON.parse(text):{};}catch{j={};}
  if(!r.ok){const e=new Error((j.errors&&j.errors[0]&&j.errors[0].message)||("Asana "+r.status));e.status=r.status;throw e;}
  return j;
}
function cleanMime(mime,name){
  const m=String(mime||"").toLowerCase(); if(m) return m;
  const n=String(name||"").toLowerCase();
  if(n.endsWith(".pdf"))return "application/pdf";
  if(n.endsWith(".docx"))return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if(n.endsWith(".xlsx"))return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if(n.endsWith(".csv"))return "text/csv";
  if(n.endsWith(".json"))return "application/json";
  if(n.endsWith(".txt")||n.endsWith(".md"))return "text/plain";
  return "application/octet-stream";
}
async function extractPdfText(buf){
  const task=getDocument({data:new Uint8Array(buf),disableFontFace:true,useSystemFonts:true});
  const doc=await task.promise;
  const pages=[];
  try{
    for(let pageNo=1;pageNo<=doc.numPages;pageNo++){
      const page=await doc.getPage(pageNo);
      const content=await page.getTextContent();
      const lines=[]; let current="",lastY=null;
      for(const item of content.items||[]){
        if(!item||typeof item.str!=="string") continue;
        const y=Array.isArray(item.transform)?item.transform[5]:null;
        if(lastY!==null&&y!==null&&Math.abs(y-lastY)>2){
          if(current.trim()) lines.push(current.trim());
          current="";
        }
        current+=(current&&item.str&&!/^\s/.test(item.str)?" ":"")+item.str;
        if(y!==null) lastY=y;
      }
      if(current.trim()) lines.push(current.trim());
      pages.push(lines.join("\n"));
      page.cleanup();
    }
  }finally{
    await doc.destroy();
  }
  return pages.join("\n\n");
}
async function extractText(buf,mime,name){
  const m=cleanMime(mime,name);
  if(m==="application/pdf") return extractPdfText(buf);
  if(m.includes("wordprocessingml")||/\.docx$/i.test(name||"")) return (await mammoth.extractRawText({buffer:buf})).value||"";
  if(m.includes("spreadsheetml")||/\.xlsx$/i.test(name||"")){
    const sheets=await readExcelFile(buf);
    const cell=value=>value instanceof Date?value.toISOString():value===null||value===undefined?"":String(value);
    return sheets.map(({sheet,data})=>"SHEET: "+sheet+"\n"+data.map(row=>row.map(cell).join("\t")).join("\n")).join("\n\n");
  }
  if(m.startsWith("text/")||m==="application/json"||/\.(txt|md|csv|json)$/i.test(name||"")) return buf.toString("utf8");
  return "";
}
function safeJson(text){
  const raw=String(text||"").replace(/^```(?:json)?/i,"").replace(/```$/,"" ).trim();
  try{return JSON.parse(raw);}catch{}
  const a=raw.indexOf("{"),b=raw.lastIndexOf("}");
  if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1));}catch{}}
  return null;
}
function fallback(name,category,text){
  const plain=String(text||"").replace(/\s+/g," ").trim();
  return {
    name,category,summary:plain.slice(0,900)||"This source was uploaded but could not be converted into readable text.",
    facts:[],recipes:[],dates:[],audiences:[],risks:[],gaps:plain?[]:["The source needs manual review because readable text could not be extracted."],
    shoot_ideas:[],output_ideas:[],analysed_at:new Date().toISOString(),ai_available:false
  };
}
async function analyseWithAI({buf,mime,name,category,campaign,text}){
  const openaiKey=process.env.OPENAI_API_KEY, anthropicKey=process.env.ANTHROPIC_API_KEY;
  if(!openaiKey&&!anthropicKey) return fallback(name,category,text);
  const schema=`Return ONLY valid JSON with this exact shape: {"summary":"", "facts":[""], "recipes":[{"name":"","important_steps":[""],"ingredients_or_products":[""],"suggested_shots":[""]}], "dates":[{"date":"","meaning":""}], "audiences":[""], "risks":[""], "gaps":[""], "shoot_ideas":[{"title":"","why":"","shots":[""]}], "output_ideas":[{"title":"","type":"course|skills_booster|manager_support|community_message|infographic|cheat_sheet|video|photo|other","audience":[""],"why":""}]}. Do not invent operational facts. Put uncertainty or conflicting information in gaps.`;
  const context=`You are analysing source material for an Ocean Basket Academy learning campaign. Campaign: ${campaign?.name||"Untitled"}. Launch date: ${campaign?.launch||campaign?.start||"not set"}. Resource category: ${category||"Other"}. File: ${name}. Identify concrete learning/content requirements, recipes/products, shoot needs, affected audiences and missing information. ${schema}`;
  let out="";
  if(openaiKey){
    const content=[{type:"text",text:context+(text?"\n\nSOURCE TEXT:\n"+text.slice(0,50000):"")}];
    if(cleanMime(mime,name).startsWith("image/")) content.push({type:"image_url",image_url:{url:`data:${cleanMime(mime,name)};base64,${buf.toString("base64")}`}});
    const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+openaiKey,"content-type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4o-mini",temperature:0.1,max_tokens:1800,response_format:{type:"json_object"},messages:[{role:"user",content}]})});
    const j=await r.json(); if(!r.ok) throw new Error((j.error&&j.error.message)||"OpenAI analysis failed");
    out=j.choices?.[0]?.message?.content||"";
  }else{
    const blocks=[];
    if(cleanMime(mime,name).startsWith("image/")) blocks.push({type:"image",source:{type:"base64",media_type:cleanMime(mime,name),data:buf.toString("base64")}});
    blocks.push({type:"text",text:context+(text?"\n\nSOURCE TEXT:\n"+text.slice(0,50000):"")});
    const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":anthropicKey,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:process.env.AI_MODEL||"claude-sonnet-4-5",max_tokens:1800,temperature:0.1,messages:[{role:"user",content:blocks}]})});
    const j=await r.json(); if(!r.ok) throw new Error((j.error&&j.error.message)||"AI analysis failed");
    out=(j.content||[]).map(x=>x.text||"").join("");
  }
  const parsed=safeJson(out)||fallback(name,category,text);
  return {...parsed,name,category,analysed_at:new Date().toISOString(),ai_available:true};
}

export default async function handler(req,res){
  if(req.method!=="POST"){res.status(405).json({error:"POST only"});return;}
  if(!readSession(req)){res.status(401).json({error:"not authenticated"});return;}
  try{
    const body=await readBody(req); let buf,mime,name,attachment=null;
    if(body.action==="analyse_attachment"){
      if(!body.attachment_id) throw Object.assign(new Error("attachment_id required"),{status:400});
      const j=await asanaGet(req,res,`/attachments/${body.attachment_id}?opt_fields=name,download_url,view_url,resource_subtype,created_at`);
      attachment=j.data||{}; name=attachment.name||"resource";
      if(!attachment.download_url) throw Object.assign(new Error("This attachment cannot be downloaded for analysis. Open it in Asana and upload a local copy to analyse it."),{status:422});
      const token=await tokenFor(req,res);
      const r=await fetch(attachment.download_url,{headers:{Authorization:"Bearer "+token}});
      if(!r.ok) throw new Error("Could not download the Asana attachment");
      buf=Buffer.from(await r.arrayBuffer()); mime=r.headers.get("content-type")||body.mime||"";
    }else{
      if(!body.data_base64) throw Object.assign(new Error("data_base64 required"),{status:400});
      buf=Buffer.from(String(body.data_base64),"base64"); mime=body.mime||""; name=body.filename||"resource";
    }
    if(!buf.length||buf.length>MAX_BYTES) throw Object.assign(new Error("Source files must be smaller than 8 MB for smart analysis"),{status:413});
    const text=await extractText(buf,mime,name);
    if(!text&&!cleanMime(mime,name).startsWith("image/")){
      const e=new Error("This file type can be attached, but smart reading currently supports PDF, DOCX, XLSX, CSV, TXT, JSON and images.");e.status=415;throw e;
    }
    const analysis=await analyseWithAI({buf,mime,name,category:body.category||"Other",campaign:body.campaign||{},text});
    res.status(200).json({analysis,attachment,extracted_chars:text.length});
  }catch(e){res.status(e.status||500).json({error:e.message});}
}
