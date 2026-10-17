// Node: Format Admin Reply (Code) - returns the whole roster after every action, so the page never
// has to guess what changed. The roster is re-read by its own node rather than in a CTE alongside
// the update, because a data-modifying CTE is not visible to the rest of the same statement.
var plan=$('Plan Admin Action').first().json||{};
var rid="req-"+Date.now().toString(36);
if(plan.denied)return [{json:{success:false,requestId:rid,error:{code:plan.code,message:plan.message}}}];
var applied=[];
try{applied=$('Apply Admin Action').all().map(function(i){return i.json||{};});}catch(e){}
if(plan.action!=="list"&&!(applied.length&&applied[0].id))
 return [{json:{success:false,requestId:rid,
  error:{code:"REQUEST_NOT_FOUND",message:"That request no longer exists - it may already have been handled."}}}];
var users=($input.first().json||{}).d;
if(!Array.isArray(users))users=[];
var pending=users.filter(function(u){return u.status==="pending";});
var changed=(plan.action==="list")?null:applied[0];
return [{json:{success:true,requestId:rid,data:{
 action:plan.action,changed:changed,users:users,
 pending:pending.length,
 counts:{pending:pending.length,
  active:users.filter(function(u){return u.status==="active";}).length,
  rejected:users.filter(function(u){return u.status==="rejected";}).length}}}}];
