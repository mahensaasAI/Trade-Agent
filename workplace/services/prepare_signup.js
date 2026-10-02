// Node: Prepare Signup (Code) - validates and normalises a request for access before anything
// touches the database. The email is lowercased here so the hash the Crypto node computes matches
// the one the sign-in path computes, and so the unique index on lower(email) behaves predictably.
function bad(code,message){return [{json:{invalid:true,code:code,message:message}}];}
var b=($input.first().json||{}).body||{};
var name=String(b.name||"").trim().replace(/\s+/g," ");
var email=String(b.email||"").trim().toLowerCase();
var password=String(b.password||"");
var role=String(b.role||"").trim().replace(/\s+/g," ");
var note=String(b.note||"").trim().slice(0,400);
if(name.length<2)return bad("INVALID_NAME","Enter your full name.");
if(name.length>90)return bad("INVALID_NAME","That name is too long.");
if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||email.length>160)return bad("INVALID_EMAIL","Enter a valid work email address.");
if(password.length<10)return bad("WEAK_PASSWORD","Choose a password of at least 10 characters.");
if(password.length>200)return bad("WEAK_PASSWORD","That password is too long.");
var parts=name.split(" ");
var initials=(parts[0].charAt(0)+(parts.length>1?parts[parts.length-1].charAt(0):"")).toUpperCase();
var slug=email.split("@")[0].replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,32);
return [{json:{invalid:false,
 id:"user-"+(slug||"member")+"-"+Date.now().toString(36).slice(-5),
 name:name,email:email,password:password,
 role:(role||"Awaiting role").slice(0,80),
 initials:initials||"?",note:note}}];
