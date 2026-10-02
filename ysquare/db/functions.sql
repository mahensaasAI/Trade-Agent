-- Y Square Workplace — Postgres functions used by the Services API. Applied by "Y Square — DB Functions".
-- Statements are separated by a line containing only "-- @@" so the workflow can apply them one by one.

-- Effective plan: premium only while plan_expires_at is in the future (or NULL = no expiry).
CREATE OR REPLACE FUNCTION ys_effective_plan(p_plan text, p_exp timestamptz) RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
SELECT CASE WHEN p_plan='premium' AND (p_exp IS NULL OR p_exp > now()) THEN 'premium' ELSE 'free' END
$fn$;
-- @@
-- Everything the UI needs on load, for a guest id or a user id.
CREATE OR REPLACE FUNCTION ys_bootstrap(p_owner text) RETURNS json LANGUAGE sql STABLE AS $fn$
SELECT json_build_object(
 'models',(SELECT coalesce(json_agg(m ORDER BY m.sort),'[]'::json) FROM (SELECT id,provider,label,model_id,tier,description,sort FROM ys_models WHERE enabled) m),
 'agentSettings',(SELECT coalesce(json_object_agg(agent_id, json_build_object('defaultModel',default_model,'enabled',enabled)),'{}'::json) FROM ys_agent_settings),
 'settings',json_build_object(
   'organization',(SELECT value FROM ys_settings WHERE key='organization'),
   'auth',json_build_object('googleClientId',(SELECT value->>'googleClientId' FROM ys_settings WHERE key='auth')),
   'billing',json_build_object('priceLabel',(SELECT value->>'priceLabel' FROM ys_settings WHERE key='billing'),'configured',(SELECT coalesce(value->>'checkoutUrl','')<>'' FROM ys_settings WHERE key='billing'),'premiumBenefits',(SELECT value->'premiumBenefits' FROM ys_settings WHERE key='billing')),
   'studypals',(SELECT value FROM ys_settings WHERE key='studypals'),
   'limits',(SELECT value FROM ys_settings WHERE key='limits')),
 'profile',(SELECT row_to_json(p) FROM ys_athlete_profiles p WHERE p.owner_id=p_owner),
 'usageToday',(SELECT coalesce(messages,0) FROM ys_usage WHERE owner_id=p_owner AND day=current_date),
 'events',(SELECT coalesce(json_agg(e ORDER BY e.starts_at NULLS LAST),'[]'::json) FROM (
    SELECT ev.id,ev.code,ev.title,ev.type,ev.starts_at,ev.ends_at,ev.venue,ev.status,ev.owner_id,ev.owner_name,ev.expected_guests,
      m.role AS my_role, m.rsvp AS my_rsvp,
      (SELECT count(*) FROM ys_event_members x WHERE x.event_id=ev.id) AS members,
      (SELECT count(*) FROM ys_event_members x WHERE x.event_id=ev.id AND x.rsvp='yes') AS going,
      (SELECT count(*) FROM ys_event_tasks t WHERE t.event_id=ev.id AND t.status<>'done') AS open_tasks,
      (SELECT count(*) FROM ys_event_tasks t WHERE t.event_id=ev.id) AS tasks
    FROM ys_events ev JOIN ys_event_members m ON m.event_id=ev.id AND m.member_id=p_owner) e),
 'counts',json_build_object('models',(SELECT count(*) FROM ys_models WHERE enabled),'knowledge',(SELECT count(*) FROM ys_knowledge),'users',(SELECT count(*) FROM ys_users WHERE active),'events',(SELECT count(*) FROM ys_events))
)
$fn$;
-- @@
-- Full event view: details, people, logistics tasks, information posts and the last 100 chat messages.
CREATE OR REPLACE FUNCTION ys_event_detail(p_event text) RETURNS json LANGUAGE sql STABLE AS $fn$
SELECT json_build_object(
 'event',(SELECT row_to_json(e) FROM ys_events e WHERE e.id=p_event),
 'members',(SELECT coalesce(json_agg(m ORDER BY CASE m.role WHEN 'organizer' THEN 0 WHEN 'helper' THEN 1 ELSE 2 END, m.joined_at),'[]'::json) FROM (SELECT member_id,name,role,rsvp,party_size,contact,joined_at FROM ys_event_members WHERE event_id=p_event) m),
 'tasks',(SELECT coalesce(json_agg(t ORDER BY CASE t.status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END, CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, t.due_at NULLS LAST),'[]'::json) FROM (SELECT id,title,category,assignee,due_at,status,priority,notes,created_by,created_at,updated_at FROM ys_event_tasks WHERE event_id=p_event) t),
 'updates',(SELECT coalesce(json_agg(u ORDER BY u.pinned DESC, u.created_at DESC),'[]'::json) FROM (SELECT id,kind,title,body,pinned,author,created_at FROM ys_event_updates WHERE event_id=p_event) u),
 'messages',(SELECT coalesce(json_agg(x ORDER BY x.created_at),'[]'::json) FROM (SELECT id,author_id,author,body,created_at FROM ys_event_messages WHERE event_id=p_event ORDER BY created_at DESC LIMIT 100) x),
 'stats',json_build_object(
   'members',(SELECT count(*) FROM ys_event_members WHERE event_id=p_event),
   'going',(SELECT coalesce(sum(party_size),0) FROM ys_event_members WHERE event_id=p_event AND rsvp='yes'),
   'maybe',(SELECT count(*) FROM ys_event_members WHERE event_id=p_event AND rsvp='maybe'),
   'pending',(SELECT count(*) FROM ys_event_members WHERE event_id=p_event AND rsvp='pending'),
   'tasks',(SELECT count(*) FROM ys_event_tasks WHERE event_id=p_event),
   'done',(SELECT count(*) FROM ys_event_tasks WHERE event_id=p_event AND status='done'),
   'overdue',(SELECT count(*) FROM ys_event_tasks WHERE event_id=p_event AND status<>'done' AND due_at IS NOT NULL AND due_at < now()),
   'highOpen',(SELECT count(*) FROM ys_event_tasks WHERE event_id=p_event AND status<>'done' AND priority='high'),
   'updates',(SELECT count(*) FROM ys_event_updates WHERE event_id=p_event),
   'messages',(SELECT count(*) FROM ys_event_messages WHERE event_id=p_event),
   'daysToGo',(SELECT extract(day FROM (starts_at - now()))::int FROM ys_events WHERE id=p_event)))
