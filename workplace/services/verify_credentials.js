// Credentials are checked against wp_users. The hash scheme is unchanged - Hash Password still
// computes SHA-256 of password + ":" + lowercased email - so existing passwords keep working.
function sessions(){var sd=$getWorkflowStaticData('global');if(!sd.sessions)sd.sessions={};return sd.sessions;}
var rid="req-"+Date.now().toString(36);
var login=$('Hash Password').first().json,b=login.body||{};
var email=String(b.email||"").trim().toLowerCase();
var hash=String(login.passwordHash||"").toLowerCase();
if(!email||!hash)return [{json:{success:false,requestId:rid,error:{code:"MISSING_CREDENTIALS",message:"Email and password are required."}}}];
var row=$input.first().json||{};
var ok=row&&row.id&&String(row.password_hash||"").toLowerCase()===hash;
if(!ok)return [{json:{success:false,requestId:rid,error:{code:"INVALID_CREDENTIALS",message:"That email and password combination was not recognised."}}}];
var token="",abc="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
for(var n=0;n<48;n++){token+=abc.charAt(Math.floor(Math.random()*abc.length));}
var ttl=12*3600*1000,store=sessions();
store[token]={id:row.id,email:row.email,name:row.name,role:row.role,initials:row.initials,
 isAdmin:!!row.is_admin,organizationId:row.organization_id,exp:Date.now()+ttl};
Object.keys(store).forEach(function(k){if(Date.now()>store[k].exp)delete store[k];});
return [{json:{success:true,requestId:rid,data:{token:token,expiresIn:ttl,
 user:{id:row.id,name:row.name,email:row.email,role:row.role,initials:row.initials,isAdmin:!!row.is_admin}}}}];
