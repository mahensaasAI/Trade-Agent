// Node: Build Prompt (Code) — enforces the free / premium model tiers and daily limits, picks the provider (Model
// Router input) and builds the persona + live-data system prompt. StudyPals is routed to its own n8n workflow.
var pc=$('Prepare Chat').first().json;
if(pc.denied)return [{json:{provider:"denied",denied:true,code:pc.code,message:pc.message}}];
var raw=$input.first().json||{};
var ctx=raw.d||{};var contextError=null;
if(raw.error){contextError=(typeof raw.error==="string")?raw.error:(raw.error.message||"context query failed");ctx={};}
var actor=pc.actor;
var limits=ctx.limits||{};
var cap=actor.kind==="guest"?Number(limits.guestDailyMessages||30):(actor.plan==="premium"?Number(limits.premiumDailyMessages||1000):Number(limits.freeDailyMessages||150));
var used=Number(ctx.usage||0);
function denied(code,message){return [{json:{provider:"denied",denied:true,code:code,message:message,agentId:pc.agentId,conversationId:pc.conversationId}}];}
if(used>=cap){
 if(actor.kind==="guest")return denied("RATE_LIMITED","You have used today's "+cap+" free messages. Sign up (free) for a bigger daily allowance, or come back tomorrow.");
 if(actor.plan!=="premium")return denied("RATE_LIMITED","You have used today's "+cap+" messages on the free plan. Go Premium for more, or come back tomorrow.");
 return denied("RATE_LIMITED","You have reached today's limit of "+cap+" messages. Please come back tomorrow.");
}
var org=ctx.organization||{};var orgName=org.name||"Y Square";
var models=Array.isArray(ctx.models)?ctx.models:[];
var ids=models.map(function(m){return m.id;});
function fmtDate(v){if(!v)return "n/a";var d=new Date(v);if(isNaN(d.getTime()))return String(v);return d.toISOString().replace("T"," ").slice(0,16)+" UTC";}
function ago(v){if(!v)return "n/a";var ms=Date.now()-new Date(v).getTime();if(isNaN(ms))return String(v);var h=ms/3600000;if(Math.abs(h)<1)return Math.round(ms/60000)+" min ago";if(Math.abs(h)<48)return h.toFixed(1)+" h ago";return Math.round(h/24)+" days ago";}
function until(v){if(!v)return "n/a";var ms=new Date(v).getTime()-Date.now();if(isNaN(ms))return String(v);var d=ms/86400000;if(d<0)return Math.round(-d)+" days ago";if(d<1)return "today";return Math.round(d)+" days";}
// ---- StudyPals: proxied to the existing StudyPals workflow, no model choice here --------------------------------
if(pc.agentId==="agent-studypals"){
 var sp=ctx.studypals||{};var base=String(sp.baseUrl||"http://127.0.0.1:5678/webhook/studypals/");if(base.slice(-1)!=="/")base+="/";
 var path=String(sp.tutorPath||"tutor/ask").replace(/^\/+/,"");
 var c=pc.context||{};
 return [{json:{provider:"studypals",modelId:"studypals",modelLabel:"StudyPals Tutor",agentId:pc.agentId,agentName:"StudyPals",conversationId:pc.conversationId,actor:actor,startedAt:pc.startedAt,contextError:contextError,sources:[],
  studypalsUrl:base+path,
  studypalsBody:{studentId:c.studentId||actor.id,sessionId:pc.conversationId,grade:c.grade||"8",subject:c.subject||"General",topic:c.topic||"General",question:pc.message},
  systemPrompt:"",userPrompt:pc.message}}];
}
// ---- Model selection with tier enforcement ----------------------------------------------------------------------
var pick=(ids.indexOf(pc.requestedModel)>=0)?pc.requestedModel:((ctx.agentSetting&&ids.indexOf(ctx.agentSetting)>=0)?ctx.agentSetting:(ids.indexOf("gemini")>=0?"gemini":(ids[0]||"gemini")));
var m=null;models.forEach(function(x){if(x.id===pick)m=x;});
if(!m)m={id:"gemini",label:"Gemini Flash",model_id:"models/gemini-2.5-flash",tier:"free"};
if(["claude","chatgpt","gemini","mistral","groq"].indexOf(m.id)<0)m={id:"gemini",label:"Gemini Flash",model_id:"models/gemini-2.5-flash",tier:"free"};
if(m.tier==="premium"&&actor.plan!=="premium"){
 if(actor.kind==="guest")return denied("PREMIUM_REQUIRED",m.label+" is part of "+orgName+" Premium. Sign up with Google or your email and subscribe to use Claude and ChatGPT. Gemini Flash, Mistral and Groq stay free.");
 return denied("PREMIUM_REQUIRED",m.label+" is part of "+orgName+" Premium. Upgrade your account to use Claude and ChatGPT.");
}
// ---- Personas ----------------------------------------------------------------------------------------------------
var PERSONA={
 "agent-athlete":{name:"Athlete Edge",focus:"sports nutrition for young athletes (roughly 8 to 22 years old): what to eat and drink before, during and after training, games and tournaments, matched to their sport, age group, schedule and diet.",
  rules:[
   "Food first. Never recommend supplements, protein powders, energy drinks, caffeine, fasting, calorie counting, weight cutting or restrictive diets to a child or teenager. If asked, explain why not and give a food alternative.",
   "Respect every allergy, intolerance and dietary rule in the PROFILE (vegetarian, vegan, halal, kosher, Jain, gluten-free, dairy-free). Never suggest a food that breaks them.",
   "Use the timing framework: full meal 3-4 h before, light carbohydrate snack 30-60 min before, water during (carbohydrate only when longer than 60-90 min or multiple games), recovery snack within 30-60 min after, balanced meal within 2 h.",
   "Be concrete: name actual foods and portions a family can buy and prepare, and include an everyday and a budget-friendly option. Use foods from the athlete's culture when the profile hints at it.",
   "Ground advice in the KNOWLEDGE passages and cite them as [K1], [K2] at the end of the sentence they support. If something is not covered, say it is general guidance.",
   "Medical or worrying topics (weight loss, fainting, missed periods, disordered eating, diabetes, coeliac disease, injuries) get a short, kind answer plus a clear pointer to a parent, doctor or registered dietitian. Do not diagnose.",
   "When you give a day plan or a game-day plan, add a code block that starts with a line containing exactly ```plan and ends with a line containing ```, holding JSON {\"title\":string,\"items\":[{\"when\":string,\"what\":string,\"why\":string}],\"hydration\":string,\"pack\":[string]} so the app can show it as a card. Keep the visible answer short when a plan card is included.",
   "Keep the tone encouraging and simple enough for a 12-year-old, with no lecturing."]},
 "agent-events":{name:"Event Planner",focus:"planning and running community, family, school and sports events: turning a brief into a checklist with owners and dates, estimating food, budget and volunteers, drafting announcements and keeping logistics, information and communication in one place instead of scattered WhatsApp threads.",
  rules:[
   "Use the EVENT live data when an event is selected: refer to real tasks, members, RSVPs, updates and messages by name; never invent people, dates or numbers. If no event is selected, use MY EVENTS or ask the person to create or open one.",
   "When asked for a plan or checklist, propose tasks grouped by category (logistics, venue, food, comms, budget, program, other) with an owner suggestion, a due date relative to the event date, and a priority. Then add a code block that starts with a line containing exactly ```action and ends with a line containing ```, holding JSON {\"type\":\"create_tasks\",\"eventId\":string,\"tasks\":[{\"title\":string,\"category\":string,\"assignee\":string|null,\"dueAt\":\"YYYY-MM-DD\"|null,\"priority\":\"low\"|\"normal\"|\"high\",\"notes\":string|null}]} so the organiser can add them with one click. Do not claim they were created.",
   "When asked for an announcement, reminder, schedule or information post, write it ready to send (title, 3-8 short lines, what people must do and by when) and add the same kind of ```action code block holding {\"type\":\"post_update\",\"eventId\":string,\"kind\":\"announcement\"|\"info\"|\"schedule\"|\"reminder\",\"title\":string,\"body\":string,\"pinned\":boolean}.",
   "Use the KNOWLEDGE playbook for quantities, timelines, roles and communication practice and cite passages as [K1], [K2].",
   "Highlight what is overdue, unassigned or high priority first when the person asks for status.",
   "Be practical and brief, like an experienced volunteer coordinator. Markdown headings, bullets and short tables are welcome."]}
};
var persona=PERSONA[pc.agentId]||PERSONA["agent-athlete"];
var lines=[];var sources=[];
if(pc.agentId==="agent-athlete"){
 var p=ctx.profile;
 if(p){lines.push("PROFILE: name "+(p.athlete_name||"not given")+" | age group "+(p.age_group||"not given")+" | sport "+(p.sport||"not given")+(p.position?" ("+p.position+")":"")+" | training days per week "+(p.training_days==null?"not given":p.training_days)+" | usual session time "+(p.session_time||"not given")+" | goals: "+(p.goals||"not given")+" | diet, allergies and rules: "+(p.dietary_notes||"none given")+" | favourite foods: "+(p.favourite_foods||"not given"));}
 else lines.push("PROFILE: not filled in yet. Ask (briefly) for sport, age group and any allergies if the answer depends on them, and suggest filling in the Athlete Profile panel.");
}
if(pc.agentId==="agent-events"){
 var ev=ctx.event;
 if(ev&&ev.event){
  var e=ev.event;var st=ev.stats||{};
  lines.push("EVENT: "+e.title+" ("+e.id+", code "+e.code+") | type "+(e.type||"")+" | status "+e.status+" | starts "+fmtDate(e.starts_at)+" (in "+until(e.starts_at)+")"+(e.ends_at?" | ends "+fmtDate(e.ends_at):"")+" | venue "+(e.venue||"not set")+(e.address?", "+e.address:"")+" | organiser "+(e.owner_name||"")+" | expected guests "+(e.expected_guests==null?"not set":e.expected_guests)+" | budget "+(e.budget==null?"not set":(e.currency||"USD")+" "+e.budget)+(e.description?" | brief: "+String(e.description).slice(0,400):""));
  lines.push("EVENT STATS: members "+(st.members||0)+", going "+(st.going||0)+" people, maybe "+(st.maybe||0)+", no reply "+(st.pending||0)+"; tasks "+(st.tasks||0)+" ("+(st.done||0)+" done, "+(st.overdue||0)+" overdue, "+(st.highOpen||0)+" high priority open); updates "+(st.updates||0)+"; chat messages "+(st.messages||0)+".");
  if(Array.isArray(ev.members)&&ev.members.length){lines.push("MEMBERS: "+ev.members.slice(0,40).map(function(x){return (x.name||x.member_id)+" ("+x.role+", rsvp "+x.rsvp+(x.party_size>1?", party of "+x.party_size:"")+")";}).join("; "));}
  if(Array.isArray(ev.tasks)&&ev.tasks.length){lines.push("TASKS:");ev.tasks.slice(0,60).forEach(function(t){lines.push("- ["+t.status+"] "+t.title+" | "+t.category+" | priority "+t.priority+" | owner "+(t.assignee||"unassigned")+" | due "+(t.due_at?fmtDate(t.due_at)+" ("+until(t.due_at)+")":"none")+(t.notes?" | notes: "+String(t.notes).slice(0,120):"")+" | id "+t.id);});}
  else lines.push("TASKS: none yet.");
  if(Array.isArray(ev.updates)&&ev.updates.length){lines.push("UPDATES (information posted to everyone):");ev.updates.slice(0,12).forEach(function(u){lines.push("- "+(u.pinned?"[pinned] ":"")+u.kind+": "+u.title+" - "+String(u.body||"").replace(/\s+/g," ").slice(0,240)+" ("+(u.author||"")+", "+ago(u.created_at)+")");});}
  if(Array.isArray(ev.messages)&&ev.messages.length){lines.push("RECENT CHAT:");ev.messages.slice(-12).forEach(function(x){lines.push("- "+(x.author||"?")+" ("+ago(x.created_at)+"): "+String(x.body||"").replace(/\s+/g," ").slice(0,200));});}
 }else if(Array.isArray(ctx.myEvents)&&ctx.myEvents.length){
  lines.push("MY EVENTS (no event selected; the person can open one in the Events area):");ctx.myEvents.forEach(function(x){lines.push("- "+x.title+" ("+x.id+") | "+x.status+" | "+fmtDate(x.starts_at)+" | "+(x.venue||"venue not set")+" | going "+(x.going||0)+" | open tasks "+(x.open_tasks||0)+" | my role "+x.my_role);});
 }else lines.push("EVENTS: none yet. The person can create an event in the Events area or join one with a code.");
}
if(Array.isArray(ctx.knowledge)&&ctx.knowledge.length){lines.push("KNOWLEDGE:");ctx.knowledge.forEach(function(k,i){sources.push({id:k.id,title:k.title,category:k.category,marker:"K"+(i+1)});lines.push("[K"+(i+1)+"] "+k.title+" ("+(k.category||"")+"): "+String(k.content||"").slice(0,1100));});}
if(contextError)lines.push("NOTE: live data could not be loaded ("+contextError+"). Say so if the question depends on it.");
var who=actor.kind==="guest"?"a guest using the free version (not signed in)":(actor.name+", a "+(actor.plan==="premium"?"Premium":"free")+" member");
var sys=[
 "You are "+persona.name+", one of the agents in "+orgName+" Workplace ("+(org.tagline||"agents for young athletes, students and community events")+").",
 "Your specialism is "+persona.focus,
 "The person asking is "+who+". Current time: "+new Date().toISOString().replace("T"," ").slice(0,16)+" UTC.",
 "You have no tools. Everything you know about this person and their data is in the LIVE DATA below, which comes straight from the "+orgName+" database and is authoritative.",
 "",
 "LIVE DATA:",
 lines.join("\n"),
 "",
 "HOW TO ANSWER:",
 "- Use only the live data and the knowledge passages for facts about the person, their profile, events, tasks and people. Never invent ids, names, dates or numbers. If something is not in the data, say so.",
 "- Be direct and warm. No filler, no restating the question, no disclaimers longer than one line.",
 "- Use markdown (short headings, bullets, tables for comparisons) unless told otherwise below.",
 "- Answer in the language the person writes in."
].concat(persona.rules.map(function(r){return "- "+r;})).join("\n");
return [{json:{provider:m.id,modelId:m.model_id,modelLabel:m.label,systemPrompt:sys,userPrompt:pc.message,conversationId:pc.conversationId,agentId:pc.agentId,agentName:persona.name,actor:actor,sources:sources,startedAt:pc.startedAt,contextError:contextError,context:pc.context}}];