$fn$;
-- @@
-- Admin overview: usage by agent and model, sign-ups and plans.
CREATE OR REPLACE FUNCTION ys_admin_overview() RETURNS json LANGUAGE sql STABLE AS $fn$
SELECT json_build_object(
 'users',(SELECT coalesce(json_agg(u ORDER BY u.created_at DESC),'[]'::json) FROM (SELECT id,name,email,role,plan,plan_expires_at,plan_source,auth_provider,active,created_at,last_login,ys_effective_plan(plan,plan_expires_at) AS effective_plan FROM ys_users) u),
 'kpis',json_build_object('users',(SELECT count(*) FROM ys_users),'premium',(SELECT count(*) FROM ys_users WHERE ys_effective_plan(plan,plan_expires_at)='premium'),'guests7d',(SELECT count(*) FROM ys_guests WHERE last_seen>now()-interval '7 days'),'runs7d',(SELECT count(*) FROM ys_agent_runs WHERE at>now()-interval '7 days'),'events',(SELECT count(*) FROM ys_events),'errors7d',(SELECT count(*) FROM ys_agent_runs WHERE at>now()-interval '7 days' AND status<>'ok')),
 'runsByAgent',(SELECT coalesce(json_agg(x),'[]'::json) FROM (SELECT agent_id,provider,count(*) AS runs,round(avg(duration_ms)) AS avg_ms,count(*) FILTER (WHERE status<>'ok') AS errors FROM ys_agent_runs WHERE at>now()-interval '30 days' GROUP BY agent_id,provider ORDER BY runs DESC) x),
 'runsByDay',(SELECT coalesce(json_agg(x ORDER BY x.day),'[]'::json) FROM (SELECT d::date AS day,(SELECT count(*) FROM ys_agent_runs r WHERE r.at::date=d::date) AS runs,(SELECT count(DISTINCT owner_id) FROM ys_agent_runs r WHERE r.at::date=d::date) AS people FROM generate_series(current_date-13,current_date,interval '1 day') d) x),
 'models',(SELECT coalesce(json_agg(m ORDER BY m.sort),'[]'::json) FROM (SELECT id,provider,label,model_id,tier,description,enabled,sort FROM ys_models) m),
 'settings',(SELECT coalesce(json_object_agg(key,value),'{}'::json) FROM ys_settings),
 'recentRuns',(SELECT coalesce(json_agg(r),'[]'::json) FROM (SELECT agent_id,owner_id,owner_kind,provider,model,status,duration_ms,at FROM ys_agent_runs ORDER BY at DESC LIMIT 25) r),
 'activity',(SELECT coalesce(json_agg(a),'[]'::json) FROM (SELECT actor,actor_type,action,object_type,object_id,target,icon,at FROM ys_activity ORDER BY at DESC LIMIT 25) a))
$fn$;
