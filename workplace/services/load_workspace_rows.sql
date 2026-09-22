SELECT jsonb_build_object(
 'organization',(SELECT jsonb_build_object('id',o.id,'name',o.name,'domain',o.domain,'plan',o.plan,'planExpiresAt',o.plan_expires_at) FROM wp_organizations o ORDER BY o.created_at LIMIT 1),
 'models',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.label,'desc',m.model_id,'tier',m.tier) ORDER BY m.sort),'[]'::jsonb) FROM wp_models m WHERE m.enabled),
 'projects',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.name,'client',p.client,'initials',p.initials,'color',p.color,'description',p.description,
    'status',p.status,'manager',p.manager,'partner',p.partner,'team',p.team,'progress',p.progress,'modules',p.modules,
    'startedAt',p.started_at,'goLive',p.go_live,'lastActivity',p.last_activity,
    'agentIds',(SELECT coalesce(jsonb_agg(pa.agent_id ORDER BY pa.agent_id),'[]'::jsonb) FROM wp_project_agents pa WHERE pa.project_id=p.id),
    'docCount',(SELECT count(*) FROM wp_documents wd WHERE wd.project_id=p.id)
   ) ORDER BY p.last_activity DESC NULLS LAST),'[]'::jsonb) FROM wp_projects p),
 'agents',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'name',g.name,'title',g.title,'type',g.type,'icon',g.icon,'color',g.color,'status',g.status,
    'description',g.description,'purpose',g.purpose,'capabilities',g.capabilities,'starters',g.starters,
    'owner',g.owner,'conversations',g.conversations,'lastActive',g.last_active,
    'projectIds',(SELECT coalesce(jsonb_agg(pa.project_id ORDER BY pa.project_id),'[]'::jsonb) FROM wp_project_agents pa WHERE pa.agent_id=g.id),
    'knowledgeSources',(SELECT count(*) FROM wp_document_chunks c WHERE c.project_id IN (SELECT pa2.project_id FROM wp_project_agents pa2 WHERE pa2.agent_id=g.id))
   ) ORDER BY g.name),'[]'::jsonb) FROM wp_agents g),
 'documents',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',wd.id,'name',wd.name,'projectId',wd.project_id,'mime',wd.mime,'size',wd.size,'status',wd.status,
    'storagePath',wd.storage_path,'pages',wd.pages,'chunks',wd.chunks,'error',wd.error,
    'uploadedBy',wd.uploaded_by,'uploadedAt',wd.created_at,'indexedAt',wd.indexed_at
   ) ORDER BY wd.created_at DESC),'[]'::jsonb) FROM wp_documents wd),
 'activity',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'actor',v.actor,'action',v.action,'target',v.target,'icon',coalesce(v.icon,'act'),'at',v.at,'projectId',v.project_id
   ) ORDER BY v.at DESC),'[]'::jsonb) FROM (SELECT * FROM wp_activity ORDER BY at DESC LIMIT 40) v),
 'kpis',jsonb_build_object(
    'activeProjects',(SELECT count(*) FROM wp_projects WHERE status IN ('active','planning')),
    'documents',(SELECT count(*) FROM wp_documents),
    'agents',(SELECT count(*) FROM wp_agents WHERE status='active'),
    'conversations',(SELECT count(*) FROM wp_conversations))
) AS d
