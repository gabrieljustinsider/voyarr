import pytest
from unittest.mock import patch, MagicMock

# Mock out modules before import
import sys
sys.modules['models'] = MagicMock()
sys.modules['services.webhook_service'] = MagicMock()
sys.modules['db_utils'] = MagicMock()
sys.modules['database'] = MagicMock()

from tasks.ai_tasks import auto_tag_video_task, extract_frame_base64, call_ollama_vision, call_openai_vision

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
