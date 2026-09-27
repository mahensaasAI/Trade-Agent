WITH k AS (SELECT ys_net_key(nullif($7, '')) AS net),
tidy AS (UPDATE ys_interest SET net_key = NULL WHERE net_key IS NOT NULL AND created_at < now() - interval '2 days' RETURNING 1),
st AS (SELECT
  (SELECT count(*) FROM ys_interest i, k WHERE k.net IS NOT NULL AND i.net_key = k.net AND i.created_at > now() - interval '1 day') AS by_net,
  (SELECT count(*) FROM ys_interest WHERE created_at > now() - interval '1 day') AS total,
  EXISTS (SELECT 1 FROM ys_interest WHERE email = $2 AND created_at > now() - interval '1 hour') AS dup),
ins AS (INSERT INTO ys_interest (name, email, role, grade, track, message, guest_id, net_key)
  SELECT $1, $2, $3, nullif($4, ''), nullif($9, ''), nullif($5, ''), nullif($6, ''), k.net FROM k, st
  WHERE st.by_net < 5 AND st.total < 300 AND NOT st.dup RETURNING id),
nt AS (INSERT INTO ys_notifications (recipient_id, recipient_email, kind, title, body, link, actor_name, created_at)
  SELECT u.id, u.email, 'interest', 'Wants to join the Y Square ecosystem', $8, '#/startups', $1, now()
  FROM ins, ys_users u WHERE u.role = 'admin' AND u.active RETURNING 1)
SELECT (SELECT count(*) FROM ins) AS saved, (SELECT count(*) FROM nt) AS notified, st.by_net, st.total, st.dup FROM st
