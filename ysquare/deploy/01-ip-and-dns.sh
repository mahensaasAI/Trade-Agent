#!/usr/bin/env bash
# Step 1-2 of deploy/README.md: reserve the VM's IP in GCP and point ysquareai.com at it in Route 53.
# Run from Cloud Shell or any machine with gcloud and aws configured. Safe to re-run: every step is idempotent
# and nothing is deleted. Nothing here touches the running VM or the duckdns hostname.
#
#   ./01-ip-and-dns.sh                 # show what it would do
#   ./01-ip-and-dns.sh --apply         # actually make the changes
set -euo pipefail

VM_IP="${VM_IP:-104.198.204.161}"
ADDRESS_NAME="${ADDRESS_NAME:-ysquare-prod-ip}"
DOMAIN="${DOMAIN:-ysquareai.com}"
TTL="${TTL:-300}"
APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
run() {
  if $APPLY; then "$@"; else printf '  would run: %s\n' "$*"; fi
}

say "1. Reserve $VM_IP as a static address in GCP"

REGION="${REGION:-}"
if [ -z "$REGION" ]; then
  ZONE=$(gcloud compute instances list --filter="EXTERNAL_IP=$VM_IP" \
           --format="value(zone)" --limit=1 2>/dev/null || true)
  if [ -z "$ZONE" ]; then
    echo "  Could not find a VM with external IP $VM_IP in the current project."
    echo "  Check 'gcloud config get-value project', or set REGION=... and re-run."
    exit 1
  fi
  REGION="${ZONE%-*}"
  echo "  found the VM in zone $ZONE -> region $REGION"
fi

if gcloud compute addresses describe "$ADDRESS_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "  '$ADDRESS_NAME' already exists in $REGION - nothing to do."
else
  run gcloud compute addresses create "$ADDRESS_NAME" --addresses "$VM_IP" --region "$REGION"
fi

say "   Firewall: ports 80 and 443 must be open (80 is needed for the certificate)"
gcloud compute firewall-rules list \
  --filter="allowed[].ports:(80 OR 443) AND direction=INGRESS AND disabled=false" \
  --format="table(name,sourceRanges.list(),allowed[].map().firewall_rule().list())" || true

say "2. Point $DOMAIN at $VM_IP in Route 53"

ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN" \
  --query "HostedZones[?Name=='${DOMAIN}.'].Id | [0]" --output text 2>/dev/null || true)
if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" = "None" ]; then
  echo "  No hosted zone found for $DOMAIN. Check your AWS credentials and region."
  exit 1
fi
ZONE_ID="${ZONE_ID#/hostedzone/}"
echo "  hosted zone: $ZONE_ID"

BATCH=$(mktemp)
cat > "$BATCH" <<JSON
{
  "Comment": "Point $DOMAIN at the Y Square VM",
  "Changes": [
    { "Action": "UPSERT", "ResourceRecordSet": {
        "Name": "$DOMAIN", "Type": "A", "TTL": $TTL,
        "ResourceRecords": [{ "Value": "$VM_IP" }] } },
    { "Action": "UPSERT", "ResourceRecordSet": {
        "Name": "www.$DOMAIN", "Type": "A", "TTL": $TTL,
        "ResourceRecords": [{ "Value": "$VM_IP" }] } }
  ]
}
JSON
echo "  change batch:"; sed 's/^/    /' "$BATCH"
run aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "file://$BATCH"

if $APPLY; then
  say "3. Waiting for DNS (this can take a couple of minutes)"
  for i in $(seq 1 30); do
    GOT=$(dig +short "$DOMAIN" @8.8.8.8 | head -1 || true)
    [ "$GOT" = "$VM_IP" ] && { echo "  $DOMAIN -> $GOT"; break; }
    printf '  waiting... (%s)\n' "${GOT:-no answer yet}"
    sleep 10
  done
  say "Done. Next: deploy/02-vm-nginx.sh on the VM."
else
  say "Dry run only. Re-run with --apply to make these changes."
fi
