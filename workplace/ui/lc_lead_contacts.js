/* ---- odf-leadcontacts: contacts in the Pipeline. "Add contact" on the Pipeline (or paste a signature and press Fill), My Buddy understands pasted contact details ("add Jane Doe jane@acme.com 214 555 0199") and asks before adding them, and "email Jane" drafts an email for that lead. A draft can be sent from WorkPlace ("Send now") from the person's own OraDayForce mailbox once Microsoft 365 sending is switched on; "Open in my mail app" stays. Talks to /svc/leads (n8n "WorkPlace Leads Contacts API"); the lead list itself still comes from /svc/collab. ---- */
if(!P.user)P.user='<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>';
var LC={open:false,form:{},busy:false,mail:null,mailBusy:false,sending:false,attached:false};
(function(){var st=document.createElement("style");st.id="lccss";st.textContent=
 ".lp-score.lc-man svg{width:18px;height:18px}"+
 ".lc-form .lp-grid{margin-top:6px}.lc-form textarea.inp{min-height:62px}"+
 ".lc-paste{display:flex;gap:8px;align-items:flex-start;margin:6px 0 4px}.lc-paste textarea{flex:1}"+
 ".lc-from{font-size:12px;color:var(--tx3);margin-top:6px}.lc-from.warn{color:var(--warn,#b45309)}"+
 ".lc-card{margin-top:8px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--panel);font-size:13px;white-space:normal}.lc-card div{margin:1px 0}.lc-card b{display:inline-block;min-width:64px;color:var(--tx3);font-weight:600}"+
 "@media (max-width:760px){.lc-paste{flex-direction:column;align-items:stretch}.lc-paste .btn{align-self:flex-start}}";
 document.head.appendChild(st);})();
function lcApi(action,payload){ var h={"Content-Type":"application/json"}; if(S.token)h.Authorization="Bearer "+S.token;
 return fetch(API+"/leads",{method:"POST",headers:h,body:JSON.stringify({action:action,payload:payload||{}})}).then(function(r){return r.json().catch(function(){throw new Error("HTTP "+r.status);});})
  .then(function(j){ if(!j||j.success===false){var e=new Error((j&&j.error&&j.error.message)||"Request failed");e.code=j&&j.error&&j.error.code;throw e;} return j.data; }); }
