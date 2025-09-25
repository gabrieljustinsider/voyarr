import pytest
from unittest.mock import patch, MagicMock

# Mock out modules before import
import sys
orig_modules = {}
for name in ['models', 'services.webhook_service', 'db_utils', 'database']:
    orig_modules[name] = sys.modules.get(name)
    sys.modules[name] = MagicMock()

from tasks.ai_tasks import auto_tag_video_task, extract_frame_base64, call_ollama_vision, call_openai_vision

# Restore original modules
for name, orig in orig_modules.items():
    if orig is None:
        sys.modules.pop(name, None)
    else:
        sys.modules[name] = orig

@patch("tasks.ai_tasks.subprocess.check_output")
@patch("tasks.ai_tasks.subprocess.run")
@patch("builtins.open", new_callable=MagicMock)
@patch("tasks.ai_tasks.os.remove")
def test_extract_frame_base64(mock_remove, mock_open, mock_run, mock_check_output):
    mock_check_output.return_value = b"10.0\n"
    
    mock_file = MagicMock()
    mock_file.read.return_value = b"fake_image_data"
    mock_open.return_value.__enter__.return_value = mock_file
    
    result = extract_frame_base64("/fake/path.mp4")
    
    assert result == "ZmFrZV9pbWFnZV9kYXRh" # base64 for fake_image_data
    mock_run.assert_called_once()
    mock_remove.assert_called_once()

@patch("tasks.ai_tasks.requests.post")
def test_call_ollama_vision(mock_post):
    mock_response = MagicMock()
    mock_response.json.return_value = {"response": "tag1, tag2, tag3"}
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response
    
    tags = call_ollama_vision("base64data", "http://localhost:11434")
    
    assert tags == ["tag1", "tag2", "tag3"]
    mock_post.assert_called_once()

@patch("tasks.ai_tasks.requests.post")
def test_call_openai_vision(mock_post):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "choices": [
            {"message": {"content": "tagA, tagB, tagC"}}
        ]
    }
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response
    
    tags = call_openai_vision("base64data", "fake_key")
    
    assert tags == ["tagA", "tagB", "tagC"]
    mock_post.assert_called_once()


@patch("tasks.ai_tasks.get_db_session")
@patch("tasks.ai_tasks.os.path.exists")
@patch("tasks.ai_tasks.extract_frame_base64")
@patch("tasks.ai_tasks.call_ollama_vision")
@patch("tasks.ai_tasks.WebhookService")
def test_auto_tag_video_task_success(mock_webhook, mock_call_ollama, mock_extract, mock_exists, mock_get_db):
    mock_exists.return_value = True
    mock_extract.return_value = "base64data"
    mock_call_ollama.return_value = ["tagA", "tagB"]

    # Setup database mocks
    mock_db = MagicMock()
    mock_get_db.return_value.__enter__.return_value = mock_db
    
    # Mock settings
    mock_ollama_url = MagicMock()
    mock_ollama_url.value = "http://localhost:11434"
    mock_openai_key = MagicMock()
    mock_openai_key.value = None
    
    # Mock entry
    mock_entry = MagicMock()
    mock_entry.file_path = "/path/to/video.mp4"
    mock_entry.tags = ["Existing"]
    mock_entry.id = 42

    # Query behavior: first query gets LibraryEntry, next queries get Settings
    mock_db.query.return_value.filter.return_value.first.side_effect = [
        mock_entry,       # first call for LibraryEntry
        mock_ollama_url,  # second call for ai_ollama_url
        mock_openai_key   # third call for ai_openai_key
    ]
    # Run the task
    auto_tag_video_task.run(42)
    
    # Assertions
    assert "tagA" in mock_entry.tags
    assert "tagB" in mock_entry.tags
    assert "Existing" in mock_entry.tags
    mock_db.commit.assert_called_once()
    mock_webhook.trigger.assert_called_once_with(
        "ai_tagging.completed",
        {"library_entry_id": 42, "new_tags": ["tagA", "tagB"]}
    )


