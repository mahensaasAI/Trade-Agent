# Putting Y Square on ysquareai.com

The app already runs on the GCP VM behind nginx. Production is the same VM, the same n8n and the
same CloudSQL database as non-prod - only the hostname is new. Work through the steps in order;
nothing here changes what `https://n8n-neonai.duckdns.org/webhook/Y2Workplace` serves.

Values used below:

| | |
| --- | --- |
| VM external IP | `104.198.204.161` |
| n8n upstream | `127.0.0.1:5678` (confirm in step 3) |
| Route 53 hosted zone | `ysquareai.com`, already delegated |

## 1. Pin the VM's IP in GCP

The address is ephemeral today, so it can change if the VM stops. Promote it to a static
reservation *before* pointing DNS at it. In the region the VM runs in:

```bash
gcloud compute instances list                      # note the VM's zone, e.g. us-central1-a
gcloud compute addresses create ysquare-prod-ip \
  --addresses 104.198.204.161 \
  --region us-central1                             # the zone minus its trailing letter
gcloud compute addresses describe ysquare-prod-ip --region us-central1
```

Console equivalent: **VPC network > IP addresses**, find the external IP on the row for the VM, and
click **Reserve**. The IP does not change and there is no downtime.

Check that ports 80 and 443 are open. 443 already is, or the duckdns URL would not work, but 80 is
needed for the certificate in step 4:

```bash
gcloud compute firewall-rules list --filter="allowed[].ports:(80 OR 443)"
```

## 2. Point ysquareai.com at it in Route 53

The domain is registered in Route 53 and the hosted zone is already delegated, so only the records
are missing. Get the zone id, then add an A record for the apex and one for `www`:

```bash
aws route53 list-hosted-zones-by-name --dns-name ysquareai.com \
  --query "HostedZones[0].Id" --output text        # e.g. /hostedzone/Z0123456789ABCDEFGHIJ

cat > /tmp/ysquare-dns.json <<'JSON'
{
  "Comment": "Point ysquareai.com at the Y Square VM",
  "Changes": [
    { "Action": "UPSERT", "ResourceRecordSet": {
        "Name": "ysquareai.com", "Type": "A", "TTL": 300,
        "ResourceRecords": [{ "Value": "104.198.204.161" }] } },
    { "Action": "UPSERT", "ResourceRecordSet": {
        "Name": "www.ysquareai.com", "Type": "A", "TTL": 300,
        "ResourceRecords": [{ "Value": "104.198.204.161" }] } }
  ]
}
JSON

aws route53 change-resource-record-sets \
  --hosted-zone-id Z0123456789ABCDEFGHIJ \
  --change-batch file:///tmp/ysquare-dns.json
```

Console equivalent: **Route 53 > Hosted zones > ysquareai.com > Create record**, simple routing,
record type A, value `104.198.204.161`, TTL 300. Repeat with record name `www`.

Keep the TTL at 300 until the cutover is finished, then raise it to 3600.

Optionally restrict who may issue certificates for the domain:

```
ysquareai.com.  CAA  0 issue "letsencrypt.org"
```

Wait for the record to propagate before continuing - the certificate in step 4 depends on it:

```bash
dig +short ysquareai.com @8.8.8.8            # expect 104.198.204.161
dig +short www.ysquareai.com @8.8.8.8
```

## 3. Add the nginx server block on the VM

First confirm where the existing duckdns block proxies to, so the new block uses the same upstream:

```bash
sudo nginx -T | grep -n 'server_name\|proxy_pass'
```

If n8n is not on `127.0.0.1:5678`, edit the `upstream ysquare_n8n` block in
[`nginx/ysquareai.com.conf`](nginx/ysquareai.com.conf) to match. Then install it:

