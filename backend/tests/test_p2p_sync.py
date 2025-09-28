import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
import json

# Setup environment variables for tests
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_p2p_sync?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key"
os.environ["SECRET_KEY"] = "test_jwt_secret_key"

import database
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

test_engine = create_engine(
    "sqlite:///file:testdb_p2p_sync?mode=memory&cache=shared",
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database.engine = test_engine
database.SessionLocal = TestSessionLocal

import db_utils

db_utils.SessionLocal = TestSessionLocal

# Safeguard against other tests mocking 'croniter' in sys.modules
if "croniter" in sys.modules and isinstance(sys.modules["croniter"], MagicMock):
    sys.modules.pop("croniter", None)

import croniter
import tasks.p2p_tasks

tasks.p2p_tasks.croniter = croniter.croniter

from fastapi.testclient import TestClient
from main import app
from database import get_db
from dependencies import verify_api_key
from models import (
    Base,
    PeerNode,
    PeerSyncLog,
    Provider,
    SiteRecipe,
    LibraryEntry,
    Settings,
)
from tasks.p2p_tasks import sync_with_peer_task, p2p_sync_scheduler

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_database_schema():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db_and_dependencies():
    # Save original globals and overrides
    orig_overrides = dict(app.dependency_overrides)
    orig_engine = database.engine
    orig_sessionlocal = database.SessionLocal
    orig_db_utils_sessionlocal = getattr(db_utils, "SessionLocal", None)

    # Patch database engine/SessionLocal
    database.engine = test_engine
    database.SessionLocal = TestSessionLocal
    db_utils.SessionLocal = TestSessionLocal

    # Overrides for verify_api_key
    app.dependency_overrides[verify_api_key] = lambda: {"type": "mock", "user": "admin"}

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    # Clean tables
    db = TestSessionLocal()
    db.query(PeerSyncLog).delete()
    db.query(PeerNode).delete()
    db.query(SiteRecipe).delete()
    db.query(LibraryEntry).delete()
    db.query(Provider).delete()
    db.query(Settings).delete()
    db.commit()
    db.close()

    yield

    # Clean up / Restore
    app.dependency_overrides = orig_overrides
    database.engine = orig_engine
    database.SessionLocal = orig_sessionlocal
    if orig_db_utils_sessionlocal is not None:
        db_utils.SessionLocal = orig_db_utils_sessionlocal


# ==========================================
# 1. P2P INBOUND GATEWAYS & AUTH TESTS
# ==========================================


def test_verify_p2p_token_missing_header():
    response = client.get("/p2p/ping")
    assert response.status_code == 401
    assert "Missing authentication credentials" in response.json()["detail"]


def test_verify_p2p_token_invalid_token():
    headers = {"x-api-key": "invalid_key"}
    response = client.get("/p2p/ping", headers=headers)
    assert response.status_code == 401
    assert "Invalid P2P authentication token" in response.json()["detail"]


def test_verify_p2p_token_inactive_peer():
    db = TestSessionLocal()
    peer = PeerNode(
        name="Inactive Peer",
        peer_url="http://inactive.local",
        outbound_key="out_key",
        inbound_token="inbound_secret_tkn",
        status="inactive",
        allowed_providers=[],
    )
    db.add(peer)
    db.commit()
    db.close()

    headers = {"x-api-key": "inbound_secret_tkn"}
    response = client.get("/p2p/ping", headers=headers)
    assert response.status_code == 403
    assert "currently inactive" in response.json()["detail"]


def test_verify_p2p_token_success():
    db = TestSessionLocal()
    peer = PeerNode(
        name="Active Peer",
        peer_url="http://active.local",
        outbound_key="out_key",
        inbound_token="inbound_secret_tkn",
        status="active",
        allowed_providers=[],
    )
    db.add(peer)
    db.commit()
    db.close()

    headers = {"x-api-key": "inbound_secret_tkn"}
    response = client.get("/p2p/ping", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "online"
    assert response.json()["peer_name"] == "Active Peer"


# ==========================================
# 2. RECIPE PULL & PUSH TESTS
# ==========================================


def test_recipes_pull_endpoint():
    db = TestSessionLocal()
    peer = PeerNode(
        name="Active Peer",
        peer_url="http://active.local",
        outbound_key="out_key",
        inbound_token="token123",
        status="active",
        allowed_providers=[],
    )
    db.add(peer)

    provider = Provider(
        id=1,
        name="Test Provider",
        base_url="https://test.com",
        naming_pattern="{title}",
        separator="_",
        space_replacement="_",
        automatic_limits=10,
        supported_methods=["html"],
    )
    db.add(provider)

    recipe = SiteRecipe(
        provider_id=1,
        css_selectors={"title": "h1"},
        xpath_selectors={"duration": "//div"},
        regex_patterns={"resolution": "\\d+p"},
        map_mode_data={},
    )
    db.add(recipe)
    db.commit()
    db.close()

    headers = {"x-api-key": "token123"}
    response = client.post("/p2p/recipes/pull", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["providers"]) == 1
    assert data["providers"][0]["name"] == "Test Provider"
    assert len(data["recipes"]) == 1
    assert data["recipes"][0]["provider_name"] == "Test Provider"
    assert data["recipes"][0]["css_selectors"]["title"] == "h1"


def test_recipes_push_manual_review():
    db = TestSessionLocal()
    peer = PeerNode(
        name="Active Peer",
        peer_url="http://active.local",
        outbound_key="out_key",
        inbound_token="token123",
        status="active",
        recipe_sync_mode="manual_review",
        allowed_providers=[],
    )
    db.add(peer)
    db.commit()
    db.close()

    headers = {"x-api-key": "token123"}
    payload = {
        "providers": [{"name": "New Provider", "base_url": "https://new.com"}],
        "recipes": [
            {"provider_name": "New Provider", "css_selectors": {"title": "div.title"}}
        ],
    }
    response = client.post("/p2p/recipes/push", headers=headers, json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "queued"

    # Check Settings queue
    db = TestSessionLocal()
    setting = db.query(Settings).filter(Settings.key == "p2p_proposed_recipes").first()
    assert setting is not None
    proposed = json.loads(setting.value)
    assert len(proposed) == 1
    assert proposed[0]["peer_name"] == "Active Peer"
    assert proposed[0]["recipes"][0]["provider_name"] == "New Provider"
    db.close()


def test_recipes_push_auto_merge():
    db = TestSessionLocal()
    peer = PeerNode(
        name="Active Peer",
        peer_url="http://active.local",
        outbound_key="out_key",
        inbound_token="token123",
        status="active",
        recipe_sync_mode="auto_merge",
        allowed_providers=[],
    )
    db.add(peer)
    db.commit()
    db.close()

    headers = {"x-api-key": "token123"}
    payload = {
        "providers": [
            {
                "name": "New Provider",
                "base_url": "https://new.com",
                "separator": "-",
                "supported_methods": ["html"],
            }
        ],
        "recipes": [
            {"provider_name": "New Provider", "css_selectors": {"title": "div.title"}}
        ],
    }
    response = client.post("/p2p/recipes/push", headers=headers, json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "merged"

    # Check Provider & Recipe added to DB
    db = TestSessionLocal()
    provider = db.query(Provider).filter(Provider.name == "New Provider").first()
    assert provider is not None
    assert provider.separator == "-"

    recipe = db.query(SiteRecipe).filter(SiteRecipe.provider_id == provider.id).first()
    assert recipe is not None
    assert recipe.css_selectors["title"] == "div.title"
    db.close()


# ==========================================
# 3. PROPOSED RECIPES QUEUE MANAGEMENT
# ==========================================


def test_get_proposed_recipes_endpoint():
    db = TestSessionLocal()
    setting = Settings(
        key="p2p_proposed_recipes",
        value=json.dumps(
            [{"peer_name": "Node A", "recipes": [{"provider_name": "P1"}]}]
        ),
    )
    db.add(setting)
    db.commit()
    db.close()

    response = client.get("/p2p/proposed-recipes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["peer_name"] == "Node A"


def test_resolve_proposed_recipe_approve():
    db = TestSessionLocal()
    setting = Settings(
        key="p2p_proposed_recipes",
        value=json.dumps(
            [
                {
                    "peer_id": 1,
                    "peer_name": "Peer A",
                    "providers": [{"name": "P1", "base_url": "https://p1.com"}],
                    "recipes": [
                        {"provider_name": "P1", "css_selectors": {"title": "h1"}}
                    ],
                }
            ]
        ),
    )
    db.add(setting)
    db.commit()
    db.close()

    payload = {"peer_id": 1, "action": "approve", "provider_name": "P1"}
    response = client.post("/p2p/proposed-recipes/resolve", json=payload)
    assert response.status_code == 200

    # Verify merged in DB
    db = TestSessionLocal()
    provider = db.query(Provider).filter(Provider.name == "P1").first()
    assert provider is not None
    recipe = db.query(SiteRecipe).filter(SiteRecipe.provider_id == provider.id).first()
    assert recipe is not None
    assert recipe.css_selectors["title"] == "h1"

    # Verify queue is empty
    setting = db.query(Settings).filter(Settings.key == "p2p_proposed_recipes").first()
    assert json.loads(setting.value) == []
    db.close()


def test_resolve_proposed_recipe_reject():
    db = TestSessionLocal()
    setting = Settings(
        key="p2p_proposed_recipes",
        value=json.dumps(
            [
                {
                    "peer_id": 1,
                    "peer_name": "Peer A",
                    "providers": [{"name": "P1", "base_url": "https://p1.com"}],
                    "recipes": [
                        {"provider_name": "P1", "css_selectors": {"title": "h1"}}
                    ],
                }
            ]
        ),
    )
    db.add(setting)
    db.commit()
    db.close()

    payload = {"peer_id": 1, "action": "reject", "provider_name": "P1"}
    response = client.post("/p2p/proposed-recipes/resolve", json=payload)
    assert response.status_code == 200

    # Verify NOT merged in DB
    db = TestSessionLocal()
    provider = db.query(Provider).filter(Provider.name == "P1").first()
    assert provider is None

    # Verify queue is empty
    setting = db.query(Settings).filter(Settings.key == "p2p_proposed_recipes").first()
    assert json.loads(setting.value) == []
    db.close()


# ==========================================
# 4. LIBRARY RECONCILIATION TESTS
# ==========================================


def test_reconcile_library_all_entries():
    db = TestSessionLocal()
    peer = PeerNode(
        name="Active Peer",
        peer_url="http://active.local",
        outbound_key="out_key",
        inbound_token="token123",
        status="active",
        library_scope="all_entries",
        allowed_providers=[],
    )
    db.add(peer)

    provider = Provider(id=1, name="Test Provider", base_url="https://test.com")
    db.add(provider)

    local_entry = LibraryEntry(
        id=1,
        provider_id=1,
        title="Local Match",
        file_path="/path/video.mp4",
        ohash="ohash_match_123",
        phash="phash_match_456",
        resolution="1080p",
        tags=["action", "local"],
        performers=["Artist A"],
    )
    db.add(local_entry)
    db.commit()
    db.close()

    # Reconcile payload
    headers = {"x-api-key": "token123"}
    payload = {
        "entries": [
            {
                "title": "Local Match",
                "provider_name": "Test Provider",
                "ohash": "ohash_match_123",
                "phash": "phash_match_456",
                "resolution": "720p",
                "tags": ["action", "peer_tag"],
                "performers": ["Artist A", "Artist B"],
            },
            {
                "title": "Missing Entry",
                "provider_name": "Test Provider",
                "ohash": "ohash_missing_999",
                "phash": "phash_missing_888",
                "resolution": "4K",
                "tags": ["sci-fi"],
                "performers": ["Star C"],
            },
        ]
    }
    response = client.post("/p2p/library/reconcile", headers=headers, json=payload)
    assert response.status_code == 200
    data = response.json()

    # Check metadata updates suggested back to peer
    assert len(data["metadata_updates"]) == 1
    update = data["metadata_updates"][0]
    assert update["ohash"] == "ohash_match_123"
    # Local has better resolution (1080p > 720p)
    assert update["better_resolution"] == "1080p"
    # Local has "local" tag that peer is missing
    assert "local" in update["new_tags"]

    # Check missing items peer has that we want
    assert len(data["missing_items"]) == 1
    assert data["missing_items"][0]["title"] == "Missing Entry"


def test_reconcile_library_specific_providers():
    db = TestSessionLocal()
    peer = PeerNode(
        name="Restricted Peer",
        peer_url="http://restricted.local",
        outbound_key="out_key",
        inbound_token="token123",
        status="active",
        library_scope="specific_providers",
        allowed_providers=[1],  # Only provider ID 1 allowed
    )
    db.add(peer)

    p1 = Provider(id=1, name="Allowed Prov", base_url="https://p1.com")
    p2 = Provider(id=2, name="Forbidden Prov", base_url="https://p2.com")
    db.add(p1)
    db.add(p2)

    db.commit()
    db.close()

    headers = {"x-api-key": "token123"}
    payload = {
        "entries": [
            {
                "title": "Allowed Entry",
                "provider_name": "Allowed Prov",
                "ohash": "ohash_1",
                "resolution": "1080p",
            },
            {
                "title": "Forbidden Entry",
                "provider_name": "Forbidden Prov",
                "ohash": "ohash_2",
                "resolution": "1080p",
            },
        ]
    }
    response = client.post("/p2p/library/reconcile", headers=headers, json=payload)
    assert response.status_code == 200
    data = response.json()

    # Forbidden entry should be filtered out from missing list
    # Both are not in local db, so allowed one goes to missing, forbidden one is ignored
    missing_titles = [item["title"] for item in data["missing_items"]]
    assert "Allowed Entry" in missing_titles
    assert "Forbidden Entry" not in missing_titles


# ==========================================
# 5. P2P NODE MANAGEMENT TESTS
# ==========================================


def test_crud_peer_nodes():
    # 1. Create
    payload = {
        "name": "Node X",
        "peer_url": "http://nodex.com",
        "outbound_key": "out_x",
        "inbound_token": "in_x",
        "recipe_sync_mode": "auto_merge",
        "sync_schedule": "daily",
        "library_scope": "all_entries",
    }
    response = client.post("/p2p/nodes", json=payload)
    assert response.status_code == 200
    node_id = response.json()["id"]
    assert response.json()["name"] == "Node X"
    assert response.json()["status"] == "inactive"

    # 2. List
    response = client.get("/p2p/nodes")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == node_id

    # 3. Update
    update_payload = {"status": "active", "sync_schedule": "weekly"}
    response = client.put(f"/p2p/nodes/{node_id}", json=update_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "active"
    assert response.json()["sync_schedule"] == "weekly"

    # 4. Get Logs
    response = client.get(f"/p2p/nodes/{node_id}/logs")
    assert response.status_code == 200
    assert len(response.json()) == 0

    # 5. Delete
    response = client.delete(f"/p2p/nodes/{node_id}")
    assert response.status_code == 200

    response = client.get("/p2p/nodes")
    assert response.json() == []


@patch("celery_app.celery_app.send_task")
def test_trigger_peer_sync_endpoint(mock_send_task):
    db = TestSessionLocal()
    peer = PeerNode(
        id=1,
        name="Peer to Sync",
        peer_url="http://peersync.local",
        outbound_key="key",
        inbound_token="token",
        allowed_providers=[],
    )
    db.add(peer)
    db.commit()
    db.close()

    mock_send_task.return_value = MagicMock(id="celery_task_id_123")

    response = client.post("/p2p/nodes/1/sync")
    assert response.status_code == 200
    assert "celery_task_id_123" in response.json()["task_id"]
    mock_send_task.assert_called_with("tasks.p2p_tasks.sync_with_peer_task", args=[1])


@pytest.mark.anyio
@patch("httpx.AsyncClient.get")
async def test_test_peer_connection_endpoint_success(mock_get):
    db = TestSessionLocal()
    peer = PeerNode(
        id=1,
        name="Test Conn Peer",
        peer_url="http://testconn.local",
        outbound_key="key",
        inbound_token="token",
        status="inactive",
        allowed_providers=[],
    )
    db.add(peer)
    db.commit()
    db.close()

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "online",
        "peer_name": "Test Conn Peer",
    }
    mock_get.return_value = mock_response

    # Need to run with async-compatible test client or invoke router function directly
    # Using TestClient async/await handling is fine
    response = client.post("/p2p/nodes/1/test-connection")
    assert response.status_code == 200
    assert response.json()["connected"] is True

    # Assert status updated to active
    db = TestSessionLocal()
    db_node = db.query(PeerNode).filter(PeerNode.id == 1).first()
    assert db_node.status == "active"
    db.close()


# ==========================================
# 6. CELERY SYNC BACKGROUND TASK TESTS
# ==========================================


@patch("requests.post")
@patch("requests.get")
def test_sync_with_peer_task_success(mock_get, mock_post):
    db = TestSessionLocal()
    # 1. Setup local data
    peer = PeerNode(
        id=1,
        name="Remote Peer",
        peer_url="http://remote.local",
        outbound_key="out_key",
        inbound_token="in_key",
        recipe_sync_mode="auto_merge",
        library_scope="all_entries",
        allowed_providers=[],
    )
    db.add(peer)

    provider = Provider(id=1, name="Local Prov", base_url="https://local.com")
    db.add(provider)

    local_entry = LibraryEntry(
        id=1,
        provider_id=1,
        title="Video Local",
        file_path="/path/video.mp4",
        ohash="local_hash_1",
        resolution="720p",
        tags=["a"],
        performers=["Art"],
    )
    db.add(local_entry)
    db.commit()
    db.close()

    # 2. Setup mock responses
    # Ping
    ping_resp = MagicMock()
    ping_resp.status_code = 200
    ping_resp.json.return_value = {"status": "online", "peer_name": "Remote Peer"}

    # Pull
    pull_resp = MagicMock()
    pull_resp.status_code = 200
    pull_resp.json.return_value = {
        "providers": [{"name": "Remote Prov", "base_url": "https://remote-prov.com"}],
        "recipes": [{"provider_name": "Remote Prov", "css_selectors": {"title": "h1"}}],
    }

    # Push
    push_resp = MagicMock()
    push_resp.status_code = 200

    # Reconcile returns a better resolution (1080p) and new tags/performers for local_hash_1
    reconcile_resp = MagicMock()
    reconcile_resp.status_code = 200
    reconcile_resp.json.return_value = {
        "metadata_updates": [
            {
                "ohash": "local_hash_1",
                "better_resolution": "1080p",
                "new_tags": ["b", "c"],
                "new_performers": ["Art", "Art2"],
            }
        ],
        "missing_items": [],
    }

    mock_get.side_effect = [ping_resp]
    mock_post.side_effect = [pull_resp, push_resp, reconcile_resp]

    # 3. Trigger Celery Task
    sync_with_peer_task(1)

    # 4. Assert local updates
    db = TestSessionLocal()

    # Local Provider & Recipe created from Pull
    new_prov = db.query(Provider).filter(Provider.name == "Remote Prov").first()
    assert new_prov is not None
    new_recipe = (
        db.query(SiteRecipe).filter(SiteRecipe.provider_id == new_prov.id).first()
    )
    assert new_recipe is not None

    # Local library entry updated with better metadata
    updated_entry = (
        db.query(LibraryEntry).filter(LibraryEntry.ohash == "local_hash_1").first()
    )
    assert updated_entry.resolution == "1080p"
    assert "b" in updated_entry.tags
    assert "c" in updated_entry.tags
    assert "Art2" in updated_entry.performers

    # Peer status active
    db_peer = db.query(PeerNode).filter(PeerNode.id == 1).first()
    assert db_peer.status == "active"

    # Log recorded
    log = db.query(PeerSyncLog).filter(PeerSyncLog.peer_id == 1).first()
    assert log is not None
    assert log.status == "success"
    assert log.recipes_synced == 1
    assert log.media_synced == 1
    db.close()


# ==========================================
# 7. TASK SCHEDULER TESTS
# ==========================================


@patch("tasks.p2p_tasks.sync_with_peer_task.delay")
def test_p2p_sync_scheduler(mock_delay):
    db = TestSessionLocal()
    # Create two nodes: one manual, one daily with next_run in past
    peer_manual = PeerNode(
        id=1,
        name="Manual Peer",
        peer_url="http://manual.local",
        outbound_key="key",
        inbound_token="tkn",
        sync_schedule="manual",
        allowed_providers=[],
    )
    db.add(peer_manual)

    peer_daily = PeerNode(
        id=2,
        name="Daily Peer",
        peer_url="http://daily.local",
        outbound_key="key",
        inbound_token="tkn",
        sync_schedule="daily",
        next_run=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1),
        allowed_providers=[],
    )
    db.add(peer_daily)
    db.commit()
    db.close()

    p2p_sync_scheduler()

    # Verify daily was called, manual was not
    mock_delay.assert_called_once_with(2)

    # Verify next_run was recalculated for Daily Peer
    db = TestSessionLocal()
    db_peer = db.query(PeerNode).filter(PeerNode.id == 2).first()
    assert db_peer.next_run is not None
    assert db_peer.next_run > datetime.now(timezone.utc).replace(tzinfo=None)
    db.close()
