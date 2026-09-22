#!/usr/bin/env bash
# Step 3-5 of deploy/README.md: install the production server block, get a certificate, and stop the
# non-prod hostname being indexed. Run ON the VM, with sudo. Run 01-ip-and-dns.sh first - the
# certificate cannot be issued until ysquareai.com resolves to this machine.
#
#   sudo ./02-vm-nginx.sh                # check everything and show what it would do
#   sudo ./02-vm-nginx.sh --apply        # install the block and reload nginx
#   sudo ./02-vm-nginx.sh --apply --cert # ...and run certbot afterwards
set -euo pipefail

DOMAIN="${DOMAIN:-ysquareai.com}"
CONF_SRC="${CONF_SRC:-$(dirname "$0")/nginx/${DOMAIN}.conf}"
CONF_DST="/etc/nginx/sites-available/${DOMAIN}"
APPLY=false; CERT=false
for a in "$@"; do
  [ "$a" = "--apply" ] && APPLY=true
  [ "$a" = "--cert" ] && CERT=true
done

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32mok\033[0m %s\n' "$*"; }
run()  { if $APPLY; then "$@"; else printf '  would run: %s\n' "$*"; fi; }

[ "$(id -u)" = "0" ] || { echo "Run this with sudo."; exit 1; }
[ -f "$CONF_SRC" ] || { echo "Cannot find $CONF_SRC"; exit 1; }

say "Pre-flight"

RESOLVED=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)
MYIP=$(curl -s --max-time 10 https://api.ipify.org || true)
if [ -z "$RESOLVED" ]; then
  warn "$DOMAIN does not resolve yet. Run 01-ip-and-dns.sh first; the certificate will fail without it."
elif [ "$RESOLVED" = "$MYIP" ]; then
  ok "$DOMAIN resolves to $RESOLVED, which is this machine"
else
  warn "$DOMAIN resolves to $RESOLVED but this machine is $MYIP - check the A record before requesting a certificate."
fi

# The server block proxies to n8n. Confirm the upstream in the config is really listening.
UPSTREAM=$(grep -oP 'server\s+\K127\.0\.0\.1:[0-9]+' "$CONF_SRC" | head -1 || true)
if [ -n "$UPSTREAM" ]; then
  if curl -s -o /dev/null --max-time 5 "http://${UPSTREAM}/healthz"; then
    ok "n8n is answering on $UPSTREAM"
  else
    warn "nothing answered on http://${UPSTREAM}/healthz - check the upstream block in $CONF_SRC"
    grep -n 'proxy_pass' /etc/nginx/sites-enabled/* 2>/dev/null | head -5 || true
  fi
fi

say "Install the $DOMAIN server block"
if [ -f "$CONF_DST" ] && ! diff -q "$CONF_SRC" "$CONF_DST" >/dev/null 2>&1; then
  warn "$CONF_DST already exists and differs. A backup will be written alongside it."
  run cp -a "$CONF_DST" "${CONF_DST}.bak.$(date +%Y%m%d%H%M%S)"
fi
run cp "$CONF_SRC" "$CONF_DST"
run ln -sfn "$CONF_DST" "/etc/nginx/sites-enabled/${DOMAIN}"
run nginx -t
run systemctl reload nginx

say "Keep the non-prod hostname out of search results"
NONPROD=$(grep -rl 'n8n-neonai.duckdns.org' /etc/nginx/sites-enabled/ 2>/dev/null | head -1 || true)
if [ -z "$NONPROD" ]; then
  warn "could not find the duckdns server block - add X-Robots-Tag noindex to it by hand"
elif grep -q 'X-Robots-Tag' "$NONPROD"; then
  ok "$NONPROD already sets X-Robots-Tag"
else
  echo "  add this line inside the server block in $NONPROD, then reload nginx:"
  echo '      add_header X-Robots-Tag "noindex, nofollow" always;'
fi

if $APPLY; then
  say "Smoke test over plain HTTP"
  printf '  app   : '; curl -s -o /dev/null -w '%{http_code}\n' -H "Host: $DOMAIN" http://127.0.0.1/ || true
  printf '  editor: '; curl -s -o /dev/null -w '%{http_code} (want 404)\n' -H "Host: $DOMAIN" http://127.0.0.1/rest/login || true
fi

if $CERT; then
  say "Issue the certificate"
  run certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN"
  run systemctl status certbot.timer --no-pager
elif $APPLY; then
  say "Next: sudo $0 --apply --cert   (or run certbot yourself)"
else
  say "Dry run only. Re-run with --apply, and add --cert once DNS resolves here."
fi