// ---- reading contact details out of free text (a pasted signature, or what someone typed to My Buddy) ----
var LC_ROLE=/\b(ceo|cfo|cto|coo|cio|cmo|chro|vp|svp|evp|vice president|president|director|manager|head of|head|founder|co-?founder|owner|partner|principal|lead|engineer|architect|officer|controller|analyst|consultant|administrator|admin|specialist|coordinator|executive|chair(?:man|woman|person)?|treasurer|buyer|procurement)\b/i;
var LC_CO=/\b(inc|llc|ltd|limited|corp|corporation|co|company|group|holdings|technologies|technology|tech|solutions|systems|services|partners|labs|consulting|industries|enterprises|global|international)\b\.?$/i;
function lcCap(w){return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase();}
function lcParse(text){
 var t=String(text||"").replace(/\r/g,""), o={};
 var lab=function(re){var m=re.exec(t);if(m){t=t.replace(m[0]," , ");return m[1].trim();}return "";};
 o.contact_name=lab(/\bname\s*[:=-]\s*([^,\n;|]+)/i); o.company=lab(/\b(?:company|organi[sz]ation|org|firm|account)\s*[:=-]\s*([^,\n;|]+)/i);
 o.contact_role=lab(/\b(?:title|role|position|job)\s*[:=-]\s*([^,\n;|]+)/i);
 var em=/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}/.exec(t); o.email=em?em[0].replace(/[.]+$/,"").toLowerCase():""; if(em)t=t.replace(em[0]," , ");
 t=t.replace(/\b(?:e-?mail|mail|phone|tel|telephone|mobile|cell|ph|m|t|o|w)\s*[:.]\s*/gi," , ");
 var ph=null,re=/(\+?\(?\d[\d\s().\-]{6,}\d)(\s*(?:x|ext\.?)\s*\d{1,5})?/g,m;
 while((m=re.exec(t))){var d=m[1].replace(/\D/g,"");if(d.length>=7&&d.length<=15){ph=m;break;}}
 o.phone=ph?(ph[1]+(ph[2]||"")).replace(/\s+/g," ").trim():""; if(ph)t=t.replace(ph[0]," , ");
 var web=/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|ai|co|us|biz|tech|cloud|app|dev|info))\b\/?\S*/i.exec(t); o.website=web?web[1].toLowerCase():""; if(web)t=t.replace(web[0]," , ");
 t=t.replace(/^\s*(?:please\s+)?(?:add|save|create|new|put)\s+(?:a\s+|the\s+|this\s+|new\s+)?(?:contact|lead|prospect|person|details|contact details)?\s*(?:for|to the pipeline|to pipeline|to leads)?\s*[:,-]?/i," ");
 t=t.replace(/\b(?:to|in|into)\s+(?:the\s+)?(?:pipeline|leads)\b/ig," ");
 var parts=t.split(/[\n,;|•·]+|\s+-\s+|\s+–\s+/).map(function(x){return x.replace(/\s+/g," ").trim();}).filter(function(x){return x&&/[A-Za-z]/.test(x)&&x.length<=80;});
 parts.forEach(function(x){
  var at=/^(.+?)\s+(?:at|@|from|with)\s+(.+)$/i.exec(x);
  if(at&&LC_ROLE.test(at[1])&&!o.contact_role){o.contact_role=at[1];if(!o.company)o.company=at[2];return;}
  if(at&&!LC_ROLE.test(at[1])&&!o.contact_name&&/^[A-Za-z][A-Za-z'.-]+(\s+[A-Za-z][A-Za-z'.-]+){0,3}$/.test(at[1])){o.contact_name=at[1];if(!o.company)o.company=at[2];return;}
  if(LC_ROLE.test(x)&&!o.contact_role&&x.split(" ").length<=7){o.contact_role=x;return;}
  if(LC_CO.test(x)&&!o.company){o.company=x;return;}
  if(!o.contact_name&&/^[A-Za-z][A-Za-z'.-]+(\s+[A-Za-z][A-Za-z'.-]+){1,3}$/.test(x)){o.contact_name=x.split(" ").map(function(w){return /^[a-z]/.test(w)?lcCap(w):w;}).join(" ");return;}
  if(!o.company&&x.split(" ").length<=5)o.company=x;
 });
 if(!o.contact_name&&o.email){var lp=o.email.split("@")[0].split(/[._-]+/).filter(function(w){return /^[a-z]{2,}$/i.test(w);});if(lp.length>=2&&lp.length<=3)o.contact_name=lp.map(lcCap).join(" ");}
 Object.keys(o).forEach(function(k){o[k]=String(o[k]||"").replace(/\s+/g," ").trim().slice(0,160);});
 return o; }
function lcHasContact(o){return !!(o&&(o.email||o.phone));}
function lcSummary(o){return [o.contact_name,o.contact_role,o.company,o.email,o.phone].filter(Boolean).join(" · ");}
function lcAdd(o,via){
 var stage=o.status||"new";
 return lcApi("leads.add",{contact_name:o.contact_name,contact_role:o.contact_role,company:o.company,email:o.email,phone:o.phone,website:o.website,notes:o.notes,location:o.location,status:stage,via:via||""})
  .then(function(d){ LP.stage=stage;LP.fit="";LP.more=false;LP.loaded=false;LP.loading=false;LC.focus=d.id; lpLoad(); return d; }); }