```bash
sudo cp nginx/ysquareai.com.conf /etc/nginx/sites-available/ysquareai.com
sudo ln -s /etc/nginx/sites-available/ysquareai.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

What the block does, and why:

| Location | Proxied to | Why |
| --- | --- | --- |
| `= /` | `/webhook/Y2Workplace` | the app; it is a hash router, so every screen is served from `/` |
| `/svc/` | `/webhook/Y2Workplace/svc/` | services API, agent chat, SynthIQ |
| `/studypals/` | `/webhook/studypals/` | StudyPals tutor, library and uploads |
| `= /billing/stripe` | `/webhook/Y2Workplace/billing/stripe` | Stripe webhook |
| `^~ /.well-known/acme-challenge/` | served from disk | certificate renewal |
| everything else | `404` | keeps the n8n editor and its `/rest` API off the production hostname |

The block sets `Host` and `X-Forwarded-Host` to `$host`. That is the whole mechanism behind the
production/non-prod split: the UI workflow's **Pick Page** node reads those headers, and
`ysquareai.com` selects the `ysquare` row while every other host selects `ysquare-next`.

Test over plain HTTP before adding TLS:

```bash
curl -sI http://ysquareai.com/ | head -3          # expect 200 and text/html
curl -sI http://ysquareai.com/rest/login | head -1 # expect 404
```

## 4. Issue the certificate

```bash
sudo certbot --nginx -d ysquareai.com -d www.ysquareai.com
sudo systemctl status certbot.timer                # renewal is already scheduled on Ubuntu
```

Certbot rewrites the file in place: it adds a `listen 443 ssl` block, the certificate paths and an
HTTP-to-HTTPS redirect. Everything else in the block is preserved. Add HSTS afterwards if you want
it, once you are sure HTTPS works:

```
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## 5. Keep non-prod out of search results

Add this to the duckdns server block so the staging copy is not indexed, then reload nginx:

```
add_header X-Robots-Tag "noindex, nofollow" always;
```

## 6. Google sign-in

The page loads Google Identity Services, which refuses to run on an unregistered origin. In the
Google Cloud console, under **APIs & Services > Credentials**, open the OAuth 2.0 client and add to
**Authorised JavaScript origins**:

```
https://ysquareai.com
https://www.ysquareai.com
```

Leave the duckdns origin in place so non-prod keeps working.

## 7. Promote the page to production

Until now `ysquareai.com` has been serving the `ysquare` row, which is the page as it was before
the domain work. Publish the current staging page to it:

1. run **Y Square - Promote UI to Production** in n8n;
2. it copies `ysquare-next` onto `ysquare` and saves the outgoing page to `ysquare-prev`;
3. compare the md5 it reports with the local snapshot:

```bash
md5sum dist/live/ysquare.html
curl -s https://ysquareai.com/ | md5sum
```

Both must match. If anything is wrong, run **Y Square - Roll Back UI** and production returns to
the previous page immediately.

## Verifying the cutover

```bash
# production serves the app over TLS
curl -sI https://ysquareai.com/ | head -3

# the API answers on the production hostname
curl -s -X POST https://ysquareai.com/svc/api \
  -H 'Content-Type: application/json' -H 'X-Guest-Id: guest-smoke-test' \
  -d '{"action":"bootstrap","payload":{}}' | head -c 300

# the n8n editor is not reachable there
curl -sI https://ysquareai.com/rest/login | head -1     # expect 404
curl -sI https://ysquareai.com/workflow/ | head -1      # expect 404

# non-prod is unchanged and still on the staging row
curl -sI https://n8n-neonai.duckdns.org/webhook/Y2Workplace | head -1
```

In a browser, open `https://ysquareai.com/`, then check the network tab: requests should go to
`ysquareai.com/svc/api`, not to the duckdns host. If they go to duckdns, the browser is holding an
older copy of the page - hard-reload it.

## Known loose end

`ys_settings.studypals.openUrl` is `https://n8n-neonai.duckdns.org/studypals/`, the static StudyPals
app, which is not part of this repo. The "open the full StudyPals app" link therefore sends
production users to the non-prod hostname. Either leave it (StudyPals is a separate product on the
same VM) or give StudyPals its own production hostname and update the setting:

```sql
UPDATE ys_settings
   SET value = value || '{"openUrl":"https://studypals.ysquareai.com/"}'::jsonb, updated_at = now()
 WHERE key = 'studypals';
```

Note that this is the *static app* URL. The tutor API base is a different setting (`baseUrl`) and
must keep pointing at a host that serves `/webhook/studypals/`.
