-- Node: Create Pending User (Postgres). Inserts the request only if the address is unknown, and
-- reports back both whether it inserted and what the existing account's state is, so the reply can
-- tell "already waiting" apart from "already a member". The NOT EXISTS guard and the unique index
-- on lower(email) cover the same ground; the index is what makes it safe under a race.
WITH ins AS (
  INSERT INTO wp_users (id, organization_id, name, email, role, initials, password_hash,
                        is_admin, status, requested_at, note)
  SELECT $1, (SELECT o.id FROM wp_organizations o ORDER BY o.created_at LIMIT 1),
         $2, $3, $4, $5, $6, false, 'pending', now(), NULLIF($7, '')
  WHERE NOT EXISTS (SELECT 1 FROM wp_users u WHERE lower(u.email) = $3)
  RETURNING id
)
SELECT (SELECT count(*) FROM ins)::int AS created,
       (SELECT u.status FROM wp_users u WHERE lower(u.email) = $3 LIMIT 1) AS existing_status