// ---- Pipeline: Add contact form, contacts first, manual leads marked ----
function lcFormHtml(){ var f=LC.form||{}, inp=function(lab,k,ph,type){return '<div class="f"><label class="meta">'+lab+'</label><input class="inp" id="lc_'+k+'" data-lc="'+k+'"'+(type?' type="'+type+'"':'')+' value="'+attr(f[k]||"")+'"'+(ph?' placeholder="'+attr(ph)+'"':'')+'></div>';};
 return '<div class="card lc-form"><div class="card-h"><h2>Add a contact</h2><button class="btn btn-s btn-g" style="margin-left:auto" data-a="lcclose">'+ic("x")+'Close</button></div><div class="card-b">'+
  '<p class="meta">Add someone you met or were introduced to. They go into the Pipeline as a lead with their details, so the team can email or call them from here. You can also tell My Buddy, for example “add Jane Doe, CFO at Acme, jane@acme.com, 214 555 0199”.</p>'+
  '<div class="lc-paste"><textarea class="inp" id="lc_paste" data-lc="paste" rows="2" placeholder="Paste an email signature or contact details, then press Fill">'+esc(f.paste||"")+'</textarea><button class="btn btn-s btn-g" data-a="lcfill">'+ic("spark")+'Fill</button></div>'+
  '<div class="lp-grid">'+inp("Name","contact_name","Jane Doe")+inp("Email","email","jane@company.com","email")+inp("Phone","phone","+1 214 555 0199","tel")+inp("Company","company","Acme Inc.")+inp("Role","contact_role","CFO")+inp("Website","website","acme.com")+
  '<div class="f"><label class="meta">Stage</label><select class="inp" id="lc_status" data-lc="status">'+LP_STAGES.map(function(s){return '<option value="'+s[0]+'"'+((f.status||"new")===s[0]?" selected":"")+'>'+s[1]+'</option>';}).join("")+'</select></div></div>'+
  '<label class="meta">Notes</label><textarea class="inp" id="lc_notes" data-lc="notes" rows="2" placeholder="How you met, what they need, next step">'+esc(f.notes||"")+'</textarea>'+
  '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn btn-s btn-p" data-a="lcsave"'+(LC.busy?" disabled":"")+'>'+ic("plus")+(LC.busy?"Adding…":"Add to pipeline")+'</button><button class="btn btn-s btn-g" data-a="lcclose">Cancel</button><span class="meta">Name or company, plus an email or phone number.</span></div></div></div>'; }
var lcBaseVPipeline=vPipeline;
vPipeline=function(){
 // Contacts the team added come first, newest first; the Lead Finder's order (by AI score) is kept for the rest.
 if(LP.items&&LP.items.length){var man=LP.items.filter(function(l){return l.signal==="Added";}).sort(function(a,b){return Number(b.id)-Number(a.id);}),rest=LP.items.filter(function(l){return l.signal!=="Added";});LP.items=man.concat(rest);}
 var h=lcBaseVPipeline.apply(this,arguments), row='<div class="row" style="margin-left:auto;gap:8px">';
 if(h.indexOf(row)>=0)h=h.replace(row,row+'<button class="btn btn-s '+(LC.open?"btn-g":"btn-p")+'" data-a="lcopen">'+ic(LC.open?"x":"plus")+(LC.open?"Close":"Add contact")+'</button>');
 if(LC.open){var tabs='<div class="tabs" style="margin-bottom:0">';h=h.indexOf(tabs)>=0?h.replace(tabs,lcFormHtml()+tabs):h.replace(/<\/div>$/,lcFormHtml()+'</div>');}
 if(LC.focus){var fid=LC.focus;setTimeout(function(){var el=document.querySelector('[data-lp-stage="'+fid+'"]');if(el){LC.focus=null;var c=el.closest(".lp");if(c){c.scrollIntoView({behavior:"smooth",block:"center"});c.style.outline="2px solid var(--ac)";setTimeout(function(){c.style.outline="";},2500);}}},60);}
 return h; };
var lcBaseCard=lpCard;
lpCard=function(l){ var h=lcBaseCard.apply(this,arguments);
 if(l&&l.signal==="Added"){h=h.replace('<span class="lp-score" title="AI fit score">'+(l.score||0)+'</span>','<span class="lp-score lc-man" title="Added by '+attr(l.owner||"the team")+'">'+ic("user")+'</span>');
  h=h.replace('<span class="bg b-ac">Added</span>','<span class="bg b-ac">Contact added'+(l.owner?' by '+esc(l.owner):'')+'</span>');}
 return h; };
