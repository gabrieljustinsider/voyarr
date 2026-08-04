import requests
from sqlalchemy.orm import Session
from models import Settings, Vault, Credential, Provider
from security import decrypt_data, encrypt_data
from services.credential_base import CredentialServiceBase


class BitwardenService(CredentialServiceBase):
    @staticmethod
    def get_config(db: Session):
        host = db.query(Settings).filter_by(key="bw_connect_host").first()
        folder_id = db.query(Settings).filter_by(key="bw_folder_id").first()
        token_vault = (
            db.query(Vault)
            .filter_by(entity_type="global_setting", key="bw_session_token")
            .first()
        )

        host_val = host.value if host else None
        folder_id_val = folder_id.value if folder_id else None
        token_val = decrypt_data(token_vault.encrypted_value) if token_vault else None

        return host_val, token_val, folder_id_val

    @staticmethod
    def push_credentials(db: Session):
        host, token, folder_id = BitwardenService.get_config(db)
        if not all([host, token]):
            raise ValueError("Bitwarden integration is not fully configured.")

        host = host.rstrip("/")
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

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

            item_payload = {
                "type": 1,  # Login type
                "name": f"Voyarr: {provider.name}",
                "notes": "Generated and managed by Voyarr",
                "login": {
                    "username": decrypt_data(v_user.encrypted_value) if v_user else "",
                    "password": decrypt_data(v_pass.encrypted_value) if v_pass else "",
                    "uris": [{"match": None, "uri": provider.base_url}],
                },
            }
            if folder_id:
                item_payload["folderId"] = folder_id

            try:
                # Search for existing item to prevent duplicates
                search_res = requests.get(
                    f"{host}/object/item", headers=headers, timeout=10
                )
                search_data = search_res.json()
                existing_items = (
                    search_data.get("data", [])
                    if isinstance(search_data, dict)
                    else (search_data if isinstance(search_data, list) else [])
                )
                existing_item = next(
                    (
                        i
                        for i in existing_items
                        if i.get("name") == f"Voyarr: {provider.name}"
                    ),
                    None,
                )

                if existing_item:
                    item_id = existing_item.get("id")
                    res = requests.put(
                        f"{host}/object/item/{item_id}",
                        json=item_payload,
                        headers=headers,
                        timeout=10,
                    )
                    res.raise_for_status()
                else:
                    res = requests.post(
                        f"{host}/object/item",
                        json=item_payload,
                        headers=headers,
                        timeout=10,
                    )
                    res.raise_for_status()
                pushed_count += 1
            except Exception as e:
                print(f"Failed to push Bitwarden credential for {provider.name}: {e}")
                continue

        return pushed_count

    @staticmethod
    def pull_credentials(db: Session):
        host, token, folder_id = BitwardenService.get_config(db)
        if not all([host, token]):
            raise ValueError("Bitwarden integration is not fully configured.")

        host = host.rstrip("/")
        headers = {"Authorization": f"Bearer {token}"}

        res = requests.get(f"{host}/object/item", headers=headers, timeout=10)
        res.raise_for_status()

        res_data = res.json()
        items = (
            res_data.get("data", [])
            if isinstance(res_data, dict)
            else (res_data if isinstance(res_data, list) else [])
        )
        pulled_count = 0

        for item in items:
            try:
                name = item.get("name", "")
                if not name.startswith("Voyarr: "):
                    continue

                provider_name = name.replace("Voyarr: ", "").strip()
                provider = db.query(Provider).filter_by(name=provider_name).first()
                if not provider:
                    continue

                login_data = item.get("login", {})
                username = login_data.get("username", "")
                password = login_data.get("password", "")

                cred = db.query(Credential).filter_by(provider_id=provider.id).first()

                # Skip overwriting if the user manually locked this credential via the UI
                if cred and cred.sync_source == "manual":
                    continue

                if not cred:
                    cred = Credential(provider_id=provider.id, sync_source="bitwarden")
                    db.add(cred)
                    db.flush()
                else:
                    cred.sync_source = "bitwarden"

                from services.credential_vault import set_fields
                set_fields(db, cred.id, {"username": username, "password": password})

                db.commit()
                pulled_count += 1
            except Exception as e:
                db.rollback()
                print(
                    f"Failed to pull Bitwarden credential {item.get('name', 'Unknown')}: {e}"
                )
                continue

        return pulled_count
