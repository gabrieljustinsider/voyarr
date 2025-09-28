import os
import sys
import pytest
from unittest.mock import MagicMock, patch

# Crucial environment variables for tests
os.environ["DATABASE_URL"] = (
    "sqlite:///file:testdb_duplicate_merge?mode=memory&cache=shared"
)
os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

# Save original modules before mocking to avoid side-effects
orig_modules = {}
for name in ["services.scraper", "croniter"]:
    orig_modules[name] = sys.modules.get(name)
    sys.modules[name] = MagicMock()

import database
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

test_engine = create_engine(
    "sqlite:///file:testdb_duplicate_merge?mode=memory&cache=shared",
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database.engine = test_engine
database.SessionLocal = TestSessionLocal

from models import Base, LibraryEntry
from tasks.duplicate_tasks import merge_duplicate_pair


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    # Restore original modules to prevent polluting other test suites
    for name, orig in orig_modules.items():
        if orig is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = orig


@pytest.fixture
def db_session():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        # Clean up library entries after each test to keep isolation
        db.query(LibraryEntry).delete()
        db.commit()
        db.close()


@patch("os.remove")
@patch("os.path.exists", return_value=True)
def test_merge_duplicate_pair(mock_exists, mock_remove, db_session):
    # Setup provider
    from models import Provider

    test_provider = Provider(id=1, name="Test Provider", base_url="http://test.com")
    db_session.add(test_provider)
    db_session.commit()

    # Setup keep entry
    keep_entry = LibraryEntry(
        id=1,
        provider_id=1,
        title="Video Keep",
        file_path="/path/to/keep.mp4",
        tags=["action"],
        performers=["performer1"],
        studio_id=None,
        entry_metadata={"resolution": "1080p", "duration": 120},
    )
    db_session.add(keep_entry)

    # Setup delete entry
    delete_entry = LibraryEntry(
        id=2,
        provider_id=1,
        title="Video Delete",
        file_path="/path/to/delete.mp4",
        tags=["comedy", "action"],
        performers=["performer2"],
        studio_id=42,
        entry_metadata={"duration": 130, "bitrate": "5000kbps"},
    )
    db_session.add(delete_entry)
    db_session.commit()

    # Perform merge
    merge_duplicate_pair(db_session, keep_id=1, delete_id=2)
    db_session.commit()

    # Validate keep entry
    updated_keep = db_session.query(LibraryEntry).filter(LibraryEntry.id == 1).first()
    assert updated_keep is not None

    # Check tags merged
    assert "action" in updated_keep.tags
    assert "comedy" in updated_keep.tags
    assert len(updated_keep.tags) == 2

    # Check performers merged
    assert "performer1" in updated_keep.performers
    assert "performer2" in updated_keep.performers
    assert len(updated_keep.performers) == 2

    # Check studio transferred since keep didn't have one
    assert updated_keep.studio_id == 42

    # Check metadata shallow merge
    assert updated_keep.entry_metadata["resolution"] == "1080p"  # kept original
    assert updated_keep.entry_metadata["duration"] == 120  # kept original
    assert updated_keep.entry_metadata["bitrate"] == "5000kbps"  # copied from delete

    # Validate delete entry removed
    deleted = db_session.query(LibraryEntry).filter(LibraryEntry.id == 2).first()
    assert deleted is None

    # Validate file delete was called
    mock_exists.assert_called_with("/path/to/delete.mp4")
    mock_remove.assert_called_with("/path/to/delete.mp4")


def test_merge_duplicate_pair_invalid_ids(db_session):
    with pytest.raises(ValueError, match="One or both entries not found"):
        merge_duplicate_pair(db_session, keep_id=999, delete_id=888)