// Calls about a contact someone added do not start from a public signal.
var lcBaseCall=lpCallHtml;
lpCallHtml=function(l,c){ var h=lcBaseCall.apply(this,arguments);
 if(l&&l.signal==="Added")h=h.replace(/<p class="meta"><b>Opening:<\/b>[\s\S]*?<\/p>/,'<p class="meta"><b>Opening:</b> "Hi'+(l.contact_name?' '+esc(String(l.contact_name).split(" ")[0]):'')+', this is '+esc(S.data.user.name)+' from OraDayForce. We help teams like '+esc(l.company)+' with AI enablement, Oracle Cloud ERP, NetSuite, EBS and Google Cloud. Is now a bad time for two minutes?"</p>');
 return h; };
// First-touch email for a contact someone added: built from their notes, never from a made-up signal.
var lcBaseGen=lpGen;
lpGen=function(l){
 if(!l||l.signal!=="Added")return lcBaseGen.apply(this,arguments);
 var u=S.data.user, p=proj(S.chat.projectId)||S.data.projects[0], first=String(l.contact_name||"").split(" ")[0];
 var ag=S.data.agents.filter(function(x){return /proposal/i.test(x.name)||/proposal/i.test(x.id)})[0]||S.data.agents[0];
 var fallback=function(){LP.draft={id:l.id,busy:false,to:l.email||"",subject:"OraDayForce and "+l.company,body:"Hi "+(first||"there")+",\n\n"+(l.notes?"Following up on "+String(l.notes).replace(/\.$/,"")+". ":"")+"At OraDayForce we help small and mid-size teams with AI enablement, Oracle Cloud ERP, NetSuite, Oracle E-Business Suite and Google Cloud.\n\nWould a 20-minute call next week be useful?\n\nBest,\n"+u.name+"\n\n--\n"+lpFooter()};render();};
 LP.draft={id:l.id,busy:true,to:l.email||"",subject:"",body:""};render();
 if(!ag||!p){fallback();return;}
 var msg="Write a short, friendly business email (under 120 words) from "+u.name+" at OraDayForce to "+(l.contact_name||("the team at "+l.company))+(l.contact_role?" ("+l.contact_role+" at "+l.company+")":" at "+l.company)+".\nOraDayForce helps small and mid-size businesses with AI enablement, Oracle Cloud ERP, NetSuite, Oracle E-Business Suite and Google Cloud.\n"+(l.notes?"What we know from our own notes: "+String(l.notes).slice(0,500)+"\n":"We have their contact details but no other background, so keep it general.\n")+"Rules: plain and specific, no hype, no invented facts, numbers, events or client names, one clear ask (a 20-minute call), sign off with "+u.name+". Do not add a footer or an unsubscribe line.\nReply in this exact format:\nSubject: <subject line>\n\n<email body>";
 api("/chat",{projectId:p.id,agentId:ag.id,conversationId:"lead-"+l.id+"-"+Date.now(),message:msg,model:modelOf(S.chat.model).id,userContext:{userId:u.id,role:u.role},attachments:[]})
 .then(function(r){ var t=String(r&&r.message&&r.message.content||"").trim(); if(!t){fallback();return;}
   var m=t.match(/^[ *]*subject[ *]*:[ *]*(.+)$/im), subj=m?m[1].replace(/[*]/g,"").trim():"OraDayForce and "+l.company, body=m?t.slice(t.indexOf(m[0])+m[0].length).trim():t;
   LP.draft={id:l.id,busy:false,to:l.email||"",subject:subj,body:body.replace(/[*][*]/g,"")+"\n\n--\n"+lpFooter()};render(); })
 .catch(function(){fallback();}); };
// ---- Send now ----
function lcMailStatus(force){ if(LC.mailBusy||(LC.mail&&!force))return; LC.mailBusy=true;
 lcApi("leads.mailstatus").then(function(d){LC.mail=d;}).catch(function(e){LC.mail={ready:false,reason:e.message||"Sending status unavailable."};}).then(function(){LC.mailBusy=false;if(LP.draft)render();}); }
