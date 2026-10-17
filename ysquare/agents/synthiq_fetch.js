// Node: Fetch Papers (Code) — retrieves live records from the sources the person selected: Europe PMC for
// PubMed/MEDLINE, PubMed Central, Cochrane reviews and preprints; the ClinicalTrials.gov API for registered
// trials; Crossref for wider journals. Nothing is invented here - only what comes back may be cited.
var pc=$('Prepare Search').first().json||{};
var row=($input.first()||{}).json||{};
var ctxData=row.d||{};
if(pc.denied||pc.blocked)return [{json:{d:ctxData,papers:[],retrieval:{sources:[],keys:[],errors:[],query:"",helper:true}}}];
var se=pc.search||{};
var picked=(Array.isArray(se.sources)&&se.sources.length)?se.sources:["pubmed","pmc"];
var per=Math.max(3,Math.min(8,Number(se.perSource)||5));
var q=String(pc.message||"").replace(/[\r\n]+/g," ").replace(/["\\()\[\]:]/g," ").replace(/\s+/g," ").trim().slice(0,240);
var nowY=new Date().getUTCFullYear();
var fromY=se.years==="5"?nowY-4:(se.years==="10"?nowY-9:0);
var UA="YSquareSynthIQ/1.0 (Y Square Workplace research agent)";
var HR=null;try{HR=this.helpers.httpRequest.bind(this.helpers);}catch(e){HR=null;}
function getJson(url){
 if(!HR)return Promise.reject(new Error("retrieval unavailable"));
 return HR({method:"GET",url:url,json:true,timeout:12000,headers:{Accept:"application/json","User-Agent":UA}});
}
function epmcQuery(srcClause,extra){
 var parts=["("+q+")"];
 if(srcClause)parts.push(srcClause);
 if(extra)parts.push(extra);
 if(fromY)parts.push("(FIRST_PDATE:["+fromY+"-01-01 TO "+nowY+"-12-31])");
 if(se.openAccess)parts.push("(OPEN_ACCESS:Y)");
 if(se.types==="evidence")parts.push('(PUB_TYPE:"Review" OR PUB_TYPE:"Meta-Analysis" OR PUB_TYPE:"Randomized Controlled Trial" OR PUB_TYPE:"systematic-review")');
 return parts.join(" AND ");
}
function epmcUrl(query){return "https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize="+per+"&query="+encodeURIComponent(query);}
function fromEpmc(data,label){
 var out=[];var arr=(((data||{}).resultList)||{}).result||[];
 arr.forEach(function(r){
  var pmid=String(r.pmid||"");var pmcid=String(r.pmcid||"");var doi=String(r.doi||"");
  var url=pmid?("https://pubmed.ncbi.nlm.nih.gov/"+pmid+"/"):(pmcid?("https://europepmc.org/article/PMC/"+pmcid):(doi?("https://doi.org/"+doi):("https://europepmc.org/article/"+(r.source||"MED")+"/"+(r.id||""))));
  var pt=((r.pubTypeList||{}).pubType)||[];if(!Array.isArray(pt))pt=[pt];
  var types=[];pt.forEach(function(x){if(x&&String(x).toLowerCase()!=="journal article")types.push(String(x));});
  out.push({src:label,title:String(r.title||"").replace(/<[^>]+>/g,"").trim(),authors:String(r.authorString||"").slice(0,220),journal:String((((r.journalInfo||{}).journal)||{}).title||r.journalTitle||"").slice(0,120),year:String(r.pubYear||""),types:types.slice(0,3).join(", "),abstract:String(r.abstractText||"").replace(/<[^>]+>/g," "),doi:doi,pmid:pmid,url:url,oa:r.isOpenAccess==="Y",cites:Number(r.citedByCount||0),registry:"",conditions:""});
 });
 return out;
}
function fromTrials(data){
 var out=[];var arr=((data||{}).studies)||[];
 arr.forEach(function(s){
  var p=s.protocolSection||{};var idm=p.identificationModule||{};var st=p.statusModule||{};var dm=p.designModule||{};var cm=p.conditionsModule||{};var de=p.descriptionModule||{};
  var nct=String(idm.nctId||"");
  var phases=[].concat(dm.phases||[]).filter(Boolean);
  out.push({src:"ClinicalTrials.gov",title:String(idm.briefTitle||idm.officialTitle||"").trim(),authors:String((((p.sponsorCollaboratorsModule||{}).leadSponsor)||{}).name||"").slice(0,160),journal:"ClinicalTrials.gov registry",year:String((st.startDateStruct||{}).date||"").slice(0,4),types:[String(st.overallStatus||"")].concat(phases).filter(Boolean).join(", "),abstract:String(de.briefSummary||"").replace(/\s+/g," "),doi:"",pmid:"",url:nct?("https://clinicaltrials.gov/study/"+nct):"https://clinicaltrials.gov/",oa:true,cites:0,registry:nct,conditions:[].concat(cm.conditions||[]).slice(0,6).join(", ")});
 });
 return out;
}
function fromCrossref(data){
 var out=[];var arr=(((data||{}).message)||{}).items||[];
 arr.forEach(function(w){
  var title=[].concat(w.title||[])[0]||"";var doi=String(w.DOI||"");var yr="";
  try{yr=String((([].concat((w.issued||{})["date-parts"]||[])[0])||[])[0]||"");}catch(e){yr="";}
  var au=[].concat(w.author||[]).slice(0,6).map(function(a){return [a.given,a.family].filter(Boolean).join(" ");}).filter(Boolean).join(", ");
  out.push({src:"Crossref",title:String(title).replace(/<[^>]+>/g,"").trim(),authors:au,journal:String([].concat(w["container-title"]||[])[0]||"").slice(0,120),year:yr,types:String(w.type||"").replace(/-/g," "),abstract:String(w.abstract||"").replace(/<[^>]+>/g," "),doi:doi,pmid:"",url:doi?("https://doi.org/"+doi):String(w.URL||""),oa:false,cites:0,registry:"",conditions:""});
 });
 return out;
}
var LABEL={pubmed:"PubMed / MEDLINE",pmc:"PubMed Central",cochrane:"Cochrane Reviews",trials:"ClinicalTrials.gov",preprints:"Preprints (medRxiv, bioRxiv)",crossref:"Crossref journals"};
function job(key){
 if(key==="pubmed")return getJson(epmcUrl(epmcQuery("(SRC:MED)",""))).then(function(d){return fromEpmc(d,LABEL.pubmed);});
 if(key==="pmc")return getJson(epmcUrl(epmcQuery("(SRC:PMC)",""))).then(function(d){return fromEpmc(d,LABEL.pmc);});
 if(key==="preprints")return getJson(epmcUrl(epmcQuery("(SRC:PPR)",""))).then(function(d){return fromEpmc(d,LABEL.preprints);});
 if(key==="cochrane")return getJson(epmcUrl(epmcQuery("(SRC:MED)",'(JOURNAL:"Cochrane Database Syst Rev" OR JOURNAL:"Cochrane Database of Systematic Reviews")'))).then(function(d){return fromEpmc(d,LABEL.cochrane);});
 if(key==="trials")return getJson("https://clinicaltrials.gov/api/v2/studies?format=json&pageSize="+per+"&query.term="+encodeURIComponent(q)).then(fromTrials);
 if(key==="crossref")return getJson("https://api.crossref.org/works?rows="+per+"&select=DOI,title,author,issued,container-title,abstract,URL,type&query.bibliographic="+encodeURIComponent(q)+(fromY?("&filter=from-pub-date:"+fromY+"-01-01"):"")).then(fromCrossref);
 return Promise.resolve([]);
}
var errors=[];
var lists=await Promise.all(picked.map(function(k){
 return job(k).then(function(v){return Array.isArray(v)?v:[];},function(e){errors.push(LABEL[k]+" ("+String((e&&e.message)||e).slice(0,90)+")");return [];});
}));
// Interleave so every source the person picked gets a place, then drop duplicates by doi / pmid / registry / title.
var papers=[],seen={},round=0,more=true;
while(more&&papers.length<14&&round<24){
 more=false;
 for(var i=0;i<lists.length;i++){
  var p=lists[i][round];
  if(!p||!p.title)continue;
  more=true;
  var key=String(p.doi||p.pmid||p.registry||p.title).toLowerCase().replace(/\s+/g," ").trim();
  if(!key||seen[key])continue;
  seen[key]=true;papers.push(p);
  if(papers.length>=14)break;
 }
 round++;
}
return [{json:{d:ctxData,papers:papers,retrieval:{sources:picked.map(function(k){return LABEL[k]||k;}),keys:picked,errors:errors,query:q,years:se.years,openAccess:!!se.openAccess,types:se.types,helper:!!HR}}}];
