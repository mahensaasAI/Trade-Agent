-- Node: Read User Roster (Postgres). The whole roster, pending first, returned after every admin
-- action so the page re-renders from the database rather than from its own guess about the change.
SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'name', u.name, 'email', u.email, 'role', u.role, 'initials', u.initials,
    'status', u.status, 'isAdmin', u.is_admin, 'note', u.note, 'reason', u.reason,
    'requestedAt', u.requested_at, 'approvedBy', u.approved_by, 'approvedAt', u.approved_at
  ) ORDER BY (u.status = 'pending') DESC, u.requested_at DESC NULLS LAST), '[]'::jsonb) AS d
FROM wp_users u
