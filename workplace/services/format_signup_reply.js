// Node: Format Signup Reply (Code) - one response shape for all three outcomes: rejected by
// validation, refused because the address is already known, or accepted and now awaiting approval.
var prep=$('Prepare Signup').first().json||{};
var rid="req-"+Date.now().toString(36);
if(prep.invalid)return [{json:{success:false,requestId:rid,error:{code:prep.code,message:prep.message}}}];
var row=$input.first().json||{};
if(row.error)return [{json:{success:false,requestId:rid,
 error:{code:"SIGNUP_UNAVAILABLE",message:"The request could not be recorded. Please try again shortly."}}}];
if(Number(row.created||0)<1){
 var st=String(row.existing_status||"");
 var msg=(st==="pending")?"A request for this email is already waiting for approval.":
  (st==="rejected")?"A previous request for this email was declined. Contact an administrator.":
  "An account already exists for this email. Try signing in instead.";
 return [{json:{success:false,requestId:rid,error:{code:"ALREADY_REQUESTED",message:msg}}}];
}
return [{json:{success:true,requestId:rid,data:{status:"pending",name:prep.name,email:prep.email,
 message:"Thanks - your request has gone to the administrator. You will be able to sign in once it is approved."}}}];