var lcBaseDraft=lpDraftHtml;
lpDraftHtml=function(l,d){ var h=lcBaseDraft.apply(this,arguments); if(d.busy)return h;
 lcMailStatus(false);
 var ready=LC.mail&&LC.mail.ready, mailto='<button class="btn btn-s btn-p" data-a="lpmailto" data-v="'+l.id+'">'+ic("send")+'Open in my mail app</button>';
 var send='<button class="btn btn-s '+(ready?"btn-p":"btn-g")+'" data-a="lcsend" data-v="'+l.id+'"'+(!ready||LC.sending?" disabled":"")+' title="'+attr(ready?"Send it now from "+LC.mail.from:"Not switched on yet")+'">'+ic("mail")+(LC.sending?"Sending…":"Send now")+'</button>';
 h=h.replace(mailto,send+(ready?mailto.replace("btn-p","btn-g"):mailto));
 var note=!LC.mail?'<div class="lc-from">'+ic("sync","spin")+' Checking whether WorkPlace can send for you…</div>':ready?'<div class="lc-from">Send now sends it from your mailbox, '+esc(LC.mail.from)+', saves it in your Sent Items and logs it on this lead. Replies come to you.</div>':'<div class="lc-from warn">'+esc(LC.mail.reason||"Sending from WorkPlace is not switched on yet.")+'</div>';
 h=h.replace('<span class="meta">Review before sending. It opens in your own mail app, so replies come straight to you.</span>','<span class="meta">Review before sending. Replies come straight to you.</span>');
 return /<\/div>$/.test(h)?h.slice(0,-6)+note+'</div>':h+note; };
function lcSend(l){ lpReadDraft(); var d=LP.draft; if(!d||LC.sending)return;
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.to||"")){toast("Add an email address","Type it in the To box","err");return;}
 if(!String(d.subject||"").trim()||String(d.body||"").trim().length<10){toast("Not ready","Add a subject and a message","err");return;}
 if(!confirm("Send this email to "+d.to+" from "+((LC.mail&&LC.mail.from)||"your mailbox")+"?\n\nSubject: "+d.subject))return;
 LC.sending=true; render();
 lcApi("leads.send",{id:l.id,to:d.to,subject:d.subject,body:d.body}).then(function(r){ LC.sending=false; var ld=r.lead||{};
   if(ld.status)l.status=ld.status; if(ld.owner)l.owner=ld.owner; if(!l.email)l.email=d.to;
   l.last_act={kind:"email",outcome:"Sent from WorkPlace to "+d.to,at:new Date().toISOString(),by_name:S.data.user.name}; LP.draft=null; delete LP.act[l.id];
   toast("Email sent","To "+d.to+(ld.status?" · "+l.company+" is in "+lpStageName(l.status):""),"ok"); render(); })
 .catch(function(e){ LC.sending=false; if(e.code==="MAIL_NOT_READY"){LC.mail={ready:false,reason:e.message};} toast("Not sent",e.message,"err"); render(); }); }
// ---- actions ----
var lcBasePipeAct=pipeAct;
pipeAct=function(a,v){
 if(String(a).indexOf("lc")!==0)return lcBasePipeAct.apply(this,arguments);
 if(a==="lcopen"){LC.open=!LC.open;if(LC.open&&!LC.form)LC.form={};render();if(LC.open)setTimeout(function(){var i=document.getElementById("lc_paste");if(i&&!LC.form.contact_name)i.focus();},60);return true;}
 if(a==="lcclose"){LC.open=false;render();return true;}
 if(a==="lcfill"){var got=lcParse(LC.form.paste||"");var n=0;Object.keys(got).forEach(function(k){if(got[k]){LC.form[k]=got[k];n++;}});render();toast(n?"Filled in":"Nothing found",n?"Check the details, then press Add to pipeline":"Paste text that has an email or phone number",n?"ok":"err");return true;}
 if(a==="lcsave"){ var f=LC.form||{}; if(!(f.contact_name||f.company)||!(f.email||f.phone)){toast("Not enough to add","Add a name or company, and an email or phone number","err");return true;}
  LC.busy=true;render();
  lcAdd(f,"").then(function(d){LC.busy=false;LC.open=false;LC.form={};toast(d.duplicate?"Already in the pipeline":"Contact added",d.duplicate?"Their details were added to the existing lead":(f.contact_name||f.company),"ok");render();})
   .catch(function(e){LC.busy=false;toast("Not added",e.message,"err");render();}); return true; }
 if(a==="lcsend"){var l=lpById(v);if(l)lcSend(l);return true;}
 return false; };