@patch("tasks.ai_tasks.get_db_session")
@patch("tasks.ai_tasks.os.path.exists")
@patch("tasks.ai_tasks.extract_frame_base64")
@patch("tasks.ai_tasks.call_ollama_vision")
def test_auto_tag_video_task_retry(mock_call_ollama, mock_extract, mock_exists, mock_get_db):
    import requests
    mock_exists.return_value = True
    mock_extract.return_value = "base64data"
    
    # Raise network exception on call_ollama_vision
    exc = requests.exceptions.Timeout("Connection timed out")
    mock_call_ollama.side_effect = exc

    # Setup database mocks
    mock_db = MagicMock()
    mock_get_db.return_value.__enter__.return_value = mock_db
    
    mock_ollama_url = MagicMock()
    mock_ollama_url.value = "http://localhost:11434"
    mock_openai_key = MagicMock()
    mock_openai_key.value = None
    
    mock_entry = MagicMock()
    mock_entry.file_path = "/path/to/video.mp4"
    mock_entry.tags = []

    mock_db.query.return_value.filter.return_value.first.side_effect = [
        mock_entry,
        mock_ollama_url,
        mock_openai_key
    ]
    
    # Mock celery retry and request via patch
    from unittest.mock import PropertyMock
    with patch("celery.app.task.Task.request", new_callable=PropertyMock) as mock_request:
        mock_req = MagicMock()
        mock_req.retries = 2
        mock_request.return_value = mock_req
        
        with patch("celery.app.task.Task.retry") as mock_retry:
            mock_retry.side_effect = Exception("CeleryRetry")
            
            with pytest.raises(Exception, match="CeleryRetry"):
                auto_tag_video_task.run(42)
                
            mock_retry.assert_called_once_with(exc=exc, countdown=4) # 2 ** 2 = 4


@patch("tasks.ai_tasks.get_db_session")
@patch("tasks.ai_tasks.os.path.exists")
@patch("tasks.ai_tasks.extract_frame_base64")
@patch("tasks.ai_tasks.call_ollama_vision")
@patch("tasks.ai_tasks.WebhookService")
def test_auto_tag_video_task_fallback(mock_webhook, mock_call_ollama, mock_extract, mock_exists, mock_get_db):
    import requests
    from celery.exceptions import MaxRetriesExceededError
    mock_exists.return_value = True
    mock_extract.return_value = "base64data"
    
    # Raise MaxRetriesExceededError from Celery retry
    exc = requests.exceptions.Timeout("Connection timed out")
    mock_call_ollama.side_effect = exc

    # Setup database mocks
    mock_db = MagicMock()
    mock_get_db.return_value.__enter__.return_value = mock_db
    
    mock_ollama_url = MagicMock()
    mock_ollama_url.value = "http://localhost:11434"
    mock_openai_key = MagicMock()
    mock_openai_key.value = None
    
    mock_entry = MagicMock()
    mock_entry.file_path = "/path/to/video.mp4"
    mock_entry.tags = []
    mock_entry.id = 42


    mock_db.query.return_value.filter.return_value.first.side_effect = [
        mock_entry,
        mock_ollama_url,
        mock_openai_key
    ]
    
    # Mock celery retry and request via patch
    from unittest.mock import PropertyMock
    with patch("celery.app.task.Task.request", new_callable=PropertyMock) as mock_request:
        mock_req = MagicMock()
        mock_req.retries = 5
        mock_request.return_value = mock_req
        
        with patch("celery.app.task.Task.retry") as mock_retry:
            mock_retry.side_effect = MaxRetriesExceededError("Max retries exceeded")
            
            # The task should catch MaxRetriesExceededError and apply fallbacks
            auto_tag_video_task.run(42)
            
            assert "AI-Tagged" in mock_entry.tags
            assert "Processed" in mock_entry.tags
            mock_db.commit.assert_called_once()
            mock_webhook.trigger.assert_called_once_with(
                "ai_tagging.completed",
                {"library_entry_id": 42, "new_tags": ["AI-Tagged", "Processed"]}
            )



