-- Node: Load Chat Models (Postgres) - runs between the chat webhook and Build Agent Context.
-- One row, one column `d`, holding the organisation's plan and the enabled model catalogue.
-- Build Agent Context uses `plan` to decide which of these the caller is allowed to reach.
SELECT jsonb_build_object(
  'plan', (SELECT lower(o.plan) FROM wp_organizations o ORDER BY o.created_at LIMIT 1),
  'models', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'name', m.label, 'provider', m.provider, 'modelId', m.model_id, 'tier', m.tier
    ) ORDER BY m.sort), '[]'::jsonb)
    FROM wp_models m WHERE m.enabled)
) AS d