document.addEventListener("input",function(e){var k=e.target&&e.target.getAttribute&&e.target.getAttribute("data-lc");if(k){LC.form=LC.form||{};LC.form[k]=e.target.value;}},true);
document.addEventListener("change",function(e){var k=e.target&&e.target.getAttribute&&e.target.getAttribute("data-lc");if(k){LC.form=LC.form||{};LC.form[k]=e.target.value;}},true);
// ---- My Buddy: "add contact …" or pasted details, and "email Jane" ----
function lcFind(q){ q=String(q||"").toLowerCase().trim(); if(!q)return null;
 var items=LP.items||[], by=function(f){return items.filter(f)[0];};
 return by(function(l){return l.email&&l.email.toLowerCase()===q;})||by(function(l){return l.contact_name&&l.contact_name.toLowerCase()===q;})||by(function(l){return String(l.company||"").toLowerCase()===q;})
  ||by(function(l){return l.contact_name&&l.contact_name.toLowerCase().split(" ")[0]===q;})||by(function(l){return q.length>=3&&(String(l.contact_name||"").toLowerCase().indexOf(q)>=0||String(l.company||"").toLowerCase().indexOf(q)>=0);})||null; }
function lcEmailLead(l){ LP.stage=l.status==="dismissed"?"new":l.status;LP.fit="";LP.more=true;LP.open=null;LP.call=null; go("#/pipeline"); LC.focus=l.id; setTimeout(function(){lpGen(l);},120); if(window.innerWidth<760)setTimeout(function(){bdToggle(false);},700); }
var lcBaseBdRun=bdRun;
bdRun=function(text){
 var raw=String(text||"").replace(/\s+/g," ").trim(), low=raw.toLowerCase();
 var em=/(?:^|\s)(?:email|e-mail|mail|write to|send (?:an )?email to|draft (?:an )?email (?:to|for))\s+(.+)$/i.exec(raw);
 if(em&&!/^(?:address|addresses)\b/i.test(em[1])){ if(!bdCan("pipeline"))return {reply:"You don't have access to the Pipeline yet. Ask an administrator."};
  var who=em[1].replace(/[.?!]+$/,"").replace(/^(?:to|the|lead)\s+/i,"").trim(), lead=lcFind(who);
  if(!lead&&!LP.loaded){lpLoad();return {reply:"Loading the Pipeline. Ask me again in a moment: “email "+who+"”."};}
  if(lead){ if(!lead.email)return {reply:lead.company+" has no email address yet. Add one under Details on the lead, or tell me “add "+(lead.contact_name||"name")+" their@email.com”."};
   lcEmailLead(lead); return {reply:"Drafting an email to "+(lead.contact_name||lead.company)+" ("+lead.email+") in the Pipeline. Check it, then press Send now or Open in my mail app."}; }
  var pe=lcParse(who); if(pe.email){BD.lc=pe;return {reply:"I couldn't find "+pe.email+" in the Pipeline. Add them first?",btns:[["lc:add","Add to pipeline"],["lc:edit","Edit first"]]};}
  return {reply:"I couldn't find “"+who+"” in the Pipeline. Try their email address, or add them first."}; }
 var addish=/^(?:please\s+)?(?:add|save|create|new|put)\b.*\b(?:contact|lead|prospect|person)\b/i.test(raw);
 var parsed=lcParse(raw);
 var implicit=!!(parsed.email||String(parsed.phone||"").replace(/\D/g,"").length>=10);
 if((addish||implicit)&&!/\b(user|member|resume|cv|project|agent|document)s?\b/i.test(raw)){
  if(!bdCan("pipeline"))return {reply:"You don't have access to the Pipeline yet. Ask an administrator."};
  if(!lcHasContact(parsed)){ if(parsed.contact_name||parsed.company){BD.lc=parsed;} LC.open=true;LC.form=Object.assign({},parsed);go("#/pipeline");
   return {reply:parsed.contact_name||parsed.company?"Opening Add contact in the Pipeline with what you gave me. Add their email or phone number there.":"Opening Add contact in the Pipeline. Fill it in there, or paste their details here and I'll fill it in."}; }
  BD.lc=parsed;
  return {reply:"Add this contact to the Pipeline?\n"+lcSummary(parsed),btns:[["lc:add","Add to pipeline"],["lc:edit","Edit first"],["lc:no","Cancel"]]}; }
 if(/^(?:add|new)\s+(?:a\s+)?(?:contact|lead)s?$/i.test(low)){LC.open=true;go("#/pipeline");return {reply:"Opening Add contact in the Pipeline. You can also paste their details here and I'll fill it in."};}
 return lcBaseBdRun.apply(this,arguments); };
