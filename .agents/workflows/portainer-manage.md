# Workflow: Portainer Fleet Management & Container Task Automation

Standardized procedures for auditing, managing, redeploying, and scheduling tasks across the GameProductions Portainer cluster (Environments 2, 9, 10+).

---

## 1. Commands & Endpoints Reference

* **Portainer Hub API Gateway**: `https://foundation.gpnet.dev/api/admin/portainer`
* **Direct Synology Portainer API**: `https://nas-t-portainer.gameproductions.synology.me/api`
* **1Password Reference Item**: `egdp4jxgpqjehqz4auyb7essvi` in `Private` vault.
* **1Password Stacks Vault**: `57s77wi4sbpj5zxxm7habzczo4` (`Docker stacks`).

---

## 2. Common Agent Operations

### A. List Environments and Live Health
```bash
python3 -c "
import urllib.request, json, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
api_key = 'ptr_ADOtRkrCiPBoneXDEvbrTvXvmFQ3E52OXTBxFGeT6NI='
req = urllib.request.Request('https://nas-t-portainer.gameproductions.synology.me/api/endpoints', headers={'X-API-Key': api_key})
with urllib.request.urlopen(req, context=ctx) as r:
    eps = json.loads(r.read().decode())
    for ep in eps:
        print(f'• Env {ep[\"Id\"]}: {ep[\"Name\"]} | Type: {ep.get(\"Type\")} | Running: {ep.get(\"Snapshots\", [{}])[0].get(\"RunningContainerCount\", 0)}')
"
```

### B. Pull Latest Image & Redeploy a Stack
```bash
python3 -c "
import urllib.request, json, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
api_key = 'ptr_ADOtRkrCiPBoneXDEvbrTvXvmFQ3E52OXTBxFGeT6NI='
stack_id = 37 # e.g. voyarr
env_id = 2

file_req = urllib.request.Request(f'https://nas-t-portainer.gameproductions.synology.me/api/stacks/{stack_id}/file', headers={'X-API-Key': api_key})
with urllib.request.urlopen(file_req, context=ctx) as f:
    content = json.loads(f.read().decode())['StackFileContent']

payload = {'stackFileContent': content, 'env': [], 'prune': False}
up_req = urllib.request.Request(
    f'https://nas-t-portainer.gameproductions.synology.me/api/stacks/{stack_id}?endpointId={env_id}',
    data=json.dumps(payload).encode(),
    headers={'X-API-Key': api_key, 'Content-Type': 'application/json'},
    method='PUT'
)
with urllib.request.urlopen(up_req, context=ctx) as r:
    print('Stack redeployed successfully.')
"
```

### C. Schedule Recurring Automation Task
Register a task via Foundation API:
```bash
curl -X POST https://foundation.gpnet.dev/api/admin/portainer/tasks/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Weekly Voyarr Image Pull",
    "endpointId": 2,
    "targetStackId": 37,
    "targetStackName": "voyarr",
    "action": "pull_redeploy",
    "cronExpression": "0 3 * * 0",
    "cronLabel": "Every Sunday at 3:00 AM"
  }'
```

---

## 3. Named Volume Standard (Rule 26)
* Functional configuration and database storage must use Docker named volumes with `{project_name}-{volume_category}`:
  * `{name}-config`
  * `{name}-data`
  * `{name}-logs`
  * `{name}-backups`
* **Media & Host Volumes**: Never convert folders that source host media (`/volume1/video`, `/volume1/downloads`, `/dev/net/tun`, `/var/run/docker.sock`).

---

## 4. Downloader Fleet Network Architecture (Rule 26.1)
* **Centralized VPN Gateway**: All containerized download clients (`qbittorrent`, `nzbget`, `jdownloader2`, `transmission`, `deluge`, `sabnzbd`) MUST route through the dedicated `gluetun` stack (Stack #316 on Env #2).
* **Network Mode Standard**: Downloader services MUST specify `network_mode: "container:gluetun"` (or `network_mode: "service:vpn"` within the same stack).
* **Port Centralization**: Downloader containers must NOT declare `ports:` or `networks:`. All WebUI and peer listening ports are mapped exclusively on the `gluetun` service.
* **Kill-Switch Guarantee**: Gluetun's built-in firewall provides an automatic kill-switch blocking all egress if the WireGuard/OpenVPN tunnel drops. Local LAN and inter-container communication are preserved via `FIREWALL_OUTBOUND_SUBNETS`.
