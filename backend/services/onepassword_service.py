import requests
from sqlalchemy.orm import Session
from models import Settings, Vault, Credential, Provider
from security import decrypt_data, encrypt_data

class OnePasswordService:
    @staticmethod
    def get_config(db: Session):
        host = db.query(Settings).filter_by(key="op_connect_host").first()
        vault_id = db.query(Settings).filter_by(key="op_vault_id").first()
        token_vault = db.query(Vault).filter_by(entity_type="global_setting", key="op_connect_token").first()
        
        host_val = host.value if host else None
        vault_id_val = vault_id.value if vault_id else None
        token_val = decrypt_data(token_vault.encrypted_value) if token_vault else None
        
        return host_val, token_val, vault_id_val

    @staticmethod
    def push_credentials(db: Session):
        host, token, vault_id = OnePasswordService.get_config(db)
        if not all([host, token, vault_id]):
            raise ValueError("1Password Connect integration is not fully configured.")
        
        host = host.rstrip('/')
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        creds = db.query(Credential).all()
        pushed_count = 0
        
        for cred in creds:
            provider = db.query(Provider).filter_by(id=cred.provider_id).first()
            if not provider: continue
            
            v_user = db.query(Vault).filter_by(entity_type='credential', entity_id=cred.id, key='username').first()
            v_pass = db.query(Vault).filter_by(entity_type='credential', entity_id=cred.id, key='password').first()
            
            username = decrypt_data(v_user.encrypted_value) if v_user else ""
            password = decrypt_data(v_pass.encrypted_value) if v_pass else ""
            
            item_payload = {
                "title": f"Voyarr: {provider.name}",
                "category": "LOGIN",
                "tags": ["Voyarr"],
                "fields": [
                    {"id": "username", "type": "STRING", "purpose": "USERNAME", "value": username},
                    {"id": "password", "type": "CONCEALED", "purpose": "PASSWORD", "value": password}
                ]
            }
            
            try:
                safe_provider_name = provider.name.replace('"', '\\"')
                # Check if item exists to update instead of duplicating
                search_res = requests.get(f"{host}/v1/vaults/{vault_id}/items", params={"filter": f'title eq "Voyarr: {safe_provider_name}"'}, headers=headers, timeout=10)
                search_data = search_res.json() if search_res.ok else []
                
                if search_data and len(search_data) > 0:
                    item_id = search_data[0]['id']
                    res = requests.put(f"{host}/v1/vaults/{vault_id}/items/{item_id}", json=item_payload, headers=headers, timeout=10)
                    res.raise_for_status()
                else:
                    res = requests.post(f"{host}/v1/vaults/{vault_id}/items", json=item_payload, headers=headers, timeout=10)
                    res.raise_for_status()
                pushed_count += 1
            except Exception as e:
                print(f"Failed to push 1Password credential for {provider.name}: {e}")
                continue
            
        return pushed_count

    @staticmethod
    def pull_credentials(db: Session):
        host, token, vault_id = OnePasswordService.get_config(db)
        if not all([host, token, vault_id]):
            raise ValueError("1Password Connect integration is not fully configured.")
        
        host = host.rstrip('/')
        headers = {"Authorization": f"Bearer {token}"}
        
        res = requests.get(f"{host}/v1/vaults/{vault_id}/items", params={"filter": 'title co "Voyarr: "'}, headers=headers, timeout=10)
        res.raise_for_status()
        
        items = res.json()
        pulled_count = 0
        
        for item_summary in items:
            try:
                item_id = item_summary['id']
                item_res = requests.get(f"{host}/v1/vaults/{vault_id}/items/{item_id}", headers=headers, timeout=10)
                if not item_res.ok: continue
                item = item_res.json()
                
                provider_name = item['title'].replace("Voyarr: ", "").strip()
                provider = db.query(Provider).filter_by(name=provider_name).first()
                if not provider: continue
                
                username, password = "", ""
                for field in item.get('fields', []):
                    if field.get('purpose') == 'USERNAME': username = field.get('value', '')
                    if field.get('purpose') == 'PASSWORD': password = field.get('value', '')
                
                # Check if credential entity exists or create it
                cred = db.query(Credential).filter_by(provider_id=provider.id).first()
                
                # Skip overwriting if the user manually locked this credential via the UI
                if cred and cred.sync_source == 'manual':
                    continue
                    
                if not cred:
                    cred = Credential(provider_id=provider.id, sync_source='1password')
                    db.add(cred)
                    db.flush()
                else:
                    cred.sync_source = '1password'
                
                # Safely sync to encrypted Vault table
                for key, val in [('username', username), ('password', password)]:
                    v = db.query(Vault).filter_by(entity_type='credential', entity_id=cred.id, key=key).first()
                    if v:
                        v.encrypted_value = encrypt_data(val)
                    else:
                        db.add(Vault(entity_type='credential', entity_id=cred.id, key=key, encrypted_value=encrypt_data(val)))
                
                db.commit()
                pulled_count += 1
            except Exception as e:
                db.rollback()
                print(f"Failed to pull 1Password credential {item_summary.get('title', 'Unknown')}: {e}")
                continue
            
        return pulled_count