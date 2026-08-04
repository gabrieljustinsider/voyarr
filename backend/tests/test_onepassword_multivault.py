import os

os.environ["DATABASE_URL"] = "sqlite:///file:testdb_multivault?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key"
os.environ["SECRET_KEY"] = "test_jwt_secret_key"

from unittest.mock import patch, MagicMock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models import Base, Settings, Vault
from security import encrypt_data
from services.onepassword_service import OnePasswordService


engine = create_engine(
    "sqlite:///file:testdb_multivault?mode=memory&cache=shared",
    poolclass=StaticPool,
    connect_args={"check_same_thread": False},
)
Base.metadata.create_all(bind=engine)
Session = sessionmaker(bind=engine)


def _seed_config():
    db = Session()
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.add(Settings(key="op_connect_host", value="http://op"))
    db.add(Settings(key="op_vault_id", value="vault-default"))
    db.add(
        Vault(
            entity_type="global_setting",
            entity_id=0,
            key="op_connect_token",
            encrypted_value=encrypt_data("tok"),
        )
    )
    db.commit()


def _resp(status, body):
    m = MagicMock()
    m.ok = status == 200
    m.status_code = status
    m.json.return_value = body
    return m


def test_list_login_items_searches_all_vaults_and_tags_source():
    db = Session()
    _seed_config()
    vaults = [{"id": "va", "name": "Vault A"}, {"id": "vb", "name": "Vault B"}]
    items_a = [
        {"id": "item1", "category": "LOGIN", "title": "Login 1",
         "fields": [{"id": "username", "value": "u1"}]}
    ]
    items_b = [
        {"id": "item2", "category": "LOGIN", "title": "Login 2", "fields": []},
        {"id": "skip", "category": "PASSWORD", "title": "Skip", "fields": []},
    ]
    with patch("requests.get") as mget:
        mget.side_effect = [_resp(200, vaults), _resp(200, items_a), _resp(200, items_b)]
        items = OnePasswordService.list_login_items(db)

    assert len(items) == 2
    by_id = {i["id"]: i for i in items}
    assert by_id["item1"]["vault_id"] == "va"
    assert by_id["item2"]["vault_id"] == "vb"
    assert "skip" not in by_id
    db.close()


def test_list_login_items_single_override_skips_vault_enumeration():
    db = Session()
    _seed_config()
    items = [{"id": "x", "category": "LOGIN", "title": "T", "fields": []}]
    with patch("requests.get") as mget:
        mget.return_value = _resp(200, items)
        got = OnePasswordService.list_login_items(db, vault_id_override="vault-default")
    assert got[0]["vault_id"] == "vault-default"
    assert mget.call_count == 1
    db.close()


def test_get_item_fields_uses_vault_override_and_returns_vault_id():
    db = Session()
    _seed_config()
    item = {
        "fields": [
            {"type": "username", "value": "alice"},
            {"type": "password", "value": "secret"},
            {"type": "OTP", "value": "JBSWY3DPEHPK3PXP"},
        ]
    }
    with patch("requests.get") as mget:
        mget.return_value = _resp(200, item)
        fields = OnePasswordService.get_item_fields(db, "item9", vault_id="vb")

    url = mget.call_args[0][0]
    assert "/v1/vaults/vb/items/item9" in url
    assert fields["username"] == "alice"
    assert fields["password"] == "secret"
    assert fields["otp"] == "JBSWY3DPEHPK3PXP"
    assert fields["vault_id"] == "vb"
    db.close()


def test_list_accessible_vaults():
    db = Session()
    _seed_config()
    with patch("requests.get") as mget:
        mget.return_value = _resp(
            200, [{"id": "va", "name": "A"}, {"id": "vb", "name": "B"}]
        )
        vaults = OnePasswordService.list_accessible_vaults(db)
    assert [v["id"] for v in vaults] == ["va", "vb"]
    db.close()