var lcBaseChips=bdChips;
bdChips=function(){ var c=lcBaseChips.apply(this,arguments); if(bdCan("pipeline")&&!c.some(function(x){return x[0]==="Add a contact";})){var i=-1;c.forEach(function(x,k){if(x[0]==="Open pipeline")i=k;});c.splice(i>=0?i+1:c.length,0,["Add a contact","plus"]);} return c.slice(0,10); };
function lcBuddyClick(e){ var el=e.target.closest&&e.target.closest('[data-bd="btn"]'); if(!el)return; var v=el.getAttribute("data-v")||""; if(v.indexOf("lc:")!==0)return;
 e.stopPropagation(); e.preventDefault(); var o=BD.lc;
 var mm=/^lc:(mail|open):(\d+)$/.exec(v);
 if(mm){ var id=mm[2], tries=0; go("#/pipeline");
  (function wait(){ var l=lpById(id); if(l){ if(mm[1]==="mail")lcEmailLead(l); else {LP.stage=l.status;LP.more=true;LC.focus=l.id;render();} return; } if(++tries<20)setTimeout(wait,250); })();
  bdSay(mm[1]==="mail"?"Drafting the email in the Pipeline. Check it, then press Send now or Open in my mail app.":"Here it is in the Pipeline."); return; }
 if(v==="lc:no"){BD.lc=null;bdSay("OK, nothing was added.");return;}
 if(!o){bdSay("Tell me their details again, for example “add Jane Doe jane@acme.com 214 555 0199”.");return;}
 if(v==="lc:edit"){LC.open=true;LC.form=Object.assign({},o);BD.lc=null;go("#/pipeline");bdSay("It's in Add contact on the Pipeline. Check it and press Add to pipeline.");if(window.innerWidth<760)setTimeout(function(){bdToggle(false);},700);return;}
 if(v==="lc:add"){ BD.lc=null; bdSay("Adding "+(o.contact_name||o.company||o.email)+"…");
  lcAdd(o,"buddy").then(function(d){ var l={id:d.id}; BD.lastLead=d.id;
    bdSay((d.duplicate?"They were already in the Pipeline, so I added the new details to that lead.":"Added "+(o.contact_name||o.company)+" to the Pipeline.")+(o.email?" Want to email them now?":""),{btns:o.email?[["lc:mail:"+d.id,"Draft an email"],["lc:open:"+d.id,"Show in Pipeline"]]:[["lc:open:"+d.id,"Show in Pipeline"]]}); })
   .catch(function(e){ bdSay("I couldn't add them: "+e.message); }); return; } }
var lcBasePaint=bdPaint;
bdPaint=function(){ var r=lcBasePaint.apply(this,arguments); var p=document.getElementById("bd-panel");
 if(p&&!p.getAttribute("data-lc")){p.setAttribute("data-lc","1");p.addEventListener("click",lcBuddyClick,true);var n=p.querySelector(".bd-note");if(n)n.textContent="My Buddy moves you around WorkPlace and adds contacts after you confirm. It never deletes or sends anything on its own.";
  var i=p.querySelector("#bd-in");if(i)i.placeholder="Where to, or paste a contact to add";}
 return r; };
/* ---- end leadcontacts ---- */
