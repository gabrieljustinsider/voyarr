import requests
from sqlalchemy.orm import Session
from models import Settings, Vault, Credential, Provider
from security import decrypt_data, encrypt_data
from services.credential_base import CredentialServiceBase
import logging

logger = logging.getLogger(__name__)


class OnePasswordService(CredentialServiceBase):
    @staticmethod
    def get_config(db: Session):
        """Retrieve 1Password credentials and resolved integration mode."""
        mode_setting = db.query(Settings).filter_by(key="op_auth_mode").first()
        vault_id_setting = db.query(Settings).filter_by(key="op_vault_id").first()
        
        # Connect mode settings
        connect_host = db.query(Settings).filter_by(key="op_connect_host").first()
        connect_token_vault = (
            db.query(Vault)
            .filter_by(entity_type="global_setting", key="op_connect_token")
            .first()
        )
        
        # Service Account (Option A) settings
        sa_token_vault = (
            db.query(Vault)
            .filter_by(entity_type="global_setting", key="op_service_account_token")
            .first()
        )

        # Foundation Fleet Application Gateway settings
        foundation_url = db.query(Settings).filter_by(key="foundation_url").first()
        fleet_key_vault = (
            db.query(Vault)
            .filter_by(entity_type="global_setting", key="fleet_app_key")
            .first()
        ) or (
            db.query(Vault)
            .filter_by(entity_type="global_setting", key="satellite_app_key")
            .first()
        )

        mode = mode_setting.value if mode_setting else None
        vault_id = vault_id_setting.value if vault_id_setting else "6wgu5yz5yphvacdimgc64ej65i"

        connect_host_val = connect_host.value if connect_host else None
        connect_token_val = decrypt_data(connect_token_vault.encrypted_value) if connect_token_vault else None

        sa_token_val = decrypt_data(sa_token_vault.encrypted_value) if sa_token_vault else None

        foundation_url_val = foundation_url.value if foundation_url else "https://foundation.gpnet.dev"
        fleet_key_val = decrypt_data(fleet_key_vault.encrypted_value) if fleet_key_vault else None

        # Auto-detect mode if not explicitly set
        if not mode:
            if sa_token_val:
                mode = "service_account"
            elif fleet_key_val:
                mode = "fleet_gateway"
            elif connect_host_val and connect_token_val:
                mode = "connect"
            else:
                mode = "service_account"

        if mode == "service_account":
            return mode, "https://api.1password.com", sa_token_val, vault_id
        elif mode in ("fleet_gateway", "satellite_gateway"):
            return "fleet_gateway", foundation_url_val, fleet_key_val, vault_id
        else:
            return mode, connect_host_val, connect_token_val, vault_id

    @staticmethod
    def get_headers(mode: str, token: str) -> dict[str, str]:
        if mode in ("fleet_gateway", "satellite_gateway"):
            return {
                "X-Fleet-Key": token,
                "X-Satellite-Key": token,
                "Accept": "application/json"
            }
        return {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    @staticmethod
    def list_accessible_vaults(db: Session) -> list[dict[str, str]]:
        """Return all accessible vaults for the active mode."""
        mode, host, token, default_vault_id = OnePasswordService.get_config(db)
        if not token:
            return [
                {"id": "6wgu5yz5yphvacdimgc64ej65i", "name": "Fleet Services"},
                {"id": "57s77wi4sbpj5zxxm7habzczo4", "name": "Self-Hosted Infrastructure"}
            ]

        headers = OnePasswordService.get_headers(mode, token)
        host_clean = (host or "").rstrip("/")

        try:
            if mode == "fleet_gateway":
                url = f"{host_clean}/api/v1/fleet/vaults"
            else:
                url = f"{host_clean}/v1/vaults"

            res = requests.get(url, headers=headers, timeout=10)
            if res.ok:
                data = res.json()
                raw_vaults = data.get("vaults") if isinstance(data, dict) and "vaults" in data else data
                vaults = []
                for v in raw_vaults:
                    if isinstance(v, dict) and v.get("id"):
                        vaults.append({"id": v["id"], "name": v.get("name") or v["id"]})
                if vaults:
                    return vaults
        except Exception as e:
            logger.warning(f"[OnePasswordService] list_accessible_vaults warning ({mode}): {e}")

        return [
            {"id": "6wgu5yz5yphvacdimgc64ej65i", "name": "Fleet Services"},
            {"id": "57s77wi4sbpj5zxxm7habzczo4", "name": "Self-Hosted Infrastructure"}
        ]

    @staticmethod
    def list_login_items(db: Session, vault_id_override: str | None = None) -> list[dict]:
        """Return LOGIN items across the accessible vaults."""
        mode, host, token, default_vault_id = OnePasswordService.get_config(db)
        if not token:
            return []

        headers = OnePasswordService.get_headers(mode, token)
        host_clean = (host or "").rstrip("/")
        target_vault = vault_id_override or default_vault_id or "6wgu5yz5yphvacdimgc64ej65i"

        items = []
        try:
            if mode == "fleet_gateway":
                url = f"{host_clean}/api/v1/fleet/vaults/{target_vault}/items"
            else:
                url = f"{host_clean}/v1/vaults/{target_vault}/items"

            res = requests.get(url, headers=headers, timeout=10)
            if res.ok:
                data = res.json()
                raw_items = data.get("items") if isinstance(data, dict) and "items" in data else data
                for summary in raw_items:
                    if not isinstance(summary, dict):
                        continue
                    if summary.get("category") and summary.get("category") != "LOGIN":
                        continue
                    fields = summary.get("fields") or []
                    field_map = {
                        f.get("id") or f.get("label"): f.get("value", "")
                        for f in fields
                        if isinstance(f, dict)
                    }
                    items.append({
                        "id": summary.get("id"),
                        "vault_id": target_vault,
                        "title": summary.get("title", ""),
                        "username": field_map.get("username", "") or field_map.get("USERNAME", ""),
                        "url": field_map.get("url", "")
                    })
        except Exception as e:
            logger.warning(f"[OnePasswordService] list_login_items warning: {e}")

        return items

    @staticmethod
    def get_item_fields(db: Session, item_id: str, vault_id: str | None = None) -> dict[str, str]:
        """Fetch a single item's secret fields."""
        mode, host, token, default_vault_id = OnePasswordService.get_config(db)
        if not token:
            raise ValueError("1Password integration is not configured.")

        target_vault = vault_id or default_vault_id or "6wgu5yz5yphvacdimgc64ej65i"
        headers = OnePasswordService.get_headers(mode, token)
        host_clean = (host or "").rstrip("/")

        if mode == "fleet_gateway":
            url = f"{host_clean}/api/v1/fleet/vaults/{target_vault}/items/{item_id}"
        else:
            url = f"{host_clean}/v1/vaults/{target_vault}/items/{item_id}"

        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        data = res.json()
        item = data.get("item") if isinstance(data, dict) and "item" in data else data

        fields: dict[str, str] = {"vault_id": target_vault}
        for field in item.get("fields") or []:
            if not isinstance(field, dict):
                continue
            ftype = (field.get("type") or "").lower()
            flabel = (field.get("label") or "").lower()
            value = field.get("value", "") or ""
            if ftype in ("username", "otp", "totp") or flabel in ("username", "user"):
                fields["username"] = str(value)
            elif ftype == "password" or field.get("purpose") == "PASSWORD" or flabel in ("password", "pass", "secret"):
                fields["password"] = str(value)

        return fields

    @staticmethod
    def push_credentials(db: Session):
        """Push all local credentials into the remote 1Password / Foundation vault."""
        mode, host, token, vault_id = OnePasswordService.get_config(db)
        if not token:
            raise ValueError("1Password integration is not configured.")

        headers = OnePasswordService.get_headers(mode, token)
        headers["Content-Type"] = "application/json"
        host_clean = (host or "").rstrip("/")

        creds = db.query(Credential).all()
        pushed_count = 0

        for cred in creds:
            provider = db.query(Provider).filter_by(id=cred.provider_id).first()
            if not provider:
                continue

            v_user = (
                db.query(Vault)
                .filter_by(entity_type="credential", entity_id=cred.id, key="username")
                .first()
            )
            v_pass = (
                db.query(Vault)
                .filter_by(entity_type="credential", entity_id=cred.id, key="password")
                .first()
            )

            username = decrypt_data(v_user.encrypted_value) if v_user else ""
            password = decrypt_data(v_pass.encrypted_value) if v_pass else ""

            item_payload = {
                "vaultId": vault_id,
                "title": f"Voyarr: {provider.name}",
                "category": "LOGIN",
                "tags": ["voyarr", "media", "credentials", "fleet-app"],
                "fields": [
                    {
                        "label": "username",
                        "type": "STRING",
                        "purpose": "USERNAME",
                        "value": username,
                    },
                    {
                        "label": "password",
                        "type": "CONCEALED",
                        "purpose": "PASSWORD",
                        "value": password,
                    },
                ],
            }

            try:
                if mode == "fleet_gateway":
                    push_url = f"{host_clean}/api/v1/fleet/credentials/push"
                    res = requests.post(push_url, json=item_payload, headers=headers, timeout=10)
                    res.raise_for_status()
                else:
                    url = f"{host_clean}/v1/vaults/{vault_id}/items"
                    res = requests.post(url, json=item_payload, headers=headers, timeout=10)
                    res.raise_for_status()
                pushed_count += 1
            except Exception as e:
                logger.error(f"[OnePasswordService] Failed to push credential for {provider.name}: {e}")
                continue

        return pushed_count

    @staticmethod
    def pull_credentials(db: Session):
        """Pull remote credentials and synchronize into Voyarr's local encrypted Vault table."""
        mode, host, token, vault_id = OnePasswordService.get_config(db)
        if not token:
            raise ValueError("1Password integration is not configured.")

        headers = OnePasswordService.get_headers(mode, token)
        host_clean = (host or "").rstrip("/")
        pulled_count = 0

        try:
            if mode == "fleet_gateway":
                pull_url = f"{host_clean}/api/v1/fleet/credentials/pull"
                res = requests.post(pull_url, json={"vaultId": vault_id, "prefix": "Voyarr:"}, headers=headers, timeout=15)
                res.raise_for_status()
                items = res.json().get("items", [])
            else:
                res = requests.get(
                    f"{host_clean}/v1/vaults/{vault_id}/items",
                    params={"filter": 'title co "Voyarr: "'},
                    headers=headers,
                    timeout=10,
                )
                res.raise_for_status()
                items = res.json()

            for item in items:
                provider_name = item.get("title", "").replace("Voyarr: ", "").strip()
                if not provider_name:
                    continue

                provider = db.query(Provider).filter_by(name=provider_name).first()
                if not provider:
                    continue

                username, password = "", ""
                for field in item.get("fields", []):
                    flabel = (field.get("label") or "").lower()
                    if field.get("purpose") == "USERNAME" or flabel in ("username", "user"):
                        username = field.get("value", "")
                    if field.get("purpose") == "PASSWORD" or flabel in ("password", "pass", "secret"):
                        password = field.get("value", "")

                cred = db.query(Credential).filter_by(provider_id=provider.id).first()
                if cred and cred.sync_source == "manual":
                    continue

                if not cred:
                    cred = Credential(provider_id=provider.id, sync_source="1password")
                    db.add(cred)
                    db.flush()
                else:
                    cred.sync_source = "1password"

                from services.credential_vault import set_fields
                set_fields(db, cred.id, {"username": username, "password": password})
                db.commit()
                pulled_count += 1
        except Exception as e:
            db.rollback()
            logger.error(f"[OnePasswordService] Failed to pull credentials: {e}")

        return pulled_count
